import { prisma } from "@/lib/prisma";
import { withApi, ok, ApiError, rateLimited } from "@/lib/api/route-helpers";
import { hashPassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/rate-limit";
import {
  coarseGuard,
  fingerprint,
  RESET_SRC,
  RESET_GLOBAL,
  RESET_MISS,
} from "@/lib/auth/auth-rate-limit";

export const runtime = "nodejs";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_NUMBER_REGEX = /[0-9]/;
// invalid 同 expired 一律同一句，唔做「token 存在但過期 vs 根本唔存在」嘅 oracle。
const INVALID_TOKEN_MESSAGE = "此重設連結無效或已過期";

export const POST = withApi(async (req: Request) => {
  // ── Layer 1：coarse pre-lookup source limiter ──
  // random-token 輪換 brute 喺呢度封頂（唔會每個新 token 都真去 DB findFirst）。
  const coarse = await coarseGuard(req, {
    srcPrefix: "auth:reset:src",
    srcPolicy: RESET_SRC,
    globalKey: "auth:reset:global",
    globalPolicy: RESET_GLOBAL,
  });
  if (!coarse.allowed) return rateLimited(req, { retryAfterSec: coarse.retryAfterSec });

  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Invalid JSON body");
  }

  const { token, password } = body;

  if (!token || typeof token !== "string") {
    throw new ApiError(400, "BAD_REQUEST", "Reset token is required");
  }

  if (!password || typeof password !== "string") {
    throw new ApiError(400, "BAD_REQUEST", "Password is required");
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new ApiError(400, "BAD_REQUEST", "密碼最少需要 8 個字元");
  }

  if (!PASSWORD_NUMBER_REGEX.test(password)) {
    throw new ApiError(400, "BAD_REQUEST", "密碼必須包含至少一個數字");
  }

  const admin = await prisma.tenantAdmin.findFirst({
    where: { resetToken: token },
  });

  // invalid / expired 一律行同一個失敗出口（統一訊息 + 失敗計數），唔區分。
  const expired = Boolean(admin?.resetTokenExpiresAt && admin.resetTokenExpiresAt < new Date());
  if (!admin || !admin.resetTokenExpiresAt || expired) {
    // 失敗計數 key = token 嘅 fingerprint（raw token 唔入 key / log）。
    const miss = await rateLimit(`auth:reset:miss:${fingerprint(token)}`, RESET_MISS);
    if (!miss.allowed) {
      const retryAfterSec = Math.max(1, Math.ceil((miss.resetAt - Date.now()) / 1000));
      return rateLimited(req, { retryAfterSec });
    }
    throw new ApiError(400, "BAD_REQUEST", INVALID_TOKEN_MESSAGE);
  }

  const passwordHash = await hashPassword(password);

  await prisma.tenantAdmin.update({
    where: { id: admin.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiresAt: null,
    },
  });

  return ok(req, { ok: true });
});
