// API-only spec → 直接用 @playwright/test（同 payment-proof-ownership.spec.ts 一樣）。
import { test, expect, request as apiRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { APP, uid } from "./helpers";

/**
 * 孤兒 route lockdown：`POST /api/tenant-admin/register`
 *
 * 真 bug（修之前）：呢條 route 零認證、零 authorization。任何陌生人只要知道
 * 一個公開 tenantId（tenantId 喺 storefront / biolink API response 到處都露），
 * 就可以 `prisma.tenantAdmin.create(...)` 幫個 victim 商戶開一個由攻擊者控制
 * email/password 嘅 TenantAdmin，跟住去 /api/tenant-admin/login 登入接管商戶後台。
 *
 * 全 repo 正常 onboarding 一律行 `/api/tenant/register`；`tenant-admin/register`
 * 冇任何 production caller（唯一 reference 係 docs/SYSTEM-AUDIT.md 條 endpoint 清單）。
 * 最小修法 = 直接刪 route，令 Next.js 對呢條 path 真正 404。
 *
 * ⚠️ 全部行 API（唔行 UI）：要驗嘅係「呢條 endpoint 唔可以建立 admin」。
 */

/** 開一間真店攞返個合法 tenantId —— 令「valid tenantId」case 真係 valid。 */
async function seedTenant(run: string): Promise<string> {
  const slug = `e2e-taregister-${run}`;
  const ctx: APIRequestContext = await apiRequest.newContext();
  try {
    const reg = await ctx.post(`${APP}/api/tenant/register`, {
      data: {
        name: `E2E TARegister ${run}`,
        slug,
        email: `${slug}@example.com`,
        password: "E2e-passw0rd-1234",
        whatsapp: "+85291234567",
        paymentMethods: ["fps"],
        fpsId: "91234567",
        templateId: "matcha",
      },
    });
    expect(reg.status(), `register ${slug} 應該 200`).toBe(200);
    const tenantId = (await reg.json()).data?.tenantId as string;
    expect(tenantId, "register 應該回 tenantId").toBeTruthy();
    return tenantId;
  } finally {
    await ctx.dispose();
  }
}

/** 完全冇 cookie / 冇 header 嘅陌生人 —— 攻擊者視角。 */
async function anonRegister(data: Record<string, unknown>) {
  const ctx = await apiRequest.newContext();
  try {
    const res = await ctx.post(`${APP}/api/tenant-admin/register`, {
      data,
      failOnStatusCode: false,
    });
    return { status: res.status(), text: await res.text() };
  } finally {
    await ctx.dispose();
  }
}

/** 試用一組 email/password 登入 —— 用嚟證明「究竟有冇建立到 admin」。 */
async function tryLogin(email: string, password: string) {
  const ctx = await apiRequest.newContext();
  try {
    const res = await ctx.post(`${APP}/api/tenant-admin/login`, {
      data: { email, password },
      failOnStatusCode: false,
    });
    return { status: res.status(), text: await res.text() };
  } finally {
    await ctx.dispose();
  }
}

test.describe("tenant-admin/register — 孤兒 route lockdown", () => {
  test("未認證 + 合法 tenantId → 404，冇建立到 admin", async () => {
    const run = uid();
    const tenantId = await seedTenant(run);
    const email = `attacker-${run}@evil.example`;
    const password = "Attacker-passw0rd-1234";

    const res = await anonRegister({ tenantId, email, password });
    expect(
      res.status,
      `舊 code 會 200 兼真係開咗個 admin（實際 ${res.text}）`,
    ).toBe(404);

    // 鐵證：呢組攻擊者 credential 唔可以登入 —— 即係根本冇建立到 TenantAdmin。
    const login = await tryLogin(email, password);
    expect(
      login.status,
      `攻擊者 credential 唔可以登入，否則 = admin 被建立咗（實際 ${login.text}）`,
    ).not.toBe(200);
  });

  test("未認證 + 亂噏 tenantId → 404，同合法 tenantId 一樣（唔做 existence oracle）", async () => {
    const run = uid();
    const res = await anonRegister({
      tenantId: `does-not-exist-${run}`,
      email: `attacker-${run}@evil.example`,
      password: "Attacker-passw0rd-1234",
    });
    // 統一 404：唔想條 route 變成「呢個 tenantId 存唔存在」嘅 oracle
    //（舊 code：valid → 200，invalid → 404，正正就係 oracle）。
    expect(res.status, `應該同合法 tenantId 一樣 404（實際 ${res.text}）`).toBe(
      404,
    );
  });

  test("未認證 + 缺 field → 一律 404（唔漏 400 validation 訊號）", async () => {
    const res = await anonRegister({ email: "x@evil.example" });
    expect(res.status, `舊 code 會 400（實際 ${res.text}）`).toBe(404);
  });
});
