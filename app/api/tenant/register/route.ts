import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth/jwt";
import { withApi, ok, ApiError } from "@/lib/api/route-helpers";
import { resolveTemplateId } from "@/lib/cover-templates";
import {
  REGISTRATION_RESERVED_SLUGS,
  SLUG_FORMAT_MESSAGE,
  SLUG_REGEX,
  SLUG_RESERVED_MESSAGE,
} from "@/lib/slug-policy";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { uploadStoreImage } from "@/lib/upload/cloudinary";
import { validateImageBytes } from "@/lib/upload/image-signature";

export const runtime = "nodejs";

const WHATSAPP_REGEX = /^\+?\d{6,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_QR_BYTES = 5 * 1024 * 1024; // 5MB，同 /api/upload 一致

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

// Onboarding QR 上載嘅授權 = 完成註冊本身。以前 wizard 喺客人未有 tenant / 未登入
// 嘅時候，匿名打 /api/upload 攞 Cloudinary URL 再塞入 register —— 即係一條人人可
// 反覆灌爆 quota 兼可任意指定 folder 嘅上載路徑。而家 wizard 揸住 QR 檔案（data
// URL）到 register 先上載：data URL 喺 tenant.create 之前淨係驗（magic bytes / size，
// 唔燒 slug），真正上載留到 tenant 建立成功之後（非致命）先做。
type PreparedQr = { url: string } | { buffer: Buffer; mime: string };

function prepareQr(value: unknown, label: string): PreparedQr | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new ApiError(400, "BAD_REQUEST", `${label} QR 連結格式唔啱`);
  }
  // Legacy / 已經係 https（例如舊 client 傳嘅 Cloudinary URL）→ 保留（backward compat）
  if (isHttpsUrl(value)) return { url: value };
  // data URL → server-side 上載前先驗真實 bytes
  const m = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(value);
  if (!m) {
    throw new ApiError(400, "BAD_REQUEST", `${label} QR 連結格式唔啱（需要 https 或圖片檔）`);
  }
  const mime = m[1].toLowerCase();
  const buffer = Buffer.from(m[2].replace(/\s/g, ""), "base64");
  if (buffer.length === 0 || buffer.length > MAX_QR_BYTES) {
    throw new ApiError(400, "BAD_REQUEST", `${label} QR 檔案太大或無效`);
  }
  // Magic-byte 驗證：偽造 MIME / SVG / 任意 binary 一律拒。
  if (!validateImageBytes(mime, new Uint8Array(buffer)).ok) {
    throw new ApiError(400, "BAD_REQUEST", `${label} QR 圖片格式無效`);
  }
  return { buffer, mime };
}

async function resolveQr(
  prepared: PreparedQr | null,
  tenantId: string,
): Promise<string | null> {
  if (!prepared) return null;
  if ("url" in prepared) return prepared.url;
  try {
    const uploaded = await uploadStoreImage(
      prepared.buffer,
      prepared.mime,
      `hk-marketplace/tenants/${tenantId}/store`,
    );
    return uploaded.url;
  } catch (e) {
    // 非致命：店已經開咗，商戶可以喺後台再上載 QR。唔好因為 Cloudinary 撲街炸註冊。
    console.error("[tenant/register] QR upload failed (store created ok):", e);
    return null;
  }
}

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
    throw new ApiError(400, "BAD_REQUEST", SLUG_FORMAT_MESSAGE);
  }

  if (REGISTRATION_RESERVED_SLUGS.has(cleanSlug)) {
    throw new ApiError(400, "BAD_REQUEST", SLUG_RESERVED_MESSAGE);
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

  // QR 驗證（喺 tenant.create 之前，data URL 只驗 magic bytes / size，唔上載、
  // 唔燒 slug）（PR #346 + upload hardening）
  const paymeQrPrepared = prepareQr(paymeQrUrl, "PayMe");
  const alipayQrPrepared = prepareQr(alipayQrUrl, "AlipayHK");

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

    // tenant.create 成功 = registration proof；而家先 server-side 上載 QR（非致命）
    const paymeQrResolved = await resolveQr(paymeQrPrepared, tenant.id);
    const alipayQrResolved = await resolveQr(alipayQrPrepared, tenant.id);

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
    if (paymeQrResolved) {
      await prisma.paymentMethod.create({
        data: {
          name: "PayMe",
          type: "payme",
          active: true,
          sortOrder: 1,
          qrCodeUrl: paymeQrResolved,
          tenantId: tenant.id,
        },
      }).catch(() => {}); // 非致命

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          paymeEnabled: true,
          paymeQrCodeUrl: paymeQrResolved,
        },
      }).catch(() => {});
    }

    // --- AlipayHK PaymentMethod record ---
    if (alipayQrResolved) {
      await prisma.paymentMethod.create({
        data: {
          name: "AlipayHK",
          type: "alipay_hk",
          active: true,
          sortOrder: 2,
          qrCodeUrl: alipayQrResolved,
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
