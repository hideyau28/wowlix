import { defineConfig, devices } from "@playwright/test";

// E2E 專用 port —— 唔好同 dev(3012)撞。
// NEXT_PUBLIC_API_URL / NEXT_PUBLIC_BASE_URL 必須指返呢個 server 自己：
// admin 頁嘅 server action 經 getApiBaseUrl() 打 API，.env 指住遠端嘅話
// dev JWT 會 401 ADMIN_AUTH_MISSING（見 docs/HANDOFF.md Phase F 坑）。
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;

// 本地 e2e 一律寫入獨立 local DB（scripts/e2e-local-db.sh 負責 create + db push），
// 唔准跟 .env 嗰個 shared DB —— 之前 e2e-* 測試店直接污染咗 prod sitemap
// （見 docs/HANDOFF.md 2026-07-22）。CI 唔使override：CI 有自己嘅 postgres service
// 經 process.env 供 DATABASE_URL。
const LOCAL_E2E_DB_URL = `postgresql://${process.env.USER || "postgres"}@localhost:5432/wowlix_e2e`;

// setup project（tenant.setup.ts）都要見到同一個 slug —— webServer.env 只落 server，
// test process 讀唔到就 fallback maysshop，而 maysshop 喺 register reserve list
// （sample 店保護），空 DB seed 會 400。CI 係 job-level env 兩邊都有；local 喺度補。
process.env.DEFAULT_TENANT_SLUG ||= "e2e-default";

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
      // 平台面 branding fetch resolve 呢個 slug；setup project 會 seed 佢。
      // 空 DB（CI service / 本地 wowlix_e2e）都冇 maysshop，一律用 e2e-default。
      DEFAULT_TENANT_SLUG: process.env.DEFAULT_TENANT_SLUG || "e2e-default",
      // 本地：硬性 override 落獨立 e2e DB（即使有人直接 npx playwright test
      // 冇行 bootstrap，都唔會寫入 shared DB —— 頂多 register 失敗 fail fast）。
      ...(process.env.CI ? {} : { DATABASE_URL: LOCAL_E2E_DB_URL }),
    },
  },
});
