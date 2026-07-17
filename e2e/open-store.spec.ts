import { test, expect } from "./fixtures";
import { APP, PLATFORM, uid } from "./helpers";

/**
 * Flow 1：訪客開店全程 —— /start 六步 wizard 由零行到 admin dashboard，
 * 再驗埋間店真係 render 到。呢條係成個 platform 嘅命脈 flow。
 */
test("visitor opens a store end-to-end via /start wizard", async ({ page }) => {
  const id = uid();
  const shopName = `E2E Wizard ${id}`;
  const slug = `e2e-wizard-${id}`;

  await page.goto(`${PLATFORM}/en/start`);

  // Step 1 — 揀 plan（有 default，Next 直行）
  await page.getByRole("button", { name: /^Next/ }).click();

  // Step 2 — 店名 / slug / email / 密碼
  const textInputs = page.locator('input[type="text"]');
  await textInputs.first().fill(shopName); // Store Name
  await textInputs.nth(1).fill(slug); // wowlix.com/<slug>
  await expect(page.getByText("Available!")).toBeVisible(); // slug debounce check
  await page.locator('input[type="email"]').fill(`${slug}@example.com`);
  await page
    .getByPlaceholder("At least 8 chars, with a number")
    .fill("E2e-passw0rd-1234");
  await page
    .getByPlaceholder("Re-enter your password")
    .fill("E2e-passw0rd-1234");
  await page.getByRole("button", { name: /^Next/ }).click();

  // Step 3 — WhatsApp
  await page.locator('input[type="tel"]').first().fill("91234567");
  await page.getByRole("button", { name: /^Next/ }).click();

  // Step 4 — 收款：揀 FPS（default fpsMode=whatsapp，唔使再填）
  await page.getByText("FPS", { exact: false }).first().click();
  await page.getByRole("button", { name: /^Next/ }).click();

  // Step 5 — 風格（default 已選）→ 最尾個掣係「Create my store」，撳落去就 register
  await expect(page.getByText("Pick a style")).toBeVisible();
  await page.getByRole("button", { name: /Create my store/ }).click();

  // Step 6 — 完成頁（register 200 + auto-login）
  await expect(page.getByText("Your store is ready!")).toBeVisible({
    timeout: 20_000,
  });

  // 入後台 — auto-login cookie 應該已經生效
  await page.getByRole("link", { name: "Go to admin dashboard" }).click();
  await page.waitForURL("**/en/admin", { timeout: 20_000 });

  // 間店 storefront 真係 render 到（path-slug 路由）
  await page.goto(`${APP}/en/${slug}`);
  await expect(page.getByText(shopName).first()).toBeVisible({
    timeout: 15_000,
  });
});
