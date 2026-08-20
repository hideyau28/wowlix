export const runtime = "nodejs";

import { ApiError, ok, withApi } from "@/lib/api/route-helpers";
import { prisma } from "@/lib/prisma";
import { isValidTransition, getTransitionError } from "@/lib/orders/status-transitions";
import { isDeadOrderStatus, restockOrderItems } from "@/lib/orders/restock";
import { getTenantId } from "@/lib/tenant";

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

function normalizeStatus(value?: string | null) {
    if (!value) return null;
    const status = value.trim().toUpperCase();
    if (!ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) {
        throw new ApiError(400, "BAD_REQUEST", `Invalid status: ${value}`);
    }
    return status as (typeof ORDER_STATUSES)[number];
}

// GET /api/orders/:id (admin)
export const GET = withApi(
    async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
        const { id } = await params;
        const tenantId = await getTenantId(_req);
        const order = await prisma.order.findFirst({
            where: { id, tenantId },
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
        });
        if (!order) {
            throw new ApiError(404, "NOT_FOUND", "Order not found");
        }
        return ok(_req, order);
    },
    { admin: true }
);

// Map status to its corresponding timestamp field
const STATUS_TIMESTAMP_MAP: Record<string, string> = {
    // New statuses
    CONFIRMED: "confirmedAt",
    PROCESSING: "processingAt",
    DELIVERED: "deliveredAt",
    // Existing statuses
    FULFILLING: "fulfillingAt",
    SHIPPED: "shippedAt",
    COMPLETED: "completedAt",
    CANCELLED: "cancelledAt",
    REFUNDED: "refundedAt",
    DISPUTED: "disputedAt",
};

const PAYMENT_STATUSES = ["pending", "uploaded", "confirmed", "rejected"] as const;

function normalizePaymentStatus(value?: string | null) {
    if (!value) return null;
    const status = value.trim().toLowerCase();
    if (!PAYMENT_STATUSES.includes(status as (typeof PAYMENT_STATUSES)[number])) {
        throw new ApiError(400, "BAD_REQUEST", `Invalid payment status: ${value}`);
    }
    return status as (typeof PAYMENT_STATUSES)[number];
}

// PATCH /api/orders/:id (admin update)
export const PATCH = withApi(
    async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
        const { id } = await params;
        const tenantId = await getTenantId(req);

        let body: any = null;
        try {
            body = await req.json();
        } catch {
            throw new ApiError(400, "BAD_REQUEST", "Invalid JSON body");
        }

        const status = normalizeStatus(body?.status);
        const paymentStatus = normalizePaymentStatus(body?.paymentStatus);
        const note = typeof body?.note === "string" ? body.note.trim() : null;
        const trackingNumber = typeof body?.trackingNumber === "string" ? body.trackingNumber.trim() : undefined;
        const cancelReason = typeof body?.cancelReason === "string" ? body.cancelReason.trim() : undefined;
        const refundReason = typeof body?.refundReason === "string" ? body.refundReason.trim() : undefined;

        // At least one field must be provided
        const hasAnyUpdate = status || paymentStatus || note !== null ||
            trackingNumber !== undefined || cancelReason !== undefined || refundReason !== undefined;
        if (!hasAnyUpdate) {
            throw new ApiError(400, "BAD_REQUEST", "At least one field is required");
        }

        // Fetch current order to validate transition
        const currentOrder = await prisma.order.findFirst({
            where: { id, tenantId },
            select: { status: true, paymentStatus: true, statusHistory: true, items: true },
        });

        if (!currentOrder) {
            throw new ApiError(404, "NOT_FOUND", "Order not found");
        }

        // Build update data
        const updateData: Record<string, any> = {};

        // Handle order status update
        if (status) {
            // Validate status transition
            if (!isValidTransition(currentOrder.status, status)) {
                throw new ApiError(400, "BAD_REQUEST", getTransitionError(currentOrder.status, status));
            }
            updateData.status = status;

            // Auto-set timestamp if this status has one and it's not already set
            const timestampField = STATUS_TIMESTAMP_MAP[status];
            if (timestampField) {
                const existing = await prisma.order.findFirst({
                    where: { id, tenantId },
                    select: { [timestampField]: true },
                });
                if (existing && existing[timestampField] === null) {
                    updateData[timestampField] = new Date();
                }
            }

            // Set paidAt when transitioning to PAID or CONFIRMED (confirms payment)
            if (status === "PAID" || status === "CONFIRMED") {
                updateData.paidAt = new Date();
            }

            // Record status history
            const history = currentOrder.statusHistory
                ? JSON.parse(currentOrder.statusHistory)
                : [];
            history.push({
                timestamp: new Date().toISOString(),
                fromStatus: currentOrder.status,
                toStatus: status,
            });
            updateData.statusHistory = JSON.stringify(history);
        }

        // Handle payment status update
        if (paymentStatus) {
            updateData.paymentStatus = paymentStatus;
        }

        // Handle note update (for rejection reason, etc.)
        if (note !== null) {
            updateData.note = note;
        }

        // Handle tracking number
        if (trackingNumber !== undefined) {
            updateData.trackingNumber = trackingNumber || null;
        }

        // Handle cancel reason
        if (cancelReason !== undefined) {
            updateData.cancelReason = cancelReason || null;
        }

        // Handle refund reason
        if (refundReason !== undefined) {
            updateData.refundReason = refundReason || null;
        }

        // 張單由生變死（CANCELLED / PAYMENT_REJECTED）就要還返落單扣走嘅貨。
        // `currentOrder.status !== status` 唔可以少：同一個 status 再 PATCH 一次
        // （撳兩下、兩個 tab、refresh 慢咗）係 no-op，唔係「又死多次」。
        const entersDeadStatus =
            !!status && isDeadOrderStatus(status) && currentOrder.status !== status;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const order = await (prisma as any).$transaction(async (tx: any) => {
            // CAS —— where 帶住「頭先驗 transition 嗰陣睇到嘅 status」。中間俾人
            // 改咗就 count===0，唔會盲寫落去。呢句同時係防雙重還貨嗰道閘：
            // CANCELLED / PAYMENT_REJECTED 係 terminal，兩個同時嘅取消只可以有
            // 一個令 status 真係由生變死，還貨嗰段就唔會行兩次。
            const result = await tx.order.updateMany({
                where: {
                    id,
                    tenantId,
                    ...(status ? { status: currentOrder.status } : {}),
                },
                data: updateData,
            });

            if (result.count === 0) {
                throw new ApiError(
                    409,
                    "CONFLICT",
                    "Order status changed by another request — reload and retry",
                );
            }

            if (entersDeadStatus) {
                await restockOrderItems(tx, tenantId, currentOrder.items);
            }

            return tx.order.findFirst({ where: { id, tenantId } });
        });

        return ok(req, order);
    },
    { admin: true }
);
