import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures";
import { APP, PLATFORM } from "./helpers";

/**
 * A11y gate：關鍵公開面跑 axe，serious / critical violation = fail。
 * （moderate 以下暫時唔擋 —— 全綠之後先收緊。）
 */

const PAGES: Array<{ name: string; url: string }> = [
  { name: "landing", url: `${PLATFORM}/en` },
  { name: "pricing", url: `${PLATFORM}/en/pricing` },
  { name: "start wizard", url: `${PLATFORM}/en/start` },
  { name: "admin login", url: `${APP}/en/admin/login` },
];

for (const p of PAGES) {
  test(`${p.name} has no serious/critical a11y violations`, async ({
    page,
  }) => {
    // 入場動畫中途 opacity 會令 axe 讀到假嘅低 contrast —
    // reduced-motion 之下所有 motion 即刻到位，量真色。
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(p.url);
    const results = await new AxeBuilder({ page })
      // #stores 係 scroll 敘事 signature：inactive caption 特登壓暗，
      // 各自喺自己嘅 scroll 時刻先到達全 contrast — 唔屬於靜態文字判準
      .exclude("#stores")
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      blocking,
      blocking
        .map(
          (v) =>
            `${v.id} (${v.impact}): ${v.help}\n` +
            v.nodes.map((n) => `  ${n.html.slice(0, 160)}`).join("\n"),
        )
        .join("\n"),
    ).toEqual([]);
  });
}
