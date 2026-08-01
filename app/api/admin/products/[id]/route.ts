export const runtime = "nodejs";

import { ApiError, ok, withApi } from "@/lib/api/route-helpers";
import { authenticateAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/prisma";
import { isStructuredSizes } from "@/lib/products/variant-model";

// PATCH /api/admin/products/[id] (admin partial update)
export const PATCH = withApi(
  async (req: Request, context: { params: Promise<{ id: string }> }) => {
    const { tenantId } = await authenticateAdmin(req);
    const { id } = await context.params;

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "Invalid JSON body");
    }

    // Verify product belongs to tenant
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { tenantId: true, sizes: true },
    });

    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Product not found");
    }

    if (existing.tenantId !== tenantId) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Product does not belong to this tenant",
      );
    }

    // Prepare update data (only update fields that are present)
    const updateData: any = {};
    if (body.hidden !== undefined) updateData.hidden = Boolean(body.hidden);
    if (body.featured !== undefined)
      updateData.featured = Boolean(body.featured);
    if (body.active !== undefined) updateData.active = Boolean(body.active);
    if (body.title !== undefined) updateData.title = body.title;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.originalPrice !== undefined)
      updateData.originalPrice = body.originalPrice;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.description !== undefined)
      updateData.description = body.description;
    if (body.images !== undefined) updateData.images = body.images;
    if (body.videoUrl !== undefined) updateData.videoUrl = body.videoUrl;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.brand !== undefined) updateData.brand = body.brand;
    if (body.badges !== undefined) updateData.badges = body.badges;
    if (body.sizeSystem !== undefined) updateData.sizeSystem = body.sizeSystem;
    if (body.sizes !== undefined) {
      // dashboard 砌嘅結構化款式（single {qty,status} / dual 色×碼）唔准俾一個
      // 渲染唔到佢嘅 client 用 `sizes: null` 靜靜清走。要清就要明示 clearVariants。
      // legacy shape（{"US 9": 3}）唔受限 —— 嗰個係 /admin/products modal 自己嘅嘢。
      if (
        body.sizes === null &&
        body.clearVariants !== true &&
        isStructuredSizes(existing.sizes)
      ) {
        throw new ApiError(
          409,
          "CONFLICT",
          "This product's variants were built in the dashboard editor. Edit them there, or send clearVariants:true to clear them.",
        );
      }
      updateData.sizes = body.sizes;
    }
    if (body.stock !== undefined) updateData.stock = body.stock;
    if (body.productType !== undefined)
      updateData.productType = body.productType;
    if (body.inventoryMode !== undefined)
      updateData.inventoryMode = body.inventoryMode;
    if (body.promotionBadges !== undefined)
      updateData.promotionBadges = body.promotionBadges;
    if (body.sku !== undefined) updateData.sku = body.sku || null;
    if (body.shoeType !== undefined) updateData.shoeType = body.shoeType;

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    return ok(req, updated);
  },
);

// DELETE /api/admin/products/[id] (admin)
export const DELETE = withApi(
  async (req: Request, context: { params: Promise<{ id: string }> }) => {
    const { tenantId } = await authenticateAdmin(req);
    const { id } = await context.params;

    // Verify product belongs to tenant
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { tenantId: true },
    });

    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Product not found");
    }

    if (existing.tenantId !== tenantId) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Product does not belong to this tenant",
      );
    }

    await prisma.product.updateMany({
      where: { id, tenantId },
      data: {
        active: false,
        deletedAt: new Date(),
      },
    });

    return ok(req, { success: true });
  },
);
