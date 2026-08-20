export const runtime = "nodejs";

import { ApiError, ok, withApi } from "@/lib/api/route-helpers";
import { authenticateAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/orders/:id/confirm-payment
export const POST = withApi(
  async (req: Request, ctx: RouteContext) => {
    const { tenantId, adminId, email } = await authenticateAdmin(req);
    const { id } = await ctx.params;

    const order = await prisma.order.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        statusHistory: true,
      },
    });

    if (!order) {
      throw new ApiError(404, "NOT_FOUND", "Order not found");
    }

    if (order.status !== "PENDING" && order.status !== "PENDING_CONFIRMATION") {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        `Cannot confirm payment: order status is '${order.status}', expected 'PENDING' or 'PENDING_CONFIRMATION'`
      );
    }

    const now = new Date();
    const confirmedBy = email || adminId || "super";

    // Build status history
    const history = order.statusHistory
      ? JSON.parse(order.statusHistory)
      : [];
    history.push({
      timestamp: now.toISOString(),
      fromStatus: order.status,
      toStatus: "CONFIRMED",
      action: "confirm_payment",
      by: confirmedBy,
    });

    // 上面個 status 檢查 + 呢句 update 中間有窗口：同一刻有人取消張單，取消
    // 嗰邊會還晒庫存，跟住呢句照寫 CONFIRMED —— 貨已經放返上架，張單又要出貨。
    // status 落 where 令「仲係未收錢」同寫入變成原子操作，輸嗰邊 count===0。
    const result = await prisma.order.updateMany({
      where: { id, tenantId, status: { in: ["PENDING", "PENDING_CONFIRMATION"] } },
      data: {
        status: "CONFIRMED",
        paidAt: now,
        paymentStatus: "confirmed",
        paymentConfirmedAt: now,
        paymentConfirmedBy: confirmedBy,
        statusHistory: JSON.stringify(history),
      },
    });

    if (result.count === 0) {
      throw new ApiError(
        409,
        "CONFLICT",
        "Order status changed by another request — reload and retry",
      );
    }

    const updated = await prisma.order.findFirst({ where: { id, tenantId } });

    return ok(req, updated);
  },
  { admin: true }
);
