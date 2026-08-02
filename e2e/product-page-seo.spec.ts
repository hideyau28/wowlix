// API-only spec（齋 fetch HTML）→ 直接用 @playwright/test。./fixtures 個
// consoleGuard 係 auto fixture 兼依賴 `page`，用咗每條 test 都會開多個冇用嘅
// browser page。
import { test, expect, request as apiRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { APP, uid } from "./helpers";

/**
 * Canonical 商品頁要講得出「件貨係乜」。
 *
 * 真 bug（修之前）：lib/biolink-data.ts 個 product select 冇攞
 * description / brand / sku / stock，mapper 亦冇 copy。於是：
 *   • ProductSheet.tsx 個 `product.description &&` gate 永遠 falsy ——
 *     商戶打嘅描述、CSV import 入嘅描述，客人一世睇唔到。
 *   • 商品頁個 Product JSON-LD 得 name / image / price —— 冇 description、
 *     冇 sku、冇 brand、冇 availability，亦冇 BreadcrumbList。
 *     legacy 嗰條 (customer)/product/[id] 反而有齊。
 *   • meta description 一律用店描述 → 同一間店所有商品頁一模一樣。
 *
 * 影響：AI 搜尋引擎（ChatGPT / Perplexity / Google AI Overview）喺呢版 HTML
 * 度抽唔到「呢件貨係乜、有冇貨」，冇嘢可以引用。
 *
 * 另外：描述 block 以前收喺 `showDescription &&` 後面（預設摺埋），
 * SSR HTML 根本冇隻字 —— 已改為一直 render，摺疊行 CSS。
 */

type Store = {
  ctx: APIRequestContext;
  slug: string;
  tenantId: string;
};

const DESCRIPTION =
  "手工製作嘅日系陶瓷杯，容量 280ml，可以入微波爐同洗碗機。";
const BRAND = "E2E Ceramics";
// SKU 有 unique constraint —— 逐 run 唯一，否則第二次跑就 500
const SKU = `E2E-SKU-${uid()}`;

async function registerStore(run: string): Promise<Store> {
  const slug = `e2e-seo-${run}`;
  const ctx = await apiRequest.newContext();
  const reg = await ctx.post(`${APP}/api/tenant/register`, {
    data: {
      name: `E2E SEO ${run}`,
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
  return { ctx, slug, tenantId };
}

test.describe("canonical 商品頁講得出件貨係乜", () => {
  let store: Store;
  let productId: string;
  let html: string;

  test.beforeAll(async () => {
    store = await registerStore(uid());

    const res = await store.ctx.post(`${APP}/api/admin/products`, {
      headers: { "x-idempotency-key": `${store.slug}-seo-${uid()}` },
      data: {
        title: "E2E 陶瓷杯",
        price: 128,
        stock: 5,
        description: DESCRIPTION,
        brand: BRAND,
        sku: SKU,
      },
    });
    expect(res.status(), "開產品應該 200").toBe(200);
    productId = (await res.json()).data?.id as string;

    const page = await store.ctx.get(
      `${APP}/zh-HK/${store.slug}/product/${productId}`,
    );
    expect(page.status(), "商品頁應該 200").toBe(200);
    html = await page.text();
  });

  test.afterAll(async () => {
    await store?.ctx.dispose();
  });

  test("商品描述真係喺 SSR HTML 度（唔係摺埋就唔 render）", () => {
    expect(
      html,
      "描述完全冇出現喺 HTML —— crawler 同 AI 引擎抽唔到（舊 code：select 根本冇攞 description）",
    ).toContain(DESCRIPTION);
  });

  test("Product JSON-LD 有 description / sku / brand / availability", () => {
    expect(html, "JSON-LD 要有 description").toContain(
      `"description":"${DESCRIPTION}"`,
    );
    expect(html, "JSON-LD 要有 sku").toContain(`"sku":"${SKU}"`);
    expect(html, "JSON-LD 要有 brand").toContain(`"name":"${BRAND}"`);
    // serializeJsonLd 只 escape < > & U+2028/9，斜線唔會變
    expect(html, "有貨要出 InStock").toContain("https://schema.org/InStock");
  });

  test("有 BreadcrumbList（店 → 商品）", () => {
    expect(html, "要有 BreadcrumbList").toContain('"@type":"BreadcrumbList"');
    expect(html, "第一層要係間店").toContain('"position":1');
    expect(html, "第二層要係件貨").toContain('"position":2');
  });

  test("meta description 用件貨自己嘅描述，唔係成間店共用", () => {
    const match = html.match(/<meta name="description" content="([^"]*)"/);
    expect(match, "商品頁一定要有 meta description").toBeTruthy();
    // 要斷言件貨自己描述入面獨有嘅字，唔可以齋 match 商品名 ——
    // 舊 code 個 fallback `${title} — ${store} on WoWlix` 都有商品名，
    // 咁樣就永遠唔會紅。
    expect(
      match![1],
      "以前一律用店描述 → 同一間店所有商品頁 meta 一模一樣，當重複內容",
    ).toContain("280ml");
  });
});
