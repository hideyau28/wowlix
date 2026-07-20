import { test as base, expect } from "@playwright/test";

/**
 * Console gate：任何 spec 用呢個 test，頁面 console error / uncaught
 * exception 一律 fail —— 除咗 allowlist（公開頁 auth probe 嘅預期 401 等）。
 */
const CONSOLE_ERROR_ALLOWLIST: RegExp[] = [
  // storefront header / preview banner 喺未登入時 probe 自己身份 — 預期 401
  /Failed to load resource.*status of 401/,
  // 404 spec 特登行唔存在嘅嘢
  /Failed to load resource.*status of 404/,
  /favicon/i,
];

type Fixtures = {
  consoleGuard: void;
};

export const test = base.extend<Fixtures>({
  consoleGuard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        if (CONSOLE_ERROR_ALLOWLIST.some((re) => re.test(text))) return;
        errors.push(text);
      });
      page.on("pageerror", (err) => {
        errors.push(`pageerror: ${err.message}`);
      });
      await use();
      expect(
        errors,
        `頁面唔應該有 console error（allowlist 以外）:\n${errors.join("\n")}`,
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
