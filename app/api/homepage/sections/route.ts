export const runtime = "nodejs";

import { ApiError, ok, withApi } from "@/lib/api/route-helpers";
import { isAdminAuthenticated } from "@/lib/admin/session";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";

// GET /api/homepage/sections - get all sections ordered by sortOrder
export const GET = withApi(async (req) => {
  const tenantId = await getTenantId(req);
  const sections = await prisma.homepageSection.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
  });
  return ok(req, { sections });
});

// POST /api/homepage/sections - create a new section (admin only)
export const POST = withApi(async (req) => {
  if (!(await isAdminAuthenticated(req))) {
    throw new ApiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const tenantId = await getTenantId(req);
  const body = await req.json();

  if (!body.title || typeof body.title !== "string") {
    throw new ApiError(400, "BAD_REQUEST", "title is required");
  }

  // Get max sortOrder to add at end
  const maxSection = await prisma.homepageSection.findFirst({
    where: { tenantId },
    orderBy: { sortOrder: "desc" },
  });
  const nextSortOrder = (maxSection?.sortOrder ?? 0) + 1;

  const section = await prisma.homepageSection.create({
    data: {
      tenantId,
      title: body.title.trim(),
      type: body.type || "product_grid",
      cardSize: body.cardSize || "small",
      sortOrder: body.sortOrder ?? nextSortOrder,
      active: body.active ?? true,
      productIds: body.productIds || [],
      filterType: body.filterType || null,
      filterValue: body.filterValue || null,
    },
  });

  return ok(req, { section });
});

// PATCH /api/homepage/sections - reorder multiple sections
export const PATCH = withApi(async (req) => {
  if (!(await isAdminAuthenticated(req))) {
    throw new ApiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const tenantId = await getTenantId(req);
  const body = await req.json();

  if (!Array.isArray(body.sections)) {
    throw new ApiError(400, "BAD_REQUEST", "sections array is required");
  }

  // Verify all sections belong to tenant
  const sectionIds = body.sections.map((item: { id: string }) => item.id);
  const ownedCount = await prisma.homepageSection.count({ where: { id: { in: sectionIds }, tenantId } });
  if (ownedCount !== sectionIds.length) {
    throw new ApiError(404, "NOT_FOUND", "Section not found");
  }

  // Update sortOrder for each section
  const updates = body.sections.map(
    (item: { id: string; sortOrder: number }, index: number) =>
      prisma.homepageSection.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder ?? index + 1 },
      })
  );

  await Promise.all(updates);

  return ok(req, { success: true });
});
