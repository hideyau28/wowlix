import { test, expect } from "./fixtures";
import { PLATFORM } from "./helpers";

/** Flow 5：繁 ↔ EN —— landing 兩個 locale 都 render 正確語言，切換 link 有效 */

test("zh-HK landing renders Chinese content", async ({ page }) => {
  await page.goto(`${PLATFORM}/zh-HK`);
  await expect(page.locator("html")).toHaveAttribute("lang", /zh/i);
  // 定價 teaser 由 plans.ts 單一真相 render — 中文版一定有「推薦」badge
  await expect(page.getByText("推薦").first()).toBeVisible();
});

test("en landing renders English content", async ({ page }) => {
  await page.goto(`${PLATFORM}/en`);
  await expect(page.locator("html")).toHaveAttribute("lang", /en/i);
  await expect(page.getByText("Recommended").first()).toBeVisible();
});

test("locale can be switched from the landing nav", async ({ page }) => {
  await page.goto(`${PLATFORM}/zh-HK`);

  // 中文版 nav 個語言掣顯示「EN」
  const enLink = page.getByRole("link", { name: "EN", exact: true }).first();
  await expect(enLink).toBeVisible();
  await enLink.click();
  await page.waitForURL(/\/en(\/|$|\?)/);
  await expect(page.locator("html")).toHaveAttribute("lang", /en/i);
});
