export const runtime = "nodejs";

import { ApiError, ok, withApi } from "@/lib/api/route-helpers";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/biolink/orders/[id]/payment-proof
// Attach payment proof to an existing PENDING order
//
// ⚠️ 以前呢條 route 係 `withApi(handler)` —— 冇 `{ admin: true }`、冇任何 auth、
// 冇 ownership、冇 tenant scoping，直接 `update({ where: { id } })`。即係任何人
// 撞到／攞到一個 PENDING order id 就可以：
//   (a) 寫一條任意 attacker-controlled URL 入 paymentProof —— 嗰條 URL 之後會喺
//       商戶後台 render 做 <img src> / <a href>（admin/orders/[id]/
//       payment-actions.tsx:168-170），即係 tracking beacon 或者釣魚 link；
//   (b) 將人哋間店張單由 PENDING flip 去 PENDING_CONFIRMATION，塞入店主嘅
//       「等你確認收款」queue —— 引到店主當一張未俾錢嘅單做已俾錢。
//
// 憑證用「order id + 落單電話」，唔用 session：客人啱啱俾完錢，通常冇 account，
// 迫佢登入 = 直接殺收入。呢個係本 repo 已有嘅公開訂單存取模式（見 sibling
// track/route.ts：都係要 phone match 先俾嘢）。
//
// 特登唔加 tenant 解析：`resolveTenant()`/`getTenantId()` 冇 header 就靜靜雞跌落
// DEFAULT_SLUG（lib/tenant.ts:57），加咗反而會將非 default 店嘅客人全部拒之門外
// —— 即係我哋喺 #370 先修完嗰個 bug class。Order.id 本身係 cuid 兼帶自己個
// tenantId，客人證明到佢知道「呢一張單」個電話之後，根本冇第二行掂得到，
// 跨租戶寫入結構上就唔可能。
export const POST = withApi(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id: orderId } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "Invalid JSON body");
    }

    const payload = (body ?? {}) as Record<string, unknown>;

    if (typeof payload.paymentProof !== "string" || !payload.paymentProof) {
      throw new ApiError(400, "BAD_REQUEST", "Missing paymentProof URL");
    }
    const paymentProof = payload.paymentProof.trim();

    // 電話 = 憑證。格式同 checkout 一致（8 位數字，見 biolink/orders/route.ts:131）。
    const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
    if (!/^\d{8}$/.test(phone)) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        "請輸入落單時嘅 8 位電話號碼 | Enter the 8-digit phone used at checkout",
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, phone: true },
    });

    // 舊 row 可能存咗 +852 前綴，同 track/route.ts 一樣剝走先比。
    const orderPhone = (order?.phone || "").replace(/^\+852/, "").trim();
    const phoneMatches = Boolean(order) && orderPhone === phone;

    if (!phoneMatches) {
      // ⚠️ 個 rate limit 特登擺喺呢度（電話對唔上先計數），唔喺 handler 頂。
      // 擺喺頂 = 個 bucket 用 orderId 做 key，攻擊者揸住條 order id 就可以慢慢
      // 灌爆佢，令啱啱俾完錢嘅客人**永遠**上載唔到收據（張單卡喺 PENDING，
      // 商戶當佢冇俾錢）—— 即係用個 fix 嚟做 DoS。只計失敗次數就冇呢個問題：
      // 打啱電話嘅人幾時都入到，估錯嘅人先受限。
      const limit = await rateLimit(`payment-proof-miss:${orderId}`, {
        interval: 10 * 60 * 1000,
        maxRequests: 10,
      });
      if (!limit.allowed) {
        throw new ApiError(
          429,
          "RATE_LIMITED",
          "試得太密，請稍後再試 | Too many attempts, please try again later",
        );
      }
      // 「冇呢張單」同「電話唔啱」一律同一個 404 —— 唔想條 route 變成
      // 「呢個 order id 存唔存在」嘅 oracle。
      throw new ApiError(404, "NOT_FOUND", "找不到訂單 | Order not found");
    }

    // updateMany + status 落 where：PENDING 檢查同寫入變成原子操作，
    // 唔會有「查完 PENDING → 中間俾人改咗 → 照寫」嘅 TOCTOU 窗口。
    const updated = await prisma.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: {
        paymentProof,
        paymentStatus: "uploaded",
        status: "PENDING_CONFIRMATION",
      },
    });

    if (updated.count === 0) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        "Payment proof can only be submitted for pending orders",
      );
    }

    return ok(req, {
      orderId,
      status: "pending_confirmation",
      paymentProof: true,
    });
  },
);
