import { after } from "next/server";
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
import {
  recordEmailAttempt,
  isForcedFailRecipient,
} from "@/lib/email/test-outbox";

export const runtime = "nodejs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 送 reset email —— 喺 `after()` callback 入面跑。**自己 catch 曬**，任何失敗
 * 只落 server log，唔會 rethrow（唔會 unhandled reject、唔會影響已回嘅 response）。
 * `sendEmail` 本身 Resend 出錯回 `{ ok:false }`（唔 throw），但 render 等仍可能
 * throw → 一律喺呢度兜。
 */
async function deliverResetEmail(to: string, resetUrl: string): Promise<void> {
  const fp = fingerprint(to);
  try {
    // Test-only fault injection（seam 關咗就永遠 false）：證明 send 失敗 path。
    if (isForcedFailRecipient(to)) {
      throw new Error("[test-seam] forced email failure");
    }
    const result = await sendEmail({
      to,
      subject: "Reset your WoWlix password",
      template: PasswordResetEmail({ resetUrl, expiresInMinutes: 60 }),
    });
    recordEmailAttempt(fp, result.ok);
    if (!result.ok) {
      console.error("[forgot-password] email send failed:", result.error);
    }
  } catch (err) {
    recordEmailAttempt(fp, false);
    console.error("[forgot-password] email send threw:", err);
  }
}

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

    // 用 Next.js `after()` schedule send —— response 之後先跑，但係平台會追蹤呢個
    // task（Vercel serverless 收工前會 await after() callback），確保 reset email
    // 真係送得出。裸 `void sendEmail().catch()` fire-and-forget 喺 serverless
    // response 之後隨時被凍結／回收 → email 可能根本冇寄出。
    //
    // 兩條 path 嘅 enumeration parity 唔變：唔存在 email 根本入唔到呢個 block；存在
    // 都只係 schedule（唔 await send），response body/status 一律同一個即回嘅 200，
    // 冇因為 send 成敗而多出任何可觀測差異（唔造 status oracle）。
    after(() => deliverResetEmail(cleanEmail, resetUrl));
  }

  return ok(req, { ok: true });
});
