import { test, expect } from "./fixtures";
import { APP, loadSharedTenant } from "./helpers";

/**
 * Flow 3：忘記密碼 —— 呢條 flow 喺 Phase E 先修返通
 * （以前未登入會被 auth guard 彈返 login，根本入唔到）。
 */

test("logged-out visitor can reach forgot-password and request a reset", async ({
  page,
}) => {
  const tenant = loadSharedTenant();
  await page.goto(`${APP}/en/admin/forgot-password`);

  // 冇被彈走
  expect(page.url()).toContain("/admin/forgot-password");
  await expect(page.getByText("Reset your password")).toBeVisible();

  await page.locator('input[type="email"]').fill(tenant.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByText("Reset link has been sent to your email."),
  ).toBeVisible();
});

test("stale/garbage auth cookie must NOT lock the user out of recovery", async ({
  page,
  context,
}) => {
  // secret rotation / tenant 被刪之後嘅狀態：cookie 存在但 JWT 驗唔過
  await context.addCookies([
    {
      name: "tenant-admin-token",
      value: "stale-garbage-not-a-jwt",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto(`${APP}/en/admin/forgot-password`);

  expect(page.url()).toContain("/admin/forgot-password");
  await expect(page.getByText("Reset your password")).toBeVisible();
});

test("authenticated user is bounced from forgot-password to dashboard", async ({
  page,
}) => {
  const tenant = loadSharedTenant();

  await page.goto(`${APP}/en/admin/login`);
  await page.locator('input[type="email"]').fill(tenant.email);
  await page.locator('input[type="password"]').fill(tenant.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/en/admin", { timeout: 20_000 });

  await page.goto(`${APP}/en/admin/forgot-password`);
  await page.waitForURL("**/en/admin");
});

test("reset-password page stays reachable (email-link flow)", async ({
  page,
}) => {
  await page.goto(`${APP}/en/admin/reset-password?token=e2e-dummy-token`);
  expect(page.url()).toContain("/admin/reset-password");
  await expect(page.getByText("Set new password")).toBeVisible();
});
