# HANDOFF — 2026-07-15（landing 線）

> 交接俾下一個 session。另一條 P0 後端線見最底。

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

### ⚠️⚠️ 2026-07-24 揪到嘅結構性坑（新 session 必讀）——「(customer) 深層頁 notFound()/redirect() = soft 200」

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
4. **(customer) soft-404（技術，但 risk 高，開咗 chip `task_56cbe3eb`）** —— 見上面「結構性坑」。未知/已刪商品回 200 soft-404。

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
