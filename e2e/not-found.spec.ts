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
  // notFound() 喺 streaming（loading.tsx）之下 HTTP status 係 200 —
  // 呢度驗 UI，唔驗 status。
  await page.goto(`${APP}/en/product/e2e-missing-product-id`);
  await expect(
    page.locator(".font-wlx-display", { hasText: "404" }),
  ).toBeVisible();
});
