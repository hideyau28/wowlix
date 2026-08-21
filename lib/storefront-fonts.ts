import {
  Bebas_Neue,
  Playfair_Display,
  Montserrat,
  Cormorant_Garamond,
  Inter,
  Lato,
} from "next/font/google";

// ── Storefront template fonts ────────────────────────────────────────────────
//
// 呢六隻以前住喺 app/[locale]/layout.tsx —— 即係全站每一條 route 嘅
// module graph 都有佢哋，而 next/font 個 preload hint 係跟 graph 行，
// 所以 **每一頁** 都 preload 足六隻。實測（`.next/server/next-font-manifest.js`
// 對住 `.next/static/media` 逐個 stat）：
//
//   /[locale]/admin/*        251 KB 字體，其中 192 KB 係呢六隻 —— admin 一隻都冇用
//   /[locale]/landing        396 KB，其中 192 KB 係呢六隻 —— marketing 面全部
//                            經 components/marketing/theme.ts 改用 Fraunces
//   /[locale]/[slug]         251 KB，用緊嘅只有該租戶 template 嗰兩隻
//
// prod 實測都係一樣（動態 route 唔出 <link rel=preload>，而係 React Flight
// 個 `:HL[...]` hint，效果一樣 —— 一開頁就落 9 隻字體）。
//
// 搬咗出嚟之後，只有真係用到嘅 surface 先 import：
//   • (customer)/layout —— HeroCarouselCMS 個 hero 用緊 Bebas + Montserrat
//   • [slug]/page 同 [slug]/product/[id]/page —— biolink 按租戶 template
//     揀 heading/body font（lib/cover-templates.ts）
//
// ⚠️ 六隻一定要留喺呢一個 module 入面共用。next/font 每 declare 一次就係一個
// instance，同一隻字體 declare 兩次會出兩份檔（preload flag 燒入檔名），
// 用家兩份都要落 —— components/marketing/fonts.ts 個註釋記低咗 2026-07-23
// 實測過呢個坑。想再收窄（例如 (customer) 只要 Bebas + Montserrat）就要
// 先解決呢件事，唔好靠開多個 module。
//
// preload 留 true：呢啲係 storefront 真正睇得見嘅標題字，租戶店個 LCP 面
// 唔應該食 FOUT。

export const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  display: "swap",
});

export const playfairDisplay = Playfair_Display({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const montserrat = Montserrat({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const cormorantGaramond = Cormorant_Garamond({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-cormorant",
  display: "swap",
});

export const inter = Inter({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const lato = Lato({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-lato",
  display: "swap",
});

/**
 * 六隻 template font 嘅 CSS variable className —— 擺喺 storefront subtree 個
 * 最外層 element。lib/fonts.ts `getFontVar()` 出嘅 `var(--font-*)` 同
 * ProductGrid / ProfileSection / FeaturedSection 直接寫 family name 嗰啲，
 * 都要喺呢個 subtree 入面先 resolve 得到。
 */
export const storefrontFontVars = [
  bebasNeue.variable,
  playfairDisplay.variable,
  montserrat.variable,
  cormorantGaramond.variable,
  inter.variable,
  lato.variable,
].join(" ");
