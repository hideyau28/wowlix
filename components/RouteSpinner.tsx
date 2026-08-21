/**
 * (customer) 各 route 嘅 loading fallback。
 *
 * ⚠️ 呢個 spinner 以前住喺 `app/[locale]/(customer)/loading.tsx`。group 級
 * `loading.tsx` 編譯出嚟就係一個 `<Suspense>`，坐喺成個 group 每一頁之上 ——
 * `notFound()` 掟嗰陣 shell 已經 flush 咗，HTTP status 鎖死喺 200（soft-404，
 * Google 當死商品／死分類係正常頁照 index）。
 *
 * 所以而家改成逐個 route 自己擺 `loading.tsx`，而且**會 `notFound()` 嗰啲頁
 * 一律唔准有**（`product/[id]`、`categories/[slug]`）。加新 route 之前，
 * 先問「呢頁會唔會 notFound()」。
 */
export default function RouteSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="h-8 w-8 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
    </div>
  );
}
