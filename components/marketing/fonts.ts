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
export const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
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
