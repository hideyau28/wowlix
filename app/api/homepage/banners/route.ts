export const runtime = "nodejs";

import { ApiError, ok, withApi } from "@/lib/api/route-helpers";
import { isAdminAuthenticated } from "@/lib/admin/session";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";

// GET /api/homepage/banners - get all banners ordered by position and sortOrder
export const GET = withApi(async (req) => {
  const tenantId = await getTenantId(req);
  const { searchParams } = new URL(req.url);
  const position = searchParams.get("position"); // "hero" or "mid"

  const banners = await prisma.homepageBanner.findMany({
    where: { tenantId, ...(position ? { position } : {}) },
    orderBy: [{ position: "asc" }, { sortOrder: "asc" }],
  });
  return ok(req, { banners });
});

// POST /api/homepage/banners - create a new banner (admin only)
export const POST = withApi(async (req) => {
  if (!(await isAdminAuthenticated(req))) {
    throw new ApiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const tenantId = await getTenantId(req);
  const body = await req.json();

  if (!body.imageUrl || typeof body.imageUrl !== "string") {
    throw new ApiError(400, "BAD_REQUEST", "imageUrl is required");
  }

  // Get max sortOrder for the position
  const position = body.position || "hero";
  const maxBanner = await prisma.homepageBanner.findFirst({
    where: { position, tenantId },
    orderBy: { sortOrder: "desc" },
  });
  const nextSortOrder = (maxBanner?.sortOrder ?? 0) + 1;

  const banner = await prisma.homepageBanner.create({
    data: {
      tenantId,
      imageUrl: body.imageUrl.trim(),
      title: body.title?.trim() || null,
      subtitle: body.subtitle?.trim() || null,
      linkUrl: body.linkUrl?.trim() || null,
      images: body.images || null,
      sortOrder: body.sortOrder ?? nextSortOrder,
      active: body.active ?? true,
      position,
    },
  });

  return ok(req, { banner });
});

// PATCH /api/homepage/banners - reorder multiple banners
export const PATCH = withApi(async (req) => {
  if (!(await isAdminAuthenticated(req))) {
    throw new ApiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const tenantId = await getTenantId(req);
  const body = await req.json();

  if (!Array.isArray(body.banners)) {
    throw new ApiError(400, "BAD_REQUEST", "banners array is required");
  }

  // Verify all banners belong to tenant
  const bannerIds = body.banners.map((item: { id: string }) => item.id);
  const ownedCount = await prisma.homepageBanner.count({ where: { id: { in: bannerIds }, tenantId } });
  if (ownedCount !== bannerIds.length) {
    throw new ApiError(404, "NOT_FOUND", "Banner not found");
  }

  // Update sortOrder for each banner
  const updates = body.banners.map(
    (item: { id: string; sortOrder: number }, index: number) =>
      prisma.homepageBanner.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder ?? index + 1 },
      })
  );

  await Promise.all(updates);

  return ok(req, { success: true });
});
