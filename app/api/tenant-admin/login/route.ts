import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { rateLimit } from "@/lib/rate-limit";
import {
  coarseGuard,
  constantWorkCompare,
  fingerprint,
  LOGIN_SRC,
  LOGIN_GLOBAL,
  LOGIN_FAIL,
} from "@/lib/auth/auth-rate-limit";

export const runtime = "nodejs";

// 429（string-error envelope，同呢條 route 其餘回應一致）+ Retry-After。
function tooMany(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { ok: false, error: "試得太密，請稍後再試 | Too many attempts, try later" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

/** 失敗 login：只喺失敗 path 計數。未爆 → 401；爆 → 429。成功 path 永遠繞得過。 */
async function failLogin(failKey: string, message: string) {
  const fail = await rateLimit(failKey, LOGIN_FAIL);
  if (!fail.allowed) return tooMany(fail.resetAt);
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

export async function POST(req: Request) {
  try {
    // ── Layer 1：coarse pre-auth source limiter（同 /api/tenant/login 共用政策，
    // 但獨立 namespace）。喺 bcrypt 之前封頂昂貴操作。──
    const coarse = await coarseGuard(req, {
      srcPrefix: "auth:tadmin-login:src",
      srcPolicy: LOGIN_SRC,
      globalKey: "auth:tadmin-login:global",
      globalPolicy: LOGIN_GLOBAL,
    });
    if (!coarse.allowed) return tooMany(coarse.resetAt);

    const body = await req.json();
    const { email, password } = body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "email and password are required" },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const failKey = `auth:login:fail:${fingerprint(cleanEmail)}`;

    // Find admin by email with tenant info
    const admin = await prisma.tenantAdmin.findUnique({
      where: { email: cleanEmail },
      include: { tenant: true },
    });

    // 帳號唔存在 / OAuth-only（冇 passwordHash）：行一次等價 bcrypt work 抹平 timing，
    // 再行同「密碼錯誤」一致嘅失敗計數（唔做存在性 oracle）。
    if (!admin || !admin.passwordHash) {
      await constantWorkCompare(String(password));
      return failLogin(
        failKey,
        admin ? "此帳號使用 Google 登入，請使用 Google 登入" : "Invalid email or password"
      );
    }

    // Verify password
    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid) {
      return failLogin(failKey, "Invalid email or password");
    }
    // ✅ 正確 credential —— 唔查／唔累積 failure bucket。

    // Verify tenant is active
    if (admin.tenant.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "Tenant is not active" },
        { status: 403 }
      );
    }

    // Sign JWT
    const token = signToken({
      tenantId: admin.tenantId,
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
    });

    // JWT lives in httpOnly cookie only — never echoed to JSON body to avoid XSS exfiltration
    const response = NextResponse.json({
      ok: true,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    });

    response.cookies.set("tenant-admin-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
