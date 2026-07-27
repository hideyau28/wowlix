import { prisma } from "@/lib/prisma";
import { withApi, ok, ApiError, rateLimited } from "@/lib/api/route-helpers";
import { randomUUID } from "crypto";
import { sendEmail } from "@/lib/email/send";
import PasswordResetEmail from "@/lib/email/templates/PasswordResetEmail";
import { rateLimit } from "@/lib/rate-limit";
import {
  coarseGuard,
  fingerprint,
  FORGOT_SRC,
  FORGOT_GLOBAL,
  FORGOT_EMAIL,
} from "@/lib/auth/auth-rate-limit";

export const runtime = "nodejs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = withApi(async (req: Request) => {
  // ── Layer 1：coarse pre-lookup source limiter ──
  // 喺 DB lookup / send 之前封頂。呢層係 volume-based（同 email 存唔存在無關），
  // 所以 429 唔會洩漏 enumeration 訊號。
  const coarse = await coarseGuard(req, {
    srcPrefix: "auth:forgot:src",
    srcPolicy: FORGOT_SRC,
    globalKey: "auth:forgot:global",
    globalPolicy: FORGOT_GLOBAL,
  });
  if (!coarse.allowed) return rateLimited(req, { retryAfterSec: coarse.retryAfterSec });

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Invalid JSON body");
  }

  const { email } = body;

  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    throw new ApiError(400, "BAD_REQUEST", "請輸入有效嘅 email");
  }

  const cleanEmail = email.trim().toLowerCase();

  const admin = await prisma.tenantAdmin.findUnique({
    where: { email: cleanEmail },
  });

  // Per-email cooldown：keyed by fingerprint(email)，存唔存在都一樣計算 → 唔洩漏
  // enumeration。爆咗就唔再真發 email（anti-bombing），但照回同一個成功回應。
  const emailBucket = await rateLimit(
    `auth:forgot:email:${fingerprint(cleanEmail)}`,
    FORGOT_EMAIL
  );

  // 無論 email 存唔存在都返回同一個成功訊息，防止 email enumeration。
  if (admin && admin.passwordHash && emailBucket.allowed) {
    const resetToken = randomUUID();
    const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 小時後過期

    await prisma.tenantAdmin.update({
      where: { id: admin.id },
      data: { resetToken, resetTokenExpiresAt },
    });

    const locale = "zh-HK";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/${locale}/admin/reset-password?token=${resetToken}`;

    // Fire-and-forget：唔 await send。原本 await 令「存在 + send 失敗 → throw →
    // 500」而「唔存在 → 200」，係一個 enumeration oracle（兼 timing 洩漏）。
    // 而家兩條 path 都即刻回同一個 200，send 失敗只落 server log。
    void sendEmail({
      to: cleanEmail,
      subject: "Reset your WoWlix password",
      template: PasswordResetEmail({ resetUrl, expiresInMinutes: 60 }),
    }).catch((err) => {
      console.error("[forgot-password] email send failed:", err);
    });
  }

  return ok(req, { ok: true });
});
