# WoWlix Marketing — DESIGN.md（Ink & Bone）

> **呢份係 landing + /pricing 嘅唯一設計真相。** 改任何 marketing 版面之前必讀。
> 出面睇到嘅嘢 = 呢份文件寫嘅嘢。如果兩者唔一致，**係文件要更新**，唔係照舊文件改 code。
>
> Surfaces：`/[locale]`（landing）同 `/[locale]/pricing`。**唔包租戶店**（見 §2 scoping）。

---

## 0. North Star（改嘢之前讀呢段）

呢版係**「一件印刷級 editorial 物件，啱好係一個 SaaS landing」** —— 唔係 template。

- **嚴格黑白**（Ink & Bone）。顏色只由**真實商戶截圖**提供。
- **有意識嘅不對稱** —— 唔好乜都置中對稱。
- **一個 tonal descent**：奶白 → 深墨（口碑島）→ 奶白 → 深墨（尾 CTA）。
- **一個 signature moment**（§6）—— 用「示範」而唔係「描述」產品。
- Motion 係**編排**過，唔係周圍撒。

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
| `components/marketing/fonts.ts` | Fraunces + Noto Serif HK 嘅 `next/font` 註冊（marketing 專用） |
| `components/marketing/plans.ts` | **`MARKETING_PLANS`** — 定價唯一真相（見 §7） |
| `components/marketing/WowlixLandingPage.tsx` | 成個 landing（單檔，含 `<style jsx global>`） |
| `components/marketing/StudioPricingPage.tsx` | `/pricing` |
| `app/globals.css`（`@theme inline`） | `--font-wlx-*` token + `--wlx-font-*` override hook |
| `public/demos/*.png` | 真實店舖截圖（唯一圖像來源） |

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

### 🔒 Scoping（唔可以妥協）
`marketingBrandVars` 只 apply 喺 **landing / pricing 個 root div 嘅 `style={}`**。
Base `:root`（`app/globals.css`）保持金色 —— **租戶店靠佢**。呢個係特登嘅（commit `c6464b0`）。
**永遠唔好**為咗方便而改 base token。

---

## 3. 字體

| 角色 | 字體 | 註冊喺 |
|---|---|---|
| 中文大標題 | **Noto Serif HK**（500/700/900） | `fonts.ts` |
| 英文 display + serif accent | **Fraunces**（variable，有真斜體，用 `opsz`/`SOFT` 軸） | `fonts.ts` |
| 內文 | Geist（沿用 base） | `app/layout.tsx` |

機制：`globals.css` 嘅 `--font-wlx-display` / `--font-wlx-serif` 有 `var(--wlx-font-*-latin/cjk, <原值>)` fallback hook；`marketingBrandVars` 覆寫嗰啲 hook。**即係 marketing 換字體，其他 surface 一個 byte 都唔變。**

規則：`.font-wlx-display{font-optical-sizing:auto}`；標題 size-bound tracking（hero `-0.035em`、h2 `-0.025em`）；h2 加 `[text-wrap:balance]`；內文 `leading-[1.65] [text-wrap:pretty]`；價錢 `[font-feature-settings:'tnum','lnum']`。

---

## 4. 版面 / 構圖

- **Hero = 不對稱 masthead**：巨型 display（`clamp(46px,10vw,128px)`）佔左，phone `lg:absolute` 由右上 bleed 過嚟壓住排版右邊留白，support copy 收喺 `max-w-[40ch]` 窄欄。**唔好改返置中。**
- **Features = bento**：`index===0` 係 2×2 大 tile + 真店截圖 bleed 出角；其餘細 tile。
- **口碑 = 深色島**（`bg-wlx-ink`）+ 不對稱 ledger（大 pull-quote `lg:col-span-7` + 細卡 rail `lg:col-span-5`）。
- **背景節奏**：paper → cream → paper → cream → **ink** → cream → **ink**。唔好搞到成版一片。
- **留白對比**：Stats/How 收緊（`py-12`/`py-16`），Features/口碑放開（`py-24 sm:py-40`）。
- **Editorial identity**（每個 section 都有）：角落巨型低調 watermark 字（`text-wlx-ink/[0.035]`，深色面用 `text-wlx-paper/[0.05]`）、`01–05` section 索引、eyebrow pill、fading hairline（唔用硬 `border-t`）。
- **Card = double-bezel**：外框 `rounded-[26px] p-[5px]` + 內核 `rounded-[21px]`（26−5，同心）+ inset 高光。
- **CTA = button-in-button**：箭咀嵌喺自己嘅圓圈入面，貼右內邊，`ease-[cubic-bezier(0.32,0.72,0,1)]`。
- Mobile：全部 `lg:` 前綴嘅 bleed/absolute 都要塌返單欄，**body 唔准橫向捲動**。

---

## 5. Motion（全部 progressive enhancement）

- **Reveal**：`.wlx-reveal` section 由 IntersectionObserver 加 `is-visible`；**子元素**帶 `.wlx-stagger` + `style={{"--i": i}}` 逐個 cascade（`calc(var(--i)*90ms)`）。
- **只喺 `.wlx-js` 之下先隱藏** → **冇 JS = 全部照見**。呢個係硬規則。
- **Scroll-timeline 效果**（hero 視差、nav 進度線、stats 數字 wipe）一律包 `@supports (animation-timeline: …)`；Safari/FF 見到嘅係靜態 fallback，**唔准爆**。
- 只 animate `transform` / `opacity`。唔准 scroll listener（用 IO 或 scroll-timeline）。
- 每個新 animation class 都要加入 `@media (prefers-reduced-motion: reduce)` 嘅 reset。
- Magnetic CTA 只喺 `(pointer:fine)` + 非 reduced-motion 生效；transform 掛喺 **wrapper span**，唔好同 Link 嘅 `active:scale` 爭。

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

---

## 9. 現行 Section 次序

`Nav → Hero(masthead) → Stats(01) → ✦ 真實店舖 signature(#stores) → Features(02, bento) → How(03) → 口碑(04, 深色島) → Pricing(05) → 尾 CTA(深色) → Footer`

> Pricing 特登排喺口碑之後、貼住尾 CTA —— 先建立慾望同信任，先講錢。**唔好搬返上去。**

---

## 10. 改完之後嘅檢查表

- [ ] `npm run ci:build` 綠
- [ ] 375px：冇橫向捲動、bleed/absolute 全部塌返單欄
- [ ] 深色面（口碑島、尾 CTA、推薦卡）：**冇任何嘢黑撞黑**
- [ ] 熄 JS：所有內容照見（`.wlx-js` 以外唔准隱藏）
- [ ] `prefers-reduced-motion`：新 animation 有 reset
- [ ] **租戶店**（`maysshop.localhost:3012`）字體同色**一個 pixel 都冇變**
- [ ] 中英兩版都睇過

---

## 11. 誠實嘅天花板

Code-only 大概去到 **~9/10**。剩低嗰段唔係前端做得到：
1. 啲 demo 截圖係彩色真拍，同嚴格 mono 本質上打交 —— 真 10 要**訂造 mono/duotone 攝影或 art direction**。
2. 最靚嗰浸 scroll motion 係 **Chromium-only**；要全平台一致就要孭 GSAP/Framer（我哋刻意唔孭）。
3. 再上就係 WebGL / 訂造插畫 —— 唔屬於 refactor 範疇。
