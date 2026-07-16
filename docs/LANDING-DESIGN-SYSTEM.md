# WoWlix Marketing — DESIGN.md（Ink & Bone）

> **呢份係 landing + /pricing 嘅唯一設計真相。** 改任何 marketing 版面之前必讀。
> 出面睇到嘅嘢 = 呢份文件寫嘅嘢。如果兩者唔一致，**係文件要更新**，唔係照舊文件改 code。
>
> Surfaces：`/[locale]`（landing）、`/[locale]/pricing`、`/[locale]/start`（開店 wizard）、法律/內容頁 **platform mode 分支**（about/terms/privacy/contact/faq，經 `MarketingLegalShell`）。**唔包租戶店**（見 §2 scoping）。

---

## 0. North Star（改嘢之前讀呢段）

呢版係**「一件印刷級 editorial 物件，啱好係一個 SaaS landing」** —— 唔係 template。

- **嚴格黑白**（Ink & Bone）。顏色只由**真實商戶截圖**提供。
- **有意識嘅不對稱** —— 唔好乜都置中對稱。
- **一個 tonal descent**：奶白 → 深墨（口碑島）→ 奶白 → 深墨（尾 CTA）。
- **一個 signature moment**（§6）—— 用「示範」而唔係「描述」產品。
- Motion 係**編排**過，唔係周圍撒。「高級感」嚟自 **scroll 全程持續有回應**（scroll-coupling），唔係入場動畫靚（§5、§11）。

### ⛔ 絕對唔好（會即刻打回 generic AI 味）
- ❌ 加返任何**彩色主色**（尤其橙 `#FF9500` —— 舊 doc 遺物，已廢除）
- ❌ 用 **Inter / Roboto / Arial / system-ui / Plus Jakarta / JetBrains Mono / Noto Sans TC**
- ❌ 紫色漸變、藍灰 SaaS 配色、任何 generic AI slop
- ❌ 灰色 placeholder 圖（一定要用 `public/demos/` 嘅真實店舖截圖）
- ❌ 加 animation library（Framer/GSAP）—— 全部用 CSS + IntersectionObserver
- ❌ 郁 `app/globals.css` 嘅 base `:root` token（租戶店靠佢，見 §2）

---

## 1. 系統住喺邊（File Map）

| 檔案 | 職責 |
|---|---|
| `components/marketing/theme.ts` | **`marketingBrandVars`** — 成套色 + font override token。**改色只改呢度。** |
| `components/marketing/fonts.ts` | Fraunces + Noto Serif HK 嘅 `next/font` 註冊（marketing 專用）。**軸同 preload 見 §3。** |
| `components/marketing/TypeStyles.tsx` | **`.font-wlx-display` 條 rule（optical sizing + feature settings）。兩個 surface 共用 —— 任何新 marketing surface 都要 render 佢。** |
| `components/marketing/plans.ts` | **`MARKETING_PLANS`** — 定價唯一真相（見 §7） |
| `components/marketing/WowlixLandingPage.tsx` | 成個 landing（單檔，含 `<style jsx global>`：`.wlx-*` motion 系統） |
| `components/marketing/StudioPricingPage.tsx` | `/pricing`（自己一套 `.studio-*` motion 系統，同 landing 獨立） |
| `app/[locale]/start/layout.tsx` | `/start` 嘅接皮位：`marketingBrandVars` + 兩隻 font variable + `<MarketingTypeStyles/>`。wizard 本體喺 `components/onboarding/OnboardingWizard.tsx`（**冇 motion 系統**，淨係 200ms transition —— 表單唔使 choreography） |
| `components/marketing/MarketingLegalShell.tsx` | 法律/內容頁 platform-mode 外殼：皮 + 自帶 nav/footer + **unlayered scoped CSS re-voice**（蓋過內容入面嘅 zinc/dark: utility，§8 坑 7 同一機制）。頁內 `if (await isPlatformMode())` 先包；租戶店行原本 zinc 版。內容 pill 掣要加 `.wlx-cta` 免俾 `a` 色規則蓋成 ink-on-ink |
| `app/globals.css`（`@theme inline`） | `--font-wlx-*` token + `--wlx-font-*` override hook |
| `public/demos/*.png` | 真實店舖截圖（唯一圖像來源） |

> **⚠️ 三個 surface（landing / pricing / start），唔係一個。** 共用嘢一律要抽出嚟（好似 `TypeStyles.tsx`），**唔好淨係寫喺
> `WowlixLandingPage` 個 `<style jsx global>` 度** —— 咁樣 `/pricing` 食唔到。踩過：所有字體
> rule 一直住喺 landing 入面，`/pricing` 13 個 `.font-wlx-display` 元素一條都食唔到，
> `font-feature-settings` 係 `normal`，冇 halt、冇 optical sizing（見 §8 坑 9）。
> 抄多份 = 兩個真相源 = 遲早走樣。要就抽 component。

> **已刪除、唔好搵：** `LandingPage.tsx`、`PricingPage.tsx`、`sections/HeroSection.tsx`、`landing.css`。
> **唔好改** `app/[locale]/(marketing)/layout.tsx` 嘅字體 —— 嗰 4 隻死 import 已移除，landing 根本唔喺嗰個 route group。

---

## 2. 色 — Ink & Bone（單色）

全部喺 `theme.ts` 嘅 `marketingBrandVars`：

```ts
"--wlx-paper":     "#F4F1EA",  // 暖米白底
"--wlx-cream":     "#EBE5DB",  // 交替 band
"--wlx-ink":       "#1A1815",  // 近黑（文字 / 深色面）
"--wlx-stone":     "#6E6A60",  // 次要文字
"--wlx-mist":      "#DCD6CA",  // 邊框 / hairline
"--wlx-accent":    "#1A1815",  // ⚠️ accent == ink（單色）
"--wlx-accent-fg": "#F4F1EA",
"--wlx-blush":     "#D6CDBF",  // 中性暖灰，只用於氛圍光暈
```

### 🚨 最重要一條規則：`accent == ink`
單色底下 accent 就係近黑。所以：

> **任何 `bg-wlx-accent` / `text-wlx-accent` 擺喺深色面（`bg-wlx-ink`）都會黑撞黑、完全隱形。**
> 深色面上一律**反白**：`bg-wlx-paper` + `text-wlx-ink`（掣/badge）、`text-wlx-paper`（剔、文字）。

已經反白咗嘅位（**唔好改返**）：尾 CTA 主掣、pricing 推薦（深色）卡嘅 badge / Check / 掣、深色口碑島全部元素。
淺色面上 `bg-wlx-accent`（黑掣喺米白底）**係啱嘅**，唔好郁。

### 🚨 第二條：深色面唔止「色」要反白 —— **elevation 都要**

呢條走過甩，因為佢匿喺 `box-shadow` 入面，唔係 `text-` / `bg-` 咁一眼睇到。

> **坐喺 `bg-wlx-ink` 之上嘅元素唔准落 drop shadow。** Shadow 色比 ink 淺 → composite 出嚟
> **比個底更光** = 一個「會發光嘅陰影」，即係死 CSS。
> 深色面要 elevation 就用 **paper inset hairline（alpha ≤ 0.18）**。

實測（口碑島兩張卡，`bg-wlx-paper/[0.04]` 疊 ink = `rgb(35,33,30)`）：

| | 落 paper 面 | 落 ink 面 |
|---|---|---|
| `inset 0 1px 0 rgba(255,255,255,0.6)` | `rgb(251)`，比底光 **+7** ✅ 微光 | `rgb(167)` 撞 border `rgb(56)`，對比 **4.96:1** ❌ 爆光管 |
| `0 18px 38px -28px rgba(44,32,28,0.3)` | 正常陰影 ✅ | `rgb(31,26,23)`，比 ink **光咗 5** ❌ 發光 |

同一句 declaration，兩個底差兩個數量級。現行值：`inset_0_1px_0_rgba(244,241,234,0.18)`（比 border 光 17、對比 1.29:1 —— catch-light，唔係光管）。

**⚠️ 呢條係睇「跌落乜嘢面」，唔係睇「張卡係咩色」** —— `bg-wlx-ink` 嘅嘢跌落淺色面（hero phone、pricing 推薦卡外框）照落大 drop shadow，嗰啲係啱嘅，唔好郁。

### 🔒 Scoping（唔可以妥協）
`marketingBrandVars` 只 apply 喺 **landing / pricing 個 root div 嘅 `style={}`** 同 **`/start` 個 layout wrapper**。
Base `:root`（`app/globals.css`）保持金色 —— **租戶店靠佢**。呢個係特登嘅（commit `c6464b0`）。
**永遠唔好**為咗方便而改 base token。

---

## 3. 字體

| 角色 | 字體 | 註冊喺 |
|---|---|---|
| 中文大標題 | **Noto Serif HK**（`weight: ["500","700","900"]`，`preload: false`） | `fonts.ts` |
| 英文 display + serif accent | **Fraunces**（variable，有真斜體，`axes: ["opsz"]`，`preload: false`） | `fonts.ts` |
| 內文 | Geist（沿用 base） | `app/layout.tsx` |

機制：`globals.css` 嘅 `--font-wlx-display` / `--font-wlx-serif` 有 `var(--wlx-font-*-latin/cjk, <原值>)` fallback hook；`marketingBrandVars` 覆寫嗰啲 hook。**即係 marketing 換字體，其他 surface 一個 byte 都唔變。**

### Fraunces 個 `opsz` 軸 — 一定要 `axes: ["opsz"]`

`next/font` **預設淨係 request `wght`**。冇明文傳 `axes` 就冇 opsz 軸，而 **Fraunces 個 opsz default 係 9** —— 即係個 128px hero 會 render 緊 **9pt 內文 master**（粗襯線、低筆畫對比、鬆 fit）。`font-optical-sizing: auto` 同所有 `'opsz'` variation 全部變 no-op。呢個坑食咗好耐（fontTools dump `fvar` 得 `['wght']`）。

- **只加 `opsz`。** SOFT 要多 118KB 但一個字得 +0.79% 闊；WONK 個 `rvrn` 替換集**冇數字**（落 01–05 numerals 100% 死），Google 又 serve default = 1。兩隻都唔抵。
- **唔准 pin `opsz`。** `font-variation-settings` 會**覆蓋** `font-optical-sizing: auto`。以前 hero / stat numerals 寫死 `'opsz' 144`，落到手機 46px 就係錯 master。要 auto 跟住 clamp 行。
- 代價：latin preload 80KB → 146KB。所以要配 `preload: false`（下面）。

### `preload: false` — 兩隻都要

`app/[locale]/(customer)/page.tsx` **同一條 route 服務 landing（platform mode）同租戶店兩邊**，而佢 static import `WowlixLandingPage → fonts.ts`。所以 `next/font` 將 preload hint（RSC payload 個 `:HL`）綁咗落成條 route，唔理行邊個分支 —— **租戶店一隻字都冇用 Fraunces（face 全部 `unloaded`）但照樣白食成個 preload**。

> 真正修法係 dynamic import 到 platform mode 先拉呢個 module（租戶店零洩漏 + landing 保住 preload），但要郁 route 層。未做。

### Noto Serif HK 兩個限制

1. **冇 italic face。** 落 `italic` 落 CJK = browser 機械剪切嘅假斜體漢字。所有 serif italic 元素要加 **`[font-synthesis-style:none]`** —— 字體匹配係逐字符嘅，所以句入面嘅 Latin 照行 Fraunces 真斜體（`font-synthesis` 只管合成出嚟嘅假 face）。**唔好**用 `lang === "en"` gate，中文 quote 裡面都有 Latin。
2. **冇 600。** `font-semibold` 想要 600 → CSS font matching 向上 resolve 到 **700**。即係同一個 h2，英文行 Fraunces 600、中文行 NSHK 700。知道就得，暫時接受。

### 約物（CJK 標點）— `halt`

Noto Serif HK 跟**港台慣例將全形標點置中**擺喺 em 格入面。內文啱，但 display 尺寸就變成一個窿：128px 之下「，」個 advance 係 122.9px 但墨迹只佔 `[51.4, 75.9]` —— 前後各吊住 ~51px 死空氣。

**`.font-wlx-display` 一律開 `'halt'`**（half-width alternates）。實測「，」`99.7px → 47.8px`。

### ⚠️ `font-feature-settings` 係「取代」唔係「merge」

寫低一次就會**整個蓋過** root 嗰句。踩過：`.font-wlx-display` 本來寫 `'ss01','dlig','kern'` —— 前兩隻 Fraunces 個 GSUB **根本冇**（實測得 `['liga','rvrn']`），而佢哋順手**靜靜雞殺咗** root 嘅 `liga` / `calt`。

現行（住喺 `components/marketing/TypeStyles.tsx`，**兩個 surface 共用**）：

```css
.font-wlx-display {
  font-optical-sizing: auto;
  font-feature-settings: 'kern', 'liga', 'calt', 'halt';
}
```

> 價錢個 `[font-feature-settings:'tnum','lnum']` 同樣會蓋走上面四隻 —— 對 `$78` 呢類 Latin 數字嚟講係啱嘅，唔使補。

其餘規則：標題 size-bound tracking（hero `-0.04em`、h2 `-0.025em`）；h2 加 `[text-wrap:balance]` + `max-w-[24ch]`（48px 冇 measure bound 會拉直成條）；內文 `leading-[1.65] [text-wrap:pretty]`。

> **每個 section h2 都一定要有 `font-wlx-display`。** 漏咗就由 root 繼承 `font-wlx-sans` = Geist + **PingFang HK 黑體**，中文版會喺一堆襯線標題中間跳出一個黑體。踩過（Stats 01）。

---

## 4. 版面 / 構圖

- **Hero = 不對稱 masthead**：巨型 display（`clamp(46px,10vw,128px)`）佔左，phone `lg:absolute` 由右上 bleed 過嚟壓住排版右邊留白，support copy 收喺 `max-w-[40ch]` 窄欄。**唔好改返置中。**
- **Features = bento**：`index===0` 係 2×2 大 tile + 真店截圖 bleed 出角；其餘細 tile。
- **口碑 = 深色島**（`bg-wlx-ink`）+ 不對稱 ledger（大 pull-quote `lg:col-span-7` + 細卡 rail `lg:col-span-5`）。
- **背景節奏**（逐個 section 實測，唔好靠估）：

  | Stats(01) | #stores | Features(02) | How(03) | 口碑(04) | Pricing(05) | 尾 CTA |
  |---|---|---|---|---|---|---|
  | cream | paper | paper | cream | **ink** | cream | **ink** |

  兩個 tonal descent（paper→ink）落喺口碑島同尾 CTA。**`#stores` 同 Features 特登都係 paper** —— signature demo 加佢自己嘅解釋係「一個 paper chapter」，由頂/底 hairline 夾住，中間唔落 rule 係設計。唔好為咗「唔好一片」而硬拆呢兩個 —— `#stores` 根本唔平，個 300px 釘住 phone cross-fade 住三張真店彩圖，係全版最大嘅 tonal event。
- **留白對比**：Stats/How 收緊（`py-12`/`py-16`），Features/口碑放開（`py-24 sm:py-40`）。
- **Editorial identity**（每個 section 都有）：角落巨型低調 watermark 字（`text-wlx-ink/[0.035]`，深色面用 `text-wlx-paper/[0.05]`）、`01–05` section 索引、eyebrow pill、fading hairline（唔用硬 `border-t`）。
- **Card = double-bezel**：外框 `rounded-[26px] p-[5px]` + 內核 `rounded-[21px]`（26−5，同心）+ inset 高光。
- **CTA = button-in-button**：箭咀嵌喺自己嘅圓圈入面，貼右內邊，`ease-[cubic-bezier(0.32,0.72,0,1)]`。
- Mobile：全部 `lg:` 前綴嘅 bleed/absolute 都要塌返單欄，**body 唔准橫向捲動**。

---

## 5. Motion（全部 progressive enhancement）

- **Reveal**：`.wlx-reveal` section 由 IntersectionObserver 加 `is-visible`；**子元素**帶 `.wlx-stagger` + `style={{"--i": i}}` 逐個 cascade（`calc(var(--i)*90ms)`）。
- **只喺 `.wlx-js` 之下先隱藏** → **冇 JS = 全部照見**。呢個係硬規則。
- **Scroll-timeline 效果**（hero 視差、nav 進度線、stats 數字 wipe、`.wlx-mark`/`.wlx-bleed`/`.wlx-shot` scroll-coupling）一律包 `@supports (animation-timeline: …)`；Safari/FF 見到嘅係靜態 fallback，**唔准爆**。
- 只 animate `transform` / `opacity`。唔准 scroll listener（用 IO 或 scroll-timeline）。**唔准 animate `filter`**（blur 每 frame 重新光柵化，中價 HK 手機捱唔住 —— `/pricing` 入場踩過）。
- 每個新 animation class 都要加入 `@media (prefers-reduced-motion: reduce)` 嘅 reset。
- Magnetic CTA 只喺 `(pointer:fine)` + 非 reduced-motion 生效；transform 掛喺 **wrapper span**，唔好同 Link 嘅 `active:scale` 爭。

### 🚨 `view()` 目標唔准有 `overflow-hidden` 祖先

`overflow: hidden` 會**製造一個 scroll container**，而 `view()` timeline 就攞佢做 scrollport —— 但佢自己永遠唔 scroll，所以 animation `progress` **直接凍死**，靜靜地 render 成「已完成」個樣。

> **全部帶 `view()` 嘅祖先一律用 `overflow-clip`**（唔製造 scroll container，剪裁效果一模一樣）。改返 `overflow-hidden` = 靜靜雞殺死全部 scroll-coupling。

踩過：stats 數字 wipe（DESIGN.md 一直吹緊嗰個）**其實從來冇 run 過** —— 五個 section wrapper 全部 `overflow-hidden`，`currentTime` 凍死喺 38.4%、clip-path 全開。改晒 `overflow-clip` 先郁到。

> ⚠️ 呢條同 §6「signature section 唔准 `overflow-hidden`」係兩件唔同事：§6 係救 `sticky`，呢條係救 `view()`。兩個都唔好用 `overflow-hidden`。

### 短頁唔好硬加 `view()`

`view()` 要元素**由 fold 以下捲入嚟**先有嘢做。`/pricing` 係短頁，plan 卡 `docTop = 515px`，一 load 就喺畫面入面，`entry` 階段過晒 → `currentTime = null`、全程唔郁 = 死 CSS。試過拆咗。加之前先量 `docTop` vs viewport 高。

### 兩個 surface 兩套 motion 系統

- **landing** = `.wlx-*`（`.wlx-reveal` / `.wlx-stagger` + scroll-coupling）。
- **`/pricing`** = `.studio-*`（`.studio-reveal` IntersectionObserver 入場，冇 scroll-coupling —— 短頁，見上）。

兩套獨立、命名唔同。統一係 architecture 決定，未做 —— **改一邊唔會影響另一邊，唔好當佢哋共用**。

---

## 6. Signature Moment（呢版嘅靈魂，唔好拆）

Stats 之後個 `#stores` section：**phone 釘住（`sticky`），3 間真店（petitfleur → hypedrops → greenday）隨住 caption scroll 過而喺螢幕內 cross-fade** —— 用「示範」證明「乜嘢店都撐得起」。

- 靠 **IntersectionObserver + `activeShop` state**（跨瀏覽器），唔用 Chromium-only scroll-timeline。
- Desktop：右欄 `hidden lg:block` + `sticky top-[14vh] h-[72vh]`；Mobile：每個 caption 下面直接排自己嘅店圖。
- **⚠️ 呢個 section 唔准有 `overflow-hidden`** —— 會即刻整死 `position: sticky`（踩過）。

---

## 7. 定價資料（單一真相）

`components/marketing/plans.ts` = **`MARKETING_PLANS`**，landing teaser 同 `/pricing` 兩邊都由佢 render。

- 現行：**$0 / $78 / $198**，推薦 = **Lite**，badge = 「推薦 / Recommended」。
- 必須同 `lib/stripe-subscription.ts`（真收費）+ `lib/plan.ts`（`PLAN_LIMITS` 真權限）對得上。
- **唔好**喺任何 component 硬寫價錢。改價 → 改 `plans.ts` + 上面兩個 lib。
- `plans.ts` **唔准 import `lib/plan.ts`**（嗰邊拉 prisma，呢邊係 client component）。

---

## 8. 踩過嘅坑（唔好再踩）

1. **`accent == ink`** → accent 擺深色面 = 隱形。深色面一律反白。（見 §2）
2. **同一個元素兩個 class 都set `animation`** → 後者覆蓋前者，另一個效果直接消失。曾經令 hero phone 卡死喺 `opacity:0`（parallax 食咗 fade-up）。要就合併成一個 `animation:` list + `animation-timeline: auto, scroll(root)`。
3. **`overflow-hidden` 會整死 `position: sticky`**（signature section 踩過）。
4. **`<style jsx global>` 係 template literal** → CSS comment 入面**唔准有 backtick**，會提前終止字串、build 直接爆。
5. **Locale**：component 收到怪 locale 會炸 `plan.features[locale]` → 一律先 normalize `const lang = locale === "zh-HK" ? "zh-HK" : "en"`。
6. **CI 個 `build` job 一路紅**（prisma migrate `relation "Tenant" does not exist`）—— 同 landing 無關，係另一條 P0 線。
7. **`transition-property` 都會中坑 2。** 唔淨止 `animation`。`.wlx-stagger` 個 global rule 收窄咗 `transition-property` 做幾個名，而佢係 **unlayered**、Tailwind utility 喺 `@layer utilities` —— unlayered 硬食 layered。所以卡自己嘅 `transition-all` + `hover:-translate-y-1` 會輸，hover 0ms 硬跳（`translate`/`box-shadow` 唔喺 list）。要就喺 global rule 度一齊報 hover 嗰啲 property（per-property delay，唔好用 blanket `transition-delay`，否則 hover 會孭埋 stagger delay）。
8. **淺色卡 shadow recipe 唔准照抄去深色面。** 口碑島兩張 figure 曾經逐個字 copy 咗 bento 卡條 recipe → 白 inset 喺 ink 面 composite 出光管（見 §2 第二條）。**Copy 卡樣式之前先問：底色係咩？**
9. **共用 rule 唔好淨係寫喺 landing 個 `<style jsx global>`。** `/pricing` 係另一個 component，食唔到。所有字體 rule 一直漏咗 `/pricing`（13 個 `.font-wlx-display` 元素 `font-feature-settings: normal`）。共用嘢抽 component（`TypeStyles.tsx`），唔好抄。
10. **`rgba(44,32,28)`（#2C201C）唔存在。** 一隻 `theme.ts` 冇嘅暖啡色，曾經係最常用嘅 shadow 色（landing 5 處 + pricing 4 處）。全部 → `rgba(26,24,21)`（真 ink）。幾何唔郁 —— 最強嗰層 R channel 差 ~6/255，blur + 負 spread 之下睇唔到。改色只改 `theme.ts`（§2）。

---

## 9. 現行 Section 次序

`Nav → Hero(masthead) → Stats(01) → ✦ 真實店舖 signature(#stores) → Features(02, bento) → How(03) → 口碑(04, 深色島) → Pricing(05) → 尾 CTA(深色) → Footer`

> Pricing 特登排喺口碑之後、貼住尾 CTA —— 先建立慾望同信任，先講錢。**唔好搬返上去。**

---

## 10. 改完之後嘅檢查表

- [ ] `npm run ci:build` 綠
- [ ] 375px：冇橫向捲動、bleed/absolute 全部塌返單欄
- [ ] 深色面（口碑島、尾 CTA、推薦卡）：**冇任何嘢黑撞黑**，亦冇 drop shadow 發光（§2 第二條）
- [ ] 熄 JS：所有內容照見（`.wlx-js` 以外唔准隱藏）
- [ ] `prefers-reduced-motion`：新 animation 有 reset
- [ ] **改咗字體 rule？三個 surface 都要睇**（landing、`/pricing`、`/start`）—— 唔好淨係睇 landing
- [ ] **改咗 `overflow`？** 帶 `view()` 嘅祖先要 `overflow-clip` 唔係 `hidden`；量返 animation `currentTime` 真係跟 scroll 郁（唔係凍死喺一個值）
- [ ] **租戶店**（`maysshop.localhost:3012`）字體同色**一個 pixel 都冇變**；改咗 `fonts.ts` 要 grep 租戶店 HTML 冇多咗字體 preload
- [ ] 中英兩版都睇過（CJK 標點收窄、serif italic 冇假斜體、標題全部襯線）

---

## 11. 誠實嘅天花板

Code-only 大概去到 **~9/10**。剩低嗰段唔係前端做得到：
1. 啲 demo 截圖係彩色真拍，同嚴格 mono 本質上打交 —— 真 10 要**訂造 mono/duotone 攝影或 art direction**。（試過 CSS letterpress / duotone filter 假裝，全部係被 cargo-cult 到爛嘅 snippet，出嚟更 template。冇路。）
2. 最靚嗰浸 scroll motion 係 **Chromium-only**；要全平台一致就要孭 GSAP/Framer（我哋刻意唔孭）。
3. 再上就係 WebGL / 訂造插畫 —— 唔屬於 refactor 範疇。

> **`view()` scroll-coupling 係真嘅、驗證過跟 scroll 郁（唔係死 CSS）**：landing 個 stats wipe、`.wlx-mark` watermark 視差、`.wlx-bleed` bento 截圖、`.wlx-shot` 手機店圖。實測 `currentTime` 隨 scroll 變、`document.getAnimations()` 有 12 個 scroll-linked。**唔好因為「睇落似冇效果」就當佢死 CSS 拆走** —— Chromium 先睇到，而且 preview pane 成日 render 唔到呢版嘅 scroll 狀態（fixed grain + sticky 撞爆 compositor）。要驗證就用 `getAnimations()[0].currentTime` 喺唔同 `scrollY` 抽樣。
