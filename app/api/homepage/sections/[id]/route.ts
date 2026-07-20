export const runtime = "nodejs";

import { ApiError, ok, withApi } from "@/lib/api/route-helpers";
import { isAdminAuthenticated } from "@/lib/admin/session";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/homepage/sections/[id] - update a section
export const PUT = withApi(async (req: Request, ctx: RouteContext) => {
  if (!(await isAdminAuthenticated(req))) {
    throw new ApiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const tenantId = await getTenantId(req);
  const { id } = await ctx.params;
  const body = await req.json();

  const existing = await prisma.homepageSection.findFirst({ where: { id, tenantId } });
  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Section not found");
  }

  const section = await prisma.homepageSection.update({
    where: { id },
    data: {
      title: body.title !== undefined ? body.title.trim() : undefined,
      type: body.type !== undefined ? body.type : undefined,
      cardSize: body.cardSize !== undefined ? body.cardSize : undefined,
      sortOrder: body.sortOrder !== undefined ? body.sortOrder : undefined,
      active: body.active !== undefined ? body.active : undefined,
      productIds: body.productIds !== undefined ? body.productIds : undefined,
      filterType: body.filterType !== undefined ? body.filterType : undefined,
      filterValue: body.filterValue !== undefined ? body.filterValue : undefined,
    },
  });

  return ok(req, { section });
});

// DELETE /api/homepage/sections/[id] - delete a section
export const DELETE = withApi(async (req: Request, ctx: RouteContext) => {
  if (!(await isAdminAuthenticated(req))) {
    throw new ApiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const tenantId = await getTenantId(req);
  const { id } = await ctx.params;

  const existing = await prisma.homepageSection.findFirst({ where: { id, tenantId } });
  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Section not found");
  }

  await prisma.homepageSection.deleteMany({ where: { id, tenantId } });

  return ok(req, { success: true });
});
