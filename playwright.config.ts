import { defineConfig, devices } from "@playwright/test";

// E2E 專用 port —— 唔好同 dev(3012)撞。
// NEXT_PUBLIC_API_URL / NEXT_PUBLIC_BASE_URL 必須指返呢個 server 自己：
// admin 頁嘅 server action 經 getApiBaseUrl() 打 API，.env 指住遠端嘅話
// dev JWT 會 401 ADMIN_AUTH_MISSING（見 docs/HANDOFF.md Phase F 坑）。
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.artifacts/test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never", outputFolder: "e2e/.artifacts/report" }]]
    : [["list"]],
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // CI：先 build 後 start（快 + 接近 prod）；local：next dev（唔使預先 build，
    // 但要熄咗 3012 dev server 先跑 —— 兩個 next 實例會爭 .next）
    command: process.env.CI
      ? `npx next start -p ${PORT}`
      : `npx next dev -p ${PORT}`,
    url: BASE,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_API_URL: BASE,
      NEXT_PUBLIC_BASE_URL: BASE,
    },
  },
});
