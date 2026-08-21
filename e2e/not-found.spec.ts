import { test, expect } from "./fixtures";
import { APP, PLATFORM, loadSharedTenant } from "./helpers";

/**
 * Flow 6：404 —— 三個層次：platform 404、搵唔到店、租戶店內 deep 404。
 * 全部應該行 Phase D 嘅中性 ErrorScreen（大字 404 + 唔准出平台橙）。
 */

test("platform unknown path shows the neutral 404 screen", async ({
  page,
}) => {
  const res = await page.goto(`${PLATFORM}/en/this-page-does-not-exist-e2e`);
  expect(res?.status()).toBe(404);
  await expect(
    page.locator(".font-wlx-display", { hasText: "404" }),
  ).toBeVisible();
});

test("unknown store slug shows store-not-found", async ({ page }) => {
  await page.goto(`${APP}/en/e2e-store-that-never-existed-xyz`);
  await expect(
    page.locator(".font-wlx-display", { hasText: "404" }),
  ).toBeVisible();
});

test("店首頁解到嘅租戶唔存在 → 出「呢間店唔存在」，唔再出平台 landing", async ({
  request,
}) => {
  // ⚠️ 特登唔用 `page`：呢條 URL 個 generateMetadata 會行 getStoreName()，租戶
  // 唔存在時佢本身就會 console.error（pre-existing，唔係呢個改動嚟）——用瀏覽器
  // 就會俾 fixtures 個 consoleGuard 攔住。呢度只需要驗 server render 出咗乜。
  //
  // `?tenant=` 由 middleware 直接 set x-tenant-slug（唔係 resolveTenant 個 dev
  // fallback，所以 next start / next dev 兩邊都行到 —— 見 canonical.spec.ts）。
  const res = await request.get(
    `${APP}/zh-HK?tenant=e2e-tenant-that-never-existed-xyz`,
  );
  const html = await res.text();

  expect(
    html,
    "租戶唔存在應該出「呢間店唔存在」（舊 code 出成版平台 landing）",
  ).toContain("呢間店唔存在");
  // ⚠️ 唔好用 "Turn Followers into Customers" 做反向斷言 —— 呢個 case 個
  // generateMetadata 會 catch 住 fallback 返 platformMeta，即係 <title> 本身
  // 就有嗰句，同 body render 咗乜完全無關（試過，白紅一次）。

  // ⚠️ 特登唔 assert HTTP 404：呢度係 render 一個畫面，唔係 notFound()。
  // (customer) 有 loading.tsx（= Suspense），notFound() 掟喺 boundary 入面
  // 只會變 soft 200 兼出無品牌 `__next_error__` 光板（HANDOFF soft-404 根因）。
  //
  // 亦都唔可以 redirect 去 /landing —— 非平台 host 嘅 /{locale}/landing 會俾
  // middleware 彈返 /{locale}，即刻無限 loop。
});

test("3-seg deep path under a real store slug hits the branded 404", async ({
  page,
}) => {
  // [slug]/[...rest] catch-all（#353 root shell 搬遷之後深層 404 嘅接口）：
  // /{locale}/{真店 slug}/{垃圾}/{垃圾} 要俾 [slug]/not-found 接住 render
  // branded 404 —— 唔准跌落 Next 內建無品牌 default（連 <html lang> 都冇嗰隻）。
  const tenant = loadSharedTenant();
  const res = await page.goto(
    `${APP}/zh-HK/${tenant.slug}/e2e-no-such-section/e2e-no-such-page`,
  );
  expect(res?.status()).toBe(404);
  await expect(
    page.locator(".font-wlx-display", { hasText: "404" }),
  ).toBeVisible();
  // 有 branded shell = 唔係 __next_error__ 光板（嗰隻連 lang 都冇）
  await expect(page.locator("html")).toHaveAttribute("lang", /zh-HK|en/);
});

test("tenant deep 404 renders inside a real store", async ({
  page,
  context,
}) => {
  const tenant = loadSharedTenant();
  await context.addCookies([
    { name: "__dev_tenant", value: tenant.slug, domain: "localhost", path: "/" },
  ]);
  // 注意：/en/<亂嘢> 會俾 middleware 當成 slug（變咗 store-not-found 個 case），
  // 所以 deep 404 要行 reserved path（product/*）先真係落到租戶店內。
  const res = await page.goto(`${APP}/en/product/e2e-missing-product-id`);
  // 未知商品一定要係真 404。舊 code 回 200（(customer)/loading.tsx 個 <Suspense>
  // 坐喺 notFound() 之上 → shell flush 咗先掟 → status 鎖死喺 200），Google
  // 就當佢係正常商品頁 index 落去。
  expect(
    res?.status(),
    "未知商品要回真 404，唔准 soft 200 俾 Google index",
  ).toBe(404);
  await expect(
    page.locator(".font-wlx-display", { hasText: "404" }),
  ).toBeVisible();
});

test("未知分類 slug 一樣要真 404", async ({ page, context }) => {
  const tenant = loadSharedTenant();
  await context.addCookies([
    { name: "__dev_tenant", value: tenant.slug, domain: "localhost", path: "/" },
  ]);
  const res = await page.goto(`${APP}/en/categories/e2e-no-such-category`);
  expect(
    res?.status(),
    "未知分類要回真 404（同商品頁同一個 Suspense 坑）",
  ).toBe(404);
});

test("租戶認唔到嘅商品頁回 404，唔係 500", async ({ request }) => {
  // 刪走 (customer)/loading.tsx 之後，本來俾 <Suspense> 食咗嘅
  // getServerTenantId() throw 會浮返上嚟。「呢間店唔存在」係 404 唔係 server
  // 死咗 —— 呢條斷言守住個回歸位。
  const res = await request.get(
    `${APP}/en/product/whatever?tenant=e2e-tenant-that-never-existed-xyz`,
  );
  expect(
    res.status(),
    "租戶唔存在應該 404，唔准 500",
  ).toBe(404);
});
