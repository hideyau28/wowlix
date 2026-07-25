import { request as apiRequest } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { APP, uid } from "./helpers";

/**
 * 租戶隔離：storefront 分類頁唔准出人哋間店嘅嘢。
 *
 * 真 bug：app/[locale]/(customer)/categories/[slug]/page.tsx 兩處
 * `await resolveTenant()` 冇傳 req —— generateMetadata（:28）同 page body（:62）。
 * lib/tenant.ts:56 冇 req 就 skip 晒 host/header parsing，slug 直接跌返
 * DEFAULT_SLUG，即係每間店嘅 /{locale}/categories/{slug} 都 render 緊 default
 * 店嘅分類、產品同 badge。左邊 CategoryBrowseNav 出緊啱嘅店嘅分類（行
 * /api/categories，用 getTenantId(req)），撳落去出人哋間店 —— 睇得見嘅滲漏。
 *
 * ⚠️ 呢條 spec 一律驗 render 出嚟嘅內容，唔驗 HTTP status：
 *   (customer)/loading.tsx 編譯成 <Suspense> boundary 坐喺 notFound() 上面，
 *   所以 (customer) 深層頁嘅 notFound() 而家係 soft 200（同 not-found.spec.ts
 *   最尾嗰條同一個原因）。驗畫面唔驗 status，等嗰個 Suspense 坑修好之後
 *   呢條 spec 都唔使跟住改。
 *
 * ⚠️ CI 驗唔到「滲去 maysshop」呢個 exact 目標，要講清楚：
 *   lib/tenant.ts:16 個 DEFAULT_SLUG 係寫死 "maysshop"（唔讀
 *   DEFAULT_TENANT_SLUG —— 淨係 middleware.ts:5 讀），而 e2e harness 一律
 *   DEFAULT_TENANT_SLUG=e2e-default，空 DB 亦都從來冇種過 maysshop
 *   （register 當佢係保留字，見 lib/slug-policy.ts:59）。所以喺 e2e 舊 code
 *   係 resolveTenant() throw（出 500 畫面），唔係 render maysshop 內容。
 *   本 spec 因此驗真正嘅不變式 —— 同一條 URL、兩間店、必須各自出返自己嘅
 *   內容 —— 呢個不變式同邊個 slug 做 default 完全無關，舊 code 一定 fail。
 */

type SeededStore = {
  slug: string;
  name: string;
  /** 兩間店共用嘅分類 slug，喺呢間店嘅名（用嚟認邊間店 render 緊） */
  sharedCatName: string;
  /** 只有呢間店有嗰個分類嘅名（冇開就 null） */
  onlyCatName: string | null;
};

type SeedOptions = {
  tag: string;
  run: string;
  sharedCatSlug: string;
  /** 傳咗就多開一個「淨係呢間店有」嘅分類 */
  onlyCatSlug?: string;
};

/**
 * 開一間新測試店 + 落分類。
 *
 * 每間店自己一個 APIRequestContext：register 會 auto-login（set
 * tenant-admin-token cookie），兩間店共用一個 context 嘅話第二間會蓋咗第一間
 * 張飛，分類就會全部落錯店。
 *
 * 用 apiRequest.newContext() 而唔係 `request` fixture —— `request` 係
 * test-scoped，beforeAll 攞唔到。
 */
async function seedStore({
  tag,
  run,
  sharedCatSlug,
  onlyCatSlug,
}: SeedOptions): Promise<SeededStore> {
  const slug = `e2e-iso-${tag}-${run}`;
  const name = `E2E Iso ${tag.toUpperCase()} ${run}`;
  const sharedCatName = `Aisle ${tag.toUpperCase()} ${run}`;
  const onlyCatName = onlyCatSlug ? `Only ${tag.toUpperCase()} ${run}` : null;

  const ctx: APIRequestContext = await apiRequest.newContext();
  try {
    const reg = await ctx.post(`${APP}/api/tenant/register`, {
      data: {
        name,
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
    const regJson = await reg.json();
    expect(
      regJson.data?.autoLogin,
      "落分類靠 register 個 auto-login cookie",
    ).toBe(true);

    const shared = await ctx.post(`${APP}/api/admin/categories`, {
      data: { name: sharedCatName, slug: sharedCatSlug },
    });
    expect(
      shared.status(),
      `${slug} 開分類 ${sharedCatSlug} 應該 200`,
    ).toBe(200);

    if (onlyCatSlug) {
      const only = await ctx.post(`${APP}/api/admin/categories`, {
        data: { name: onlyCatName, slug: onlyCatSlug },
      });
      expect(only.status(), `${slug} 開分類 ${onlyCatSlug} 應該 200`).toBe(200);
    }
  } finally {
    await ctx.dispose();
  }

  return { slug, name, sharedCatName, onlyCatName };
}

/**
 * 用 __dev_tenant cookie 揀店（localhost 唔係 platform host，同
 * platform-surface.spec.ts / not-found.spec.ts 同一招）。
 *
 * 順帶講明點解呢招喺 /{locale}/categories/... 行得通：middleware 個
 * resolveSlugFromLocalePath() 會攞第二段 "categories"，而 "categories" 喺
 * ROUTE_RESERVED_SLUGS（lib/slug-policy.ts:35）→ return null →
 * `!localePathSlug` 成立 → cookie override 生效。
 */
async function visitStore(
  page: Page,
  context: BrowserContext,
  storeSlug: string,
  path: string,
): Promise<void> {
  await context.addCookies([
    { name: "__dev_tenant", value: storeSlug, domain: "localhost", path: "/" },
  ]);
  await page.goto(`${APP}${path}`);
}

test.describe("storefront 分類頁租戶隔離", () => {
  // Serial：特登要 A 店先行、B 店後行 —— 同一條 URL 行兩次，A 嗰次會
  // warm 任何 route-level cache，B 嗰次仍然要出返 B 自己嘅嘢。順序固定
  // 亦令 fail 可重現（唔會靠 worker 排程行運）。
  test.describe.configure({ mode: "serial" });

  let sharedCatSlug: string;
  let aOnlyCatSlug: string;
  let storeA: SeededStore;
  let storeB: SeededStore;

  test.beforeAll(async () => {
    // slug 喺 beforeAll 度即場生 —— CI 有 retries: 2，module-level 生嘅話
    // 重跑會 register 同一個 slug 撞 409，真 failure 就俾 setup 錯誤遮咗。
    const run = uid();
    sharedCatSlug = `e2e-aisle-${run}`;
    aOnlyCatSlug = `e2e-a-only-${run}`;

    storeA = await seedStore({
      tag: "a",
      run,
      sharedCatSlug,
      onlyCatSlug: aOnlyCatSlug,
    });
    storeB = await seedStore({ tag: "b", run, sharedCatSlug });
  });

  /**
   * 同一條 /en/categories/{sharedCatSlug}，喺邊間店開就要出邊間店嘅分類。
   * h1 驗 page body 個 call site，document title 驗 generateMetadata 嗰個 ——
   * 兩處分開驗，淨係修其中一處都會 fail。
   */
  async function expectOwnAisle(
    page: Page,
    context: BrowserContext,
    visited: SeededStore,
    other: SeededStore,
  ): Promise<void> {
    await visitStore(
      page,
      context,
      visited.slug,
      `/en/categories/${sharedCatSlug}`,
    );

    await expect(
      page.getByRole("heading", { level: 1, name: visited.sharedCatName }),
      `${visited.slug} 應該出自己嘅分類 h1「${visited.sharedCatName}」`,
    ).toBeVisible();

    const title = await page.title();
    expect(
      title,
      `generateMetadata 應該出 visited 店嘅分類名（實際「${title}」）`,
    ).toContain(visited.sharedCatName);
    expect(
      title,
      "title 要保住 visited 店個名 —— 淨係換 getServerTenantId() 會漏咗 tenant.name",
    ).toContain(visited.name);
    expect(title, `title 唔准帶 ${other.slug} 個名`).not.toContain(other.name);

    // 對面店嘅分類名 / 店名一個字都唔准出現喺 DOM
    await expect(
      page.locator("body"),
      `${visited.slug} 個頁面滲咗 ${other.slug} 嘅分類名`,
    ).not.toContainText(other.sharedCatName);
    await expect(
      page.locator("body"),
      `${visited.slug} 個頁面滲咗 ${other.slug} 個店名`,
    ).not.toContainText(other.name);
  }

  test("A 店開共用分類 slug → 出 A 自己嘅分類（control）", async ({
    page,
    context,
  }) => {
    await expectOwnAisle(page, context, storeA, storeB);
  });

  test("B 店開同一條 URL → 出 B 自己嘅分類，唔准出 A（真滲漏位）", async ({
    page,
    context,
  }) => {
    await expectOwnAisle(page, context, storeB, storeA);
  });

  test("B 店開 A 獨有嘅分類 slug → 404 畫面，唔准借 A 嘅內容", async ({
    page,
    context,
  }) => {
    await visitStore(page, context, storeB.slug, `/en/categories/${aOnlyCatSlug}`);

    // 驗 404 畫面（唔驗 status —— soft 200，見檔頭）。驗「404」而唔係
    // 「唔係 A 嘅內容」：舊 code 喺 e2e 係 resolveTenant() throw → 出 500
    // 畫面，呢句一樣抓得住；prod 舊 code 就會出 default 店嘅分類，下面
    // 嗰句 canary 抓住。
    await expect(
      page.locator(".font-wlx-display", { hasText: "404" }),
      "B 店冇呢個分類 → 應該行 branded 404，唔應該出 500 或者人哋間店",
    ).toBeVisible();

    await expect(
      page.locator("body"),
      "B 店個頁面借咗 A 店嘅分類內容",
    ).not.toContainText(storeA.onlyCatName ?? "__unreachable__");
  });
});
