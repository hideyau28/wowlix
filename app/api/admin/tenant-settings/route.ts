export const runtime = "nodejs";

import { ApiError, ok, withApi } from "@/lib/api/route-helpers";
import { authenticateAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/prisma";
import { resolveTemplateId } from "@/lib/cover-templates";
import {
  REGISTRATION_RESERVED_SLUGS,
  SLUG_FORMAT_MESSAGE,
  SLUG_REGEX,
  SLUG_RESERVED_MESSAGE,
} from "@/lib/slug-policy";

const ROUTE = "/api/admin/tenant-settings";

// GET /api/admin/tenant-settings (admin)
export const GET = withApi(async (req) => {
  const { tenantId, adminId } = await authenticateAdmin(req);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      slug: true,
      tagline: true,
      location: true,
      whatsapp: true,
      instagram: true,
      socialLinks: true,
      coverTemplate: true,
      coverPhoto: true,
      logoUrl: true,
      // Checkout settings
      currency: true,
      deliveryOptions: true,
      freeShippingThreshold: true,
      orderConfirmMessage: true,
      // Branding
      hideBranding: true,
    },
  });

  if (!tenant) {
    throw new ApiError(404, "NOT_FOUND", "Tenant not found");
  }

  // Get admin email
  const admin = await prisma.tenantAdmin.findUnique({
    where: { id: adminId },
    select: { email: true },
  });

  return ok(req, {
    ...tenant,
    email: admin?.email || null,
    logo: tenant.logoUrl,
  });
});

// PUT /api/admin/tenant-settings (admin)
export const PUT = withApi(async (req) => {
  const { tenantId } = await authenticateAdmin(req);

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Invalid JSON body");
  }

  // Validate slug if provided — rename 必須行足 register 同一套規矩
  // （format + reserved + uniqueness，全部食 lib/slug-policy 單一真相）。
  // 以前呢度乜都唔驗，租戶 admin 可以將 slug 改做 "landing"/"www" 遮死
  // 自己間店、或者大楷/怪字砌爛 URL。
  let slugUpdate: string | undefined;
  if (body.slug !== undefined) {
    if (typeof body.slug !== "string" || body.slug.trim().length === 0) {
      throw new ApiError(400, "BAD_REQUEST", "slug must be a non-empty string");
    }

    const cleanSlug = body.slug.trim().toLowerCase();

    const currentTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    if (!currentTenant) {
      throw new ApiError(404, "NOT_FOUND", "Tenant not found");
    }

    // 冇改到（settings form 成個 object 照 PUT 返嚟係常態）就唔郁 slug —
    // 歷史 slug 未必過得到而家嘅規矩，唔可以逼佢哋改名先俾儲存其他設定
    if (cleanSlug !== currentTenant.slug) {
      if (!SLUG_REGEX.test(cleanSlug)) {
        throw new ApiError(400, "BAD_REQUEST", SLUG_FORMAT_MESSAGE);
      }
      if (REGISTRATION_RESERVED_SLUGS.has(cleanSlug)) {
        throw new ApiError(400, "BAD_REQUEST", SLUG_RESERVED_MESSAGE);
      }

      const existing = await prisma.tenant.findUnique({
        where: { slug: cleanSlug },
      });
      if (existing) {
        throw new ApiError(409, "CONFLICT", "Slug already taken");
      }

      slugUpdate = cleanSlug;
    }
  }

  // Prepare update data
  const updateData: any = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (slugUpdate !== undefined) updateData.slug = slugUpdate;
  if (body.tagline !== undefined) updateData.tagline = body.tagline;
  if (body.location !== undefined) updateData.location = body.location;
  if (body.whatsapp !== undefined) updateData.whatsapp = body.whatsapp;
  if (body.instagram !== undefined) updateData.instagram = body.instagram;
  if (body.socialLinks !== undefined) updateData.socialLinks = body.socialLinks;
  if (body.coverTemplate !== undefined)
    updateData.coverTemplate = resolveTemplateId(body.coverTemplate);
  if (body.coverPhoto !== undefined) updateData.coverPhoto = body.coverPhoto;
  if (body.logo !== undefined) updateData.logoUrl = body.logo;
  // Checkout settings
  if (body.currency !== undefined) updateData.currency = body.currency;
  if (body.deliveryOptions !== undefined)
    updateData.deliveryOptions = body.deliveryOptions;
  if (body.freeShippingThreshold !== undefined)
    updateData.freeShippingThreshold = body.freeShippingThreshold;
  // Allow explicitly setting to null
  if (body.freeShippingThreshold === null)
    updateData.freeShippingThreshold = null;
  if (body.orderConfirmMessage !== undefined)
    updateData.orderConfirmMessage = body.orderConfirmMessage;
  if (body.hideBranding !== undefined)
    updateData.hideBranding = body.hideBranding;

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: updateData,
    select: {
      name: true,
      slug: true,
      tagline: true,
      location: true,
      whatsapp: true,
      instagram: true,
      socialLinks: true,
      coverTemplate: true,
      coverPhoto: true,
      logoUrl: true,
      currency: true,
      deliveryOptions: true,
      freeShippingThreshold: true,
      orderConfirmMessage: true,
      hideBranding: true,
    },
  });

  return ok(req, {
    ...updated,
    logo: updated.logoUrl,
  });
});
