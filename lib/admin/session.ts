import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getTokenFromRequest, verifyToken } from "@/lib/auth/jwt";

const COOKIE_NAME = "admin_session";
const EXPIRY = "24h";

function getSecretKey(): Uint8Array {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(): Promise<string> {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecretKey());
  return token;
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

export async function getSessionFromCookie(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME);
    if (!sessionCookie?.value) return false;
    return verifySession(sessionCookie.value);
  } catch {
    return false;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function validateAdminSecret(secret: string): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;
  return secret === adminSecret;
}

/**
 * 一個 request 係咪合法 admin，接受三種憑證：
 *  1) x-admin-secret header（外部整合 / 平台 super-admin 自動化）
 *  2) tenant-admin-token JWT（租戶 admin —— 開店 / 登入 / select-tenant 攞到）
 *  3) admin_session cookie（平台 super-admin，經 ADMIN_SECRET 登入）
 *
 * 點解要有佢：租戶 admin 唔再攞平台 god-mode `admin_session`（安全修正：
 * 呢隻同 super-admin 同款，公開開店就攞到 = 跨租戶提權）。凡係本來淨認
 * `getSessionFromCookie()` 嘅租戶功能（e.g. homepage CMS）都要改用呢個，
 * 否則租戶 admin 401。tenant scope 仍然由各 route 嘅 getTenantId(req)（食 JWT）決定。
 */
export async function isAdminAuthenticated(req: Request): Promise<boolean> {
  const headerSecret = req.headers.get("x-admin-secret");
  if (headerSecret && validateAdminSecret(headerSecret)) return true;

  const token = getTokenFromRequest(req);
  if (token && verifyToken(token)) return true;

  return getSessionFromCookie();
}
