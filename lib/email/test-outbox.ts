import "server-only";
import { testSeamEnabled, forcedFailDecision } from "@/lib/test-seam/seam-guard";

/**
 * Test-only email observability + fault injection —— **fail-closed**。
 *
 * 淨係 `EMAIL_TEST_SEAM=1` **且** 唔喺 Vercel（`VERCEL !== "1"`）先生效；Vercel
 * production／preview（build + runtime 都自動 set `VERCEL=1`）即使誤設 flag 都
 * 一律關 → 全部 no-op、讀唔到、注入唔到。純為咗俾 e2e 證明 forgot-password
 * 嘅 `after()` reset-email task：
 *   1. 存在 account（allowed bucket）→ send task 真係執行到。
 *   2. 唔存在 account → 唔會 schedule／send。
 *   3. send 失敗 → after() callback 內部 catch，唔會 unhandled reject。
 *
 * 只存 fingerprint（唔存 raw email），同 rate-limit key hygiene 一致。
 */
// 每次 live 讀 env（同 /api/test-only/rate-limit-keys 一致），避免 module load
// order 影響。決策抽落純 testSeamEnabled()：flag=1 且 VERCEL!==1 先真。
export function emailTestSeamEnabled(): boolean {
  return testSeamEnabled(process.env.EMAIL_TEST_SEAM, process.env.VERCEL);
}

type Attempt = { ok: boolean };

// key = fingerprint(to)；value = immutable array（append 用 spread，唔就地 mutate）。
const attempts = new Map<string, readonly Attempt[]>();

export function recordEmailAttempt(fingerprintedTo: string, ok: boolean): void {
  if (!emailTestSeamEnabled()) return;
  const prev = attempts.get(fingerprintedTo) ?? [];
  attempts.set(fingerprintedTo, [...prev, { ok }]);
}

export function readEmailAttempts(fingerprintedTo: string): readonly Attempt[] {
  if (!emailTestSeamEnabled()) return [];
  return attempts.get(fingerprintedTo) ?? [];
}

/**
 * Fault injection sentinel：只喺 seam 開時，收件人 local-part 含 `forcefail`
 * → 當 send 失敗。俾 e2e 用一個真存在嘅 account 觸發 send 失敗 path，證明
 * after() 內部 catch 住、response 照回同一個 200。
 */
export function isForcedFailRecipient(email: string): boolean {
  return forcedFailDecision(emailTestSeamEnabled(), email);
}
