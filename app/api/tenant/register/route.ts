import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth/jwt";
import { withApi, ok, ApiError } from "@/lib/api/route-helpers";
import { resolveTemplateId } from "@/lib/cover-templates";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

const RESERVED_SLUGS = new Set([
  "admin", "api", "auth", "login", "start", "_next", "maysshop",
  "app", "checkout", "cart", "search", "orders", "profile",
  "collections", "settings", "signup", "about", "contact",
  "terms", "privacy", "favicon.ico",
]);

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const WHATSAPP_REGEX = /^\+?\d{6,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// QR 連結只准 https（合法上傳 = Cloudinary secure_url）。register 係公開端點，
// 唔擋就會將任意 URL 存落 DB 再喺公開 checkout render 做 <img src>（tracking pixel /
// 誤導圖）。淨係 <img src> sink，唔會 XSS，屬 defense-in-depth。
const isHttpsUrl = (v: unknown): boolean => {
  if (typeof v !== "string" || v.length === 0 || v.length > 2048) return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

export const POST = withApi(async (req: Request) => {
  try {
  let body: { name?: string; slug?: string; whatsapp?: string; instagram?: string; email?: string; password?: string; googleAuth?: boolean; coverTemplate?: string; templateId?: string; tagline?: string; paymentMethods?: string[]; fpsId?: string; fpsAccountName?: string; paymeQrUrl?: string; alipayQrUrl?: string };
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Invalid JSON body");
  }

  const { name, slug, whatsapp, instagram, email, password, googleAuth, coverTemplate, templateId, tagline, paymentMethods, fpsId, fpsAccountName, paymeQrUrl, alipayQrUrl } = body;
  const isOAuth = googleAuth === true;

  // --- Validation ---
  if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50) {
    throw new ApiError(400, "BAD_REQUEST", "店名需要 2-50 個字");
  }

  if (!slug || typeof slug !== "string") {
    throw new ApiError(400, "BAD_REQUEST", "Slug 係必填");
  }

  const cleanSlug = slug.trim().toLowerCase();
  if (!SLUG_REGEX.test(cleanSlug)) {
    throw new ApiError(400, "BAD_REQUEST", "Slug 格式唔啱：3-30 個字，只可以用細楷英文、數字同連字號");
  }

  if (RESERVED_SLUGS.has(cleanSlug)) {
    throw new ApiError(400, "BAD_REQUEST", "呢個名係保留字，唔可以用");
  }

  if (whatsapp && typeof whatsapp === "string" && whatsapp.trim() && !WHATSAPP_REGEX.test(whatsapp.trim())) {
    throw new ApiError(400, "BAD_REQUEST", "請輸入有效 WhatsApp 號碼");
  }

  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    throw new ApiError(400, "BAD_REQUEST", "請輸入有效嘅 email");
  }

  // OAuth 用戶冇密碼，skip password validation
  if (!isOAuth) {
    if (!password || typeof password !== "string" || password.length < 8) {
      throw new ApiError(400, "BAD_REQUEST", "密碼最少 8 個字");
    }
  }

  // QR 連結 https 驗證（喺 tenant.create 之前，先 fail 唔燒 slug）
  if (paymeQrUrl != null && paymeQrUrl !== "" && !isHttpsUrl(paymeQrUrl)) {
    throw new ApiError(400, "BAD_REQUEST", "PayMe QR 連結格式唔啱（需要 https）");
  }
  if (alipayQrUrl != null && alipayQrUrl !== "" && !isHttpsUrl(alipayQrUrl)) {
    throw new ApiError(400, "BAD_REQUEST", "AlipayHK QR 連結格式唔啱（需要 https）");
  }

  const cleanName = name.trim();
  const cleanWhatsapp = whatsapp?.trim() || "";
  const cleanInstagram = instagram?.trim().replace(/^@/, "") || "";
  const cleanEmail = email.trim().toLowerCase();
  const cleanTagline = tagline?.trim() || "";
  const cleanFpsId = fpsId?.trim() || "";
  const cleanFpsAccountName = fpsAccountName?.trim() || "";
  const cleanTemplate = resolveTemplateId(templateId?.trim() || coverTemplate?.trim());
  const hashedPassword = (!isOAuth && password) ? await bcrypt.hash(password, 10) : null;

  // --- Create Tenant + TenantAdmin atomically ---
  try {
    // Create tenant first, then admin in a sequential transaction
    const tenantData: Record<string, unknown> = {
      name: cleanName,
      slug: cleanSlug,
      whatsapp: cleanWhatsapp || undefined,
      instagram: cleanInstagram || undefined,
      description: cleanTagline || undefined,
      template: cleanTemplate,
      coverTemplate: cleanTemplate,
      brandColor: "#FF9500",
      status: "active",
    };
    // templateId column 可能未存在（需要手動 migration）
    try { tenantData.templateId = cleanTemplate; } catch {}

    const tenant = await prisma.tenant.create({
      data: tenantData as any,
    });

    let admin;
    try {
      admin = await prisma.tenantAdmin.create({
        data: {
          email: cleanEmail,
          name: cleanName,
          passwordHash: hashedPassword,
          tenantId: tenant.id,
        },
      });
    } catch (adminErr) {
      // Rollback: delete the tenant if admin creation fails
      await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
      throw adminErr;
    }

    // --- Payment configs: use selected methods or default to FPS ---
    const PAYMENT_DISPLAY_NAMES: Record<string, string> = {
      fps: "FPS 轉數快",
      payme: "PayMe",
      alipay_hk: "AlipayHK",
      bank_transfer: "銀行過數",
    };
    const methods = paymentMethods?.length ? paymentMethods : ["fps"];
    for (let i = 0; i < methods.length; i++) {
      await prisma.tenantPaymentConfig.create({
        data: {
          tenantId: tenant.id,
          providerId: methods[i],
          enabled: true,
          displayName: PAYMENT_DISPLAY_NAMES[methods[i]] || methods[i],
          sortOrder: i,
        },
      }).catch(() => {}); // 非致命，唔好 block 整個 registration
    }

    // --- FPS PaymentMethod record（收款設定）---
    if (cleanFpsId) {
      await prisma.paymentMethod.create({
        data: {
          name: "FPS 轉數快",
          type: "fps",
          active: true,
          sortOrder: 0,
          accountNumber: cleanFpsId,
          accountName: cleanFpsAccountName || null,
          tenantId: tenant.id,
        },
      }).catch(() => {}); // 非致命

      // 同步更新 Tenant FPS 欄位
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          fpsEnabled: true,
          fpsAccountId: cleanFpsId,
          fpsAccountName: cleanFpsAccountName || null,
        },
      }).catch(() => {});
    }

    // --- PayMe PaymentMethod record ---
    if (paymeQrUrl && typeof paymeQrUrl === "string") {
      await prisma.paymentMethod.create({
        data: {
          name: "PayMe",
          type: "payme",
          active: true,
          sortOrder: 1,
          qrCodeUrl: paymeQrUrl,
          tenantId: tenant.id,
        },
      }).catch(() => {}); // 非致命

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          paymeEnabled: true,
          paymeQrCodeUrl: paymeQrUrl,
        },
      }).catch(() => {});
    }

    // --- AlipayHK PaymentMethod record ---
    if (alipayQrUrl && typeof alipayQrUrl === "string") {
      await prisma.paymentMethod.create({
        data: {
          name: "AlipayHK",
          type: "alipay_hk",
          active: true,
          sortOrder: 2,
          qrCodeUrl: alipayQrUrl,
          tenantId: tenant.id,
        },
      }).catch(() => {}); // 非致命
    }

    // --- Default store settings with delivery options ---
    await prisma.storeSettings.create({
      data: {
        tenantId: tenant.id,
        storeName: cleanName,
        whatsappNumber: cleanWhatsapp || undefined,
        instagramUrl: cleanInstagram ? `https://instagram.com/${cleanInstagram}` : undefined,
        tagline: cleanTagline || undefined,
        // SF智能櫃
        sfLockerFee: 35,
        sfLockerFreeAbove: 600,
        // 順豐到付 / 送貨上門
        homeDeliveryFee: 40,
        homeDeliveryFreeAbove: 600,
        homeDeliveryIslandExtra: 20,
        // 一般運費
        shippingFee: 40,
        freeShippingThreshold: 600,
      },
    }).catch(() => {}); // 非致命

    // --- Auto-login: 只簽租戶級 tenant-admin-token（下面）---
    // 唔再簽平台 god-mode `admin_session`：呢隻同 super-admin 登入攞嘅
    // 同款 token，而 /api/admin/select-tenant 認住佢就會簽任何租戶嘅 super
    // token（冇 ownership check）—— 公開開店攞到 = 跨租戶提權。
    const cookieStore = await cookies();

    // --- Set tenant-admin-token cookie (API auth) ---
    const adminToken = signToken({
      tenantId: tenant.id,
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
    });
    cookieStore.set("tenant-admin-token", adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return ok(req, { ok: true, tenantId: tenant.id, slug: tenant.slug });
  } catch (err: unknown) {
    // Handle unique constraint violations
    const isPrismaUnique = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
    const hasUniqueMsg = err instanceof Error && err.message.includes("Unique constraint");
    if (isPrismaUnique || hasUniqueMsg) {
      const target = isPrismaUnique && typeof err.meta?.target === "string" ? err.meta.target : "";
      if (target.includes("email")) {
        throw new ApiError(409, "CONFLICT", "呢個 email 已經註冊咗");
      }
      if (target.includes("slug")) {
        throw new ApiError(409, "CONFLICT", "呢個名已經有人用咗");
      }
      // Fallback: check which field by trying lookups
      const existingSlug = await prisma.tenant.findUnique({ where: { slug: cleanSlug } });
      if (existingSlug) {
        throw new ApiError(409, "CONFLICT", "呢個名已經有人用咗");
      }
      const existingEmail = await prisma.tenantAdmin.findUnique({ where: { email: cleanEmail } });
      if (existingEmail) {
        throw new ApiError(409, "CONFLICT", "呢個 email 已經註冊咗");
      }
      throw new ApiError(409, "CONFLICT", "資料重複，請檢查 slug 或 email");
    }
    throw err;
  }
  } catch (error: unknown) {
    // ApiError 係我哋自己噏嘅 4xx（validation / conflict）—— 交返 withApi
    // 正確 map status（400/409），唔好喺度食晒變 500。
    if (error instanceof ApiError) throw error;
    // 其餘真·unexpected error：log 出嚟，但唔好將 error.message 原文
    // 漏返俾 client（可能含 DB / 內部細節 —— 資訊洩漏）。
    console.error("[register] unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});
