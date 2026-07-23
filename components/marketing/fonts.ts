import { Fraunces, Noto_Serif_HK } from "next/font/google";

// Marketing-only display/serif type — registered here (not app/layout.tsx) so
// tenant stores, admin, and biolink surfaces never load these fonts. See
// app/globals.css --wlx-font-*-latin / --wlx-font-*-cjk hooks for how these
// wire into --font-wlx-display / --font-wlx-serif on marketing pages only.
// axes: ["opsz"] 一定要傳 —— next/font 預設淨係 request wght，冇咗 opsz 隻 fvar
// 就得 ['wght']，咁 font-optical-sizing:auto 同所有 'opsz' variation 都係 no-op。
// Fraunces 個 opsz default 係 9，所以個 128px hero 一直 render 緊 9pt 內文 master
// （粗襯線、低筆畫對比、鬆 fit）。加返軸之後 auto 會跟 font-size 行（範圍 9–144）。
// 代價：latin preload 80KB → 146KB。只加 opsz — SOFT 要多 118KB 但一個字得
// +0.79% 闊，WONK 個 rvrn 替換集冇數字（落 01–05 numerals 100% 死），兩隻都唔抵。
// preload: true —— 得閒改呢度之前必須明白邊啲 route 食緊呢個 module：
// preload hint 跟 static-import graph 行，所以邊個 static import、邊個就 preload。
// 而家嘅紀律（HANDOFF task ②，2026-07-23）：
//   ✓ app/[locale]/landing（靜態 platform landing —— 正正係要 preload 嘅 LCP 面）
//   ✓ /pricing（StudioPricingPage）、/start（start/layout）—— marketing 面，真用緊
//   ✗ 租戶 route 一律唔准 static import：(customer)/page.tsx 同五頁法律頁
//     （terms/privacy/contact/faq/about → MarketingLegalShell）已全部轉 lazy
//     import —— 以前 static import 年代租戶店白食 146KB preload 正正係呢度嚟。
// 邊個新 surface 要用 marketing fonts：platform-only 先准 static import；
// 租戶共用 route 一律 await import()。
// ⚠️ 唔好玩「另開一個 preload:true 副本 module」——next/font 將 preload flag
// 燒入 build 檔名（-s.p. vs -s.），兩個實例各指一份檔，preload 嗰份冇人用，
// 結果係雙倍下載（2026-07-23 實測 .next 證實）。
export const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  preload: true,
  variable: "--font-fraunces",
  display: "swap",
});

export const notoSerifHK = Noto_Serif_HK({
  weight: ["500", "700", "900"],
  subsets: ["latin"],
  preload: false,
  variable: "--font-noto-serif-hk",
  display: "swap",
});
