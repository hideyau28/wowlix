import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// JWT secret — must be set via env var, no fallback (lazy to avoid build-time error)
let _jwtSecret: Uint8Array | null = null;
function getJwtSecret(): Uint8Array {
  if (_jwtSecret) return _jwtSecret;
  const raw = process.env.JWT_SECRET;
  if (!raw) throw new Error("JWT_SECRET environment variable is not set");
  _jwtSecret = new TextEncoder().encode(raw);
  return _jwtSecret;
}

const COOKIE_NAME = "hk_session";
const TOKEN_EXPIRY = "7d"; // 7 days

export interface JWTPayload {
  userId: string;
  // phone is nullable since email-only signups have no phone.
  phone: string | null;
  [key: string]: unknown; // Required for jose JWTPayload compatibility
}

export interface SessionUser {
  id: string;
  phone: string | null;
  name: string | null;
  email: string | null;
}

// Generate a 6-digit OTP
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// OTP_EXPIRY_MINUTES — keep in sync with the copy inside OtpEmail.tsx.
export const OTP_EXPIRY_MINUTES = 5;

// Store OTP for an identifier (5 minute expiry).
// `phone` parameter name is historical — it accepts any unique identifier
// (HK phone or email). The OtpCode.phone DB column acts as a generic key.
export async function storeOTP(phone: string, otp: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Invalidate any existing OTP for this phone
  await prisma.otpCode.deleteMany({ where: { phone } });

  // Opportunistically clean up expired OTPs
  await prisma.otpCode.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  // Create new OTP entry
  await prisma.otpCode.create({
    data: { phone, code: otp, expiresAt },
  });
}

// Verify OTP against stored value
export async function verifyOTP(phone: string, otp: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await (prisma as any).$transaction(async (tx: any) => {
    // Find the latest non-expired OTP for this phone
    const stored = await tx.otpCode.findFirst({
      where: {
        phone,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!stored) {
      return false;
    }

    // Check OTP match
    if (stored.code !== otp) {
      const newAttempts = stored.attempts + 1;
      if (newAttempts >= 5) {
        // Max attempts reached — delete the OTP
        await tx.otpCode.delete({ where: { id: stored.id } });
      } else {
        // Increment attempts counter
        await tx.otpCode.update({
          where: { id: stored.id },
          data: { attempts: newAttempts },
        });
      }
      return false;
    }

    // OTP is valid, remove it (one-time use)
    await tx.otpCode.delete({ where: { id: stored.id } });
    return true;
  })) as unknown as boolean;
}

// Validate HK phone number format (8 digits starting with 2/3/5/6/7/8/9)
export function validateHKPhone(phone: string): boolean {
  // Remove +852 prefix if present
  const digits = phone.replace(/^\+852/, "").replace(/\D/g, "");

  // Must be 8 digits
  if (digits.length !== 8) {
    return false;
  }

  // Must start with 2, 3, 5, 6, 7, 8, or 9
  const firstDigit = digits[0];
  return ["2", "3", "5", "6", "7", "8", "9"].includes(firstDigit);
}

// Normalize phone to +852XXXXXXXX format
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/^\+852/, "").replace(/\D/g, "");
  return `+852${digits}`;
}

// Email validation — rough RFC-5322 lite, enough to reject obvious junk.
// Real validation happens when Resend tries to deliver.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Create JWT token
export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getJwtSecret());
}

// Verify JWT token
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// Set session cookie (server-side)
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });
}

// Clear session cookie (server-side)
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Get session token from cookie (server-side)
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  return cookie?.value || null;
}

// Get session user from request (API routes)
export async function getSessionUser(request: Request): Promise<JWTPayload | null> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  // Parse cookies manually
  const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split("=");
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const token = cookies[COOKIE_NAME];
  if (!token) {
    return null;
  }

  return verifyToken(token);
}
