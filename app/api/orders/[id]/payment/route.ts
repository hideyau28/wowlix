export const runtime = "nodejs";

import { ApiError, ok, withApi } from "@/lib/api/route-helpers";
import { prisma } from "@/lib/prisma";
import { isValidTransition, getTransitionError } from "@/lib/orders/status-transitions";
import { isDeadOrderStatus } from "@/lib/orders/restock";
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

        // 張單死咗就唔准再郁付款狀態。取消／拒收會**還晒庫存**（見
        // lib/orders/restock.ts），但取消唔會郁 paymentStatus —— 一張已取消嘅單
        // 個 paymentStatus 照樣停喺 "uploaded"，上面個 check 攔唔到。後果：
        //   • confirm：張單由 PENDING_CONFIRMATION 俾人取消完之後仲 confirm 得，
        //     paidAt / paymentStatus 寫成「收咗錢」，貨已經放返上架 —— 商戶睇住
        //     一張「已付款」嘅單，倉底其實冇留貨。
        //   • reject：一樣係喺一張死單度加多筆冇意義嘅狀態改動。
        // 要記錄退款行 REFUNDED + refundReason，唔係喺死單度改付款狀態。
        if (isDeadOrderStatus(currentOrder.status)) {
            throw new ApiError(
                400,
                "BAD_REQUEST",
                `Cannot ${action} payment: order is ${currentOrder.status}`,
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
        // `status` 都要落 where（唔止 paymentStatus）—— 上面個「死咗就唔准郁」
        // 檢查係讀完先寫，中間有窗口：同一刻有人取消張單（還晒庫存），呢句
        // 仲會照將 status 寫成 CONFIRMED，變成貨放咗返上架但張單要出貨。
        // 兩個 field 一齊落 where，兩個檢查同寫入就一齊變成原子操作。
        const result = await prisma.order.updateMany({
            where: {
                id,
                tenantId,
                paymentStatus: "uploaded",
                status: currentOrder.status,
            },
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
