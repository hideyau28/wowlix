import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limit";

/**
 * 商戶 auth 端點嘅系統性 rate limit —— 建喺現有 DB-backed `rateLimit()` 之上
 * （純 in-memory 唔算數，serverless 每個 instance 各自一份會被繞過）。
 *
 * 威脅模型（呢個 module 要一次過堵嘅）：
 *   • 暴力破解 login（狂試密碼）+ bcrypt CPU 耗盡（每次 compare cost-12 ≈ 200ms+）。
 *   • forgot-password 濫發 reset email（email bombing）+ account enumeration。
 *   • reset-password token 空間輪換 brute（每次 random token 開新 bucket 灌爆 DB）。
 *
 * 設計原則：
 *   1. **Coarse pre-auth source limiter 一定喺 bcrypt / DB lookup 之前** —— 封頂
 *      每個來源同全域嘅昂貴操作量，唔俾未認證請求燒 CPU / DB。
 *   2. **針對 credential guessing 嘅細粒度策略只計失敗、唔 gate 成功 path** ——
 *      正確店主任何時候（除非同一來源 coarse flood）都入到，攻擊者灌爆一個
 *      normalized email 嘅失敗 bucket 都鎖唔死真店主（成功 path 根本唔查佢）。
 *   3. **Client IP 只係 best-effort**（x-forwarded-for spoofable）——per-source 之外
 *      再有固定 global cap 防 IP 輪換／偽造，但 cap 設得遠高於現階段合理流量，
 *      避免 noisy-neighbor 誤殺真商戶。
 *   4. **raw token / email / password 一律唔入 rate-limit key / log** —— 敏感值先
 *      經 SHA-256 fingerprint 再做 key。
 */

// ── Policies ────────────────────────────────────────────────────────────────
// interval = window（ms）；max = 窗內容許次數。數字按現階段（小型 HK marketplace，
// 登入量極低）合理流量 + defense-in-depth backstop 揀，正常商戶撞唔到。

/** Login：per-IP coarse（擋單源狂 loop，喺 bcrypt 之前）。 */
export const LOGIN_SRC = { interval: 5 * 60 * 1000, maxRequests: 20 };
/** Login：固定 global bcrypt backstop（防 IP 輪換／偽造）。設得遠高於正常量。 */
export const LOGIN_GLOBAL = { interval: 60 * 1000, maxRequests: 1000 };
/** Login：per-normalized-email 失敗計數（只計錯 credential，成功 path 唔查）。 */
export const LOGIN_FAIL = { interval: 15 * 60 * 1000, maxRequests: 8 };

/** Forgot：per-IP coarse（喺 DB lookup / send 之前）。 */
export const FORGOT_SRC = { interval: 15 * 60 * 1000, maxRequests: 12 };
/** Forgot：固定 global backstop。 */
export const FORGOT_GLOBAL = { interval: 60 * 1000, maxRequests: 300 };
/** Forgot：per-normalized-email cooldown（防同一 inbox 被 email bombing）。 */
export const FORGOT_EMAIL = { interval: 15 * 60 * 1000, maxRequests: 3 };

/** Reset：per-IP coarse（喺 token lookup 之前，擋 random-token 輪換）。 */
export const RESET_SRC = { interval: 15 * 60 * 1000, maxRequests: 20 };
/** Reset：固定 global backstop。 */
export const RESET_GLOBAL = { interval: 60 * 1000, maxRequests: 400 };
/** Reset：per-token-fingerprint 失敗計數（defense-in-depth，重複試同一 token）。 */
export const RESET_MISS = { interval: 15 * 60 * 1000, maxRequests: 12 };

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * 盡力攞 client IP 做 coarse limiter dimension。x-forwarded-for 第一跳 client
 * 可偽造 → 只當 best-effort（配合固定 global bucket），攞唔到 fallback 去共享
 * "unknown" bucket。同 lib/api/route-helpers.ts、app/api/upload/route.ts 一致。
 */
export function clientSource(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/**
 * SHA-256 fingerprint —— 令 raw token / email 唔會原文出現喺 RateLimitEntry.key
 * 或者任何 log。截短 32 hex 已足夠抗撞（key namespace 已隔離）。
 */
export function fingerprint(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);
}

type Policy = { interval: number; maxRequests: number };
type CoarseResult = { allowed: boolean; retryAfterSec: number; resetAt: number };

/**
 * Coarse guard：per-source + 固定 global 兩層，任何一層爆 → 唔准落 bcrypt / lookup。
 * 一定要喺任何昂貴操作（bcrypt compare / DB 查 order / send email）之前叫。
 */
export async function coarseGuard(
  req: Request,
  opts: {
    srcPrefix: string;
    srcPolicy: Policy;
    globalKey: string;
    globalPolicy: Policy;
  }
): Promise<CoarseResult> {
  const src = await rateLimit(`${opts.srcPrefix}:${clientSource(req)}`, opts.srcPolicy);
  if (!src.allowed) return toResult(false, src.resetAt);

  const global = await rateLimit(opts.globalKey, opts.globalPolicy);
  if (!global.allowed) return toResult(false, global.resetAt);

  return toResult(true, src.resetAt);
}

function toResult(allowed: boolean, resetAt: number): CoarseResult {
  return {
    allowed,
    resetAt,
    retryAfterSec: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
  };
}

// ── Constant-work bcrypt compare ─────────────────────────────────────────────
// 帳號唔存在 / 冇 passwordHash 就 early-return 唔行 bcrypt = timing enumeration
// oracle（存在嘅 email 慢、唔存在嘅快）。喺呢啲 path 對一個 dummy hash 行一次
// compare，令有冇帳號嘅耗時貼近。dummy hash 首次用時即場生成再 cache（唔 hardcode
// 任何 hash 值），冇引入新 dependency（bcryptjs 本身已用）。
let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash("no-such-account-placeholder", 12);
  }
  return dummyHashPromise;
}

/** 對唔存在嘅帳號行一次等價 bcrypt work，抹平 login 嘅 enumeration timing。 */
export async function constantWorkCompare(password: string): Promise<void> {
  try {
    await bcrypt.compare(password, await getDummyHash());
  } catch {
    // dummy compare 純為抹平 timing —— 出錯都唔可以影響 login 判斷。
  }
}
