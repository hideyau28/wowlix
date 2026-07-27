/**
 * Test-seam 純決策 —— 唔讀 env、冇 side effect、唔 import server-only，
 * 方便直接單元斷言 truth table（e2e/test-seam-guard.spec.ts）。
 *
 * 一個 test-only seam（email-outbox / rate-limit-keys）只准喺以下條件先生效：
 *   1. 明確開 flag（`<SEAM>_TEST_SEAM === "1"`）—— 冇明確開 = 關。
 *   2. 唔喺 Vercel（`VERCEL !== "1"`）—— Vercel production **同** preview 嘅
 *      build + runtime 都會自動 set `VERCEL=1`，所以就算有人手殘喺 Vercel
 *      dashboard 誤設 flag，seam 仍然 fail-closed。
 *
 * 呢個 gate **唔靠**「prod 冇設 flag」呢個假設 —— 就算 flag 意外漏落 Vercel，
 * `VERCEL===1` 仍然封死。
 */
export function testSeamEnabled(
  flagValue: string | undefined,
  vercelValue: string | undefined,
): boolean {
  return flagValue === "1" && vercelValue !== "1";
}

/**
 * Forcefail sentinel 純決策：seam 關 → 一律 false（唔做 fault injection）；
 * 開咗先睇收件人 local-part 有冇 `forcefail`。抽成純函數令「seam 關 → 唔生效」
 * 呢個 invariant 可以脫離 env 直接斷言。
 */
export function forcedFailDecision(seamEnabled: boolean, email: string): boolean {
  if (!seamEnabled) return false;
  const localPart = email.split("@")[0] ?? "";
  return /forcefail/i.test(localPart);
}
