/**
 * Build guard：公開（可以俾 Google index 嘅）route 入面，唔准喺一個會
 * `notFound()` 嘅 page 之上出現 `loading.tsx`。
 *
 * 點解要條 guard —— 呢個 class 前後燒咗成三個 session：
 *   先誤判做「root layout 太早 stream」，四招 fix（client not-found、server
 *   not-found、co-located not-found、改 redirect）全部無效，最後 3 個獨立調查
 *   + 對照實驗先揪到真兇。
 *
 * 機制：`loading.tsx` 編譯出嚟就係一個 `<Suspense>`（Next
 * `layout-router.js` 個 LoadingBoundary）。Next 淨係喺 **shell Fizz render
 * 個 catch** 度 set 404 —— `notFound()` 掟喺 Suspense boundary 入面，React
 * 用 fallback 填咗個 boundary、shell 照樣完成，**200 headers 已經寫咗**，
 * 個 404 之後先以 client-side error 送到。結果：死商品／死分類回 200
 * soft-404，Google 當正常頁 index。
 *
 * 想要 skeleton 又想要真 404？將 Suspense 擺喺 `notFound()` **之下**
 * （page 入面用 explicit `<Suspense>` 包住重 subtree）—— throw 之下嘅
 * boundary 係安全嘅，之上先會出事。`product/[id]/page.tsx` 個
 * RelatedProducts 就係範例。
 *
 * ⚠️ `(admin)` 特登唔查：admin 喺 auth 後面兼唔俾 index，soft-404 淨係影響
 * 畫面，唔會餵 Google 死 URL。admin 嗰啲 skeleton 值錢過嗰個 status code。
 */
import fs from "node:fs";
import path from "node:path";

const APP_ROOT = "app";
const PAGE_FILES = new Set(["page.tsx", "page.ts", "page.jsx", "page.js"]);
const LOADING_FILES = ["loading.tsx", "loading.ts", "loading.jsx", "loading.js"];

/** auth 後面 + noindex —— soft-404 喺度冇 SEO 後果。 */
const EXEMPT_SEGMENT = "(admin)";

const NOT_FOUND_CALL = /\bnotFound\s*\(/;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

/** 由 page 所在 folder 一路行返上 app/，收集途中所有 loading.tsx。 */
function loadingBoundariesAbove(pageFile) {
  const found = [];
  let dir = path.dirname(pageFile);
  for (;;) {
    for (const name of LOADING_FILES) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) found.push(candidate);
    }
    if (path.normalize(dir) === path.normalize(APP_ROOT)) break;
    dir = path.dirname(dir);
  }
  return found;
}

const violations = [];

if (fs.existsSync(APP_ROOT)) {
  for (const file of walk(APP_ROOT)) {
    if (!PAGE_FILES.has(path.basename(file))) continue;
    if (file.split(path.sep).includes(EXEMPT_SEGMENT)) continue;
    if (!NOT_FOUND_CALL.test(fs.readFileSync(file, "utf8"))) continue;

    const boundaries = loadingBoundariesAbove(file);
    if (boundaries.length > 0) {
      violations.push({ page: file, boundaries });
    }
  }
}

if (violations.length > 0) {
  console.error(
    "ERROR: 有 loading.tsx 坐喺 notFound() 之上 —— 嗰啲 page 會回 soft 200，" +
      "Google 會當死 URL 係正常頁 index 落去：",
  );
  for (const v of violations) {
    console.error(`  ${v.page}`);
    for (const b of v.boundaries) console.error(`    ↑ ${b}`);
  }
  console.error(
    "改法：刪走嗰個 loading.tsx（想保住 skeleton 就搬落 notFound() 之下，" +
      "喺 page 入面用 explicit <Suspense>），或者將唔會 notFound() 嘅 route " +
      "搬入自己嘅 route group 再喺嗰層擺 loading.tsx。",
  );
  process.exit(1);
}

console.log("OK: 冇 loading.tsx 坐喺 notFound() 之上（(admin) 除外）");
