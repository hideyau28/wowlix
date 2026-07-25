"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/plan";
import { getServerTenantId } from "@/lib/tenant";
import { getSessionToken, verifyToken } from "@/lib/auth";
import {
  ORDER_ACCESS_COOKIE,
  ORDER_ACCESS_MAX_AGE,
  mintOrderGrant,
  phoneMatchesOrder,
  verifyOrderGrant,
} from "./order-access";

/**
 * 攞訂單俾確認頁 render。
 *
 * ⚠️ 以前呢個 action 係 server-to-server `fetch(${NEXT_PUBLIC_API_URL}/api/orders/${id})`
 * 淨帶 `x-admin-secret`，**冇 forward x-tenant-slug**。收嗰邊
 * （app/api/orders/[id]/route.ts:38）行 `getTenantId(_req)` —— 冇 JWT 冇 header，
 * 就靠個 internal URL 個 host 解析，而 www / localhost 都喺 DEFAULT_HOSTS，
 * 所以**永遠**解做 default 店。而且成個 page 零 ownership 檢查，攞到 order id
 * 就 render 晒客人姓名／電話／地址／貨品／金額。
 *
 * 而家直接查 prisma + `getServerTenantId()`（middleware set 嘅可信 header），
 * 順手唔再將一個 full-privilege ADMIN_SECRET 送落一版客人面頁，兼慳返一個
 * lambda round trip。
 */
export async function getOrderById(orderId: string) {
  try {
    const tenantId = await getServerTenantId();

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: {
        id: true,
        userId: true,
        orderNumber: true,
        status: true,
        customerName: true,
        phone: true,
        items: true,
        amounts: true,
        fulfillmentType: true,
        fulfillmentAddress: true,
        paymentMethod: true,
      },
    });

    if (!order) {
      return { ok: false as const, error: "Order not found" };
    }

    // 邊個先睇得全單（姓名／電話／地址／逐件貨）：
    //   ① 啱啱喺呢個瀏覽器落完單 —— checkout 派咗個簽名 grant cookie；
    //   ② 登入咗嘅會員，張單係佢自己嘅（userId 對得上，或者 session 個電話
    //      同張單個電話一樣）。
    // 兩樣都冇 = 陌生人，淨係俾佢見單號／狀態／總額。
    const cookieStore = await cookies();
    let canViewDetail = verifyOrderGrant(
      cookieStore.get(ORDER_ACCESS_COOKIE)?.value,
      tenantId,
      order.id,
    );

    if (!canViewDetail) {
      const sessionToken = await getSessionToken();
      const session = sessionToken ? await verifyToken(sessionToken) : null;
      if (session) {
        canViewDetail =
          (Boolean(order.userId) && order.userId === session.userId) ||
          phoneMatchesOrder(session.phone, order.phone);
      }
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { whatsapp: true, name: true },
    });

    return {
      ok: true as const,
      data: order,
      canViewDetail,
      tenantWhatsapp: tenant?.whatsapp ?? null,
      tenantName: tenant?.name ?? null,
      whatsappEnabled: await hasFeature(tenantId, "whatsapp"),
    };
  } catch {
    return { ok: false as const, error: "Failed to fetch order" };
  }
}

/**
 * Checkout 成功之後派 grant cookie，令啱啱俾完錢嘅客人零阻力見到全單。
 *
 * ⚠️ **唔信 client 講嘅嘢**：呢度自己再查一次張單屬唔屬於呢個 tenant、電話
 * 啱唔啱，啱先簽。client 傳個電話淨係用嚟核對，唔會直接變成憑證。
 *
 * 永遠唔 throw：checkout 個 handler 一 throw 就會跳去佢自己個 catch，出
 * 「訂單創建失敗」兼**唔跳頁** —— 單已經落咗、cart 已經清咗，客人卻卡死喺
 * checkout 頁。派唔到 grant 最多係見 summary，唔可以因為咁炸咗條收入路徑。
 * （caller 嗰邊仲有一層 client-side try/catch 兜住 action invocation 本身失敗。）
 */
export async function grantOrderAccessAfterCheckout(
  orderId: string,
  phone: string,
): Promise<void> {
  try {
    const tenantId = await getServerTenantId();

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, phone: true },
    });
    if (!order || !phoneMatchesOrder(phone, order.phone)) return;

    const grant = mintOrderGrant(tenantId, order.id);
    if (!grant) return;

    const cookieStore = await cookies();
    cookieStore.set(ORDER_ACCESS_COOKIE, grant, {
      httpOnly: true,
      sameSite: "lax", // Stripe 返嚟係 top-level GET，lax 送得到
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ORDER_ACCESS_MAX_AGE,
    });
  } catch {
    // 見上面：派唔到 grant 唔可以阻住跳頁。
  }
}
