// Test-seam fail-closed gate —— PR#378 follow-up。
//
// 修嘅 gap：email-outbox / rate-limit-keys 兩條 test-only seam 之前淨係判
// `<SEAM>_TEST_SEAM === "1"`，靠「Vercel prod 冇設 flag」呢個假設。萬一有人喺
// Vercel dashboard 誤設 flag，seam 就會喺 production 開 → 讀到 rate-limit key /
// email outbox、甚至 forgot-password 被 forcefail 注入。加多一層 `VERCEL !== "1"`
// 硬 gate：Vercel build + runtime 都自動 set VERCEL=1，誤設 flag 都 fail-closed。
//
// 兩組斷言：
//   A. 純決策 truth table（import 純 seam-guard，唔打 HTTP／DB／env）—— cover
//      成個 env matrix，包括 local CI 開、無 flag 關、VERCEL=1+flag=1 關、
//      email forcefail 喺 VERCEL=1 唔生效。
//   B. Route production-guard 行為（HTTP 打真跑緊嘅 e2e server，flag=1 且冇 VERCEL）
//      —— 證明「local CI flag=1 → 兩條 route 開」同埋開咗都仍受 input gate。
//      揀唔掂 DB 嘅 path（invalid prefix / missing param）令呢個 spec 唔靠 DB。
import { test, expect, request as apiRequest } from "@playwright/test";
import { testSeamEnabled, forcedFailDecision } from "../lib/test-seam/seam-guard";
import { APP, uid } from "./helpers";

// ── A. 純決策 truth table ──────────────────────────────────────────────────────

test.describe("seam-guard 純決策（fail-closed truth table）", () => {
  test("[critical] testSeamEnabled：flag=1 且 VERCEL!==1 先開", () => {
    // critical：重覆 3 次跑同一組斷言，確保決策 deterministic、冇隱藏 env 依賴。
    for (let rep = 0; rep < 3; rep++) {
      // 開：明確 flag=1 且唔喺 Vercel（local / CI）。
      expect(testSeamEnabled("1", undefined), `rep ${rep}: flag=1 無 VERCEL → 開`).toBe(true);
      expect(testSeamEnabled("1", "0"), `rep ${rep}: flag=1 VERCEL=0 → 開`).toBe(true);
      expect(testSeamEnabled("1", ""), `rep ${rep}: flag=1 VERCEL="" → 開`).toBe(true);

      // 關：冇明確開 flag。
      expect(testSeamEnabled(undefined, undefined), `rep ${rep}: 無 flag → 關`).toBe(false);
      expect(testSeamEnabled("", undefined), `rep ${rep}: flag="" → 關`).toBe(false);
      expect(testSeamEnabled("0", undefined), `rep ${rep}: flag=0 → 關`).toBe(false);
      expect(testSeamEnabled("true", undefined), `rep ${rep}: flag=非"1" → 關`).toBe(false);

      // 關：Vercel 硬 gate —— 即使誤設 flag=1，VERCEL=1 都 fail-closed。
      expect(testSeamEnabled("1", "1"), `rep ${rep}: flag=1 VERCEL=1（誤設）→ 關`).toBe(false);
      expect(testSeamEnabled("0", "1"), `rep ${rep}: flag=0 VERCEL=1 → 關`).toBe(false);
      expect(testSeamEnabled(undefined, "1"), `rep ${rep}: 無 flag VERCEL=1 → 關`).toBe(false);
    }
  });

  test("[critical] forcedFailDecision：seam 關（含 VERCEL=1）→ email forcefail 唔生效", () => {
    for (let rep = 0; rep < 3; rep++) {
      // seam 關 → 一律 false，唔理 local-part。
      expect(forcedFailDecision(false, "forcefail@x.com"), `rep ${rep}: seam-off 唔注入`).toBe(false);
      expect(forcedFailDecision(false, "forcefail-123@x.com"), `rep ${rep}: seam-off 唔注入`).toBe(false);

      // VERCEL=1（即使 flag=1）→ seam 關 → forcefail 唔生效。
      const vercelSeam = testSeamEnabled("1", "1");
      expect(forcedFailDecision(vercelSeam, "forcefail@x.com"), `rep ${rep}: VERCEL=1 唔注入`).toBe(false);

      // local seam 開 → forcefail local-part 先真；非 forcefail 仍 false。
      const localSeam = testSeamEnabled("1", undefined);
      expect(forcedFailDecision(localSeam, "forcefail@x.com"), `rep ${rep}: local 開 → 注入`).toBe(true);
      expect(forcedFailDecision(localSeam, "ForceFail@x.com"), `rep ${rep}: 大小寫不敏感`).toBe(true);
      expect(forcedFailDecision(localSeam, "normal@x.com"), `rep ${rep}: 非 forcefail 唔注入`).toBe(false);
    }
  });
});

// ── B. Route production-guard 行為（跑緊嘅 server：flag=1、無 VERCEL）───────────

test.describe("test-only route seam（local CI 開、input 仍 gate）", () => {
  test("rate-limit-keys：seam 開 → 非 404，但非 auth: prefix 仍 400", async () => {
    const ctx = await apiRequest.newContext();
    try {
      // seam 開（flag=1、無 VERCEL）→ 唔係 404（唔係 disabled）；但 prefix gate 住 →
      // 400。呢條 path 喺 prisma query 之前 return，所以唔靠 DB。
      const res = await ctx.get(`${APP}/api/test-only/rate-limit-keys?prefix=upload:`, {
        failOnStatusCode: false,
      });
      expect(res.status(), `seam 開時應該 gate prefix（400），唔係 404：${await res.text()}`).toBe(400);
    } finally {
      await ctx.dispose();
    }
  });

  test("email-outbox：seam 開 → 非 404；缺 `to` → 400，有 `to` → 200", async () => {
    const ctx = await apiRequest.newContext();
    try {
      // 缺 param → 400（seam 開先入到呢個 validation；關咗會係 404）。
      const missing = await ctx.get(`${APP}/api/test-only/email-outbox`, {
        failOnStatusCode: false,
      });
      expect(missing.status(), `seam 開 + 缺 to → 400：${await missing.text()}`).toBe(400);

      // 有 to → 200（in-memory outbox，唔靠 DB）；未發過 email → count 0。
      const to = `seam-probe-${uid()}@nowhere.example`;
      const hit = await ctx.get(`${APP}/api/test-only/email-outbox?to=${encodeURIComponent(to)}`, {
        failOnStatusCode: false,
      });
      expect(hit.status(), `seam 開 + 有 to → 200：${await hit.text()}`).toBe(200);
      const body = (await hit.json()) as { ok: boolean; count: number };
      expect(body.ok, "outbox 應回 ok:true").toBe(true);
      expect(body.count, "未發過 email → count 0").toBe(0);
    } finally {
      await ctx.dispose();
    }
  });
});
