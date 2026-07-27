// GAP A — 純函數守衛，唔使真 server / 真 Cloudinary / 真 DB。
// 直接 import lib 決策函數，測全 matrix。
import { test, expect } from "@playwright/test";
import {
  shouldUseTestAdapter,
  hasCloudinaryCredentials,
  type UploadEnv,
} from "../lib/upload/cloudinary";

/**
 * 真 bug（修之前）：`isTestMode = UPLOAD_TEST_MODE===1 || !hasCredentials()`。
 * production 一旦漏 Cloudinary credentials，就靜靜雞當 test mode、回一條假
 * `test-fake` URL —— 商戶以為上載成功但根本冇 asset（fail-open / data-integrity）。
 *
 * 而家：假 adapter 只可由「明確 UPLOAD_TEST_MODE=1」啟用，同時 VERCEL guard
 * 令個 flag 就算意外流入任何 Vercel 部署都失效；缺 credentials 一律 fail-loud。
 *
 * 呢啲全部係純函數斷言（deterministic），critical 個幾條 loop 3 次守穩。
 */

const FULL_CREDS: UploadEnv = {
  CLOUDINARY_CLOUD_NAME: "real-cloud",
  CLOUDINARY_API_KEY: "real-key",
  CLOUDINARY_API_SECRET: "real-secret",
};

test.describe("GAP A — upload test-adapter guard（fail-loud，唔 fail-open）", () => {
  test("CI / 本地 e2e：flag=1 + 非 Vercel → 用假 adapter", () => {
    // 有真 credentials 都好（本地 shell 可能 export 咗 .env.production），仍然唔打真服務。
    expect(shouldUseTestAdapter({ UPLOAD_TEST_MODE: "1" })).toBe(true);
    expect(
      shouldUseTestAdapter({ UPLOAD_TEST_MODE: "1", ...FULL_CREDS }),
    ).toBe(true);
  });

  test("[critical] 缺 credentials + 冇 flag → 唔可以 fake（正正係 fail-open 修正位）", () => {
    // 修之前呢個 case 會 !hasCredentials() → true → 假成功。而家必須 false（fail-loud）。
    for (let rep = 0; rep < 3; rep++) {
      expect(
        shouldUseTestAdapter({}),
        `rep ${rep}: 缺 creds 又冇 flag 唔准 fake`,
      ).toBe(false);
      expect(
        shouldUseTestAdapter({ UPLOAD_TEST_MODE: "0" }),
        `rep ${rep}: flag 唔係 1 唔准 fake`,
      ).toBe(false);
    }
  });

  test("[critical] flag=1 但喺 Vercel 部署（prod/preview）→ 一律唔 fake（誤設失效）", () => {
    for (let rep = 0; rep < 3; rep++) {
      expect(
        shouldUseTestAdapter({ UPLOAD_TEST_MODE: "1", VERCEL: "1" }),
        `rep ${rep}: Vercel 上誤設 flag 唔准 fake`,
      ).toBe(false);
      expect(
        shouldUseTestAdapter({ UPLOAD_TEST_MODE: "1", VERCEL: "1", ...FULL_CREDS }),
        `rep ${rep}: Vercel + creds + 誤設 flag 亦唔 fake`,
      ).toBe(false);
    }
  });

  test("正常 production：冇 flag + 有 creds → 唔 fake（行真上載）", () => {
    expect(shouldUseTestAdapter(FULL_CREDS)).toBe(false);
    expect(shouldUseTestAdapter({ VERCEL: "1", ...FULL_CREDS })).toBe(false);
  });

  test("hasCloudinaryCredentials：三個齊先算有", () => {
    expect(hasCloudinaryCredentials(FULL_CREDS)).toBe(true);
    expect(hasCloudinaryCredentials({})).toBe(false);
    expect(
      hasCloudinaryCredentials({
        CLOUDINARY_CLOUD_NAME: "c",
        CLOUDINARY_API_KEY: "k",
        // 缺 secret
      }),
    ).toBe(false);
  });
});
