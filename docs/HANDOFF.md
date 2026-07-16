# HANDOFF — 2026-07-15（landing 線）

> 交接俾下一個 session。另一條 P0 後端線見最底。

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
