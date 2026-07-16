export const runtime = "nodejs";

import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { ApiError, ok, withApi } from "@/lib/api/route-helpers";
import { getTenantId } from "@/lib/tenant";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new ApiError(500, "INTERNAL", "STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(key, {
    // Keep default (latest) API version for this stripe-node release.
  });
}

type Body = {
  orderId: string;
  locale?: string;
};

export const POST = withApi(async (req) => {
  // 卡收款暫時封盤（2026-07-16 商業決定）：呢條路而家用緊平台自己嘅
  // STRIPE_SECRET_KEY 收客人錢，冇 Connect、冇 payout —— 真 live 嘅話
  // 商戶啲錢會困死喺平台戶口。文案已經改晒淨賣 FPS/PayMe/AlipayHK/銀行轉帳。
  // 第日重開一定要行 Stripe Connect direct charges + Standard account
  //（錢直入商戶戶口，先撐得起「永遠 0% 佣金」）—— 詳見 docs/HANDOFF.md。
  if (process.env.ENABLE_CARD_CHECKOUT !== "true") {
    throw new ApiError(
      503,
      "FORBIDDEN",
      "Card checkout is not available. Please pay by FPS / PayMe / AlipayHK / bank transfer.",
    );
  }
  const stripe = getStripe();
  const tenantId = await getTenantId(req);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Invalid JSON body");
  }

  const orderId = (body?.orderId || "").trim();
  if (!orderId) throw new ApiError(400, "BAD_REQUEST", "orderId is required");

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
  });
  if (!order) throw new ApiError(404, "NOT_FOUND", "Order not found");

  const amounts: any = order.amounts;
  const currency = String(amounts?.currency || "HKD").toLowerCase();

  const items: any[] = Array.isArray(order.items) ? (order.items as any[]) : [];
  if (items.length === 0)
    throw new ApiError(400, "BAD_REQUEST", "Order has no items");

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(
    (it) => {
      const name = String(it?.name || it?.title || "Item");
      const unitPrice = Number(it?.unitPrice ?? it?.price);
      const quantity = Number(it?.quantity ?? it?.qty);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          `Invalid unitPrice for item: ${name}`,
        );
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          `Invalid quantity for item: ${name}`,
        );
      }

      return {
        price_data: {
          currency,
          product_data: { name },
          unit_amount: Math.round(unitPrice * 100),
        },
        quantity: Math.floor(quantity),
      };
    },
  );

  // Delivery fee from order amounts (skip if zero / free shipping)
  const deliveryFee = Number(amounts?.deliveryFee ?? 0);
  if (order.fulfillmentType === "DELIVERY" && deliveryFee > 0) {
    line_items.push({
      price_data: {
        currency,
        product_data: { name: "Delivery fee" },
        unit_amount: Math.round(deliveryFee * 100),
      },
      quantity: 1,
    });
  }

  // Apply coupon discount from order amounts
  const discount = Number(amounts?.discount ?? 0);
  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  if (discount > 0) {
    const couponName = amounts?.couponCode
      ? String(amounts.couponCode)
      : "Discount";
    const stripeCoupon = await stripe.coupons.create({
      amount_off: Math.round(discount * 100),
      currency,
      duration: "once",
      max_redemptions: 1,
      name: couponName,
    });
    discounts = [{ coupon: stripeCoupon.id }];
  }

  const locale = (body.locale || "zh-HK").trim();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin;

  const successUrl = `${baseUrl}/${locale}/orders/${orderId}?payment=success`;
  const cancelUrl = `${baseUrl}/${locale}/checkout?orderId=${orderId}&payment=cancel`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items,
    ...(discounts ? { discounts } : {}),
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      orderId,
    },
    // Force 3D Secure for all card payments (ME market compliance)
    payment_method_options: {
      card: {
        request_three_d_secure: "any",
      },
    },
  });

  // Track as a payment attempt (canonical record)
  await prisma.paymentAttempt
    .create({
      data: {
        provider: "STRIPE",
        tenantId,
        status: "CREATED",
        orderId,
        amount:
          typeof session.amount_total === "number"
            ? session.amount_total
            : null,
        currency:
          typeof session.currency === "string" ? session.currency : null,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
        lastEventType: "checkout.session.created",
        lastEvent:
          session as unknown as import("@prisma/client").Prisma.InputJsonValue,
      },
    })
    .catch(() => null);

  // Legacy fields (for backward compatibility)
  await prisma.order.update({
    where: { id: orderId },
    data: {
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : undefined,
    },
  });

  if (!session.url)
    throw new ApiError(500, "INTERNAL", "Stripe session URL missing");

  return ok(req, { url: session.url });
});
