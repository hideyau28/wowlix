export const runtime = "nodejs";

import crypto from "node:crypto";
import { customAlphabet } from "nanoid";
import { ApiError, ok, withApi } from "@/lib/api/route-helpers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { saveReceiptHtml } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";
import OrderConfirmationEmail from "@/lib/email/templates/OrderConfirmationEmail";
import { getTenantId } from "@/lib/tenant";
import { checkPlanLimit } from "@/lib/plan";

const ROUTE = "/api/orders";

// Shipping fee constants
const DEFAULT_SHIPPING_FEE = 40;
const DEFAULT_FREE_SHIPPING_THRESHOLD = 600;
const OUTLYING_ISLANDS_SURCHARGE = 20;

// Order number: WX + YYMMDD + - + 6-char alphanumeric nanoid
const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 6);

function generateOrderNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `WX${yy}${mm}${dd}-${nanoid()}`;
}

const ORDER_STATUSES = [
  // New status flow
  "PENDING",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "PAYMENT_REJECTED",
  // Legacy statuses
  "PAID",
  "FULFILLING",
  "DISPUTED",
] as const;

function stableStringify(input: unknown): string {
  const seen = new WeakSet<object>();

  const norm = (v: any): any => {
    if (v === null || v === undefined) return v;
    if (typeof v !== "object") return v;

    if (seen.has(v)) return "[Circular]";
    seen.add(v);

    if (Array.isArray(v)) return v.map(norm);

    const out: Record<string, any> = {};
    for (const k of Object.keys(v).sort()) out[k] = norm(v[k]);
    return out;
  };

  return JSON.stringify(norm(input));
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function normalizeStatus(value?: string | null) {
  if (!value) return null;
  const status = value.trim().toUpperCase();
  if (!ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) {
    throw new ApiError(400, "BAD_REQUEST", `Invalid status: ${value}`);
  }
  return status as (typeof ORDER_STATUSES)[number];
}

type DeliveryOption = {
  id: string;
  label: string;
  price: number;
  enabled: boolean;
};

type CreateOrderPayload = {
  customerName: string;
  phone: string;
  email?: string | null;
  userId?: string | null; // Link to user account if logged in
  items: Array<{
    productId: string;
    variantId?: string;
    name: string;
    unitPrice: number;
    quantity: number;
  }>;
  amounts: {
    subtotal: number;
    discount?: number;
    deliveryFee?: number;
    total: number;
    currency: string;
    couponCode?: string;
  };
  fulfillment: {
    type: "pickup" | "delivery";
    deliveryMethod?: string; // Delivery option ID from tenant's deliveryOptions
    address?: {
      line1: string;
      district?: string;
      region?: string;
      unit?: string;
      notes?: string;
    };
  };
  note?: string | null;
  // Local payment fields (FPS/PayMe/Alipay)
  paymentMethod?: string | null;
  paymentProof?: string | null;
};

function assertNonEmptyString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(400, "BAD_REQUEST", `Missing or invalid ${field}`);
  }
}

function assertPositiveNumber(value: unknown, field: string) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    throw new ApiError(400, "BAD_REQUEST", `Missing or invalid ${field}`);
  }
}

function assertPositiveInt(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ApiError(400, "BAD_REQUEST", `Missing or invalid ${field}`);
  }
}

function getIdempotencyKey(req: Request) {
  return (
    req.headers.get("x-idempotency-key") ??
    req.headers.get("idempotency-key") ??
    ""
  ).trim();
}

function parseCreatePayload(body: any): CreateOrderPayload {
  if (!body || typeof body !== "object") {
    throw new ApiError(400, "BAD_REQUEST", "Invalid JSON body");
  }

  assertNonEmptyString(body.customerName, "customerName");
  assertNonEmptyString(body.phone, "phone");

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new ApiError(400, "BAD_REQUEST", "Missing or invalid items");
  }

  for (const [idx, item] of body.items.entries()) {
    if (!item || typeof item !== "object") {
      throw new ApiError(400, "BAD_REQUEST", `Invalid items[${idx}]`);
    }
    assertNonEmptyString(item.productId, `items[${idx}].productId`);
    assertNonEmptyString(item.name, `items[${idx}].name`);
    assertPositiveNumber(item.unitPrice, `items[${idx}].unitPrice`);
    assertPositiveInt(item.quantity, `items[${idx}].quantity`);
  }

  if (!body.amounts || typeof body.amounts !== "object") {
    throw new ApiError(400, "BAD_REQUEST", "Missing or invalid amounts");
  }

  assertPositiveNumber(body.amounts.subtotal, "amounts.subtotal");
  if (body.amounts.discount !== undefined) {
    assertPositiveNumber(body.amounts.discount, "amounts.discount");
  }
  if (body.amounts.deliveryFee !== undefined) {
    assertPositiveNumber(body.amounts.deliveryFee, "amounts.deliveryFee");
  }
  assertPositiveNumber(body.amounts.total, "amounts.total");

  const currencyRaw = body.amounts.currency;
  if (typeof currencyRaw !== "string" || currencyRaw.trim().length === 0) {
    throw new ApiError(
      400,
      "BAD_REQUEST",
      "Missing or invalid amounts.currency",
    );
  }
  const currency = currencyRaw.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ApiError(
      400,
      "BAD_REQUEST",
      "amounts.currency must be 3 letters",
    );
  }
  const defaultCurrencyRaw = process.env.DEFAULT_CURRENCY;
  if (defaultCurrencyRaw) {
    const defaultCurrency = defaultCurrencyRaw.trim().toUpperCase();
    if (defaultCurrency && currency !== defaultCurrency) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        `amounts.currency must be ${defaultCurrency}`,
      );
    }
  }

  if (!body.fulfillment || typeof body.fulfillment !== "object") {
    throw new ApiError(400, "BAD_REQUEST", "Missing or invalid fulfillment");
  }

  if (
    body.fulfillment.type !== "pickup" &&
    body.fulfillment.type !== "delivery"
  ) {
    throw new ApiError(
      400,
      "BAD_REQUEST",
      "fulfillment.type must be pickup or delivery",
    );
  }

  if (body.fulfillment.type === "delivery") {
    if (
      !body.fulfillment.address ||
      typeof body.fulfillment.address !== "object"
    ) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        "fulfillment.address is required for delivery",
      );
    }
    assertNonEmptyString(
      body.fulfillment.address.line1,
      "fulfillment.address.line1",
    );
  }

  // Parse coupon code from amounts
  const couponCode =
    typeof body.amounts?.couponCode === "string" &&
    body.amounts.couponCode.trim().length > 0
      ? body.amounts.couponCode.trim().toUpperCase()
      : undefined;

  return {
    customerName: body.customerName.trim(),
    phone: body.phone.trim(),
    email:
      typeof body.email === "string" && body.email.trim().length > 0
        ? body.email.trim()
        : undefined,
    userId:
      typeof body.userId === "string" && body.userId.trim().length > 0
        ? body.userId.trim()
        : undefined,
    items: body.items,
    amounts: {
      ...body.amounts,
      currency,
      couponCode,
    },
    fulfillment: body.fulfillment,
    note:
      typeof body.note === "string" && body.note.trim().length > 0
        ? body.note.trim()
        : undefined,
    paymentMethod:
      typeof body.paymentMethod === "string" &&
      body.paymentMethod.trim().length > 0
        ? body.paymentMethod.trim()
        : undefined,
    paymentProof:
      typeof body.paymentProof === "string" &&
      body.paymentProof.trim().length > 0
        ? body.paymentProof.trim()
        : undefined,
  };
}

function amountMatches(actual: number, expected: number) {
  if (Number.isInteger(actual) && Number.isInteger(expected)) {
    return actual === expected;
  }
  return Math.abs(actual - expected) < 0.0001;
}

type RepricedOrder = {
  items: CreateOrderPayload["items"];
  amounts: CreateOrderPayload["amounts"];
};

// Calculate shipping fee using hardcoded defaults (legacy fallback for maysshop)
function calculateShippingFeeLegacy(subtotal: number, region?: string): number {
  const isOutlyingIslands = region === "離島";
  const qualifiesForFreeShipping = subtotal >= DEFAULT_FREE_SHIPPING_THRESHOLD;
  const baseShipping = qualifiesForFreeShipping ? 0 : DEFAULT_SHIPPING_FEE;
  const islandSurcharge = isOutlyingIslands ? OUTLYING_ISLANDS_SURCHARGE : 0;
  return baseShipping + islandSurcharge;
}

// Resolve delivery fee: tenant deliveryOptions → StoreSettings → legacy hardcoded
async function resolveDeliveryFee(
  tenantId: string,
  subtotal: number,
  deliveryMethod?: string,
  region?: string,
): Promise<number> {
  // 1. Try tenant's deliveryOptions JSON (matches delivery option ID from client)
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { deliveryOptions: true, freeShippingThreshold: true },
  });

  if (deliveryMethod && tenant?.deliveryOptions) {
    const options = tenant.deliveryOptions as DeliveryOption[];
    const matched = options.find((o) => o.id === deliveryMethod && o.enabled);
    if (matched) {
      let fee = matched.price;
      if (
        tenant.freeShippingThreshold != null &&
        subtotal >= tenant.freeShippingThreshold
      ) {
        fee = 0;
      }
      return fee;
    }
  }

  // 2. Fallback: StoreSettings
  const ss = await prisma.storeSettings.findFirst({
    where: { tenantId },
    select: {
      shippingFee: true,
      freeShippingThreshold: true,
      homeDeliveryFee: true,
      homeDeliveryFreeAbove: true,
      homeDeliveryIslandExtra: true,
    },
  });

  if (ss) {
    const baseFee =
      ss.homeDeliveryFee ?? ss.shippingFee ?? DEFAULT_SHIPPING_FEE;
    const freeAbove =
      ss.homeDeliveryFreeAbove ??
      ss.freeShippingThreshold ??
      DEFAULT_FREE_SHIPPING_THRESHOLD;
    const islandExtra =
      ss.homeDeliveryIslandExtra ?? OUTLYING_ISLANDS_SURCHARGE;
    const isOutlyingIslands = region === "離島";
    const free = subtotal >= freeAbove;
    return (free ? 0 : baseFee) + (isOutlyingIslands ? islandExtra : 0);
  }

  // 3. Final fallback: legacy hardcoded constants (keeps maysshop unaffected)
  return calculateShippingFeeLegacy(subtotal, region);
}

async function repriceOrder(
  payload: CreateOrderPayload,
  tenantId: string,
): Promise<RepricedOrder> {
  const productIds = Array.from(
    new Set(payload.items.map((item) => item.productId)),
  );
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      tenantId,
      active: true,
      hidden: false,
      deletedAt: null,
    },
    select: { id: true, title: true, price: true, active: true },
  });

  const productMap = new Map(products.map((product) => [product.id, product]));

  for (const productId of productIds) {
    if (!productMap.has(productId)) {
      throw new ApiError(400, "BAD_REQUEST", "Product not found");
    }
  }

  let subtotal = 0;
  const repricedItems = payload.items.map((item) => {
    const product = productMap.get(item.productId)!;
    if (product.active === false) {
      throw new ApiError(400, "BAD_REQUEST", "Product not available");
    }
    const unitPrice = product.price;
    const lineTotal = unitPrice * item.quantity;
    subtotal += lineTotal;
    return {
      ...item,
      name: product.title,
      unitPrice,
    };
  });

  // Calculate shipping fee server-side (don't trust client)
  let deliveryFee = 0;
  if (payload.fulfillment.type === "delivery") {
    const region =
      payload.fulfillment.address?.region ||
      payload.fulfillment.address?.district;
    deliveryFee = await resolveDeliveryFee(
      tenantId,
      subtotal,
      payload.fulfillment.deliveryMethod,
      region,
    );
  }

  // Server-side coupon validation (don't trust client discount)
  let discount = 0;
  let validatedCouponCode: string | undefined;
  if (payload.amounts.couponCode) {
    const coupon = await prisma.coupon.findFirst({
      where: { code: payload.amounts.couponCode, tenantId, active: true },
    });
    if (coupon) {
      const notExpired =
        !coupon.expiresAt || coupon.expiresAt.getTime() >= Date.now();
      const withinUsage =
        coupon.maxUsage === null || coupon.usageCount < coupon.maxUsage;
      const meetsMinOrder =
        coupon.minOrder === null || subtotal >= coupon.minOrder;

      if (notExpired && withinUsage && meetsMinOrder) {
        if (coupon.discountType === "PERCENTAGE") {
          discount = subtotal * (coupon.discountValue / 100);
        } else {
          if (coupon.code.toUpperCase() === "FREESHIP") {
            discount = Math.min(deliveryFee, coupon.discountValue);
          } else {
            discount = coupon.discountValue;
          }
        }
        const maxDiscount = subtotal + deliveryFee;
        if (discount > maxDiscount) discount = maxDiscount;
        validatedCouponCode = coupon.code;
      }
    }
    // If coupon invalid, discount stays 0 — don't block order, just ignore bad coupon
  } else if (payload.amounts.discount !== undefined) {
    // No coupon code but client sent discount — ignore it (server controls discount)
    discount = 0;
  }

  const total = subtotal + deliveryFee - discount;

  const computedAmounts: CreateOrderPayload["amounts"] = {
    subtotal,
    total,
    currency: payload.amounts.currency,
  };

  if (discount > 0) {
    computedAmounts.discount = discount;
  }
  if (validatedCouponCode) {
    computedAmounts.couponCode = validatedCouponCode;
  }
  if (deliveryFee > 0) {
    computedAmounts.deliveryFee = deliveryFee;
  }

  if (!amountMatches(payload.amounts.subtotal, computedAmounts.subtotal)) {
    throw new ApiError(400, "BAD_REQUEST", "subtotal mismatch (repriced)");
  }

  // Validate client-sent delivery fee matches server calculation
  if (
    payload.amounts.deliveryFee !== undefined &&
    !amountMatches(payload.amounts.deliveryFee, deliveryFee)
  ) {
    throw new ApiError(400, "BAD_REQUEST", "deliveryFee mismatch (repriced)");
  }

  if (!amountMatches(payload.amounts.total, computedAmounts.total)) {
    throw new ApiError(400, "BAD_REQUEST", "total mismatch (repriced)");
  }

  return {
    items: repricedItems,
    amounts: computedAmounts,
  };
}

const PAGE_SIZE = 20;

// GET /api/orders (admin)
export const GET = withApi(
  async (req) => {
    const tenantId = await getTenantId(req);
    const { searchParams } = new URL(req.url);
    const status = normalizeStatus(searchParams.get("status"));
    const search = searchParams.get("q")?.trim() || null;
    const pageParam = searchParams.get("page");
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const skip = (page - 1) * PAGE_SIZE;

    // Build where clause
    const where: Prisma.OrderWhereInput = {};
    where.tenantId = tenantId;
    if (status) {
      where.status = status;
    }
    if (search) {
      // Search by orderNumber or phone (case-insensitive)
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const whereClause = Object.keys(where).length > 0 ? where : undefined;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: PAGE_SIZE,
        include: {
          paymentAttempts: {
            select: {
              id: true,
              provider: true,
              status: true,
              amount: true,
              currency: true,
              stripeCheckoutSessionId: true,
              stripePaymentIntentId: true,
              stripeChargeId: true,
              failureCode: true,
              failureMessage: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      prisma.order.count({ where: whereClause }),
    ]);

    return ok(req, { orders, total, page, pageSize: PAGE_SIZE });
  },
  { admin: true },
);

// POST /api/orders (customer create + idempotency)
export const POST = withApi(async (req) => {
  const tenantId = await getTenantId(req);

  // Plan gating: check monthly order limit
  const orderCheck = await checkPlanLimit(tenantId, "orders");
  if (!orderCheck.allowed) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "This store has reached its monthly order limit. Please try again later. | 店主本月訂單已滿，請稍後再試。",
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Invalid JSON body");
  }

  const payload = parseCreatePayload(body);
  const repriced = await repriceOrder(payload, tenantId);

  const idemKey = getIdempotencyKey(req);
  if (!idemKey) {
    throw new ApiError(400, "BAD_REQUEST", "Missing x-idempotency-key");
  }

  const requestHash = sha256(
    stableStringify({ route: ROUTE, method: "POST", body: payload }),
  );

  const existing = await prisma.idempotencyKey.findFirst({
    where: { key: idemKey, route: ROUTE, method: "POST", tenantId },
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new ApiError(
        409,
        "CONFLICT",
        "Idempotency key already used with different payload",
      );
    }
    return ok(req, existing.responseJson);
  }

  const orderNumber = generateOrderNumber();

  // Determine payment status and order status based on whether proof is uploaded
  const hasPaymentProof = !!payload.paymentProof;
  const paymentStatus = hasPaymentProof ? "uploaded" : "pending";
  // Manual payments with proof → PENDING_CONFIRMATION (waiting for merchant to confirm)
  // Online payments (Stripe) or no proof → PENDING (waiting for payment)
  const initialOrderStatus = hasPaymentProof
    ? "PENDING_CONFIRMATION"
    : "PENDING";

  const appliedCouponCode = (repriced.amounts as any)?.couponCode;

  // Atomic transaction: stock deduction + order creation + coupon usage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await (prisma as any).$transaction(async (tx: any) => {
    // Stock deduction — updateMany with gte guard prevents race conditions
    for (const item of repriced.items) {
      if (item.variantId) {
        const result = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          throw new ApiError(
            400,
            "BAD_REQUEST",
            `INSUFFICIENT_STOCK: 庫存不足 — ${item.name}`,
          );
        }
      } else {
        const result = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          throw new ApiError(
            400,
            "BAD_REQUEST",
            `INSUFFICIENT_STOCK: 庫存不足 — ${item.name}`,
          );
        }
      }
    }

    // Create order
    const created = await tx.order.create({
      data: {
        tenantId,
        orderNumber,
        customerName: payload.customerName,
        phone: payload.phone,
        email: payload.email ?? null,
        userId: payload.userId ?? null,
        items: repriced.items,
        amounts: repriced.amounts,
        fulfillmentType:
          payload.fulfillment.type === "pickup" ? "PICKUP" : "DELIVERY",
        fulfillmentAddress:
          payload.fulfillment.type === "delivery"
            ? (payload.fulfillment.address ?? undefined)
            : undefined,
        status: initialOrderStatus,
        note: payload.note ?? null,
        paymentMethod: payload.paymentMethod ?? null,
        paymentProof: payload.paymentProof ?? null,
        paymentStatus,
      },
    });

    // Atomic coupon usage increment with guard against exceeding maxUsage / expiry
    if (appliedCouponCode) {
      const updated = await tx.$executeRaw`
                UPDATE "Coupon"
                SET "usageCount" = "usageCount" + 1
                WHERE "code" = ${appliedCouponCode}
                  AND "tenantId" = ${tenantId}
                  AND "active" = true
                  AND ("maxUsage" IS NULL OR "usageCount" < "maxUsage")
                  AND ("expiresAt" IS NULL OR "expiresAt" >= NOW())
            `;
      if (updated === 0) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          "Coupon is no longer valid (expired or usage limit reached)",
        );
      }
    }

    return created;
  });

  await saveReceiptHtml({
    id: order.id,
    customerName: order.customerName,
    phone: order.phone,
    email: order.email,
    items: Array.isArray(order.items) ? (order.items as any[]) : [],
    amounts: order.amounts as any,
    createdAt: order.createdAt,
  }).catch((error) => {
    console.error("Failed to save receipt:", error);
  });

  // Fire-and-forget order confirmation email. Skip silently when no email
  // captured. Never block the order response on delivery — Resend errors
  // shouldn't surface to the customer at checkout time.
  if (order.email) {
    const tenantBrand = await prisma.tenant
      .findUnique({
        where: { id: tenantId },
        select: { name: true },
      })
      .catch(() => null);
    void sendEmail({
      to: order.email,
      subject: `Order ${order.orderNumber || order.id} confirmed${
        tenantBrand?.name ? ` · ${tenantBrand.name}` : ""
      }`,
      template: OrderConfirmationEmail({
        customerName: order.customerName,
        orderNumber: order.orderNumber || order.id,
        items: Array.isArray(order.items) ? (order.items as any[]) : [],
        amounts: order.amounts as any,
        brand: tenantBrand?.name ? { name: tenantBrand.name } : undefined,
      }),
    }).catch((error) => {
      console.error("[order email] send failed:", error);
    });
  }

  await prisma.idempotencyKey.create({
    data: {
      tenantId,
      key: idemKey,
      route: ROUTE,
      method: "POST",
      requestHash,
      status: 200,
      responseJson: order as any,
    },
  });

  return ok(req, order);
});
