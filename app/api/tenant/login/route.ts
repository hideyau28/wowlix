import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth/jwt";
import { withApi, ok, ApiError, rateLimited } from "@/lib/api/route-helpers";
import { cookies } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import {
  coarseGuard,
  constantWorkCompare,
  fingerprint,
  LOGIN_SRC,
  LOGIN_GLOBAL,
  LOGIN_FAIL,
} from "@/lib/auth/auth-rate-limit";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 統一 login 失敗訊息 —— 帳號唔存在 / 冇 passwordHash / 密碼錯誤全部回同一句，
// 唔俾 error body 區分「帳號存唔存在」（account enumeration oracle）。timing 已由
// constantWorkCompare 抹平，訊息／status 亦一致（401，爆 quota 先 429）。
const GENERIC_LOGIN_ERROR = "電郵或密碼不正確";

export const POST = withApi(async (req: Request) => {
  // ── Layer 1：coarse pre-auth source limiter（喺 bcrypt 之前）──
  // 封頂每來源／全域嘅 login 嘗試，保護 bcrypt CPU + 擋單源狂 loop。
  // 呢層係唯一會擋到「帶正確 credential」請求嘅地方，而且淨係喺同一來源 flood 先會。
  const coarse = await coarseGuard(req, {
    srcPrefix: "auth:login:src",
    srcPolicy: LOGIN_SRC,
    globalKey: "auth:login:global",
    globalPolicy: LOGIN_GLOBAL,
  });
  if (!coarse.allowed) return rateLimited(req, { retryAfterSec: coarse.retryAfterSec });

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Invalid JSON body");
  }

  const { email, password } = body;

  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    throw new ApiError(400, "BAD_REQUEST", "請輸入有效嘅 email");
  }

  if (!password || typeof password !== "string") {
    throw new ApiError(400, "BAD_REQUEST", "請輸入密碼");
  }

  const cleanEmail = email.trim().toLowerCase();
  // 失敗計數 key：normalized email 嘅 fingerprint（唔存原文入 key / log）。
  const failKey = `auth:login:fail:${fingerprint(cleanEmail)}`;

  const admin = await prisma.tenantAdmin.findUnique({
    where: { email: cleanEmail },
    include: { tenant: { select: { id: true, status: true } } },
  });

  // 帳號唔存在 / 冇 passwordHash：行一次等價 bcrypt work 抹平 timing，
  // 再行同「密碼錯誤」一致嘅失敗計數 + 同一句 generic 訊息（唔做存在性 oracle）。
  if (!admin || !admin.passwordHash) {
    await constantWorkCompare(password);
    return failLogin(req, failKey, GENERIC_LOGIN_ERROR);
  }

  if (admin.tenant.status !== "active") {
    throw new ApiError(403, "FORBIDDEN", "商店已停用");
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    return failLogin(req, failKey, GENERIC_LOGIN_ERROR);
  }
  // ✅ 正確 credential —— 直接發 token，唔查／唔累積 failure bucket。
  // 攻擊者灌爆呢個 email 嘅 failKey 都鎖唔死真店主：成功 path 根本冇經過佢。

  // 只簽租戶級 tenant-admin-token —— 唔再簽平台 god-mode admin_session
  // （同 super-admin 同款，會經 select-tenant 提權去任何租戶）。
  const cookieStore = await cookies();

  // Set tenant-admin-token cookie (API auth)
  const adminToken = signToken({
    tenantId: admin.tenant.id,
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

  return ok(req, { ok: true, tenantId: admin.tenant.id });
});

/**
 * 失敗 login 統一出口：只喺失敗 path 計數。窗內未爆 → 401（原本錯誤訊息）；
 * 爆咗 → 429 + Retry-After。因為淨係喺失敗 path 計，正確密碼永遠繞得過，
 * 令攻擊者無法用「灌爆失敗 bucket」鎖死真店主登入。
 */
async function failLogin(req: Request, failKey: string, message: string) {
  const fail = await rateLimit(failKey, LOGIN_FAIL);
  if (!fail.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((fail.resetAt - Date.now()) / 1000));
    return rateLimited(req, { retryAfterSec });
  }
  throw new ApiError(401, "UNAUTHORIZED", message);
}
