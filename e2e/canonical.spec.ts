import { test, expect } from "./fixtures";
import { PLATFORM, loadSharedTenant } from "./helpers";

/**
 * Canonical / hreflang host 紀律。
 *
 * 三個真出現過嘅 regression 守住：
 *  ① /en/pricing 同 /zh-HK/pricing 共用一句寫死嘅 canonical（英文版親口話
 *     自己嘅正本係中文版，兼經兩次 307）；
 *  ② canonical 指 apex（wowlix.com）—— apex 全路徑 307 → www，sitemap 一早
 *     淨出 www，兩邊講唔同嘢；
 *  ③ 租戶面 canonical 指 {slug}.wowlix.com —— wildcard DNS 唔存在（NXDOMAIN）。
 *
 * canonical 係寫死嘅 production 絕對 URL，同 e2e 個 localhost host 無關 ——
 * 所以喺本機一樣驗到。
 */

const SITE = "https://www.wowlix.com";

async function seoHrefs(page: import("@playwright/test").Page) {
  return page.$$eval(
    'link[rel="canonical"], link[rel="alternate"][hreflang]',
    (links) =>
      links.map((l) => ({
        rel: l.getAttribute("rel") ?? "",
        hreflang: l.getAttribute("hreflang") ?? "",
        href: l.getAttribute("href") ?? "",
      })),
  );
}

async function canonicalOf(page: import("@playwright/test").Page) {
  return page.getAttribute('link[rel="canonical"]', "href");
}

for (const locale of ["en", "zh-HK"] as const) {
  test(`/${locale}/pricing self-canonicals to its own locale on www`, async ({
    page,
  }) => {
    await page.goto(`${PLATFORM}/${locale}/pricing`);
    expect(await canonicalOf(page)).toBe(`${SITE}/${locale}/pricing`);
  });

  test(`/${locale} landing self-canonicals to its own locale on www`, async ({
    page,
  }) => {
    await page.goto(`${PLATFORM}/${locale}`);
    expect(await canonicalOf(page)).toBe(`${SITE}/${locale}`);
  });
}

test("/en/pricing carries absolute www hreflang (en + zh-HK + x-default)", async ({
  page,
}) => {
  await page.goto(`${PLATFORM}/en/pricing`);
  const langs = (await seoHrefs(page))
    .filter((l) => l.rel === "alternate")
    .map((l) => `${l.hreflang}=${l.href}`)
    .sort();
  expect(langs).toEqual(
    [
      `en=${SITE}/en/pricing`,
      `x-default=${SITE}/zh-HK/pricing`,
      `zh-HK=${SITE}/zh-HK/pricing`,
    ].sort(),
  );
});

test("platform SEO hrefs never use apex or a subdomain host", async ({
  page,
}) => {
  for (const route of ["/en", "/zh-HK", "/en/pricing", "/zh-HK/pricing"]) {
    await page.goto(`${PLATFORM}${route}`);
    const hrefs = (await seoHrefs(page)).map((l) => l.href);
    expect(hrefs.length, `${route} 應該有 canonical + hreflang`).toBeGreaterThan(
      0,
    );
    for (const href of hrefs) {
      // apex 會 307 → www；canonical 一定要指最終 URL
      expect(href, `${route} 有 apex href`).not.toMatch(
        /^https:\/\/wowlix\.com/,
      );
      // {slug}.wowlix.com wildcard DNS 唔存在
      expect(href, `${route} 有 subdomain href`).toMatch(
        new RegExp(`^${SITE.replace(/[.]/g, "\\.")}(/|$)`),
      );
    }
  }
});

test("?tenant= preview canonicalises to the store's path biolink", async ({
  page,
}) => {
  const tenant = loadSharedTenant();
  // ?tenant= override 會令 x-is-platform 冇 set → 跌落 (customer) 租戶 branch。
  // 以前呢條 path 出 https://{slug}.wowlix.com/en（開唔到嘅 host）。
  await page.goto(`${PLATFORM}/en?tenant=${tenant.slug}`);
  expect(await canonicalOf(page)).toBe(`${SITE}/${tenant.slug}`);
});
