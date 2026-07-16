# HANDOFF — 2026-07-15（landing 線）

> 交接俾下一個 session。另一條 P0 後端線見最底。

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
5. **Phase C 完成收貨**（`73d3c41`，2026-07-17 全 flow 驗埋尾）：/start 六步 wizard 上 Ink & Bone 皮（layout 級 subtree override + double-bezel 卡 + pill CTA + WoWlix wordmark 錨）；殺咗 step 1 Pro 深色卡 accent==ink 蟲（✓/radio/ring 黑撞黑）；裝飾色全轉單色（error 紅、Google logo、template 預覽色保留）。實測：Yau set 咗 `TENANT_JWT_SECRET` 之後真開咗間測試店 `phase-c-tea`（register 200 → step 6 完成頁 → 自動登入 admin 3/6 checklist → 店舖真 render），中英 + 375px 無橫捲，租戶店 face 全 unloaded、token 原色（新店自己彩色主題，證明零 mono 滲入），ci:build 綠。DESIGN.md 已記入 /start 做第三個 surface。

### Motion loop 點重跑（分數 8.2，目標 10）

- Script 喺 **`.claude/workflows/motion-overdrive.js`**（唔好again擺 /tmp —— 會俾系統清）。
- 用法：`Workflow({ scriptPath: ".claude/workflows/motion-overdrive.js" })`。舊 run 嘅 cache（wf_ff492ead-d4e）新 session 用唔到，fresh run 會自己重新評 baseline（≈8.2）再爬。
- 要 dev server：`preview_start {name:"dev"}`（port 3012），target `wowlix.localhost:3012`（**淨 localhost = May's Shop sample 店，唔係 WoWlix**）。
- 已知第三波候選（判到一半俾 session limit 斬）：masthead 退場鏡像、hero release ensemble 補完（sub/CTA 各自速率）、phone halo 拖光、島 rail 反向視差、island figcaption 順序畫線、/pricing 逐卡 IO cascade + FAQ ledger + nav hairline（scroll(root) 短頁都得）、尾 CTA 墨水傾瀉 + paper glow breathe、stats @property 數字 settle、compositor 衛生（unspray will-change、reduced-motion gate .wlx-progress）、bento bleed 剷 700ms grayscale filter（§5）。
- Session limit 會斷 workflow —— 斷咗就 keep going：睇 journal 執返已完成嘅嘢，主 loop 自己做得嘅自己做。

### 跟住落嚟（順序）

- **Phase E：admin login/forgot/reset 三頁 + 後台輕手**（product register：150–250ms，冇 choreography）。
- **Phase D**：法律/內容頁（about/terms/privacy/contact/faq）—— **必須 `isPlatformMode()` gate**（同真店共用 route，直接漆會滲入 Bull Kicks）；404/error 品牌化；footer 零死鏈。
- **Phase E**：admin login/forgot/reset 三頁 + 後台輕手（product register：150–250ms，冇 choreography）。
- **Phase F**：六條 flow（訪客開店全程、登入、忘記密碼、法律、繁↔EN、404）寫成 Playwright e2e 落 CI；code-review 成條 branch；Lighthouse/console/a11y gate；Yau 親自行一次收貨。

### ⚠️ Phase C 實測發現（2026-07-16/17，行真 flow 揭出嚟）

1. ~~`TENANT_JWT_SECRET` dev 冇 set~~ → **Yau 已加（2026-07-17），全 flow 通咗**。
2. **Register 非原子**（未修）：DB 開晒 tenant/admin/settings 先至簽 token，炸咗 = 店開咗一半、user 冇 login cookie、slug 燒咗（實測 `ink-stone-tea` 已佔用）。加上 **raw internal error 原文直接顯示俾 end user**。已開 task chip「Harden /api/tenant/register」兜住。
3. Dev DB 兩個測試 tenant：半製成品 `ink-stone-tea`（phase-c-test@example.com，順手清）+ 完整測試店 `phase-c-tea`（phase-c-test2@example.com）。
4. 小觀察（唔急）：wizard step 5 預覽「抹茶」綠，但開出嚟間店 storefront 個 avatar 係橙、cover 粉紅雲石；admin header 就係綠。template 三個 surface 唔一致，Phase E 或者租戶 theming 嗰陣睇。

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
