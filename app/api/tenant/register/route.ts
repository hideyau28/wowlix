import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth/jwt";
import { withApi, ok, ApiError } from "@/lib/api/route-helpers";
import { resolveTemplateId } from "@/lib/cover-templates";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

const RESERVED_SLUGS = new Set([
  "admin", "api", "auth", "login", "start", "_next", "maysshop",
  "app", "checkout", "cart", "search", "orders", "profile",
  "collections", "settings", "signup", "about", "contact",
  "terms", "privacy", "favicon.ico",
  // 防自我指向子域（wowlix.wowlix.com / www.wowlix.com）同保留 demo
  "wowlix", "www", "demo",
  // 靜態 platform landing route segment（app/[locale]/landing）—— 租戶用咗
  // 呢個 slug 會俾 route 遮死永遠開唔到
  "landing",
]);

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const WHATSAPP_REGEX = /^\+?\d{6,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// QR 連結只准 https（合法上傳 = Cloudinary secure_url）。register 係公開端點，
// 唔擋就會將任意 URL 存落 DB 再喺公開 checkout render 做 <img src>（tracking pixel /
// 誤導圖）。淨係 <img src> sink，唔會 XSS，屬 defense-in-depth（PR #346）。
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

  // Auto-login 簽兩條 token 都要 env secret — 落 DB 之前 fail-fast：
  // 唔好等開完店先炸（slug 會燒咗、用戶又攞唔到 session，同一個 slug 冇得再試）
  if (!process.env.TENANT_JWT_SECRET || !process.env.ADMIN_SECRET) {
    console.error("[tenant/register] missing TENANT_JWT_SECRET / ADMIN_SECRET env");
    throw new ApiError(500, "INTERNAL", "伺服器設定有誤，請稍後再試");
  }

  // QR 連結 https 驗證（喺 tenant.create 之前，先 fail 唔燒 slug）（PR #346）
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
      // 明文寫 null（schema default 係已廢除嘅舊品牌橙 #FF9500，migration
      // 另一條線先郁）—— storefront 係 brandColor || tmpl.accent，null 先會
      // 動態跟住用戶揀嘅 template 行，第日轉 template 都唔會甩色。
      // 以前寫死 #FF9500，搞到 step 5 預覽綠色但開出嚟間店橙色。
      brandColor: null,
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

    // --- Auto-login (best-effort) ---
    // 店已經開咗 — 由呢度開始任何失敗都唔准令成個 request 炸 500
    // （否則 slug 燒咗但用戶見 error、又冇 session）。簽唔到 token 就
    // 冇自動登入，用戶用返 email+password / Google 登入照入到後台。
    let autoLogin = true;
    try {
      // 只簽租戶級 tenant-admin-token —— 唔簽平台 god-mode admin_session
      // （同 super-admin 同款，會經 select-tenant 提權去任何租戶；PR #346）。
      const cookieStore = await cookies();

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
    } catch (loginErr) {
      autoLogin = false;
      console.error("[tenant/register] auto-login failed (store created ok):", loginErr);
    }

    return ok(req, { ok: true, tenantId: tenant.id, slug: tenant.slug, autoLogin });
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
    // ApiError（validation 400 / conflict 409 / 手動拋嘅 500）交返俾 withApi
    // 個 fail() 出正確 status + shape；其餘 unexpected error 詳情只落 server
    // log，俾用戶嘅一律 generic —— 唔准將內部 error.message 原文送上前端。
    if (error instanceof ApiError) throw error;
    console.error("[tenant/register] unexpected error:", error);
    throw new ApiError(500, "INTERNAL", "註冊失敗，請再試");
  }
});
