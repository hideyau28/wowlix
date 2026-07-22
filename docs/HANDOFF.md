# HANDOFF — 2026-07-15（landing 線）

> 交接俾下一個 session。另一條 P0 後端線見最底。

---

## ✅ 2026-07-22:出 prod 後現況 + audit Sprint 1（branch `fix/audit-sprint1`）

**狀態更正**:#345（landing 重設計）/ #346（安全硬化）/ #347（CI）已於 2026-07-20 全部 merge 入 main 出咗 prod —— 下面「等 Yau merge #345」等字眼已過時,留底做歷史。

**外部 audit（wowlix.com,13 條）→ 13 agent 逐條對 code adversarial verify**:13 條全部係真問題,但 4 條修正框架 ——
- 商品 URL:`(customer)/product/[id]` route **已存在**（含 canonical + Product/BreadcrumbList JSON-LD）,只欠 biolink 店 wiring + sitemap;
- LCP 真兇係 `force-dynamic` + hero 標題開場 clip-path 收埋 900ms + Fraunces 冇 preload（**唔係** audit 講嘅 CSS/圖片/動畫 —— repo 自己 Lighthouse artifact 證明嗰啲已 pass）;
- JSON-LD 部分存在（FAQ/product ✓）,另發現 Organization node 擺錯位（只喺 store branch render + hardcode 平台身份）;
- 「7 款收款方式」係作嘅 —— 收款方式根本冇 plan-gate,marketing 版先啱。
- Live sitemap 實測（2026-07-21）:**1008 URL,672（67%）係 test/e2e 污染**（比 audit 見嘅 478/224 仲惡化咗）。

**Sprint 1 已落（6 commit,ci:build 綠）**:
`9e38ead` sitemap 排除 e2e-/test/phase-/wowlix/www/demo + register reserve;`df8c961` hreflang 絕對化 + self-ref canonical;`9ffe818` 收款文案統一;`8c44bbe` 「示範店舖」誠實化 + nav 44px + 雙色 focus 環;`50dba96` 商品卡 keyboard-operable;`4d72c12` WhatsApp header aria-label。

⚠️ **根因未解**:e2e 寫緊同一個 DB（`e2e/setup/tenant.setup.ts:7`）,sitemap filter 只係遮掩 —— 要隔離 CI/e2e DB + purge 現有 `e2e-*`/`test.*`/`phase-*` row（獨立 task）。

**Sprint 2 backlog（#8-13,M effort）**:register step-2 a11y（label/name/form/aria/focus）、商品 URL wiring（reuse 現有 route + sitemap products）、店舖 grid `content-visibility`、product sheet dialog a11y hook、JSON-LD 三面（landing Organization+SoftwareApplication / pricing offers / 店 Store+ItemList）+ 修 Organization 擺錯位、LCP 三招（標題即畫 + platform-only Fraunces preload + 考慮除 force-dynamic）。

---

## 🚀 2026-07-16 深夜：全站提升 programme — 交接（新 session 由呢度開始）

**目標（Yau 原話）**：要俾人信任度、覺得係一個專業嘅平台；成個流程有心、高級；全網每一頁每一條 flow 都要行一次。

### 已完成（全部喺 branch，build 綠）

1. **執行修正批**（9 commit）：Fraunces opsz 軸（hero 由 9pt 內文 master 變真 display cut）、halt 約物（全形標點收半形）、假斜體/黑體標題/引號 CJK 三修、hover transition 撞車、深色島光管 shadow、TypeStyles 抽出共用（/pricing 先至第一次食到字體 rule）、fraunces preload:false（租戶店慳返 146KB）、scroll-coupling（view() 凍結 bug：**祖先 overflow-hidden 會凍死 view()，一律用 overflow-clip** —— 已寫入 DESIGN.md）。
2. **卡收款封盤**（`e3bc8c8` + `9971661`）—— 見下面 2026-07-16 更新 section。
3. **Motion loop 兩波**（`58303b6` + `0114b9c` + `5006cdc`）：judge panel 中位數 **7.2 → 8.2**。十六招落地，全部真 browser 逐效果實測。
4. **Phase D 完成**（`f254132` + `925ef5c`，2026-07-17）：
   - **D-1 404/500 換血**：新共用 `components/ErrorScreen.tsx`（base `--wlx-*` token，中性淺色），五頁重寫（root/locale not-found+error、[slug] store-not-found）—— 剷走橙色舊品牌，租戶店客唔再見到平台橙色搶戲。實測 platform store-404 + 租戶 deep-404。
   - **D-2 法律/內容頁上皮**：新 `components/marketing/MarketingLegalShell.tsx`（unlayered scoped CSS re-voice，唔使逐頁改 class），about/terms/privacy/contact/faq 加 `isPlatformMode()` gate。實測 platform terms/contact/faq 有皮、maysshop 租戶版一 pixel 唔變。contact WhatsApp 掣 platform 面轉單色 pill（`.wlx-cta` 防 ink-on-ink）。
   - **Footer audit**：landing/pricing/租戶店全部 link 有對應 route，**零死鏈**（唔使改）。
   - ⚠️ 未做/發現：platform mode 內容頁文案仍然係 maysshop 店味（title「- B」、「以下係關於 B 嘅常見問題」）—— 見「等 Yau」；shipping/returns 冇 gate（淨係租戶 footer 連去，platform 直入先會見，低危）。
5. **Phase E 完成**（2026-07-17）：
   - **E-1 admin auth 三頁 DS 對齊**（`12f79ea`）—— login/forgot/reset CTA 統一 admin 款、zinc 清零、no-op hover 修。
   - **Middleware auth route 修正**：發現真 bug —— auth guard 只放行 `/admin/login`，**未登入嘅人去 forgot/reset-password 會被彈返 login，成條忘記密碼 flow 根本行唔通**（E-1 驗收見到卡係因為當時登入咗，亦因此見到「admin chrome 包住 forgot 卡」嗰個怪相 —— 兩個問題同源）。修法（經 review workflow 兩輪打磨）：`isAuthRoute`（login|forgot-password|reset-password）做 guard 放行；middleware 嘅「登入咗彈 dashboard」**只做 login** 並加 `!isApiRoute`（唔加嘅話 regex 個 `[^/]+` 會食埋 `api`，帶 cookie POST `/api/admin/login` 被 307 去唔存在嘅 `/api/admin` —— pre-existing bug 順手修埋）；forgot-password 嘅彈走搬咗去 page 層 `forgot-password/layout.tsx` 用 `verifyToken()` **真驗 JWT 先彈**（middleware 只查 cookie 存在 —— 揸 stale/爛 cookie 嘅人正正最需要恢復頁，唔可以憑存在就彈走）；reset-password 永遠唔彈（email link flow）。實測：未登入 forgot/reset 都入到、有效 token 行 forgot → dashboard、爛 cookie 行 forgot 照入到、帶 cookie POST forgot API 直達 handler。
   - **後台輕手（product register flow）**：150–250ms micro-transition，冇 choreography。Product modal + badge modal 入場（backdrop fade 200ms + panel slide-in-from-bottom-2 200ms ease-out）、badge dropdown 150ms、error banner slide-in、bulk bar fade、register flow 主要互動元素補 `transition-colors`（150ms；頁內其他角落——pagination/filter dropdown 等——未掃，屬後續 polish）、touched 範圍內嘅 no-op hover（stone→stone）修做 `hover:text-wlx-ink`、每個 animate-in 都有 `motion-reduce:animate-none`。全部用現成 `tw-animate-css` utility，零新 CSS。
   - 實測：開 disposable 測試店 `phase-e-motion` 行成條 create flow（modal 開 → 揀類型 → 入名/價 → Create → 張枱即時出「測試蛋糕 Phase E」）；computed style 證實 backdrop/panel/dropdown 動畫真係行緊（`enter` @ 0.2s/0.15s）；ci:build 綠。
6. **Phase F 完成**（2026-07-17）—— **成個 programme 最後一個 phase**：
   - **六條 flow Playwright e2e 落 CI**（`e2e/`，27 條 spec 全綠）：訪客開店全程（/start 六步 wizard 行到 admin + storefront render）、登入（錯/啱/已登入彈走）、忘記密碼（含**爛 cookie 唔准鎖死恢復頁** —— Phase E 修正嘅 regression 測試）、法律（platform 有皮 / 租戶無皮）、繁↔EN（`<html lang>` + 切換）、404 三層 + **深色 OS FAQ 可讀性**。
   - **三重 gate**：console error 零容忍 fixture（all specs auto，allowlist 只留公開頁 auth probe 嘅 401/404）、axe a11y serious/critical 零容忍（landing/pricing/start/login + 深色 FAQ）、Lighthouse a11y+SEO ≥0.9 硬 gate（`lighthouserc.cjs`）。實測 Lighthouse landing 92/96/100/92、pricing 97/98/100/100。
   - **CI 新 `e2e` job**：postgres service + `prisma db push`（migrate chain 空 DB 會爆 = P0 線問題）+ build + playwright + lhci。
   - **e2e 揭到 + 修咗嘅真 bug**：① `<html lang>` 寫死 zh-HK（`/en` 頁 screen reader 用中文聲讀英文）→ middleware `x-locale` header + `HtmlLangSync`；② `--wlx-stone` #6E6A60 喺 cream 上 4.3:1 唔過 WCAG AA → #686459（4.71:1，肉眼無感）；③ 空 DB `/api/tenant/branding` 500（default tenant 唔存在）→ e2e setup seed default tenant + CI `DEFAULT_TENANT_SLUG`；④ platform 法律頁深色 OS 文字 2.2:1（`MarketingLegalShell` override list 冇 `div` + dark: utility specificity 高）→ `!important` + 拍平深色底。
   - **成條 branch review**（6-bucket 多角度 + adversarial verify）：唯一 confirmed = 上面 ④，已修。其餘 dismiss（pre-existing on main 或非本 branch 引入）—— 見「等 Yau / 安全跟進」。
   - **e2e 慣例**：測試店一律 `e2e-*` 前綴（同 `phase-*` 一齊入待清名單）；e2e server 必須自己打自己（`NEXT_PUBLIC_API_URL/BASE_URL=localhost:3100`，否則 admin SSR 死 —— 即上面 Phase E 記低嗰個 dev env 坑，已喺 `playwright.config.ts` webServer.env 定死）。
7. **Phase C 完成收貨**（`73d3c41`，2026-07-17 全 flow 驗埋尾）：/start 六步 wizard 上 Ink & Bone 皮（layout 級 subtree override + double-bezel 卡 + pill CTA + WoWlix wordmark 錨）；殺咗 step 1 Pro 深色卡 accent==ink 蟲（✓/radio/ring 黑撞黑）；裝飾色全轉單色（error 紅、Google logo、template 預覽色保留）。實測：Yau set 咗 `TENANT_JWT_SECRET` 之後真開咗間測試店 `phase-c-tea`（register 200 → step 6 完成頁 → 自動登入 admin 3/6 checklist → 店舖真 render），中英 + 375px 無橫捲，租戶店 face 全 unloaded、token 原色（新店自己彩色主題，證明零 mono 滲入），ci:build 綠。DESIGN.md 已記入 /start 做第三個 surface。

### Motion loop 點重跑（分數 8.2，目標 10）

- Script 喺 **`.claude/workflows/motion-overdrive.js`**（唔好again擺 /tmp —— 會俾系統清）。
- 用法：`Workflow({ scriptPath: ".claude/workflows/motion-overdrive.js" })`。舊 run 嘅 cache（wf_ff492ead-d4e）新 session 用唔到，fresh run 會自己重新評 baseline（≈8.2）再爬。
- 要 dev server：`preview_start {name:"dev"}`（port 3012），target `wowlix.localhost:3012`（**淨 localhost = May's Shop sample 店，唔係 WoWlix**）。
- 已知第三波候選（判到一半俾 session limit 斬）：masthead 退場鏡像、hero release ensemble 補完（sub/CTA 各自速率）、phone halo 拖光、島 rail 反向視差、island figcaption 順序畫線、/pricing 逐卡 IO cascade + FAQ ledger + nav hairline（scroll(root) 短頁都得）、尾 CTA 墨水傾瀉 + paper glow breathe、stats @property 數字 settle、compositor 衛生（unspray will-change、reduced-motion gate .wlx-progress）、bento bleed 剷 700ms grayscale filter（§5）。
- Session limit 會斷 workflow —— 斷咗就 keep going：睇 journal 執返已完成嘅嘢，主 loop 自己做得嘅自己做。

### 跟住落嚟（順序）

**四個 phase（C/D/E/F）全部完成。programme 嘅 code 部分收晒尾，剩返係 Yau 決定 + 安全跟進。**

- **等 Yau 收貨 + merge #345**（branch 已好大，53 commit；考慮分段 merge 定一次過）。
- ⚠️ **CI 個 `build` job 仍然紅** —— pre-existing prisma migrate `relation "Tenant" does not exist`，同 landing/Phase F 無關（P0 線嘅 prod migration 項目）。新加嘅 `e2e` job 用 `db push` 繞過，應該綠。**唔好因為 build 紅就以為 Phase F 壞咗** —— 睇 job 分開 conclusion。
- **安全跟進（Phase F review 抓到嘅 pre-existing 問題，已開 task chip / 記喺下面「安全跟進」，唔屬本 branch scope）**。
- dev env 坑（admin SSR server action 打遠端 API → `ADMIN_AUTH_MISSING`）已喺 `playwright.config.ts` webServer.env 定死解法（`NEXT_PUBLIC_*=localhost:3100`）。手動跑 admin 頁 dev 就要自己覆寫 env。

### 🔐 安全跟進（Phase F review 揭出，pre-existing on main，非本 branch 引入）

1. **register auto-login 簽平台 super-admin session cookie**（`app/api/tenant/register/route.ts` ~234）—— 公開開店成功後 `createSession()` 簽 `{role:"admin"}`（ADMIN_SECRET 簽名）set 做 `admin_session`，同平台 super-admin 同一款 token。adversarial verify 確認係真 weakness 但 pre-existing。已開 task chip。要查邊啲 guard 信任呢個 cookie（會唔會跨租戶提權）。P0 安全線。
2. **payme / alipay QR URL 冇 validation** —— wizard/register 收 `paymeQrUrl`/`alipayQrUrl` 落 DB 再喺公開頁 render 做 `<img src>`。review verify 未跑完（credit 斷）；未確認有冇 sanitize。低-中危（img src 唔行 script，但可做 tracking / SSRF-ish）。值得單獨查。
3. **inbound `x-is-platform` / `x-tenant-slug` header 冇 strip** —— middleware `new Headers(request.headers)` copy 晒 inbound，只喺特定 path 先覆寫。client 直接砌呢啲 header 可能扮到 platform mode。pre-existing。要 middleware 開頭一律 delete 呢幾個 internal header 先。

### 📝 已審視但有意識接受（唔使改，記錄在案）

- **base `--font-wlx-sans` 加咗 CJK fallback stack**（`app/globals.css` `@theme`）：影響所有 surface 包括租戶店。但 HK 目標裝置（iOS/macOS）PingFang 本來就係 sans CJK fallback → 視覺一致；其他平台反而更正確（明確 Traditional JhengHei/Noto TC）。DESIGN.md §3 有記，屬 landing redesign 有意識決定，唔係 regression。**如果 Yau 要租戶店 byte-identical**：將 CJK append 由 base `--font-wlx-sans` 搬去 marketing scope（`marketingBrandVars`）即可。
- **dead-store 404 CTA 由 `/en/start` 改 `/zh-HK/start`**：呢頁全中文文案 + 平台 canonical default 就係 zh-HK（`/start` middleware 都 redirect 去 `/zh-HK/start`），一致，唔係 regression。

### ⚠️ Phase C 實測發現（2026-07-16/17，行真 flow 揭出嚟）

1. ~~`TENANT_JWT_SECRET` dev 冇 set~~ → **Yau 已加（2026-07-17），全 flow 通咗**。
2. ~~Register 非原子 + raw error leak~~ → **已修（`1db8d16`）**：env secret 落 DB 前 fail-fast；auto-login 轉 best-effort（簽 token 失敗回 `autoLogin:false`，唔再累街）；外層 catch 唔再漏 error.message 原文，ApiError 交返 withApi（validation 由錯誤嘅 500 還原做 400/409）。curl 實測 400/409/200 三條 path。
3. ~~Step 5 預覽綠 vs 開出嚟橙~~ → **已修（`4b1d2f6`）**：register 以前寫死 `brandColor:"#FF9500"`（舊品牌橙），蓋過 `brandColor || tmpl.accent` 條 fallback 鏈。而家寫 null，動態跟 template。**留意 schema default 仲係 `#FF9500`（`prisma/schema.prisma:325`），改 default 要 migration — 屬 P0 線。**
4. Dev DB **六個**測試 tenant 待清：半製成品 `ink-stone-tea` + `phase-c-tea` / `phase-c-harden` / `phase-c-green` / `phase-c-mochi`（email = phase-c-test~5@example.com）+ `phase-e-motion`（email = phase-e-test@example.com，入面有一件測試貨「測試蛋糕 Phase E」）。⚠️ Tenant 關聯表冇 onDelete cascade，要逐層拆。

### 唔准掂（每個 agent prompt 都要抄）

租戶店任何嘢（sample 店 + 真店）· `app/globals.css` base `:root` · 共用頁必須 platform-gate · `plans.ts` 定價 · 文案 pending 兩項（口碑真偽、變現 vs 變生意）· `#stores` sticky 機制 · overflow-clip 唔准改返 hidden · §5 只准 transform/opacity/clip-path。

### 等 Yau

口碑真偽 · hero「變現」定「變生意」· merge #345 時機（branch 已經好大，考慮分段）· **platform 內容頁文案**（about/faq/terms 而家用 maysshop 店名「B」同店味文案 —— 平台版 About/FAQ 要 Yau 出 copy，皮已備好）。

---

## 🔄 2026-07-16 更新：卡收款商業決定（影響 P0 線 scope）

**Yau 決定：暫時唔收信用卡。** 分析見對話記錄，重點：

- 主力收款（FPS/PayMe/AlipayHK/銀行轉帳）係客人直接過數俾商戶，錢唔經平台 —— 「0% 佣金」喺呢啲路係物理，唔係讓利。
- 卡嗰條路（`/api/checkout/session`）用緊**平台自己嘅 `STRIPE_SECRET_KEY`**，冇 Connect、冇 payout —— 真 live 嘅話商戶啲錢會困死喺平台戶口。已經用 env flag `ENABLE_CARD_CHECKOUT` 封盤（default 封）。
- 文案已改：`plans.ts` 同 `/pricing` FAQ 唔再承諾信用卡，改賣「錢直入你自己戶口，WoWlix 一蚊佣金都唔收」。

**對 P0 線（`fix/deep-review-p0-hardening`）嘅影響：**
1. **Stripe Connect 成嚿 scope 拆出、推遲** —— P0 縮剩 prod migration + 訂閱 billing live mode（訂閱照收卡，嗰個係平台收商戶月費，唔受影響）。
2. **第日重開卡收款，一定要行 direct charges + Standard account** —— 錢直入商戶戶口、Stripe 費商戶找、平台零觸碰。呢個唔係技術偏好，係「永遠 0% 佣金」呢個 forever-promise 嘅地基；行 destination charges 遲早要收費返嚟，個承諾就死。
3. 重開觸發條件（Yau 定）：有付費商戶主動要卡收款，或者出現 cross-border 商戶 segment。

**文案 pending 剩返兩個**（0% 佣金已按精準框架簽咗）：三個口碑係咪真商戶、hero「變現」定「變生意」。

---

## 現狀

| | |
|---|---|
| **Branch** | `feat/landing-creator-first`（已 push，同 origin 同步） |
| **PR** | [#345](https://github.com/hideyau28/wowlix/pull/345) — **OPEN · MERGEABLE** |
| **Production** | 仍然係舊版（`7d7b79e`）—— **未 merge = 未 LIVE** |
| **另一條線** | `fix/deep-review-p0-hardening`（Stripe Connect / prod migration / live mode）原封未動 |

---

## 🔑 開場第一件事

**讀 `docs/LANDING-DESIGN-SYSTEM.md`。**

嗰份 doc 今日重寫過。**舊版仲寫住橙色 `#FF9500` + Plus Jakarta + JetBrains Mono + 已刪除嘅檔案**，而 `CLAUDE.md` 強制要求每次改 landing 都要讀佢 —— 即係任何 agent 照舊版做，就會一鋪過重建返 generic 橙色版，推翻晒成套 mono editorial。

新版入面有：`accent == ink` 反白規則、marketing-only scoping 死線、字體 override hook 機制、構圖規則、motion 合約（無 JS 一定見到 / scroll-timeline 要 `@supports` gate）、signature moment 唔准拆、`plans.ts` 定價單一真相、同 **§8「踩過嘅坑」**。

---

## 今個 session 做咗

`/pricing 對齊` → `清舊金殘留` → `section 重排（說服次序）` → `plans.ts 定價單一真相（$0/$78/$198，推薦 = Lite）` → `換 display font（Fraunces + Noto Serif HK）` → `POV 標題 + 可驗證信任文案` → **`Ink & Bone 黑白 mono 重上色`** → **`10/10 四波提升`**：

1. 編輯 identity（光學字級、watermark、01–05 索引、fading rules、grain + vignette）
2. 不對稱 masthead + **signature：phone 釘住、3 間真店隨 scroll cross-fade**
3. 打破格網（bento、深色口碑島、巨型數字、double-bezel）
4. Motion choreography（cascade reveal、hero 視差、nav 進度線、magnetic CTA）

最後重寫 `DESIGN.md`。

---

## 等 Yau 決定

1. **Merge #345 = 出 prod。**
   註：CI 個 `build` job 一路紅，係 **pre-existing 嘅 prisma migration 錯**（`relation "Tenant" does not exist`），同 landing 無關 —— main 近 5 個 commit 都係紅住照 merge。

2. **文案 sign-off**
   - 「永遠 0% 佣金」係 forever-promise
   - 3 個口碑係咪真商戶（唔係就改「搶先體驗」）
   - Hero 用「**變現**」定「變生意」

3. **法律頁**（`/terms` `/privacy` `/contact` `/about`）
   佢哋喺 `(customer)` group，**同租戶店共用**（Bull Kicks 等真店行同一條 route）。漆暖色會滲入真店。
   - **A（建議）** 只喺 `isPlatformMode()` 套 marketing 皮，租戶店維持原狀 → 一致 + 零滲入
   - **B** 保持樸素灰（法律頁本來就唔使花巧）
   - **C** marketing 開自己一套獨立法律頁

---

## ⚠️ 陷阱（唔講實會中）

`fix/deep-review-p0-hardening` 停喺 `5da0311`，**入面仲有舊版（陶土紅）嘅 landing commit**。

#345 merge 之後，如果直接 `git rebase main` 條 P0 branch，佢會**試圖用舊 landing 蓋返新 mono** → 衝突或者靜靜雞倒退。

> **正確做法：rebase 嗰陣把嗰批 landing commit drop 走**（內容已經由 #345 入咗 main）。

---

## 可選 / 參考

- 設計參考站（要用「開新 tab」方式先入到，直接 navigate 會俾 block）：
  - `styles.refero.design` — 2,000+ AI-readable design system，有 **Monochrome UI** / **Premium Design** 分類，可以直接攞 DESIGN.md
  - `minimal.gallery` · `recent.design`（人眼靈感，冇 token 輸出）
  - ~~`21st.dev` · `motionsites.ai`~~ — 2026-07-15 逐項評估過，零 salvage（彩色 shader / WebGL / 3D prompt 庫，全撞 DESIGN.md §0 + §11）。**唔好再開。**
- **誠實天花板：** code-only ~9/10。剩低嗰段要訂造 mono/duotone 攝影同 art direction，唔係前端做得到（詳見 DESIGN.md §11）。

---

## 另一條線：P0 後端（同 landing 分開）

`fix/deep-review-p0-hardening` — Stripe Connect、prod migration、live mode。
順帶一提：上面提到 CI 紅嗰個 `relation "Tenant" does not exist` migration 問題，**正正就係呢條線嘅「prod migration」項目**。
