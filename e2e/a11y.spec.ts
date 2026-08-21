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

// 深色 OS 訪客上 platform 法律頁：MarketingLegalShell 強制淺色皮，內容入面
// 嘅 dark:text-zinc-* utility 曾經令答案文字 ≈2.2:1（review 抓到）。展開所有
// FAQ 之後喺 dark 配色下跑 axe。
test("platform FAQ stays readable for dark-OS visitors", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  // networkidle：等 (customer)/loading.tsx Suspense 邊界嘅 streamed RSC payload
  // 收晒 + 所有 hydration JS chunk load 完，之後嗰個 <details> 子樹先唔會再被替換。
  // 舊寫法用 page.locator("summary").all() 喺 stream 完成前影低一批 ElementHandle
  // 再逐個 click，被替換嗰刻 handle 就 detach（CI 三次 timeout：waiting for
  // locator('summary').nth(4) — element was detached from the DOM）。
  await page.goto(`${PLATFORM}/en/faq`, { waitUntil: "networkidle" });

  const shell = page.locator(".wlx-legal-content");
  await expect(shell).toBeVisible();

  const details = shell.locator("details");
  // details.first() 係 live locator，auto-wait 到 stream 後嘅真節點 attached。
  await expect(details.first()).toBeVisible();

  // 用 expect.poll 包住「對當刻 live collection 原子展開 + 讀返 state」，一路
  // retry 到 state 穩定 —— 唔靠任何 framework internal（例如 __reactContainer$…
  // 呢類 undocumented private key，React 版本一轉就假紅）。<details> 係 server
  // render 嘅靜態 markup（冇 open prop），HTMLDetailsElement.open 係 uncontrolled，
  // React 唔會管呢個 attribute，所以純 DOM 展開唔會撞 hydration。
  //
  // 一個 poll pass = 對「當刻」DOM 全部 <details> set open=true，即刻讀返幾多真係
  // open。若 stream / hydration 途中子樹俾替換，evaluateAll 下一個 poll 會攞返
  // fresh handle 對『新嗰批』重新展開，冇 snapshot-then-click 嘅 detach race。
  // 穩定條件：count>0 且全部 open —— 回 count（否則回 -1 令 poll 繼續）。
  await expect
    .poll(
      async () =>
        details.evaluateAll((els) => {
          for (const el of els) (el as HTMLDetailsElement).open = true;
          const total = els.length;
          const open = els.filter(
            (el) => (el as HTMLDetailsElement).open,
          ).length;
          return total > 0 && open === total ? total : -1;
        }),
      { message: "platform FAQ <details> 應該全部展開且穩定（純 DOM 觀測）" },
    )
    .toBeGreaterThan(0);

  // 再用 live locator 對「目前」collection 做一次唯讀 re-verify —— 確認 poll 之後
  // 冇再被替換、全部仍然 open。同樣 evaluateAll 讀當刻 state，唔影 snapshot。
  const state = await details.evaluateAll((els) => ({
    count: els.length,
    open: els.filter((el) => (el as HTMLDetailsElement).open).length,
  }));
  expect(state.count).toBeGreaterThan(0);
  expect(state.open).toBe(state.count);

  // 展開後至少一條答案文字要真係可見 —— 保住條 test 嘅意義：axe 量嘅係
  // 「展開狀態下」答案 div 喺 dark 配色嘅 contrast，唔係摺埋嗰陣量唔到。
  await expect(shell.locator("details > div").first()).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include(".wlx-legal-content")
    .withRules(["color-contrast"])
    .analyze();
  expect(
    results.violations,
    results.violations
      .map((v) => v.nodes.map((n) => n.html.slice(0, 160)).join("\n"))
      .join("\n"),
  ).toEqual([]);
});

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
