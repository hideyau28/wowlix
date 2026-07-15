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
// preload: false —— 上面句「tenant stores never load these fonts」以前係假嘅。
// app/[locale]/(customer)/page.tsx 同一條 route 服務 landing（platform mode）
// 同租戶店兩邊，而佢 static import 呢個 module，所以 next/font 將 preload hint
// （RSC payload 入面個 :HL）綁咗落成條 route —— 租戶店一隻字都冇用 Fraunces
// （face 全部 unloaded）但照樣白食成個 preload。notoSerifHK 一早已經因為同一個
// 原因收咗 preload:false，Fraunces 漏咗。代價：landing 個 hero 唔再 preload，
// display:swap 會有 FOUT。真正修法係 dynamic import 到 platform mode 先拉呢個
// module（兩邊都贏），但嗰個要郁 route 層 — 另開一個 task。
export const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  preload: false,
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
