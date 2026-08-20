export const runtime = "nodejs";

import { ApiError, ok, withApi } from "@/lib/api/route-helpers";
import { prisma } from "@/lib/prisma";
import { isValidTransition, getTransitionError } from "@/lib/orders/status-transitions";
import { getTenantId } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/orders/:id/payment - confirm or reject payment
export const PATCH = withApi(
    async (req: Request, ctx: RouteContext) => {
        const { id } = await ctx.params;
        const tenantId = await getTenantId(req);

        let body: any = null;
        try {
            body = await req.json();
        } catch {
            throw new ApiError(400, "BAD_REQUEST", "Invalid JSON body");
        }

        const action = body?.action;
        const rejectionNote = typeof body?.note === "string" ? body.note.trim() : null;

        if (action !== "confirm" && action !== "reject") {
            throw new ApiError(400, "BAD_REQUEST", "action must be 'confirm' or 'reject'");
        }

        // Fetch current order
        const currentOrder = await prisma.order.findFirst({
            where: { id, tenantId },
            select: {
                status: true,
                paymentStatus: true,
                statusHistory: true,
            },
        });

        if (!currentOrder) {
            throw new ApiError(404, "NOT_FOUND", "Order not found");
        }

        // Payment can only be confirmed/rejected if paymentStatus is "uploaded"
        if (currentOrder.paymentStatus !== "uploaded") {
            throw new ApiError(
                400,
                "BAD_REQUEST",
                `Cannot ${action} payment when payment status is '${currentOrder.paymentStatus}'`
            );
        }

        const updateData: Record<string, any> = {};

        if (action === "confirm") {
            // Confirm payment: update paymentStatus and transition order to CONFIRMED
            updateData.paymentStatus = "confirmed";
            updateData.paidAt = new Date();

            // Transition order status from PENDING/PENDING_CONFIRMATION to CONFIRMED if valid
            if (currentOrder.status === "PENDING" || currentOrder.status === "PENDING_CONFIRMATION") {
                const fromStatus = currentOrder.status;
                // PENDING_CONFIRMATION is a manual payment status; treat it like PENDING for transitions
                const canTransition = fromStatus === "PENDING_CONFIRMATION" || isValidTransition("PENDING", "CONFIRMED");
                if (!canTransition) {
                    throw new ApiError(400, "BAD_REQUEST", getTransitionError("PENDING", "CONFIRMED"));
                }
                updateData.status = "CONFIRMED";
                updateData.confirmedAt = new Date();

                // Record status history
                const history = currentOrder.statusHistory
                    ? JSON.parse(currentOrder.statusHistory)
                    : [];
                history.push({
                    timestamp: new Date().toISOString(),
                    fromStatus,
                    toStatus: "CONFIRMED",
                });
                updateData.statusHistory = JSON.stringify(history);
            }
        } else {
            // Reject payment: update paymentStatus and optionally add note
            updateData.paymentStatus = "rejected";
            if (rejectionNote) {
                updateData.note = rejectionNote;
            }
        }

        // updateMany + paymentStatus 落 where：上面個 "uploaded" 檢查同寫入變成
        // 原子操作，收返「查完 uploaded → 中間俾人 confirm 咗 → 照寫」個 TOCTOU。
        //
        // ⚠️ reject 特登**唔還庫存**。撳完「拒絕付款」張單仲係
        // PENDING_CONFIRMATION，admin 個「確認收款」掣照樣喺度撳得
        // （payment-actions.tsx:181-192）—— 客人影錯截圖、商戶拒一拒等佢重發，
        // 係真實流程。喺嗰刻放貨返上架，同一張單之後一撳確認就要出一件已經
        // 賣咗俾人嘅貨。庫存要鎖到張單真係死（CANCELLED / PAYMENT_REJECTED）
        // 嗰刻先還 —— 見 lib/orders/restock.ts。
        const result = await prisma.order.updateMany({
            where: { id, tenantId, paymentStatus: "uploaded" },
            data: updateData,
        });

        if (result.count === 0) {
            throw new ApiError(
                409,
                "CONFLICT",
                "Payment status changed by another request — reload and retry",
            );
        }

        const order = await prisma.order.findFirst({ where: { id, tenantId } });

        return ok(req, order);
    },
    { admin: true }
);
