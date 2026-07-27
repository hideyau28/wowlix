// 商戶 auth 端點嘅系統性 rate limit。API-only spec（同 payment-proof-ownership /
// upload-proof-coarse-limit 一樣）→ 直接用 @playwright/test。
//
// 真 bug（修之前）：/api/tenant/login、/api/tenant-admin/login、
// /api/admin/forgot-password、/api/admin/reset-password 全部冇系統性 DB-backed
// rate limit —— 可以無限暴力破解密碼、狂發 reset email、用 random token 輪換灌爆
// bcrypt / DB。
//
// ⚠️ 全部行 API：要驗嘅係 route 授權 / 限流邏輯，API 層驗得晒。
// ⚠️ 每條 test / rep 用獨一 x-forwarded-for，令 per-IP coarse bucket 隔離、斷言
//    deterministic（同 upload-proof-coarse-limit.spec.ts freshIp 一致）。
import { test, expect, request as apiRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { APP, uid } from "./helpers";

// 同 lib/auth/auth-rate-limit.ts 嘅政策手動對齊（改政策要一齊改呢度）。
const LOGIN_FAIL_MAX = 8; // 每 normalized email 失敗上限
const LOGIN_SRC_MAX = 20; // 每 IP login coarse 上限
const FORGOT_SRC_MAX = 12; // 每 IP forgot coarse 上限
const RESET_SRC_MAX = 20; // 每 IP reset coarse 上限

const GOOD_PASSWORD = "E2e-passw0rd-1234";

/** TEST-NET-3（198.51.100.0/24 保留做測試）+ uid → 每 test 獨一 IP。 */
function freshIp(tag: string): string {
  const n = (Math.abs(hashUid(`${tag}-${uid()}`)) % 250) + 1;
  return `198.51.100.${n}`;
}
function hashUid(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

// 每 test 用獨一 source header 隔離 per-IP coarse bucket。用 x-vercel-forwarded-for
// —— production 上 Vercel 平台填、client 蓋唔到嘅權威值（clientSource 亦優先讀佢）。
// local next dev 冇平台 stripping，所以 test 照 set 到（見下面 XVFF-precedence test）。
function ctxForIp(ip: string): Promise<APIRequestContext> {
  return apiRequest.newContext({
    extraHTTPHeaders: { "x-vercel-forwarded-for": ip },
  });
}

type SeededTenant = { email: string; slug: string; tenantId: string };

/** 開一間真店，回登入用嘅 email（密碼固定 GOOD_PASSWORD）。 */
async function registerTenant(tag: string): Promise<SeededTenant> {
  // slug 限 3-30 字元 → prefix 保持短。
  const slug = `arl-${tag}-${uid().slice(-8)}`;
  const ctx = await apiRequest.newContext();
  try {
    const reg = await ctx.post(`${APP}/api/tenant/register`, {
      data: {
        name: `E2E AuthRL ${tag.toUpperCase()} ${slug}`,
        slug,
        email: `${slug}@example.com`,
        password: GOOD_PASSWORD,
        whatsapp: "+85291234567",
        paymentMethods: ["fps"],
        fpsId: "91234567",
        templateId: "matcha",
      },
    });
    expect(reg.status(), `register ${slug} 應該 200：${await reg.text()}`).toBe(200);
    const tenantId = (await reg.json()).data?.tenantId as string;
    expect(tenantId, "register 應該回 tenantId").toBeTruthy();
    return { email: `${slug}@example.com`, slug, tenantId };
  } finally {
    await ctx.dispose();
  }
}

async function loginAttempt(
  ctx: APIRequestContext,
  path: string,
  email: string,
  password: string,
) {
  const res = await ctx.post(`${APP}${path}`, {
    data: { email, password },
    failOnStatusCode: false,
  });
  return { status: res.status(), res };
}

// ── Test seams ────────────────────────────────────────────────────────────────

/** 讀 email test seam：某 email 嘅 after() send task 結果（fail-closed，prod 404）。 */
async function readOutbox(
  ctx: APIRequestContext,
  email: string,
): Promise<{ count: number; sent: number; failed: number }> {
  const res = await ctx.get(
    `${APP}/api/test-only/email-outbox?to=${encodeURIComponent(email)}`,
    { failOnStatusCode: false },
  );
  expect(res.status(), `email seam 應該開咗（200）：${await res.text()}`).toBe(200);
  return (await res.json()) as { count: number; sent: number; failed: number };
}

/** 讀 rate-limit key seam：某 exact prefix 下嘅 key（用嚟斷言 coarse source 值）。 */
async function srcKeys(ctx: APIRequestContext, prefix: string): Promise<string[]> {
  const res = await ctx.get(
    `${APP}/api/test-only/rate-limit-keys?prefix=${encodeURIComponent(prefix)}`,
    { failOnStatusCode: false },
  );
  expect(res.status(), `rate-limit-keys seam 應該開咗（200）：${await res.text()}`).toBe(200);
  return ((await res.json())?.keys ?? []) as string[];
}

// ── Login：credential-guessing 429（fail limiter）──────────────────────────────

test.describe("login — 暴力破解密碼", () => {
  for (const path of ["/api/tenant/login", "/api/tenant-admin/login"]) {
    test(`[critical] ${path}：狂試錯密碼 → 401 然後 429`, async () => {
      // critical：3 個獨立 rep（新店 + 新 IP），確保守穩。
      for (let rep = 0; rep < 3; rep++) {
        const tenant = await registerTenant(`brute-${rep}`);
        const ip = freshIp(`brute-${path}-${rep}`);
        const ctx = await ctxForIp(ip);
        try {
          let saw401 = false;
          let saw429 = false;
          let retryAfter: string | null = null;
          for (let i = 0; i < LOGIN_FAIL_MAX + 4 && !saw429; i++) {
            const { status, res } = await loginAttempt(
              ctx,
              path,
              tenant.email,
              "definitely-wrong-1",
            );
            if (status === 401) saw401 = true;
            if (status === 429) {
              saw429 = true;
              retryAfter = res.headers()["retry-after"] ?? null;
            }
          }
          expect(saw401, `rep ${rep}: 頭幾次錯密碼應該係 401`).toBe(true);
          expect(
            saw429,
            `rep ${rep}: 修之前狂試錯密碼永遠唔會 429（冇 rate limit）`,
          ).toBe(true);
          expect(retryAfter, `rep ${rep}: 429 要帶 Retry-After`).toBeTruthy();
        } finally {
          await ctx.dispose();
        }
      }
    });
  }

  test("[critical] 正確密碼 control：任何時候都入到 200", async () => {
    for (let rep = 0; rep < 3; rep++) {
      const tenant = await registerTenant(`ok-${rep}`);
      const ip = freshIp(`ok-${rep}`);
      const ctx = await ctxForIp(ip);
      try {
        const { status } = await loginAttempt(
          ctx,
          "/api/tenant/login",
          tenant.email,
          GOOD_PASSWORD,
        );
        expect(status, `rep ${rep}: 正確密碼一定要 200`).toBe(200);
      } finally {
        await ctx.dispose();
      }
    }
  });

  test("[critical] 攻擊者灌爆 victim email 失敗 bucket，victim 由另一 source 仍可登入", async () => {
    // Regression guard：fail limiter 只計失敗、唔 gate 成功 path。正確密碼永遠繞得過。
    for (let rep = 0; rep < 3; rep++) {
      const victim = await registerTenant(`lockout-${rep}`);

      // 攻擊者 source A：狂試錯密碼灌到爆（>fail max）。
      const ipA = freshIp(`attacker-${rep}`);
      const attacker = await ctxForIp(ipA);
      try {
        let sawBlock = false;
        for (let i = 0; i < LOGIN_FAIL_MAX + 4; i++) {
          const { status } = await loginAttempt(
            attacker,
            "/api/tenant/login",
            victim.email,
            "attacker-guess-9",
          );
          if (status === 429) sawBlock = true;
        }
        expect(sawBlock, `rep ${rep}: 攻擊者應該撞到 429`).toBe(true);
      } finally {
        await attacker.dispose();
      }

      // Victim source B：用正確密碼，一定要入到（冇被 email bucket 鎖死）。
      const ipB = freshIp(`victim-${rep}`);
      const victimCtx = await ctxForIp(ipB);
      try {
        const { status, res } = await loginAttempt(
          victimCtx,
          "/api/tenant/login",
          victim.email,
          GOOD_PASSWORD,
        );
        expect(
          status,
          `rep ${rep}: victim 由乾淨 source 用正確密碼一定要 200（唔可以俾攻擊者鎖死）：${await res.text()}`,
        ).toBe(200);
      } finally {
        await victimCtx.dispose();
      }
    }
  });

  test("per-IP coarse：唔同 email 輪換都封頂（source-based，唔靠 email bucket）", async () => {
    // 每次用唔同（唔存在）email → 永遠唔會撞 per-email fail bucket；
    // 唯一會擋到嘅係 per-IP coarse limiter。證明 coarse 獨立於 email。
    const ip = freshIp("srcrot");
    const ctx = await ctxForIp(ip);
    try {
      let saw401 = false;
      let saw429 = false;
      for (let i = 0; i < LOGIN_SRC_MAX + 5 && !saw429; i++) {
        const { status } = await loginAttempt(
          ctx,
          "/api/tenant/login",
          `nobody-${uid()}@nowhere.example`,
          "whatever-pass-1",
        );
        if (status === 401) saw401 = true;
        if (status === 429) saw429 = true;
      }
      expect(saw401, "頭幾次（唔存在 email）應該正常 401").toBe(true);
      expect(saw429, "同一 IP 超過 coarse 上限應該 429").toBe(true);
    } finally {
      await ctx.dispose();
    }
  });
});

// ── Forgot-password：email bombing + enumeration ──────────────────────────────

async function forgotPost(ctx: APIRequestContext, email: string) {
  const res = await ctx.post(`${APP}/api/admin/forgot-password`, {
    data: { email },
    failOnStatusCode: false,
  });
  let ok: unknown = undefined;
  try {
    ok = (await res.json())?.data?.ok;
  } catch {
    /* 非 JSON */
  }
  return { status: res.status(), ok };
}

test.describe("forgot-password — email bombing + enumeration", () => {
  test("per-IP coarse：狂 request → 200 然後 429", async () => {
    const ip = freshIp("forgot-coarse");
    const ctx = await ctxForIp(ip);
    try {
      let saw200 = false;
      let saw429 = false;
      let retryAfter: string | null = null;
      for (let i = 0; i < FORGOT_SRC_MAX + 4 && !saw429; i++) {
        const res = await ctx.post(`${APP}/api/admin/forgot-password`, {
          data: { email: `bomb-${uid()}@nowhere.example` },
          failOnStatusCode: false,
        });
        if (res.status() === 200) saw200 = true;
        if (res.status() === 429) {
          saw429 = true;
          retryAfter = res.headers()["retry-after"] ?? null;
        }
      }
      expect(saw200, "頭幾次 forgot 應該 200").toBe(true);
      expect(saw429, "修之前 forgot 永遠唔會 429（冇 rate limit）").toBe(true);
      expect(retryAfter, "429 要帶 Retry-After").toBeTruthy();
    } finally {
      await ctx.dispose();
    }
  });

  test("[critical] 存在 vs 唔存在 email → 一模一樣嘅回應（唔洩漏 enumeration）", async () => {
    for (let rep = 0; rep < 3; rep++) {
      const existing = await registerTenant(`enum-${rep}`);
      const missing = `ghost-${uid()}@nowhere.example`;

      // 各自新 IP，避免撞 coarse limiter 影響對照。
      const cExist = await ctxForIp(freshIp(`enum-exist-${rep}`));
      const cMiss = await ctxForIp(freshIp(`enum-miss-${rep}`));
      try {
        const a = await forgotPost(cExist, existing.email);
        const b = await forgotPost(cMiss, missing);
        expect(a.status, `rep ${rep}: 存在 email 應該 200`).toBe(200);
        expect(
          b.status,
          `rep ${rep}: 唔存在 email 應該同存在一樣 200（唔做 oracle）`,
        ).toBe(a.status);
        expect(a.ok, `rep ${rep}: 存在 body ok:true`).toBe(true);
        expect(b.ok, `rep ${rep}: 唔存在 body 要同存在一樣 ok:true`).toBe(a.ok);
      } finally {
        await cExist.dispose();
        await cMiss.dispose();
      }
    }
  });
});

// ── Forgot-password：after() reset-email send task（BLOCKER A）─────────────────
// 證明 email 由 Next.js after() schedule（response 之後平台仍追蹤嘅 task），
// 唔係裸 void fire-and-forget（serverless response 後隨時被凍結 → 冇寄出）。
// 用 email test seam 觀測 send task 有冇執行；唔寄真 email（dev sendEmail 只 log）。

test.describe("forgot-password — after() send task", () => {
  test("[critical] 存在 account（allowed bucket）→ after() 執行 send task", async () => {
    for (let rep = 0; rep < 3; rep++) {
      const tenant = await registerTenant(`send-exist-${rep}`);
      const ctx = await ctxForIp(freshIp(`send-exist-${rep}`));
      try {
        const r = await forgotPost(ctx, tenant.email);
        expect(r.status, `rep ${rep}: 存在 email 應該 200`).toBe(200);
        expect(r.ok, `rep ${rep}: body ok:true`).toBe(true);
        // after() response 之後先跑 → poll 到 outbox 有一次成功 send。
        await expect
          .poll(async () => (await readOutbox(ctx, tenant.email)).sent, {
            timeout: 10_000,
          })
          .toBe(1);
      } finally {
        await ctx.dispose();
      }
    }
  });

  test("[critical] 不存在 account → 同一 200 body，但唔 schedule / send", async () => {
    for (let rep = 0; rep < 3; rep++) {
      const missing = `ghost-send-${uid()}@nowhere.example`;
      const ctx = await ctxForIp(freshIp(`send-miss-${rep}`));
      try {
        const r = await forgotPost(ctx, missing);
        expect(r.status, `rep ${rep}: 唔存在 email 應該 200`).toBe(200);
        expect(r.ok, `rep ${rep}: body 同存在一樣 ok:true`).toBe(true);
        // 俾 after()（如果錯誤 schedule 咗）有足夠時間跑，再確認 outbox 一直係 0。
        await new Promise((r) => setTimeout(r, 1200));
        const box = await readOutbox(ctx, missing);
        expect(box.count, `rep ${rep}: 唔存在 account 唔應該 send`).toBe(0);
      } finally {
        await ctx.dispose();
      }
    }
  });

  test("[critical] send 失敗 → 同一 200 response、唔 unhandled reject", async () => {
    for (let rep = 0; rep < 3; rep++) {
      // email local-part 含 "forcefail" → seam 逼 send 失敗（見 lib/email/test-outbox）。
      const tenant = await registerTenant(`forcefail-${rep}`);
      const ctx = await ctxForIp(freshIp(`send-fail-${rep}`));
      try {
        const r = await forgotPost(ctx, tenant.email);
        // send 成敗都唔可以改 response —— 一律同成功一樣即回 200 ok:true。
        expect(r.status, `rep ${rep}: send 失敗都要回 200`).toBe(200);
        expect(r.ok, `rep ${rep}: body 一律 ok:true`).toBe(true);
        // after() 內部 catch 咗 → outbox 記錄一次 failed（冇 unhandled reject 炸咗個 task）。
        await expect
          .poll(async () => (await readOutbox(ctx, tenant.email)).failed, {
            timeout: 10_000,
          })
          .toBe(1);
        // server 仍健康：後續 forgot 照正常 200（唔係崩咗）。
        const health = await forgotPost(ctx, `after-${uid()}@nowhere.example`);
        expect(health.status, `rep ${rep}: send 失敗後 server 仍要正常`).toBe(200);
      } finally {
        await ctx.dispose();
      }
    }
  });
});

// ── clientSource 優先次序：Vercel 平台 XVFF > client 偽造 XFF（BLOCKER B）───────
// 用 203.0.113.0/24（另一保留測試網段）避免同 freshIp 嘅 198.51.100.0/24 撞。

test.describe("clientSource 優先次序（平台值 > client XFF）", () => {
  test("[critical] x-vercel-forwarded-for 蓋過 client 偽造 x-forwarded-for", async () => {
    for (let rep = 0; rep < 3; rep++) {
      const authoritative = `203.0.113.${10 + rep}`; // 平台 XVFF（可信）
      const spoof = `203.0.113.${100 + rep}`; // client 偽造 XFF（唔可以當真）
      const ctx = await apiRequest.newContext({
        extraHTTPHeaders: {
          "x-vercel-forwarded-for": authoritative,
          "x-forwarded-for": spoof,
        },
      });
      try {
        // 打一次 login（唔存在 email）→ 生成 auth:login:src:<source> coarse key。
        await loginAttempt(
          ctx,
          "/api/tenant/login",
          `nobody-${uid()}@nowhere.example`,
          "whatever-1",
        );
        const hit = await srcKeys(ctx, `auth:login:src:${authoritative}`);
        const spoofed = await srcKeys(ctx, `auth:login:src:${spoof}`);
        expect(hit.length, `rep ${rep}: coarse source 應該用平台 XVFF`).toBeGreaterThan(0);
        expect(
          spoofed.length,
          `rep ${rep}: client 偽造 XFF 唔可以蓋過 XVFF`,
        ).toBe(0);
      } finally {
        await ctx.dispose();
      }
    }
  });

  test("XVFF 缺席 → fallback 落 x-forwarded-for（local / 其他 runtime）", async () => {
    const only = "203.0.113.200";
    const ctx = await apiRequest.newContext({
      extraHTTPHeaders: { "x-forwarded-for": only },
    });
    try {
      await loginAttempt(
        ctx,
        "/api/tenant/login",
        `nobody-${uid()}@nowhere.example`,
        "whatever-1",
      );
      const hit = await srcKeys(ctx, `auth:login:src:${only}`);
      expect(hit.length, "冇 XVFF 時應該 fallback 用 XFF").toBeGreaterThan(0);
    } finally {
      await ctx.dispose();
    }
  });
});

// ── Reset-password：token 輪換 brute + oracle + key hygiene ────────────────────

async function resetPost(ctx: APIRequestContext, token: string) {
  const res = await ctx.post(`${APP}/api/admin/reset-password`, {
    data: { token, password: GOOD_PASSWORD },
    failOnStatusCode: false,
  });
  let message: string | undefined;
  try {
    message = (await res.json())?.error?.message;
  } catch {
    /* 非 JSON */
  }
  return { status: res.status(), message };
}

test.describe("reset-password — token 輪換 + oracle", () => {
  test("[critical] random token 輪換 → 400 然後 coarse 429（DB lookup 被封頂）", async () => {
    for (let rep = 0; rep < 3; rep++) {
      const ip = freshIp(`reset-rot-${rep}`);
      const ctx = await ctxForIp(ip);
      try {
        let saw400 = false;
        let saw429 = false;
        for (let i = 0; i < RESET_SRC_MAX + 5 && !saw429; i++) {
          const { status } = await resetPost(ctx, `random-token-${uid()}`);
          if (status === 400) saw400 = true;
          if (status === 429) saw429 = true;
        }
        expect(saw400, `rep ${rep}: 頭幾個 random token 應該正常 400`).toBe(true);
        expect(
          saw429,
          `rep ${rep}: 修之前 random token 輪換永遠唔會 429（冇 coarse）`,
        ).toBe(true);
      } finally {
        await ctx.dispose();
      }
    }
  });

  test("invalid token 用統一訊息（唔區分 invalid vs expired）", async () => {
    const ctx = await ctxForIp(freshIp("reset-msg"));
    try {
      const { status, message } = await resetPost(ctx, `no-such-token-${uid()}`);
      expect(status).toBe(400);
      // 同 route.ts INVALID_TOKEN_MESSAGE 對齊。expired token（DB 先 seed 到）行同一句。
      expect(message).toBe("此重設連結無效或已過期");
    } finally {
      await ctx.dispose();
    }
  });
});

// ── Key hygiene：raw token / email 唔會原文入 RateLimitEntry.key ────────────────

test.describe("rate-limit key hygiene（test seam）", () => {
  test("raw token / email 唔出現喺 auth rate-limit key", async () => {
    const rawToken = `raw-secret-token-${uid()}`;
    const rawEmailLocal = `raw-secret-email-${uid()}`;
    const rawEmail = `${rawEmailLocal}@nowhere.example`;

    const ip = freshIp("hygiene");
    const ctx = await ctxForIp(ip);
    try {
      // 生成 reset miss key（fingerprint(rawToken)）。
      await resetPost(ctx, rawToken);
      // 生成 login fail key（fingerprint(rawEmail)）。
      await loginAttempt(ctx, "/api/tenant/login", rawEmail, "whatever-1");
      // 生成 forgot email cooldown key（fingerprint(rawEmail)）。
      await ctx.post(`${APP}/api/admin/forgot-password`, {
        data: { email: rawEmail },
        failOnStatusCode: false,
      });

      const probe = await ctx.get(
        `${APP}/api/test-only/rate-limit-keys?prefix=auth:`,
        { failOnStatusCode: false },
      );
      expect(probe.status(), `test seam 應該開咗（200）：${await probe.text()}`).toBe(200);
      const keys = ((await probe.json())?.keys ?? []) as string[];
      expect(keys.length, "應該有 auth: key 生成到").toBeGreaterThan(0);

      for (const k of keys) {
        expect(k.includes(rawToken), `raw token 唔可以入 key：${k}`).toBe(false);
        expect(k.includes(rawEmail), `raw email 唔可以入 key：${k}`).toBe(false);
        expect(k.includes(rawEmailLocal), `raw email local-part 唔可以入 key：${k}`).toBe(false);
      }
    } finally {
      await ctx.dispose();
    }
  });

  test("test seam prod fail-closed（冇 env → 404）—— 呢度只證開咗時 gate 住 prefix", async () => {
    const ctx = await apiRequest.newContext();
    try {
      // prefix 唔喺 auth: namespace → 400（就算開咗都唔係通用 DB reader）。
      const bad = await ctx.get(`${APP}/api/test-only/rate-limit-keys?prefix=upload:`, {
        failOnStatusCode: false,
      });
      expect(bad.status(), "非 auth: prefix 要 400").toBe(400);
    } finally {
      await ctx.dispose();
    }
  });
});
