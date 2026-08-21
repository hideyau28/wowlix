# HANDOFF — 2026-07-15（landing 線）

> 交接俾下一個 session。另一條 P0 後端線見最底。

---

## 🚩 2026-08-21 — (customer) soft-404 修好咗，出咗 prod（#392）

**未知／已刪商品同分類由 200 變真 404。** 根因就係 2026-07-25 查實嗰個（見下面 ②）：`loading.tsx` 編譯出嚟係 `<Suspense>`，坐喺 `notFound()` 之上 → shell flush 咗先掟 → status 鎖死 200 → Google 當死 URL 係正常頁 index。

**點拆**（判斷準則：**呢頁會唔會 `notFound()`？**）

| route | loading.tsx | 租戶認唔到 |
|---|---|---|
| `product/[id]` · `categories/[slug]` | ❌ 冇（刪走） | **真 404** |
| `(home)`（新 route group，URL 冇變） · `search` · `collections` | ✅ 各自一個 | `<StoreNotFoundScreen />`（200，同 #391 一致） |
| `products` | ✅ 原本就有（唔會 notFound()） | — |

- group 級 `(customer)/loading.tsx` **刪咗** —— 佢一個人罩住成 21 頁，係整死 `notFound()` 嗰個。個 spinner 抽咗做 `components/RouteSpinner.tsx`，邊頁要就邊頁自己擺。
- 首頁靠新 `(customer)/(home)/` route group 保住 skeleton —— route group 唔改 URL（`/[locale]` 照舊，build manifest 驗過），但個 Suspense 只罩住首頁。
- 商品頁「相關商品」搬咗落 `notFound()` **之下**嘅 explicit `<Suspense>`（`RelatedProducts` async component + `RelatedProductsSkeleton`）。**Suspense 喺 throw 之下係安全嘅，之上先會出事。**
- **新 `getServerTenantIdOrNull()`**（`lib/tenant.ts`）—— 刪走個 boundary 之後，本來俾佢食走嘅 `getServerTenantId()` throw 會變真 500。⚠️ 特登**唔用** `.catch(() => null)`：只有「查到但唔 active／查唔到」先 null，**DB timeout / pool 爆照掟上去出真 500**，唔想 DB 死扮成 404 呃走 monitoring 同 Google。

**新 build guard `scripts/assert-no-loading-above-notfound.mjs`**（落咗 prebuild）—— 公開 route 再有 `loading.tsx` 坐喺會 `notFound()` 嘅 page 之上就 build 紅。呢個 class 燒咗成三個 session（先誤判做 root layout 早 stream，四招 fix 全部無效）。正反兩面都驗過。`(admin)` 特登豁免：auth 後面兼 noindex，soft-404 淨係影響畫面，唔餵 Google 死 URL；`admin/orders/[id]` 而家就係咁。

**Live 驗證（prod `860d3f5`）17/17**

| 應該 404 | |
|---|---|
| `/en/product/e2e-missing-product-id?tenant=maysshop` | 404 ✅（merge 前同一條 URL 實測 **200**） |
| `/en/categories/e2e-no-such-category?tenant=maysshop` | 404 ✅ |
| `/en/product/whatever?tenant=e2e-never-existed-xyz` | 404 ✅ |

| 唔准誤殺（全部 200） | |
|---|---|
| 真商品 · 租戶首頁 · search · collections · biolink 店頁 | 200 ✅ ×5 |
| landing · pricing · terms | 200 ✅ ×3 |

| 唔准 500 | |
|---|---|
| `search` / `collections` / 首頁 + `?tenant=` 打錯 | 200 ✅ ×3，body 出到「呢間店唔存在」 |

**#391 字體 scope 冇倒退**：租戶首頁 woff2 集 = biolink 店頁 woff2 集（8 = 8，差集空），`Fraunces` 出現 0 次。

**驗證**：`ci:build` 綠（`/[locale]` 仍然 `ƒ`、landing/pricing 仍然 prerender = 冇倒退 #353）· CI e2e 4m16s 綠 · 本地 e2e **146 passed**（2 條 a11y 中途紅 —— `platform FAQ dark-OS`（HANDOFF 已知 flake）同 `admin login`（dev server `_clientMiddlewareManifest.js` MIME race），**單獨重跑 7/7 全綠**）· **RED proof**：三條新／收緊嘅斷言喺舊 code 全部 `Received: 200`（3 failed / 6 passed），修完 9/9。

### 仲欠（呢個 PR 冇做）

- **首頁 / search / collections 租戶認唔到仍然係 200** —— 出「呢間店唔存在」畫面而唔係 404（#391 訂落嘅形態，要保住 skeleton）。停用店嘅 custom domain 首頁理論上仍然係一個可以俾 index 嘅 soft-404。要真 404 就要將首頁嘅 tenant check 提到 explicit `<Suspense>` 之上（page 拆做 page + body component），獨立處理。
- **真 404 個 body 冇品牌**（`__next_error__` 光板，hydrate 之後先出品牌）—— Next 16.2.4 嘅 404 shell 寫死，唔係呢個 PR 整出嚟，全站現有 404 一樣係咁。

---

## 🚩 2026-08-20 — 租戶店首頁減 145.6 KB 字體（#391）

`(customer)/page.tsx` 一直 preload 緊 marketing 嘅 Fraunces（normal + italic），即係每個租戶店客人入首頁都白落 **145.6 KB** 完全用唔著嘅字體。

**⚠️ 最重要嗰句：舊 handoff 寫嘅「lazy import 兜法」係假嘅，`fonts.ts` 都記錯咗，而家改正咗。**

> Next 16 / turbopack 個 **per-page font manifest 連 dynamic `import()` 都照計**。個 module 一出現喺條 route 嘅 graph 就照 preload，你點 import 都冇分別。**唯一斷得開嘅界線係 route 邊界。**

| route | font preload |
|---|---|
| `(customer)/page`（前） | 396.1 KB |
| `(customer)/page`（後） | **250.6 KB** |
| `[slug]/page`（純租戶對照） | 250.6 KB |
| `landing`（control，要有 Fraunces） | 203.8 KB |

量法同 WS6 一樣：`.next/server/next-font-manifest.json` 逐個檔對住 `.next/static/media` stat。

**兩個 branch 點拆**（platform landing 本身已經有自己條 `/[locale]/landing`，middleware 正常流量早就 rewrite 過去，連 JSON-LD 都喺嗰邊）：

- **platform branch** → `redirect(/{locale}/landing)`。middleware 冇捕到嘅邊緣 case 先行到呢度。
- **unknown tenant** → `StoreNotFoundScreen`（新抽出嚟，同 `[slug]/not-found.tsx` 共用同一個 component —— 冇新文案）。⚠️ 呢個 branch **唔可以** redirect 去 `/landing`：middleware 對非平台 host 嘅 `/{locale}/landing` 會彈返 `/{locale}`（「/landing 收口」），即刻**無限 redirect loop**。

**行為改動一項**：租戶 host 解唔到店（或者 `?tenant=` 打錯 slug）由「出成版 WoWlix 平台 landing」變成「呢間店唔存在」404 畫面。

**新 e2e 2 條，兩條都 RED proof 過**：`font-preload-scope`「租戶店首頁唔會 preload Fraunces」（舊 code 紅，`Fraunces` 真係喺 preload family list 入面）、`not-found`「租戶唔存在 → 呢間店唔存在」（舊 code 出成版 landing）。本地 full suite **146/146**（fresh DB）。

**Live 驗證（prod `66e866c`）5/5**：租戶首頁（`?tenant=maysshop`）嘅 woff2 集**同 biolink 店頁一模一樣**（= 零 marketing 洩漏）· landing 仲有 Fraunces（control）· `?tenant=` 打錯 slug 出「呢間店唔存在」· `/zh-HK` `/pricing` `/maysshop` `/terms` `/en` 全 200。量法：直接 curl HTML 抽 `.woff2` 檔名做差集 —— **唔好淨數 `<link as=font>`**，dynamic route 行 React Flight `:HL[...]`，會誤判成「零字體」。

### 仲欠：五頁法律頁

terms/privacy/contact/faq/about（→ `MarketingLegalShell`）一樣係 **396.1 KB**。要開 platform-only route 先斷到（同 `/landing` 一樣：middleware rewrite 平台 host 過去），但 **about/faq/contact 撞住 open PR #368**（等緊 Yau 文案 sign-off），硬做會 conflict。**等 #368 埋咗身先郁。** `components/marketing/fonts.ts` 記低咗新紀律同進度。

⚠️ 本地連跑幾次之後，DB-backed rate-limit spec（`auth-rate-limit` / `payment-proof-ownership` / `upload-proof-coarse-limit`）會間唔中紅，每次紅唔同條。呢次特登對住**乾淨 main tree** 跑過同一個 full suite 確認同樣會發生 —— 唔關改動事，reset DB 就綠。CI 有 `retries: 2`，冇中過。

---

## 🚩 2026-08-20 — WS4 還庫存出咗 prod（#389 + #390）

落單一直會扣庫存，但成個 repo **冇任何一條路會還返**。客人落完單唔俾錢、商戶撳「取消」，嗰幾件貨就永遠鎖死喺一張死單度 —— 賣得越耐，帳面同倉底差得越遠。

**三個唔可以行返轉頭嘅決定：**

1. **還貨嘅 trigger 係「張單入咗死狀態」，唔係「付款俾人拒絕」** —— HANDOFF 原本寫「`payment/route.ts` reject 喺同一 tx 還貨」，**冇照做**。撳完「拒絕付款」張單仲係 `PENDING_CONFIRMATION`，admin 個「確認收款」掣照樣撳得（`payment-actions.tsx:181-192` 只 gate order status，唔 gate paymentStatus）。客人影錯截圖、商戶拒一拒等佢重發係真實流程；喺嗰刻放貨返上架，同一張單之後一撳確認就要出一件已經賣咗俾人嘅貨。**庫存鎖到張單真係死（`CANCELLED` / `PAYMENT_REJECTED`）嗰刻先還。** 商戶要放貨，就係喺 status dropdown 揀嗰兩個之一（本身已經有）。

2. **防雙重還貨唔使加 column** —— 靠 status CAS：`updateMany` 個 where 帶住「頭先驗 transition 嗰陣睇到嘅 status」，贏咗（`count===1`）先還貨。兩個死狀態喺 `status-transitions.ts` 都係 terminal，一世只入得一次 → 最多還一次。同一個 status 再 PATCH 一次（撳兩下／兩個 tab）係 no-op，唔會當「又死多次」。順手收埋同 class 嘅兩個 TOCTOU：payment reject（`paymentStatus` 落 where）、`confirm-payment`（`status` 落 where）—— 後者唔收嘅話「同一刻取消 + 確認」會變成貨已經還晒上架、張單又要出貨。

3. **還幾多、還去邊，讀 marker 唔准估** —— 落單嗰陣每件貨寫低 `stockSource`（`variant` / `product` / `combination` / `none`）落 `Order.items`。兩條落單 route 扣貨形狀唔同（`/api/orders` 冇 variant 就扣 `Product.stock`；biolink 冇 variant 就乜都唔扣），淨係睇 `variantId` 在唔在係分唔開嘅。biolink 個 items snapshot 以前淨係留低顯示名（`貨名 · 黑 · M`），variant 身份完全冇存低 —— 就算想還都冇資料還；而家連 `variantId` / `variantKey` 一齊存。

⚠️ **舊單（冇 marker）一律唔還**，包括 2026-08-20 呢個 deploy 之前落嘅所有 pending 單。寧願少還（商戶自己加返，睇得見）都好過亂加（睇唔見，直到出唔到貨）。商戶要清返嗰批舊單嘅貨，要手動改庫存。

還 variant 會順手救返「賣到 0 自動落架」個 flag（雙維格同樣由 `hidden` 開返 `available`）—— 淨係加返個數但仍然落架，客人一樣買唔到，等於冇還過。

**idempotency 記錄搬入 transaction** —— 以前 `idempotencyKey.create` 喺 tx **外面**：同一條 key 兩個 request 同時入嚟，兩邊都過得 `findFirst`（嗰陣仲未有 row），兩邊都扣一次庫存、開一張單，輸嗰個先至喺最後食 P2002 掟 500 —— 客人見到出錯，實際上兩張單兩份貨都已經落咗。而家輸嗰個成個 tx（連扣庫存連張單）rollback，再回讀贏家嗰份 `responseJson`。biolink 嗰邊個 response 連 `fpsInfo` / `paymeInfo` 都要喺 tx 入面砌好先存得低，所以商戶收款資料嗰句 query 提咗上 tx 之前。

**#390 followup（同一 session 自己揪返出嚟，已 merge + prod `c82c3ef`）** —— #389 收咗 `confirm-payment` 嗰道閘，但漏咗 sibling `PATCH /api/orders/:id/payment`。**取消唔會郁 `paymentStatus`**，所以一張已取消嘅單個 paymentStatus 照樣停喺 `"uploaded"`，佢個「一定要 uploaded」檢查攔唔到 —— 死單仲 confirm 得，寫低 `paidAt` + 收咗錢，但貨已經還晒上架。加咗 `isDeadOrderStatus` 明示 guard（sequential）+ `status` 落 `updateMany` where（race）。RED proof：舊 code 嗰句回 200。

**Live 驗證（prod `eb6e051` 5/5、`c82c3ef` 再驗一次）**：所有改過嘅 admin route 無 auth 一律回 401 `ADMIN_AUTH_MISSING`（唔係 500 —— 即係新 module `lib/orders/restock` / `lib/api/prisma-errors` 喺 prod 載入到），兩條落單 route 空 body 回 400（`Missing tenantId` 等），storefront `/zh-HK`、`/pricing`、`/maysshop` 全 200。

⚠️ **還貨本身冇喺 prod 驗** —— 要驗就要喺真商戶度落一張真單再取消（會入商戶個 queue、可能寄真 email、郁真庫存）。呢件事嘅證據係 CI 對住真 build 跑嗰 8 條 e2e，唔係 prod write。

**新 e2e**：`order-restock.spec.ts` 8 條（本地 full suite **144/144**，fresh DB）。**RED proof 7/8**：並發嗰條紅成 `[200,500,500,200]`（正正係 P2002）。「拒絕付款唔還貨」嗰條係 **control** —— 舊 code 都綠，佢守嘅係將來有人手多多喺 reject 度加還貨嗰下要即刻紅。

⚠️ **踩過一次**：`scripts/e2e-local-db.sh` 個 `dropdb` 撞到仲未收工嘅 e2e dev server 就會失敗，`>/dev/null 2>&1 &&` 會靜靜雞令成個 playwright run **冇行過**；跟住再跑就係積存 state，一次過紅 10 條（`createVariant` 200 → 唔係 200 嗰類）。見呢個形狀先 `lsof -ti:3100 | xargs kill -9` 再 reset。

---

## 🚩 2026-08-02 — WS6 減磅出咗 prod（#388），WS4 仲未做

上一個 session 尾聲講「下一步開 WS6」，呢個 session 接手做完。**四個 commit 全部零功能改動**，數字全部實測（唔係估）：

| Surface | first-load JS gzip | preload 字體 |
|---|---|---|
| admin dashboard | 389K → 269K（**-120K**） | 251K → 58K（**-192K**） |
| admin analytics | 356K → 241K（**-115K**） | 251K → 58K（**-192K**） |
| admin products | 264K → 252K（-12K） | 251K → 58K（**-192K**） |
| 平台 landing / pricing | 冇變 | 396K → 204K（**-192K**） |
| biolink 店頁 | 冇變 | 冇變（**control** —— 佢真係用緊） |

storefront query：**一次 render 13 條 → 8 條**（Tenant ×5→×3、StoreSettings ×4→×1）。

**量法**（下次想再量照抄）：JS 讀 `.next/diagnostics/route-bundle-stats.json` 嘅 first-load chunk 逐個 gzip；字體讀 `.next/server/next-font-manifest.js` 對住 `.next/static/media` 逐個 stat；query 喺 `lib/prisma.ts` 臨時加 `log:["query"]` 數 warm dev render（記得還原）。

**Live 驗證做到咩程度**：landing 係 static route，直接 curl HTML 數到得 4 個 `<link as=font>`（Fraunces + Geist ×2 + Geist Mono），template font **零洩漏**；biolink 係 dynamic route，字體 hint 行 React Flight `:HL[...]` 唔係 `<link>`，要 grep HTML 入面啲 `.woff2` 再對返 CSS 嘅 `@font-face` 先反查到 family —— 查完六隻齊（control 正確）。⚠️ **淨數 `<link as=font>` 會將動態 route 誤判成「零字體」**，我第一次就係咁差啲當咗 regression。

**三件過程中改咗計劃／要記低嘅事**：

1. **`{isSheetOpen && ...}` 先係真正慳到 bytes 嗰句** —— next/dynamic 係 component **mount** 嗰陣攞 chunk，唔係個 prop 由 false 轉 true 嗰陣。ProductEditSheet 以前一直 render（自己內部 `if (!isOpen) return null`），淨係包 `dynamic()` 一樣會每次入 dashboard 都照落個 chunk。
2. **modal 有一處行為真係變咗（比舊行為安全）** —— 以前 sheet 閂咗仲 mount，A 商品開緊個 image upload 喺閂咗、再開 B 之後先 resolve，`setImages(prev => [...prev, url])` 會將 A 張相靜雞雞貼落 B。而家 unmount 會丟咗嗰個 late setState：修咗跨商品串相，但閂到一半嗰張相唔會自動貼返（檔案照上到 Cloudinary，只係冇 attach）。
3. **cache key 一律明示帶住租戶身份** —— 特登唔將無參數嘅 `getServerTenantId()` 直接包 `cache()`。React cache() 本身逐 request，但呢個 repo 出過幾單跨租戶滲漏，而「key 唔含租戶身份、身份由 header 嚟」正正係嗰個 bug 嘅形狀。keyed by slug / tenantId 之後，就算 cache scope 有意外，租戶 A 都攞唔到租戶 B 嘅嘢。

**新 e2e**：`font-preload-scope.spec.ts` 3 條（本地 full suite **136/136**，fresh DB）。特登**唔斷言「preload 幾多個」**（加隻新字體就無辜紅）—— 改為由頁面自己嘅 CSS 反查每個 preload 落嚟嘅檔屬邊個 font-family 再斷言 family 名。RED proof：還原字體改動 → admin 同 landing 兩條紅（訊息列晒六隻名），biolink 嗰條 control 新舊都綠。

⚠️ **e2e 積存 state 陷阱**：連跑幾次之後，`auth-rate-limit` 同 `upload-proof-coarse-limit` 嗰啲 DB-backed rate limit spec 會紅（`Expected 400, Received 429`，而且每次紅唔同條）。**唔係 code 壞** —— `dropdb wowlix_e2e && bash scripts/e2e-local-db.sh` 重置就返晒綠。見紅先睇係咪呢個。

### 仲欠（按優先次序）

- ~~**WS4**~~ —— ✅ **2026-08-20 #389 已 merge + prod**，見最頂。⚠️ 有一個位冇照呢粒 bullet 做：`payment/route.ts` reject **唔還貨**（還咗會超賣，原因見最頂）。
- **租戶共用 route 仲食緊 145.6 KB Fraunces preload** —— (a) `(customer)/page` ✅ **2026-08-20 #391 出咗 prod**（396.1 → 250.6 KB，同純租戶 route 一樣）；(b) **五頁法律頁仲係 396.1 KB**，撞住 open PR #368 未郁，詳情見最頂。
- **商品深連應該係商品做 h1** —— `[slug]/product/[id]` 落地時 `ProfileSection.tsx:131` 個店名仍然係 `<h1>`，商品標題喺 ProductSheet 入面唔係 heading。要由 BioLinkPage（收到 `initialProductId`）thread 個 flag 落 ProfileSection（降 h2）同 ProductSheet（升 h1）。純 SEO heading hierarchy。
- **#368 平台文案** 仍然等 Yau sign-off（open PR）。

---

## 🚩 2026-07-25 新 session 由呢度開始（上一個 session 收尾狀態）

### ① ✅ 租戶分類頁跨租戶滲漏 —— **Yau 批咗，#370 已 merge 出 prod + live 驗證 4/4**

`categories/[slug]/page.tsx:28`（generateMetadata）同 `:62`（page body）兩處 `await resolveTenant()` 冇傳 req → `lib/tenant.ts:59` 冇 Request 就 skip 晒 host/header 解析 → slug 永遠跌返 `DEFAULT_SLUG`（maysshop）。全 repo 得呢兩個 no-arg call site 中招（~46 個 `getTenantId(...)` 全部有傳 req）。

**修法（唔係照 handoff 原本寫嗰句「改用 getServerTenantId()」）** —— 新 `resolveCategoryTenant()` 經 `next/headers` 讀 `x-tenant-slug`，一 query 攞埋 `id + name + status`。**特登唔用 `getServerTenantId()`**：
1. 佢淨係 return id，攞唔到 `<title>` 要嘅 `tenant.name`；
2. 佢租戶唔存在／停用就 **throw** —— soft-404 個 Suspense 坑修好之後會變真 500。「呢間店唔存在」係 404 唔係 server 死咗 → return `null` 由 caller 出 404；
3. **DB 撲街（timeout / pool 爆）照樣 throw 上去 → 真 500**。冇用 `.catch(() => null)`，唔想 DB 死扮成 404 呃走 monitoring 同 Google。

順手收埋同檔最後一句 unscoped query：breadcrumb parent `findUnique({ id })` → `findFirst({ id, tenantId })`。

**驗證**：`ci:build` 綠（categories 仍然 `ƒ`、landing/pricing 仍然 `●`）· e2e **49/49**（新 `e2e/tenant-isolation.spec.ts` 3 條）· **RED proof**：還原做舊 code 再跑 → 1 failed（`Tenant not found or inactive at resolveTenant → CategoryPage`）· **live 4/4**：`/zh-HK/categories/jordan?tenant=solemena-test` 出 `Jordan — Wowlix Studio`（舊 code 會 404，因為 maysshop 一個分類都冇）、`nike` 同樣、垃圾 slug → `Category Not Found`、平台 host 冇 `?tenant=` → `Category Not Found` 冇借 solemena 內容。

⚠️ **呢個 PR 修唔到、唔好當已清**：
- **平台 host 仍然出 default 店 catalogue** —— `www.wowlix.com/{locale}/categories/{slug}` middleware 硬 set `x-tenant-slug = DEFAULT_SLUG`，patch 喺嗰面係 **no-op**。同 #366 **同一 class**，要行同一招（middleware redirect）。`/about` `/faq` `/contact` `/terms` `/collections` `/search` `/product/*` 一樣中招。
- `lib/tenant.ts:16` `DEFAULT_SLUG` 寫死 `"maysshop"`，唔讀 `DEFAULT_TENANT_SLUG`（淨係 `middleware.ts:5` 讀）—— 兩個 default 來源會 drift。
- `resolveTenant()` 個 no-req path 仲係靜靜雞跌落 default 店唔 throw —— **今次個 bug 出得世嘅結構原因**。

### ①b 🔴🔴 做 #370 順手全 repo 掃租戶隔離，揪到三條更嚴重嘅（**全部 Yau 拍板位，未郁**）

逐條對住 code 親手覆核過，唔係 agent 空講：

1. **`app/[locale]/(customer)/orders/[id]/actions.ts:14` —— CRITICAL，未認證讀客人 PII**
   `getOrderById()` server-to-server fetch `/api/orders/{id}` **淨係帶 `x-admin-secret`，冇 forward `x-tenant-slug`**。`app/api/orders/[id]/route.ts:38` `getTenantId(_req)` 冇 header 冇 JWT → 靠 internal URL 個 host 解析（`www` → DEFAULT_HOSTS）→ **永遠 maysshop**。兩個後果：
   - **(a) 功能爛晒**：所有非 default 店，客人 checkout 完跳落 `/{locale}/orders/{id}` 一律 404，跌落「minimal confirmation」branch —— 商戶啲客**永遠見唔到自己張單**。
   - **(b) PII**：`orders/[id]/page.tsx:30` 叫 `getOrderById(id)` **零 session／零 phone／零 ownership check**。即係任何人攞到（或者收到人哋 share 嘅）maysshop order cuid，就 render 到成張單 —— `customerName` / phone / email / `fulfillmentAddress` / items / 金額 / `paymentAttempts`。靠 cuid 估唔到做唯一屏障。
2. **`app/api/admin/orders/[id]/receipt/route.ts:9` —— HIGH，跨租戶 IDOR**
   `await authenticateAdmin(req);` 個結果**掉咗唔要**，跟住 `fs.readFile("/tmp/receipts/{id}.html")` 齋靠 bare id，**零租戶 check**。任何一間店嘅 admin 都讀到第二間店張收據（入面有姓名／電話／email／貨品／金額）。
3. **`app/api/biolink/orders/[id]/payment-proof/route.ts` —— HIGH，未認證跨租戶寫入**
   `withApi(...)` **冇 `{ admin: true }`，成條 route 零 auth**；`findUnique({ where: { id } })` + `update` 都冇 tenantId。任何人攞到任何店嘅 PENDING order id，就寫得個**任意 URL** 落 `paymentProof` 兼把單 flip 做 `PENDING_CONFIRMATION` —— 直接彈入商戶後台叫佢確認收款。對比 sibling `track/route.ts:56` 有驗電話，呢條乜都冇。

**Yau 批咗「三條一次過修晒」→ 進度：**

- ✅ **#371 收據 route**（已 merge + prod）—— destructure `tenantId` + `findFirst({ id, tenantId })` 先讀檔；順手揪到**第二個窿：path traversal**（Next 會 `decodeURIComponent` dynamic param，`..%2f` 變真 `../` 爬得出 `/tmp/receipts`，e2e 實證舊 code 回 200 唔係理論）→ 加白名單 regex + 用 DB 攞返嚟嘅 id 砌路徑 + 三種失敗一律同一個 404（唔做 order id 存在性 oracle）。新 `e2e/receipt-isolation.spec.ts` 3 條，RED proof 過。
- ✅ **#372 補付款截圖**（已 merge + prod + live 驗）—— 憑證改「order id + 落單電話」（同 sibling `track/route.ts` 一致），**特登唔加 tenant 解析**（加咗就會將非 default 店客人拒之門外 = #370 嗰個 bug class 翻兜）；`update` → `updateMany` + status 落 where 收 TOCTOU；**rate limit 電話對唔上先計數** —— 擺喺 handler 頂用 orderId 做 key 嘅話，攻擊者灌爆 bucket 就令啱啱俾完錢嘅客人永遠上載唔到收據（用安全 fix 嚟做 DoS），有 e2e 專門守住。新 `e2e/payment-proof-ownership.spec.ts` 4 條，RED proof 3/4。
- ✅ **#373 orders PII**（已 merge + prod + live 驗）—— 詳見下面 ①c。**三條全部收晒。**

**📌 嚴重程度更正（我之前講大咗）**：`"orders"` 喺 `ROUTE_RESERVED_SLUGS`（`lib/slug-policy.ts:38`），所以 `www.wowlix.com/{locale}/orders/{id}` 個 `x-tenant-slug` **永遠**係 DEFAULT_SLUG。即係「所有非 default 店客人 checkout 完見唔到自己張單」**唔成立** —— 非 default 店嘅客人根本行 path-biolink（`/{locale}/{slug}/order/{id}`），唔經呢頁。真實影響 = **未認證讀到 default 店（maysshop）啲單嘅客人 PII**，唔係全平台商戶。

### ①c orders PII — ✅ #373 已修（agent 原設計被 refute，最後係重寫嘅）

**做咗乜**：剷咗個 internal fetch，直接 prisma + `getServerTenantId()`；分兩層 —— 陌生人淨係見單號／狀態／總額，姓名／電話／地址／逐件貨要憑證。憑證 = checkout 成功後 server **自己核對過電話**先派嘅簽名 grant cookie，或者登入會員。**唔要求登入**（checkout 特登容許 guest，迫啱啱俾完錢嘅人開 account = 殺收入），啱啱落完單嗰個瀏覽器零阻力見全單，**零新客人面文案**（Yau 揀咗呢個方向）。

**三個唔可以行返轉頭嘅決定（agent 原方案就係喺呢度撞板，refute 揪出嚟）**：

1. **grant 一定要 raw HMAC，唔可以用 JWT** —— `route-helpers` 接受任何用 `TENANT_JWT_SECRET` 簽、payload 有 `tenantId` 嘅 JWT 做 admin auth。派張帶 `tenantId` 嘅 JWT 落客人 browser = 俾佢 replay 做 admin token（**提權**）。
2. **checkout 個 grant call 一定要包 client-side `try/catch`** —— 嗰個 `await` 坐喺落單 handler 個 outer `try` 入面，佢個 `catch` 係出「訂單創建失敗」兼**唔跳頁**。action **invocation** 失敗（deploy 令舊 tab action id 失效／5xx／斷線）reject 喺 client → 單已落、cart 已清，客人卡死喺 checkout 頁。**action 內部自己嗰個 catch 兜唔到**（佢喺 server 行）。agent 原設計寫「失敗都照跳頁」係錯嘅。
3. **原本個 degraded 200「多謝惠顧 + 單號」唔可以改做 `notFound()`** —— 加上 `(customer)/loading.tsx` 個 Suspense 坑，俾完錢嘅客人會見到無品牌 `__next_error__` 爛畫面。

**測試教訓（值得記）**：第一版 spec 淨係 red 喺租戶嗰半 —— 陌生人喺舊 code 見到 degraded 頁，一樣冇 PII，所以 **PII gate 本身冇 red-prove 到**。要**特登將張單落喺 default 店**（兩邊都搵到張單）先隔離到真正變數，舊 code 就會喺「陌生人唔准見到客人姓名」嗰句直接紅。以後驗呢類 gate 要留意：fail 喺第一句斷言 = 後面啲斷言根本冇行過。

**另外兩條新掃到、未郁**：`POST /api/orders` 收 `paymentProof` 完全唔驗兼冇 auth（`route.ts:282-285`→`:677`，`(customer)` checkout 真正行嗰條）；`/api/upload` 零認證（任何人可以灌爆你個 Cloudinary）。仲有 `lib/email.ts` `renderReceiptHtml` **stored XSS**（`customerName`/`phone`/`email` 零 escape 插入 HTML 再用 `text/html` 喺自己 origin 送）—— 而家俾 `/tmp` 問題遮住，但如果將來改做 on-demand render 就會即刻解封，**escape 一定要喺嗰個改動之前或者同時落**。

### ② ✅ soft-404 根因查實咗（3 個獨立調查 + 對照實驗，高信心）—— **fix 已落，見最頂 2026-08-21**

**舊寫喺下面嗰個「shell 早 stream」假設係錯嘅，已推翻。** 對照組：`app/[locale]/[slug]/product/[id]` 同樣深度、同樣 `force-dynamic`、同一個 root layout —— 佢回**真 404**。

**真兇 = `loading.tsx`：**
> `loading.tsx` 編譯出嚟就係一個 `<Suspense>`（`node_modules/next/dist/client/components/layout-router.js:415` `LoadingBoundary`）。Next 16 淨係喺 **shell Fizz render 個 catch** 度 set 404（`node_modules/next/dist/server/app-render/app-render.js:1949`，redirect 喺 :1955）。`notFound()` 喺 Suspense boundary 入面掟 → React 用 fallback 填咗個 boundary → shell 完成 → **200 headers 已經寫咗** → 個 404 之後先以 client-side error 送到。

肇事檔案（兩個都坐喺 `notFound()` 之上）：
- `app/[locale]/(customer)/loading.tsx`（group 級 —— 整死成個 group）
- `app/[locale]/(customer)/product/[id]/loading.tsx`（segment 級）

**呢個解釋晒點解舊 session 四招全部無效**（client not-found / server not-found / co-located not-found / 改 redirect）—— status 喺 shell flush 嗰陣早就鎖死，唔關 not-found 檔事。亦解釋咗點解 #366 shipping/returns 要迫住行 middleware。

**⚠️ 唔好淨係刪 `loading.tsx` 就算**（兩個 judge 都話 SHIP，但兩個都插旗）：
- `(customer)/loading.tsx` 罩住成個 storefront（cart / checkout / search / orders / profile / 商品頁）。刪咗 = **租戶店冇晒 skeleton**；force-dynamic route 冇 `loading.tsx` 連 `<Link>` prefetch 都冇嘢 prefetch，手機撳入商品會停喺舊頁等成個 Neon round trip（200–500ms）零反饋。**呢個係郁租戶店手感，CI 驗唔到。**
- 拆咗 boundary，本來被 soft-200 遮住嘅 throw 會變真 500（`categories/[slug]` 就係一個 —— 見 ①）。
- **「有品牌嘅 404 body」喺 Next 16.2.4 做唔到**：404 shell 寫死 `<html id="__next_error__">`（`app-render.js:1103-1113` `getErrorRSCPayload` 個 `seedData`，唔會 consult root layout），品牌係 hydrate 之後先出。現有嗰啲「正常」404 頁一樣係咁 —— 呢個係 spec 要放寬，唔係 blocker。

**建議永久形態（judge 推薦，未實作未驗）**：商品頁先做平價存在檢查 → 再喺 `notFound()` **之下**用 explicit `<Suspense>` 包住重 subtree 保住 skeleton。**Suspense boundary 喺 throw 之下係安全嘅**，之上先會出事。以後唔好再喺會 `notFound()` 嘅 page 之上加 `loading.tsx`。

**已否決方案**：有 agent 寫過一個 middleware + `/api/internal/product-404-gate` 嘅 gate（每次睇商品加一次 DB round trip）——兩個 judge 都叫唔好行。code 擺咗喺上個 session 個 scratchpad（`/private/tmp/.../agent-middleware-gate-attempt/`，⚠️ /tmp 會蒸發，冇特登保留，要就重寫）。

### ③ PR #368 open — 等 Yau 文案 sign-off（CI 全綠）

`feat/platform-content-pages`，3 個 commit：平台 about/faq/contact 出 WoWlix 自己文案（唔再跌落 default 店「- B」）+ 兩輪專家會議嘅修正。**CI build + e2e 63/63 + Vercel 全綠，就爭 Yau 過文案。** 唔好自己 merge（文案＝拍板位）。等緊 Yau 三個答覆：文案字眼 OK 未／「0% 佣金 forever」上唔上呢兩頁／要唔要寫回覆時間承諾。

兩輪 review 已修：canonical + hreflang（本來三頁裸奔）、og:url + og:image（本來零分享圖）、`/fr/about` 跨語言 canonical、contact 死 query、多條文案／廣東話語感、e2e 補 zh-HK + body 斷言 + 租戶 canonical guard。

### ④ 仲有嘅 Yau 拍板位

- **terms / privacy**：要 Yau 俾①法律實體全名（Flow Studio HK？定有間有限公司）②data 清單 confirm，先出 skeleton。**唔准 AI 作住 ship。**
- **`brandColor` schema default 仲係橙 `#FF9500`**（`prisma/schema.prisma:325`）—— DB migration，低優先。
- **(a) subdomain 復活** —— 要先搬 Namecheap email forwarding 先郁得 NS。
- **假 `hello@wowlix.com` 仲喺 `lib/email/send.ts:12`** 做交易 email 寄件人 default。Vercel prod 有冇 set `EMAIL_FROM` / `RESEND_API_KEY` 只有 Yau 睇到。改寄件域名要 flowstudiohk.com 喺 Resend 驗過 domain（Yau 嗰邊 infra）。

---

## ✅ 2026-07-24（續）：#365 + #366 出 prod —— 技術 SEO 尾巴掃乾淨

**#365 死店連結（`fix/dead-store-links`，已 merge + prod）** —— 掃跟進撞返同 #355/#356/#363 同一 class，但喺冇人掃過嘅 admin 工具 + 對外訊息：
- **追單 WhatsApp send 咗條死 link 俾真客人（收入面 bug）**：`admin/cart-recovery` 砌 `${slug}.wowlix.com` 做 checkout link 塞入 WhatsApp 追單訊息 —— wildcard DNS NXDOMAIN，客人 100% 開唔到。
- **商戶貼 IG bio 嗰條 link 食 307**：OnboardingWizard 完成頁「複製連結」+ BioLinkDashboard copy 都出 apex `wowlix.com/{slug}`（307→www）。畫面**顯示**短版照留，**複製出去**改真 www host。
- 新 `storeShareUrl(slug, customDomain)`（`lib/site-url.ts`）收口「人真係會撳」嗰類 link。
- **Build guard**（`scripts/assert-no-subdomain-store-urls.mjs`，落 prebuild）：呢 class 炸過四次（#355 sitemap 971 死鏈／#356 卡 href／#363 canonical／#365 追單），code 裏面（註釋除外）再出現 `${...}.wowlix.com` 就 build 紅。正反兩面都驗過。

**#366 平台滲漏（`fix/platform-store-page-leak`，已 merge + prod）** —— Phase D 尾巴「shipping/returns 冇 platform gate」+ 一條冇人記低嘅 sitemap 污染：
- **平台 host render 緊人哋間店政策**：`/en/shipping`「Shipping Policy - B」（B = default 店 maysshop）。平台唔寄貨，呢兩頁冇平台版內容 → redirect 返 landing。
- **sitemap 主動 index 租戶個人化頁**：`platformPages` 有 `/en/collections`（title「My Wishlist - B」）/`/en/cart`/`/en/orders`。剷咗，換返 `/en/pricing`+`/zh-HK/pricing`（本身漏咗）。
- Live 驗證 4/4：平台 shipping/returns 4 條全 307→landing、legal 五頁冇誤殺（200）、sitemap 個人化頁 = 0 兼 pricing = 1、租戶 biolink 200。

### ⚠️⚠️ 2026-07-24 揪到嘅結構性坑 ——「(customer) 深層頁 notFound()/redirect() = soft 200」

> **📌 2026-07-25 勘誤：下面呢段個「root layout 早 stream」歸因係錯嘅，已由 3 個獨立調查 + 對照實驗推翻。**
> 真兇係 `loading.tsx` 造出嚟嘅 Suspense boundary 坐喺 `notFound()` 之上 —— **睇返最頂 ② 嗰段**。
> 下面留底做歷史（同埋記錄「試過乜、點解無效」），但唔好再照住佢去查 root layout。

做 #366 嗰陣 CI e2e 捉到平台 shipping 用 `notFound()` 竟然回 **200 唔係 404**。逐個方案否決後揪到根因：

> **`app/[locale]/layout.tsx` 好早就 stream 咗 `<html>` 殼**，deep `(customer)` page 先至跑到。到時 page 級 `redirect()` / `notFound()` 已經變成 **soft 200**（client-side redirect / soft-404），HTTP status 唔會係 307/404。

實測逐個否決：page 內 `notFound()` → 200 · 加 co-located **server** component `not-found.tsx`（`(customer)/not-found.tsx` 甚至 `shipping/not-found.tsx`）→ 一樣 200 · 改 `redirect()` → 一樣 soft 200（`isPlatformMode()` log 出嚟明明 `true`）。對比 `[locale]/[slug]/`（有 co-located not-found + 冇早 stream）就正常回 404。

**兩個影響**：
1. **#366 解法** = 平台 shipping/returns 改喺 **middleware** redirect（render 前 return，307 硬確定，同 `/pricing` `/landing` `/start` 一致）。**呢類「平台 host 唔應該出某頁」以後一律行 middleware，唔好喺 page 用 notFound()/redirect()。**
2. **pre-existing bug（開咗 chip `task_56cbe3eb`）**：`(customer)` group 內**任何** `notFound()` 都係 soft 200 —— 即係**未知/已刪商品 `product/[id]` 依家回 200 soft-404**，Google 當正常頁 index。middleware 幫唔到（要 DB query 先知商品存唔存在）。要動 root layout streaming（唔好倒退 #353 靜態 landing TTFB），risk 高過 #366，獨立處理。

---

## 🔑 2026-07-24：merge workflow 改咗（新 session 讀呢段先）

**Yau 授權：CI 綠 = Claude Code 自己 squash-merge 出 prod，唔使逐個等佢批。** 之後自己 live 驗證 + 報佢知。

點解保留 PR：**唔係為咗 code review**（呢個 repo 冇第二個 reviewer），係為咗「**e2e 綠先准出 prod**」呢個 gate —— 關鍵事實：**Vercel 唔會等 GitHub Actions**，佢自己只跑 `npm run build`，唔跑 41 條 e2e。直接 `push main` = CI 未出結果之前個版本已經喺 prod 度。CI 本身 `on: push main` + `pull_request` 兩邊都跑。

⚠️ **四類照樣要停低問 Yau**（CI 驗唔到）：① 文案 ② 商業承諾 ③ DB migration ④ 安全改動。

---

## ✅ 2026-07-24：canonical 收口單一 host（#363 **已 merge 出 prod + live 驗證 7/7 過**）

**Live 實測**（merge 後）：`/en/pricing` canonical 終於自指 `www.wowlix.com/en/pricing` + 三條 hreflang 齊；`/zh-HK/pricing` 自指；landing 兩個 locale 自指；`?tenant=solemena-test` 由死 subdomain 變 `www.wowlix.com/solemena-test`；租戶 biolink（solemena-test / maysshop）200 冇跌；landing + pricing `x-vercel-cache: HIT` 冇跌；**四條 platform route 掃 apex 殘留 = 0**。


追下面嗰句掛咗好耐嘅「apex→www canonical sweep（要 Yau 決定）」，逐條 live curl 查落去 —— 入面**唔止係靚唔靚，有條真 bug**。

**① `/en/pricing` 個 canonical 指住中文版（P1 真 bug）** —— pricing 用緊 static `metadata` object，兩個 locale share 同一句 `canonical: https://wowlix.com/pricing`。而 #359 補咗光板 `/pricing` → `/zh-HK/pricing` 之後，**英文定價頁等於親口同 engine 講「我嘅正本係中文版」**，仲要經兩次 307（apex→www→zh-HK）。英文版基本上 index 唔到。改咗做 `generateMetadata` + per-locale self-canonical + hreflang。**route 照樣 `● SSG`**（`await params` 唔算 dynamic API，build output 實測）。

**② canonical 全部指 apex，但 sitemap 一早淨出 www** —— apex 喺 Vercel domain 層**全路徑 307 → www**（`/`、`/pricing`、`/en/pricing` 逐條 curl 驗過）。sitemap/robots/商品 URL 由 #356 起統一 www —— 即係 sitemap 講 www、canonical 講 apex，自己同自己嘈。**呢個一直當「決定」擺住，但其實冇得揀**：307 方向係 apex→www，sitemap 亦已經落咗 www 嗰邊，今次淨係補返一致。

**③ 租戶面 canonical 指住開唔到嘅 host** —— `(customer)/page.tsx` 租戶 branch 出 `https://{slug}.wowlix.com/{locale}`（wildcard DNS NXDOMAIN）。**呢個 branch 唔係死 code**：platform host 加 `?tenant={slug}`（demo 預覽）→ `tenantOverridden=true` → `x-is-platform` 冇 set → 就跌落嗰度，live curl 實證真係出咗死 canonical。連 Store JSON-LD 個 `url` 一齊併軌落 path biolink。順帶執埋 `(customer)/product/[id]`：以前**淨係 platform mode 先併軌**，non-platform 跌返 `/{locale}/product/{id}` —— 嗰條 URL 冇 tenant context 只解得返 default 店，即係 canonical 指住第二間店件貨。

**新 `lib/site-url.ts` 做 host 單一真相**（`SITE_URL` / `OG_DEFAULT_IMAGE` / `ORGANIZATION_ID` / `platformUrl()` / `biolinkUrl()`）；`lib/biolink-data.ts` 個 `BIOLINK_BASE` 同 `app/sitemap.ts` 都食返同一個常數 —— **當初就係各自揸一份 hardcode string 先 drift 出兩個 host**。新 `e2e/canonical.spec.ts` 七條，含通用 guard：platform 四條 route 所有 canonical/hreflang **一律唔准 apex、一律要 www**，將來邊個 hardcode 返都即刻紅。

**冇掂**：`privacy`/`terms`/`about`/`Footer` 版面文字上面嘅 `https://wowlix.com`（係 copy，apex 照 307 行得通，文案歸 Yau）。
**留意**：`ORGANIZATION_ID` 由 apex 變 www = JSON-LD entity 一次性 re-key（站仔新、冇外部引用，判斷零成本）。
**驗證**：`npm run ci:build` 綠（landing + pricing 仍然 `●`，四份 prerender HTML 逐份 grep 過 canonical/hreflang）· `npm run test:e2e` **41/41 綠**。

⚠️ 本機第一次跑 e2e 要 `npx playwright install chromium`（browser binary 冇裝，36 條會集體紅，唔關 code 事）。

---

## ✅ 2026-07-23（夜）：HANDOFF 跟進三連發（#358–#360）→ **已 merge 出 prod**

> **📌 2026-07-24 更正：下面寫「等 Yau 收貨」已過時。** #358 / #359 / #360 / #361（docs）/ #362（gitignore `.lighthouseci/`）全部順序 squash-merge 出咗 prod，CI build+e2e 逐個綠先郁，**live 驗證 6/6 過**：`/pricing` 307 → `/zh-HK/pricing`、`/zh-HK/pricing` `x-vercel-cache: PRERENDER`、check-slug `pricing`/`wowlix` 齊出保留字、`/fr/pricing` 404、deep 404、maysshop biolink 200 + landing HIT 冇跌。


**#358 slug policy 收口單一真相（`fix/slug-policy-unify`）** —— 追「tenant-settings PUT rename 繞過 RESERVED_SLUGS」個 chip，查落唔止一個洞：slug 規矩散落三份各自唔同嘅 copy —— ① PUT rename **乜都唔驗**（可改做 `landing`/`www`/大楷遮死自己間店）；② check-slug 揸 stale list（話 `wowlix`/`landing` 可用，wizard 綠燈行到 register 先 400）；③ register 唔擋 route 字（`pricing`/`product` 等 —— 註冊到但 path routing 永遠 resolve 唔到 = 出世死店）。全部收口落新 `lib/slug-policy.ts`：`ROUTE_RESERVED_SLUGS`（middleware routing 判斷）+ `PLATFORM_RESERVED_SLUGS`（wowlix/www/demo/app/maysshop）+ `REGISTRATION_RESERVED_SLUGS`（union，register/check-slug/rename 用）。⚠️ **ROUTE list 唔可以擺真租戶 slug**（maysshop 擺入去佢個 path biolink 就 resolve 唔到）—— 所以要分兩層，唔係一份 union 用到底。PUT rename 而家行足 register 全套（trim/lowercase → format → reserved → uniqueness；slug 冇改到 = no-op，歷史 slug 唔使被逼改名先儲到其他設定）。新 `e2e/slug-policy.spec.ts` 三條。30/30 綠。

**#359 /pricing 真 prerender + 光板 /pricing redirect（`perf/pricing-prerender`）** —— 跟進 ②。pricing 補 `generateStaticParams` + `dynamicParams=false`（on-demand cache → build-time SSG，`● /[locale]/pricing` 兩 locale；`/fr/pricing` 由 200 變 404）。做嘅時候發現：**pricing canonical 指住光板 `wowlix.com/pricing`，但光板 `/pricing` 冇 middleware 接** —— 以 `locale="pricing"` 跌落 (customer) home（platform host 上 render 咗 landing 內容），canonical 目標同真內容對唔上。學 #353 光板 `/landing` 先例補 redirect 落 `/zh-HK/pricing`。新 `e2e/pricing.spec.ts` 三條。30/30 綠。

**#360 path-slug 3-seg deep 404 spec（`test/deep-404-path-slug-spec`）** —— 跟進 ③。`/{locale}/{真店}/{垃圾}/{垃圾}` 行 `[slug]/[...rest]` catch-all 落 branded 404：驗 HTTP 404 + 404 screen + `<html lang>` 存在（唔准跌落 `__next_error__` 光板）。28/28 綠。純 spec，零 production code。

**📌 勘誤：下面「🔐 安全跟進（Phase F review 揭出）」三條全部已經喺 PR #346（2026-07-20 出 prod）修咗** —— ① register auto-login 而家只簽租戶級 `tenant-admin-token`（route 註釋直接寫明唔簽 god-mode `admin_session`）；② payme/alipay QR URL 有 https-only 驗證；③ middleware 三處都先 delete 晒 inbound `x-is-platform`/`x-tenant-slug`/`x-tenant-path-slug` 先 set 可信值。**唔好再追呢三條。**（2026-07-23 夜逐條對 code 證實。）

**Merge 注意**：#358 同 #359 都掂 `middleware.ts` 但唔同 hunk，順序無所謂；#360 純 e2e。三個都係由 main 開嘅獨立 branch，唔係 stacked。

**剩返未郁 —— 技術 SEO 尾巴 07-24 已掃乾淨（#363/#365/#366），淨返全部係 Yau 拍板位（唔好自己郁）：**

1. **platform 內容頁文案（文案＋法律）** —— about/faq/terms/privacy/contact 五頁喺平台 host 上 title 全部「- B」+ body 係 maysshop 波鞋店文案（Phase D 上咗 marketing 殼，但內容仲係 default 店嘅）。⚠️ 唔好自己作 WoWlix 嘅 About/Terms/Privacy（法律敏感）。要 Yau：出 platform copy（然後 wire 一個 platform branch），**或者**話 redirect/隱藏佢哋（同 shipping/returns 一樣喺 middleware 做）。
2. **`brandColor` schema default 仲係橙 `#FF9500`（DB migration）** —— `prisma/schema.prisma:325`。register 已寫 null，實際好少中，低優先。改 default = migration = 停低問。
3. **(a) subdomain 復活（infra）** —— 要先搬 Namecheap email forwarding 先郁得 NS，見 2026-07-23 後半 section。
4. ~~**(customer) soft-404（chip `task_56cbe3eb`）**~~ —— ✅ **2026-08-21 修好咗，見最頂嗰段**。冇粗暴刪 `loading.tsx`：逐頁按「會唔會 notFound()」拆，skeleton 全部保住。

---

## ✅ 2026-07-23:三個跟進 task 全部落地（兩個 PR 等 Yau 收貨）

**Task ①（PR #352,branch `fix/e2e-local-db-isolation`）:e2e 本地 DB 隔離** —— root cause 剩低嗰一半堵咗。`scripts/e2e-local-db.sh` drop+recreate local homebrew postgres 嘅 `wowlix_e2e` + `prisma db push`;`playwright.config.ts` 喺 `!CI` 硬性 override `DATABASE_URL`(就算有人直接 `npx playwright test` 都寫唔到 shared DB)+ `DEFAULT_TENANT_SLUG` 統一 `e2e-default`(`maysshop` 喺 register reserve list,空 DB seed 會 400 —— test process 同 server 兩邊都要見到)。實證:27/27 綠、rows 全落 local、shared DB e2e-* 跑前跑後都係 12。**唔使 docker**(local 有 homebrew postgresql@14 行緊)。

**Task ③+②(branch `feat/static-platform-landing`):拆 force-dynamic 靜態化 platform landing + Fraunces platform-only preload** —— 一個 root 級重構做齊兩件:
- **Root shell 搬遷**:`app/layout.tsx` 刪咗,`<html>/<body>` + 8 個 font 註冊 + globals.css 搬入 `app/[locale]/layout.tsx`,lang 由 param 嚟(normalize en|zh-HK)。舊 root 讀 `headers()`(x-locale + generateMetadata 嘅 isPlatformMode/getStoreName)令**全站每條 route 焗住 dynamic** —— 呢個先係 TTFB 真兇。storeName branding metadata 搬落 `(customer)`/`(admin)` layout(本身 force-dynamic);`[slug]/order/[id]` 自己補(**要 isPlatformMode 先行**,唔係會將 maysshop 個名印落人哋訂單頁 —— review 抓住)。
- **靜態 landing route**:`app/[locale]/landing/page.tsx`(generateStaticParams en/zh-HK + `dynamicParams=false`,metadata/JSON-LD 照抄 (customer) platform branch,**兩邊必須keep一致**),middleware 將 platform host 嘅 /en /zh-HK 內部 rewrite 過去(`?tenant=` override 照跌返落 dynamic route)。`landing` 入咗 middleware + register 兩份 RESERVED_SLUGS(prod 已 query 過冇 tenant 用緊呢個 slug);租戶 host 直開 /{locale}/landing 會 307 返店首頁;光板 /landing 學 /start redirect。**實證:TTFB 3-4ms(舊 dynamic 路 local→Neon 係 ~2.5s);/pricing 都順手甩咗 dynamic**。
- **Fraunces preload**:`fonts.ts` 掀 `preload:true`,靠 import 紀律控制邊條 route 食 hint —— landing/pricing/start static import(要 preload 嘅 marketing 面),`(customer)/page.tsx` 同五頁法律頁(MarketingLegalShell)轉 **lazy `await import()`**。實證 preload hint 只喺 platform landing HTML 出現(2 個 woff2),租戶 home/法律頁 = 0。
- **`/` redirect 搬入 middleware**(app/page.tsx 冇得留,`nextUrl.clone()` 保 query 唔整跛 `?tenant=` demo 預覽);root not-found/error 刪咗,深層 404 由 `[slug]/[...rest]/page.tsx` catch-all 接(掟 notFound 落 [slug]/not-found branded 版);`app/global-error.tsx` 補返 root shell 爆嘅品牌 500。
- 驗證:ci:build 綠(landing = ● SSG)、27/27 e2e 綠、6-lens adversarial review workflow(28 agents)17 findings 全修/確認 accept。

**⚠️ Next 16 三個踩過嘅坑(唔知會再中)**:
1. **notFound() 喺直屬 root layout segment 嘅 page 掟,唔會俾 [locale]/not-found 或 sibling not-found 接**,一律跌落無品牌 default(root 級 /_not-found 冇 locale param 起唔到 shell)。要接就要喺更深 segment(如 [slug]/[...rest])掟。dev + prod build 都實測過。
2. **next/font 將 preload flag 燒入檔名**(`-s.p.` vs `-s.`):「另開一個 preload:true 副本 module」會出兩份檔,preload 嗰份冇人用 = 雙倍下載。唔好玩。
3. **next-font-manifest 係 superset**:lazy import 咗嘅 module 照樣列喺 manifest,但 runtime 唔會 emit hint —— 判斷要 curl 真 HTML,唔好淨睇 manifest。

**有意識接受(記錄在案)**:landing 靜態化後 `plans.ts` 定價**烘死喺 build**,改價要 redeploy 先生效;深層 404 文案係「呢間店唔存在」(舊 root 版係通用「搵唔到呢個頁面」);edge 404 面 title 用靜態「WoWlix」;platform 法律頁 marketing fonts 冇 preload hint(lazy 嘅代價,字體照載,同以前 preload:false 一樣);2-seg 404 個 `__next_error__` 殼(冇 lang)係 **prod 一早如此**嘅 pre-existing class,唔係本 branch 引入。

**跟進(有 chip / 未做)**:① tenant-settings PUT slug rename 繞過 RESERVED_SLUGS(pre-existing,review 揭出,已有 task chip);② /pricing 可加 generateStaticParams 做真 prerender(而家係 on-demand cache,已經夠快);③ e2e 可補 3-seg deep 404 spec。

---

## ✅ 2026-07-23(後半):全部出 prod + 租戶 SEO 死鏈救返

**#352/#353/#354 已 squash-merge 出 prod + live 驗證全過**(Yau 授權「你幫我處理」):landing `x-vercel-cache: HIT`(真 CDN 靜態)、Fraunces preload 只喺 platform、租戶 biolink 零污染、deep 404 branded。

**Live 驗證揭發 pre-existing P1 → 當日救完**:`*.wowlix.com` **wildcard DNS 根本唔存在**(dig NXDOMAIN;Namecheap DNS 冇 wildcard、Vercel project 冇 wildcard domain)—— 即係 sitemap 977 條有 971 條 subdomain URL 全部死鏈(包括 Sprint 2 個 336 條商品 URL),租戶 canonical 指死 host,biolink 商品卡 `<a href>` crawler 面 cross-tenant 404(JS sheet UX 一直冇事)。兩步救:

1. **#355 止血**:sitemap 唔再 emit subdomain URL,改出可達 path biolink。
2. **#356 重建商品 SEO 面(揀咗 (b) path 路線)**:新 route `[locale]/[slug]/product/[id]`(tenant 由 path slug 解析,render biolink + product sheet 自動開,SSR 齊,share link 落地可以直接買)、`lib/biolink-data.ts` 共用 loader + `productUrl()` 單一真相、三張卡 href + JSON-LD + sitemap 商品 URL 全部接返去 path 形式、**sitemap/robots 全份統一 www host**(apex 全路徑 307 → www)。Review workflow 抓到修埋:HIGH(OrderConfirmation pathname-append order link 喺商品頁 checkout 後會 404)+ sitemap 混 host + og fallback + default 店雙 canonical 併軌。Live 實證:550 條全 www、商品頁 200/JSON-LD/canonical、卡 href 可達。

**(a) 路線(subdomain 復活)如果第日要行**:Vercel 加 wildcard domain 要 NS 遷去 Vercel,**會斷 Namecheap email forwarding**(MX = eforward*.registrar-servers.com),要先搬 email(improvmx / Cloudflare email routing);跟住轉返 subdomain canonical 要一齊改 sitemap/卡 href/biolink-data/canonical(sitemap.ts 註釋列晒)。

**未郁 / follow-up**:platform 頁 canonical 仍係 apex 形式(歷史遺留,engine 靠 307 自己 resolve 落 www)—— apex→www canonical sweep 係獨立決定;(customer) 非 platform host 嘅 canonical 仍係 subdomain 年代形式(得 subdomain host 先 render,今日冇影響)。

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

**Sprint 2 已落（6 commit,ci:build 綠,PR #349 stacked 喺 #348 上）**:
`45998cf` /start step-2 form/label/aria/focus;`35479d0` grid content-visibility（priority 卡唔包）;`983f6cf` 商品卡真 `<a href>` + sitemap 商品 URL（reuse 現有 product/[id] route,特登唔用 next/Link 避 prefetch 風暴）;`66162d5` use-dialog-a11y hook（focus trap/Escape/還原）兩個 sheet 上 dialog 語義;`f6c6461` JSON-LD 三面 + 修 Organization 錯標租戶店 bug;`c22a93a` hero LCP 死 delay 剪走（編排不變）。

**2026-07-22 深夜:兩個 sprint 已 merge 出 prod** —— #348（Sprint 1）+ #350（Sprint 2;取代被 GitHub 閂死嘅 stacked #349,cherry-pick 落新 main,tree byte-identical）。Live 實證:sitemap 1008→632 URL、污染 672→88、商品 URL 336 條出街。⚠️ Stacked PR 教訓:squash-merge 底層 + `--delete-branch` 會即時 CLOSE 上層 PR 且無得救,merge 底層時唔好即刻刪 branch。

**2026-07-22 深夜:prod DB 測試店 soft-disable（DB 操作,git 冇 trace,呢度係唯一記錄）** —— 經 Yau 批核,20 間 tenant `status` → `"disabled"`（可逆,還原就 update 返 active）:12× `e2e-*`、5× `phase-*`（phase-c-tea/harden/green/mochi、phase-e-motion）、`test`、`test2`、`wowlix`（自指向源頭）。**保留 active（Yau 揀）**:`maysshop`（sample,永遠唔掂）、`solemena-test`（Wowlix Studio,249 商品 3 訂單）、`tonic-test-0323`（1 單）。sitemap residual 88 條 URL 正正嚟自呢兩間保留店 —— 係有意決定,唔係漏。

**跟進 task（未做,有記錄）**:① **e2e 本地 DB 隔離**（root cause 剩低嘅一半:local playwright 仲係寫 shared DB,新 e2e-* 店會再累積〔雖然 register 已 reserve 唔到 wowlix/www/demo、sitemap 有 filter〕— 方案:local docker postgres + db push + seed,學 CI 個 e2e job）;② Fraunces platform-only preload（dynamic import route 層重構,fonts.ts 註釋有方案）;③ 拆 `force-dynamic` 靜態化 platform landing（TTFB 最大槓桿）。

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

> **⚠️ 2026-07-23 勘誤：下面三條全部已喺 PR #346 修咗（見最頂 2026-07-23（夜）section）。留底做歷史，唔好再追。**

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
