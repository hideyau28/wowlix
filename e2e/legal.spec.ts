import { test, expect } from "./fixtures";
import { APP, PLATFORM, loadSharedTenant } from "./helpers";

/**
 * Flow 4：法律/內容頁 —— platform 面有 MarketingLegalShell 皮（.wlx-legal），
 * 租戶面一定冇（滲入真店 = Phase D 嘅死線）。
 */

const LEGAL_ROUTES = ["/en/terms", "/en/privacy", "/en/contact", "/en/faq", "/en/about"];

for (const route of LEGAL_ROUTES) {
  test(`platform ${route} wears the marketing legal shell`, async ({
    page,
  }) => {
    await page.goto(`${PLATFORM}${route}`);
    await expect(page.locator(".wlx-legal")).toHaveCount(1);
  });
}

test("tenant terms page must NOT wear the marketing shell", async ({
  page,
  context,
}) => {
  const tenant = loadSharedTenant();
  // localhost 唔係 platform host；用 __dev_tenant cookie 指定測試店
  await context.addCookies([
    { name: "__dev_tenant", value: tenant.slug, domain: "localhost", path: "/" },
  ]);
  await page.goto(`${APP}/en/terms`);
  await expect(page.locator(".wlx-legal")).toHaveCount(0);
});
