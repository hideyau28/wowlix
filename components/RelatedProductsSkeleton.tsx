/**
 * 商品頁「相關商品」嗰段嘅 streaming fallback。
 *
 * 由舊 `app/[locale]/(customer)/product/[id]/loading.tsx` 抽出嚟嗰一段。整個
 * segment 級 `loading.tsx` 已經刪走 —— 佢個 `<Suspense>` 坐喺 `notFound()`
 * 之上，令未知商品回 soft 200。而家個 boundary 搬咗落 `notFound()` **之下**
 * （throw 之下嘅 Suspense 係安全嘅），主內容照樣即刻出，淨係相關商品串流。
 */
export default function RelatedProductsSkeleton() {
  return (
    <div className="mt-6 px-4">
      <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-4" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="aspect-square bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            <div className="p-2.5 space-y-2">
              <div className="h-3 w-12 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
