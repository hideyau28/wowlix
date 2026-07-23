import { test, expect } from "./fixtures";
import { PLATFORM } from "./helpers";

/**
 * /pricing route hygiene（真 prerender + 光板 redirect）。
 */

test("bare /pricing redirects to /zh-HK/pricing", async ({ page }) => {
  await page.goto(`${PLATFORM}/pricing`);
  await expect(page).toHaveURL(/\/zh-HK\/pricing$/);
  // 落地真係 pricing 內容（唔係以 locale="pricing" 跌落 home）
  await expect(
    page.getByRole("heading", { level: 1 }),
  ).toContainText(/0% (佣金|commission)/i);
});

test("garbage locale /fr/pricing is a 404 (dynamicParams locked)", async ({
  page,
}) => {
  const res = await page.goto(`${PLATFORM}/fr/pricing`);
  expect(res?.status()).toBe(404);
});

test("/en/pricing renders the pricing page", async ({ page }) => {
  const res = await page.goto(`${PLATFORM}/en/pricing`);
  expect(res?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1 }),
  ).toContainText(/0% (佣金|commission)/i);
});
