// API-only spec → 直接用 @playwright/test（同 slug-policy.spec.ts 一樣）。
// ./fixtures 個 consoleGuard 係 auto fixture 兼依賴 `page`，用咗每條 test 都會
// 開多個冇用嘅 browser page。
import { test, expect, request as apiRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { APP, uid } from "./helpers";

/**
 * 補付款截圖：order id 唔算憑證，order id + 落單電話先係。
 *
 * 真 bug（修之前）：`app/api/biolink/orders/[id]/payment-proof/route.ts` 用
 * `withApi(...)` 但冇 `{ admin: true }`、冇任何 auth、冇 ownership、冇 tenant
 * scoping，直接 `prisma.order.update({ where: { id } })`。任何人撞到／攞到一個
 * PENDING order id 就可以：
 *   (a) 寫任意 attacker-controlled URL 入 paymentProof —— 之後會喺商戶後台
 *       render 做 <img src> / <a href>（admin/orders/[id]/payment-actions.tsx）；
 *   (b) 將人哋張單由 PENDING flip 去 PENDING_CONFIRMATION，塞入店主嘅
 *       「等你確認收款」queue。
 *
 * ⚠️ 呢條 spec 全部行 API（唔行 UI）：真流程要 Cloudinary 上載，CI 行唔到。
 *    要驗嘅係 route 嘅授權邏輯，API 層驗得晒。
 */

/** 一條似模似樣嘅截圖連結（/api/upload 回 Cloudinary secure_url）。 */
const PROOF_URL =
  "https://res.cloudinary.com/demo/image/upload/v1/hk-marketplace/payments/e2e-proof.jpg";

type SeededOrder = {
  slug: string;
  orderId: string;
  phone: string;
};

/** 開一間店 + 落一件貨 + 落一張 PENDING 單（冇 paymentProof）。 */
async function seedPendingOrder(
  tag: string,
  run: string,
  phone: string,
): Promise<SeededOrder> {
  const slug = `e2e-proof-${tag}-${run}`;
  const ctx: APIRequestContext = await apiRequest.newContext();
  try {
    const reg = await ctx.post(`${APP}/api/tenant/register`, {
      data: {
        name: `E2E Proof ${tag.toUpperCase()} ${run}`,
        slug,
        email: `${slug}@example.com`,
        password: "E2e-passw0rd-1234",
        whatsapp: "+85291234567",
        paymentMethods: ["fps"],
        fpsId: "91234567",
        templateId: "matcha",
      },
    });
    expect(reg.status(), `register ${slug} 應該 200`).toBe(200);
    const tenantId = (await reg.json()).data?.tenantId as string;
    expect(tenantId, "register 應該回 tenantId").toBeTruthy();

    const prod = await ctx.post(`${APP}/api/admin/products`, {
      headers: { "x-idempotency-key": `${slug}-prod` },
      data: { title: `Proof Item ${run}`, price: 128, stock: 5 },
    });
    expect(prod.status(), `${slug} 開產品應該 200`).toBe(200);
    const productId = (await prod.json()).data?.id as string;

    // 唔帶 paymentProof → DB status = PENDING
    const order = await ctx.post(`${APP}/api/biolink/orders`, {
      headers: { "x-idempotency-key": `${slug}-order` },
      data: {
        tenantId,
        items: [
          { productId, productName: `Proof Item ${run}`, qty: 1, price: 128 },
        ],
        customer: { name: `E2E ${tag.toUpperCase()}`, phone },
        delivery: { method: "meetup", address: null },
        payment: { method: "fps" },
        total: 128,
      },
    });
    expect(
      order.status(),
      `${slug} 落單應該 200，實際 ${order.status()}：${await order.text()}`,
    ).toBe(200);
    const orderJson = await order.json();
    expect(orderJson.data?.status, "冇截圖嘅單應該係 pending_payment").toBe(
      "pending_payment",
    );

    return { slug, orderId: orderJson.data.orderId as string, phone };
  } finally {
    await ctx.dispose();
  }
}

/** 完全冇 cookie / 冇 header 嘅陌生人 —— 攻擊者視角。 */
async function anonPost(orderId: string, data: Record<string, unknown>) {
  const ctx = await apiRequest.newContext();
  try {
    const res = await ctx.post(
      `${APP}/api/biolink/orders/${orderId}/payment-proof`,
      { data, failOnStatusCode: false },
    );
    return { status: res.status(), text: await res.text() };
  } finally {
    await ctx.dispose();
  }
}

/** 查返張單而家係咩 status（用公開 track endpoint，要電話先睇到）。 */
async function readStatus(orderId: string, phone: string): Promise<string> {
  const ctx = await apiRequest.newContext();
  try {
    const res = await ctx.get(
      `${APP}/api/biolink/orders/${orderId}/track?phone=${phone}`,
      { failOnStatusCode: false },
    );
    expect(res.status(), "track 應該 200").toBe(200);
    return (await res.json()).data?.status as string;
  } finally {
    await ctx.dispose();
  }
}

test.describe("補付款截圖 — ownership", () => {
  test("陌生人冇電話 → 400，張單唔准郁", async () => {
    const o = await seedPendingOrder("noph", uid(), "61110001");

    const res = await anonPost(o.orderId, { paymentProof: PROOF_URL });
    expect(res.status, `舊 code 會 200 兼真係寫咗（實際 ${res.text}）`).toBe(400);

    expect(
      await readStatus(o.orderId, o.phone),
      "張單應該仲係 PENDING，冇被 flip 入商戶確認 queue",
    ).toBe("PENDING");
  });

  test("陌生人打錯電話 → 404，張單唔准郁", async () => {
    const o = await seedPendingOrder("wrong", uid(), "61110001");

    const res = await anonPost(o.orderId, {
      paymentProof: PROOF_URL,
      phone: "69999999",
    });
    // 404 而唔係 403：唔想條 route 變成「呢個 order id 存唔存在」嘅 oracle。
    expect(res.status, `舊 code 會 200（實際 ${res.text}）`).toBe(404);

    expect(
      await readStatus(o.orderId, o.phone),
      "張單應該仲係 PENDING",
    ).toBe("PENDING");
  });

  test("真客人打啱電話 → 200，張單去到 PENDING_CONFIRMATION（control）", async () => {
    const o = await seedPendingOrder("ok", uid(), "61110001");

    const res = await anonPost(o.orderId, {
      paymentProof: PROOF_URL,
      phone: o.phone,
    });
    expect(
      res.status,
      `真客人一定要入到，否則個 fix 係矯枉過正（實際 ${res.text}）`,
    ).toBe(200);

    expect(await readStatus(o.orderId, o.phone)).toBe("PENDING_CONFIRMATION");
  });

  test("攻擊者狂試錯電話，鎖唔死真客人", async () => {
    // Regression guard：個 rate limit 一定要「電話對唔上先計數」。
    // 如果擺喺 handler 頂用 orderId 做 key，攻擊者揸住條 order id 灌爆個 bucket
    // 就可以令啱啱俾完錢嘅客人永遠上載唔到收據 —— 用個安全 fix 嚟做 DoS。
    const o = await seedPendingOrder("dos", uid(), "61110001");

    for (let i = 0; i < 12; i++) {
      await anonPost(o.orderId, {
        paymentProof: PROOF_URL,
        phone: "69999999",
      });
    }

    const res = await anonPost(o.orderId, {
      paymentProof: PROOF_URL,
      phone: o.phone,
    });
    expect(
      res.status,
      `真客人打啱電話唔可以俾人哋試錯連累（實際 ${res.text}）`,
    ).toBe(200);
  });
});
