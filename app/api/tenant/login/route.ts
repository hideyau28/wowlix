import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth/jwt";
import { withApi, ok, ApiError } from "@/lib/api/route-helpers";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = withApi(async (req: Request) => {
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

  const admin = await prisma.tenantAdmin.findUnique({
    where: { email: cleanEmail },
    include: { tenant: { select: { id: true, status: true } } },
  });

  if (!admin || !admin.passwordHash) {
    throw new ApiError(401, "UNAUTHORIZED", "帳號不存在或未設定密碼");
  }

  if (admin.tenant.status !== "active") {
    throw new ApiError(403, "FORBIDDEN", "商店已停用");
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    throw new ApiError(401, "UNAUTHORIZED", "密碼錯誤");
  }

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
