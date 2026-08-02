import { test, expect } from "./fixtures";
import { APP, PLATFORM, loadSharedTenant } from "./helpers";
import type { Page } from "@playwright/test";

/**
 * Storefront template font 只准落喺 storefront。
 *
 * 真 bug（修之前）：六隻 template font（Bebas Neue / Playfair Display /
 * Montserrat / Cormorant Garamond / Inter / Lato）declare 咗喺
 * app/[locale]/layout.tsx —— 即係全站每一條 route 嘅 module graph 都有佢哋。
 * next/font 個 preload hint 跟 module graph 行，所以 **每一頁** 都 preload
 * 足六隻，實測 192 KB：
 *
 *   • 全部 /[locale]/admin/*  —— admin 一隻都冇用
 *   • /landing、/pricing、/start —— marketing 面經
 *     components/marketing/theme.ts 全部改用 Fraunces
 *
 * prod 一樣中招：動態 route 唔出 <link rel=preload>，而係 React Flight 個
 * `:HL[...]` hint，行到瀏覽器一樣變真 preload link，一開頁就落齊九隻字體。
 *
 * 而家六隻搬咗去 lib/storefront-fonts.ts，只有 (customer)/layout 同
 * [slug] 兩條 biolink route import。
 *
 * 呢度**特登唔斷言「preload 幾多個」**——加隻新字體就會無辜紅。改為由頁面
 * 自己嘅 CSS 反查每個 preload 落嚟嘅檔屬邊個 font-family，再斷言 family 名。
 */

const TEMPLATE_FAMILIES = [
  "Bebas Neue",
  "Playfair Display",
  "Montserrat",
  "Cormorant Garamond",
  "Inter",
  "Lato",
];

/**
 * 頁面 preload 緊嘅字體屬邊幾個 family。
 *
 * next/font 出嘅 @font-face 保留真實 family 名（Next 16 turbopack 唔會 hash
 * 做 __Bebas_Neue_xxx），所以 url → family 對得返轉頭。
 */
async function preloadedFontFamilies(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const urlToFamily = new Map<string, string>();
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin sheet — 呢個 app 冇，防守而已
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const family = rule.style
          .getPropertyValue("font-family")
          .replace(/["']/g, "")
          .trim();
        const src = rule.style.getPropertyValue("src");
        for (const m of src.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          urlToFamily.set(m[1].split("/").pop() ?? "", family);
        }
      }
    }

    const families = new Set<string>();
    for (const link of Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[as="font"]'),
    )) {
      const file = link.getAttribute("href")?.split("/").pop() ?? "";
      const family = urlToFamily.get(file);
      if (family) families.add(family);
    }
    return Array.from(families);
  });
}

test("admin 唔會 preload storefront template font（192 KB）", async ({
  page,
}) => {
  // login 係 admin route group 入面唯一唔使 auth 嘅頁，同其餘 admin 頁共用
  // (admin)/layout，所以 font graph 一模一樣。
  await page.goto(`${APP}/zh-HK/admin/login`);
  await page.waitForLoadState("networkidle");

  const families = await preloadedFontFamilies(page);

  expect(
    families.filter((f) => TEMPLATE_FAMILIES.includes(f)),
    `admin 頁 preload 咗 storefront template font：${families.join(", ")}。` +
      `六隻字體應該淨係由 lib/storefront-fonts.ts 經 (customer)/layout 同 ` +
      `[slug] route import，唔好搬返上 app/[locale]/layout.tsx。`,
  ).toEqual([]);
});

test("平台 landing 唔會 preload storefront template font", async ({ page }) => {
  await page.goto(`${PLATFORM}/zh-HK/landing`);
  await page.waitForLoadState("networkidle");

  const families = await preloadedFontFamilies(page);

  expect(
    families.filter((f) => TEMPLATE_FAMILIES.includes(f)),
    `landing preload 咗 storefront template font：${families.join(", ")}。` +
      `marketing 面經 components/marketing/theme.ts 用 Fraunces，唔使 template font。`,
  ).toEqual([]);

  // Control：Fraunces 係 landing 真正嘅 LCP 字體，唔可以順手畀人 lazy 走
  expect(
    families,
    "landing 應該仲 preload 緊 Fraunces（佢個 hero 就係用呢隻）",
  ).toContain("Fraunces");
});

test("biolink 店頁照樣 preload 到自己 template 嗰隻字", async ({ page }) => {
  const tenant = loadSharedTenant();
  await page.goto(`${APP}/zh-HK/${tenant.slug}`);
  await page.waitForLoadState("networkidle");

  const families = await preloadedFontFamilies(page);

  // 呢條係上面兩條嘅 control：搬 font 之後 storefront 唔可以連自己都冇埋。
  // 唔指定邊隻 —— 租戶用邊個 cover template 就係邊隻。
  expect(
    families.filter((f) => TEMPLATE_FAMILIES.includes(f)).length,
    `biolink 店頁一隻 template font 都冇 preload（${families.join(", ")}）——` +
      `storefrontFontVars 冇掛上去，租戶店個標題字會 FOUT。`,
  ).toBeGreaterThan(0);
});
