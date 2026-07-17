import { test, expect } from "./fixtures";
import { APP, loadSharedTenant } from "./helpers";

/** Flow 2：登入 —— 錯密碼有錯誤提示、啱密碼入 dashboard、登入咗再行 login 會彈返 dashboard */

test("wrong password shows an error and stays on login", async ({ page }) => {
  const tenant = loadSharedTenant();
  await page.goto(`${APP}/en/admin/login`);

  await page.locator('input[type="email"]').fill(tenant.email);
  await page.locator('input[type="password"]').fill("definitely-wrong-1");
  await page.getByRole("button", { name: "Log in", exact: true }).click();

  // API 錯誤 message 有中英兩個來源，齋 match 個紅色錯誤段
  await expect(
    page.locator("p.text-red-600", { hasText: /密碼錯誤|Invalid email or password/ }),
  ).toBeVisible();
  expect(page.url()).toContain("/admin/login");
});

test("correct credentials land on the dashboard", async ({ page }) => {
  const tenant = loadSharedTenant();
  await page.goto(`${APP}/en/admin/login`);

  await page.locator('input[type="email"]').fill(tenant.email);
  await page.locator('input[type="password"]').fill(tenant.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();

  await page.waitForURL("**/en/admin", { timeout: 20_000 });
});

test("visiting login while authenticated bounces to dashboard", async ({
  page,
}) => {
  const tenant = loadSharedTenant();

  // 先 UI 登入攞真 cookie
  await page.goto(`${APP}/en/admin/login`);
  await page.locator('input[type="email"]').fill(tenant.email);
  await page.locator('input[type="password"]').fill(tenant.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/en/admin", { timeout: 20_000 });

  // 再行 login → middleware 應該彈返 dashboard
  await page.goto(`${APP}/en/admin/login`);
  await page.waitForURL("**/en/admin");
});
