export const runtime = "nodejs";

import crypto from "node:crypto";
import { customAlphabet } from "nanoid";
import { ApiError, ok, withApi } from "@/lib/api/route-helpers";
import { getProvider } from "@/lib/payments/registry";
import { checkPlanLimit, hasFeature } from "@/lib/plan";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import OrderConfirmationEmail from "@/lib/email/templates/OrderConfirmationEmail";

type DeliveryOption = {
  id: string;
  label: string;
  price: number;
  enabled: boolean;
};

const DEFAULT_DELIVERY_OPTIONS: DeliveryOption[] = [
  { id: "meetup", label: "面交", price: 0, enabled: true },
  { id: "sf-collect", label: "順豐到付", price: 0, enabled: true },
  { id: "sf-prepaid", label: "順豐寄付", price: 30, enabled: true },
];

// Legacy mapping for fulfillment type
function getFulfillmentType(methodId: string): "PICKUP" | "DELIVERY" {
  if (methodId === "meetup") return "PICKUP";
  return "DELIVERY";
}

const ROUTE = "/api/biolink/orders";

// Order number: WX + YYMMDD + - + 6-char alphanumeric nanoid
const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 6);

function generateOrderNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `WX${yy}${mm}${dd}-${nanoid()}`;
}

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

function getIdempotencyKey(req: Request) {
  return (
    req.headers.get("x-idempotency-key") ??
    req.headers.get("idempotency-key") ??
    ""
  ).trim();
}

type BioLinkOrderPayload = {
  tenantId: string;
  items: Array<{
    productId: string;
    variantId?: string;
    productName: string;
    variant: string | null;
    qty: number;
    price: number;
    image: string | null;
  }>;
  customer: { name: string; phone: string; email?: string | null };
  delivery: { method: string; address?: string | null };
  payment: { method: string };
  paymentProof: string | null;
  note: string | null;
  total: number;
  couponCode: string | null;
};

function parsePayload(body: unknown): BioLinkOrderPayload {
  if (!body || typeof body !== "object") {
    throw new ApiError(400, "BAD_REQUEST", "Invalid JSON body");
  }
  const b = body as Record<string, unknown>;

  if (typeof b.tenantId !== "string" || !b.tenantId) {
    throw new ApiError(400, "BAD_REQUEST", "Missing tenantId");
  }

  if (!Array.isArray(b.items) || b.items.length === 0) {
    throw new ApiError(400, "BAD_REQUEST", "Missing items");
  }
  for (const item of b.items) {
    if (!item || typeof item !== "object")
      throw new ApiError(400, "BAD_REQUEST", "Invalid item");
    const i = item as Record<string, unknown>;
    if (typeof i.productId !== "string")
      throw new ApiError(400, "BAD_REQUEST", "Missing item.productId");
    if (typeof i.productName !== "string")
      throw new ApiError(400, "BAD_REQUEST", "Missing item.productName");
    if (typeof i.qty !== "number" || i.qty <= 0)
      throw new ApiError(400, "BAD_REQUEST", "Invalid item.qty");
    if (typeof i.price !== "number" || i.price <= 0)
      throw new ApiError(400, "BAD_REQUEST", "Invalid item.price");
  }

  const cust = b.customer as Record<string, unknown> | undefined;
  if (!cust || typeof cust.name !== "string" || cust.name.trim().length < 2) {
    throw new ApiError(
      400,
      "BAD_REQUEST",
      "Missing or invalid customer.name (min 2 chars)",
    );
  }
  if (typeof cust.phone !== "string" || !/^\d{8}$/.test(cust.phone.trim())) {
    throw new ApiError(
      400,
      "BAD_REQUEST",
      "Missing or invalid customer.phone (8 digits)",
    );
  }

  const del = b.delivery as Record<string, unknown> | undefined;
  if (!del || typeof del.method !== "string") {
    throw new ApiError(400, "BAD_REQUEST", "Invalid delivery.method");
  }

  const pay = b.payment as Record<string, unknown> | undefined;
  if (!pay || typeof pay.method !== "string" || !getProvider(pay.method)) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid payment.method");
  }

  if (typeof b.total !== "number" || b.total <= 0) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid total");
  }

  return {
    tenantId: b.tenantId as string,
    items: b.items as BioLinkOrderPayload["items"],
    customer: {
      name: (cust.name as string).trim(),
      phone: (cust.phone as string).trim(),
      email:
        typeof cust.email === "string" && cust.email.trim()
          ? cust.email.trim()
          : null,
    },
    delivery: {
      method: del.method as string,
      address:
        typeof del.address === "string" && del.address.trim()
          ? del.address.trim()
          : null,
    },
    payment: { method: pay.method as string },
    paymentProof:
      typeof b.paymentProof === "string" && b.paymentProof.trim()
        ? b.paymentProof.trim()
        : null,
    note: typeof b.note === "string" && b.note.trim() ? b.note.trim() : null,
    total: b.total as number,
    couponCode:
      typeof b.couponCode === "string" && b.couponCode.trim()
        ? b.couponCode.trim().toUpperCase()
        : null,
  };
}

// POST /api/biolink/orders
export const POST = withApi(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Invalid JSON body");
  }

  const payload = parsePayload(body);

  // Validate tenant exists + load checkout settings
  const tenant = await prisma.tenant.findUnique({
    where: { id: payload.tenantId },
    select: {
      id: true,
      name: true,
      currency: true,
      deliveryOptions: true,
      freeShippingThreshold: true,
      fpsEnabled: true,
      fpsAccountName: true,
      fpsAccountId: true,
      fpsQrCodeUrl: true,
      paymeEnabled: true,
      paymeLink: true,
      paymeQrCodeUrl: true,
      whatsapp: true,
    },
  });

  if (!tenant) throw new ApiError(404, "NOT_FOUND", "Tenant not found");

  // Plan gating: check monthly order limit
  const orderCheck = await checkPlanLimit(tenant.id, "orders");
  if (!orderCheck.allowed) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "This store has reached its monthly order limit. Please try again later. | 店主本月訂單已滿，請稍後再試。",
    );
  }

  // Idempotency check (required)
  const idemKey = getIdempotencyKey(req);
  if (!idemKey) {
    throw new ApiError(400, "BAD_REQUEST", "Missing idempotency key");
  }
  let requestHash: string | null = null;

  {
    requestHash = sha256(
      stableStringify({ route: ROUTE, method: "POST", body: payload }),
    );

    const existing = await prisma.idempotencyKey.findFirst({
      where: {
        key: idemKey,
        route: ROUTE,
        method: "POST",
        tenantId: tenant.id,
      },
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
  }

  // Get delivery options from tenant settings
  const deliveryOptions =
    (tenant.deliveryOptions as DeliveryOption[] | null) ||
    DEFAULT_DELIVERY_OPTIONS;
  const enabledOptions = deliveryOptions.filter((o) => o.enabled);
  const selectedDelivery = enabledOptions.find(
    (o) => o.id === payload.delivery.method,
  );

  if (!selectedDelivery) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid delivery method");
  }

  // Server-side repricing: verify prices match DB
  const productIds = Array.from(new Set(payload.items.map((i) => i.productId)));
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      tenantId: tenant.id,
      active: true,
      hidden: false,
      deletedAt: null,
    },
    select: { id: true, title: true, price: true, sizes: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let serverTotal = 0;
  const repricedItems: Array<{
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
  }> = [];

  for (const item of payload.items) {
    const product = productMap.get(item.productId);
    if (!product)
      throw new ApiError(
        400,
        "BAD_REQUEST",
        `Product not found: ${item.productId}`,
      );
    const lineTotal = product.price * item.qty;
    serverTotal += lineTotal;
    const variantDisplay = item.variant
      ? item.variant.replace(/\|/g, " · ")
      : null;
    repricedItems.push({
      productId: item.productId,
      name: `${product.title}${variantDisplay ? ` · ${variantDisplay}` : ""}`,
      unitPrice: product.price,
      quantity: item.qty,
    });
  }

  // Allow small rounding difference
  if (Math.abs(serverTotal - payload.total) > 1) {
    throw new ApiError(400, "BAD_REQUEST", "Total mismatch (server repriced)");
  }

  // Calculate delivery fee
  let deliveryFee = selectedDelivery.price || 0;
  if (
    tenant.freeShippingThreshold &&
    serverTotal >= tenant.freeShippingThreshold
  ) {
    deliveryFee = 0;
  }

  // Server-side coupon validation (if provided)
  let couponDiscount = 0;
  let validatedCouponCode: string | null = null;

  if (payload.couponCode) {
    const couponAllowed = await hasFeature(tenant.id, "coupon");
    if (couponAllowed) {
      const coupon = await prisma.coupon.findFirst({
        where: { code: payload.couponCode, tenantId: tenant.id },
      });
      if (coupon && coupon.active) {
        const notExpired =
          !coupon.expiresAt || coupon.expiresAt.getTime() >= Date.now();
        const withinLimit =
          coupon.maxUsage === null || coupon.usageCount < coupon.maxUsage;
        const meetsMin =
          coupon.minOrder === null || serverTotal >= coupon.minOrder;

        if (notExpired && withinLimit && meetsMin) {
          if (coupon.discountType === "PERCENTAGE") {
            couponDiscount = serverTotal * (coupon.discountValue / 100);
          } else if (coupon.code.toUpperCase() === "FREESHIP") {
            couponDiscount = Math.min(deliveryFee, coupon.discountValue);
          } else {
            couponDiscount = coupon.discountValue;
          }
          const maxDiscount = serverTotal + deliveryFee;
          if (couponDiscount > maxDiscount) couponDiscount = maxDiscount;
          validatedCouponCode = coupon.code;
          // ⚠️ 唔喺度 increment usageCount —— 落單 transaction 未開，一件斷貨
          // rollback 咗張單，個 usage 一樣照入數。真正 increment 喺 tx 入面，
          // 用一句有 maxUsage / expiry guard 嘅原子 UPDATE（同 /api/orders 一致）。
        }
      }
    }
  }

  const orderNumber = generateOrderNumber();
  const totalWithDelivery = Math.max(
    0,
    serverTotal + deliveryFee - couponDiscount,
  );

  // Atomic: stock deduction + order creation in a single transaction
  const order = await (prisma as any).$transaction(async (tx: any) => {
    // Single-variant stock deduction (updateMany with gte guard).
    // ⚠️ 租戶隔離：where 一定要同時鎖 tenantId + productId —— 只驗 productId
    // 屬本店（repricing 嗰度）但唔 scope variantId 嘅話，攻擊者可用本店真
    // productId 夾帶人哋店（或本店另一件貨）嘅 variantId 跨租戶／跨產品扣庫存。
    // 加咗之後：任何 mismatch → count===0 → 統一 400（同「庫存不足」同一句，
    // 唔做存在性 oracle），原子 guard 一步過驗 ownership + stock，冇 TOCTOU。
    for (const item of payload.items) {
      if (!item.variantId) continue;

      const result = await tx.productVariant.updateMany({
        where: {
          id: item.variantId,
          tenantId: tenant.id,
          productId: item.productId,
          stock: { gte: item.qty },
        },
        data: { stock: { decrement: item.qty } },
      });
      if (result.count === 0) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          `INSUFFICIENT_STOCK: 庫存不足 — ${item.productName}`,
        );
      }

      // Deactivate variant if stock hits zero（同樣 scope tenantId + productId）
      await tx.productVariant.updateMany({
        where: {
          id: item.variantId,
          tenantId: tenant.id,
          productId: item.productId,
          stock: { lte: 0 },
        },
        data: { active: false },
      });
    }

    // Dual-variant stock deduction（JSONB sizes）
    //
    // ⚠️ 舊 code 攞嘅 `product.sizes` 係 transaction 外面嗰個 findMany 讀返嚟嘅
    // snapshot，喺 tx 入面 in-place mutate 再成舊 blob 寫返 —— 兩張同時嘅單
    // 兩邊都讀到 qty 5，兩邊都寫 4，賣咗兩件淨係扣咗一件（lost update）。
    // 而家：喺 tx 入面 SELECT ... FOR UPDATE 重讀，鎖住行到 commit 為止，
    // immutable 砌一個新 blob 再寫。同一張單有多件同款貨時，第二次重讀會見到
    // 自己 tx 未 commit 嘅寫入，扣數會累加，啱。
    //
    // 落鎖次序按 productId 排 —— 兩張單各自鎖唔同次序嘅話會死鎖。
    const dualItems = payload.items
      .filter((i) => !i.variantId && !!i.variant && i.variant.includes("|"))
      .slice()
      .sort((a, b) => a.productId.localeCompare(b.productId));

    for (const item of dualItems) {
      const locked = (await tx.$queryRaw`
        SELECT "sizes" FROM "Product"
        WHERE "id" = ${item.productId} AND "tenantId" = ${tenant.id}
        FOR UPDATE
      `) as Array<{ sizes: unknown }>;

      const sizes = locked[0]?.sizes as Record<string, unknown> | null;
      if (!sizes || !("dimensions" in sizes) || !("combinations" in sizes))
        continue;

      const combinations = (
        sizes as {
          combinations: Record<string, { qty: number; status: string }>;
        }
      ).combinations;
      const combo = combinations[item.variant!];
      if (!combo || combo.qty < item.qty) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          `INSUFFICIENT_STOCK: ${item.variant!.replace(/\|/g, " · ")} 庫存不足`,
        );
      }

      const nextQty = combo.qty - item.qty;
      const nextSizes = {
        ...sizes,
        combinations: {
          ...combinations,
          [item.variant!]: {
            ...combo,
            qty: nextQty,
            status: nextQty === 0 ? "hidden" : combo.status,
          },
        },
      };

      // where 加返 tenantId —— 唔好淨係靠上面個 findMany 嘅 scope（latent hole）。
      await tx.product.updateMany({
        where: { id: item.productId, tenantId: tenant.id },
        data: { sizes: nextSizes as object },
      });
    }

    // Create order — set paymentStatus based on whether proof was uploaded
    const hasProof = !!payload.paymentProof;
    const created = await tx.order.create({
      data: {
        tenantId: tenant.id,
        orderNumber,
        customerName: payload.customer.name,
        phone: payload.customer.phone,
        email: payload.customer.email || null,
        items: repricedItems,
        amounts: {
          subtotal: serverTotal,
          deliveryFee,
          discount: couponDiscount > 0 ? couponDiscount : undefined,
          couponCode: validatedCouponCode || undefined,
          total: totalWithDelivery,
          currency: tenant.currency || "HKD",
        },
        fulfillmentType: getFulfillmentType(payload.delivery.method),
        fulfillmentAddress:
          getFulfillmentType(payload.delivery.method) === "DELIVERY"
            ? {
                line1: selectedDelivery.label,
                notes: payload.delivery.method,
                address: payload.delivery.address,
              }
            : undefined,
        status: hasProof ? "PENDING_CONFIRMATION" : "PENDING",
        paymentMethod: payload.payment.method,
        paymentProof: payload.paymentProof,
        paymentStatus: hasProof ? "uploaded" : "pending",
        note: payload.note || null,
      },
    });

    // Coupon usage —— 喺 tx 入面用一句原子 UPDATE 收 maxUsage / expiry。
    // 上面 validation 嗰度係 check-then-act：兩張單同時見到 usageCount 9 < 10，
    // 兩張都用得，最後 count 變 11。呢句 WHERE 帶住 guard，超額嗰張會 count===0
    // → 拒單兼連張單一齊 rollback（同 /api/orders 一致）。
    if (validatedCouponCode) {
      const updated = await tx.$executeRaw`
        UPDATE "Coupon"
        SET "usageCount" = "usageCount" + 1
        WHERE "code" = ${validatedCouponCode}
          AND "tenantId" = ${tenant.id}
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

  // Fire-and-forget order confirmation email. Skip silently when no email
  // captured. Tenant is already in scope so no extra DB hit needed.
  if (order.email) {
    void sendEmail({
      to: order.email,
      subject: `Order ${order.orderNumber || order.id} confirmed${
        tenant.name ? ` · ${tenant.name}` : ""
      }`,
      template: OrderConfirmationEmail({
        customerName: order.customerName,
        orderNumber: order.orderNumber || order.id,
        items: Array.isArray(order.items) ? (order.items as any[]) : [],
        amounts: order.amounts as any,
        awaitingConfirmation: !!payload.paymentProof,
        brand: tenant.name ? { name: tenant.name } : undefined,
      }),
    }).catch((error) => {
      console.error("[biolink order email] send failed:", error);
    });
  }

  // Build response
  const hasPaymentProof = !!payload.paymentProof;
  const response: Record<string, unknown> = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: hasPaymentProof ? "pending_confirmation" : "pending_payment",
    paymentProof: hasPaymentProof,
  };

  // Query PaymentMethod table for payment transfer info (new merchants)
  const paymentMethodRecord =
    payload.payment.method === "fps" || payload.payment.method === "payme"
      ? await prisma.paymentMethod.findFirst({
          where: {
            tenantId: tenant.id,
            type: payload.payment.method,
            active: true,
          },
          select: { qrImage: true, accountInfo: true },
        })
      : null;

  if (payload.payment.method === "fps") {
    if (paymentMethodRecord) {
      response.fpsInfo = {
        accountName: null,
        id: paymentMethodRecord.accountInfo,
        qrCode: paymentMethodRecord.qrImage,
      };
    } else if (tenant.fpsEnabled) {
      response.fpsInfo = {
        accountName: tenant.fpsAccountName,
        id: tenant.fpsAccountId,
        qrCode: tenant.fpsQrCodeUrl,
      };
    }
  }

  if (payload.payment.method === "payme") {
    if (paymentMethodRecord) {
      response.paymeInfo = {
        link: paymentMethodRecord.accountInfo,
        qrCode: paymentMethodRecord.qrImage,
      };
    } else if (tenant.paymeEnabled) {
      response.paymeInfo = {
        link: tenant.paymeLink,
        qrCode: tenant.paymeQrCodeUrl,
      };
    }
  }

  response.whatsapp = tenant.whatsapp;
  response.storeName = tenant.name;
  response.total = totalWithDelivery;

  // Save idempotency record
  if (requestHash) {
    await prisma.idempotencyKey.create({
      data: {
        tenantId: tenant.id,
        key: idemKey,
        route: ROUTE,
        method: "POST",
        requestHash,
        status: 200,
        responseJson: response as any,
      },
    });
  }

  return ok(req, response);
});
