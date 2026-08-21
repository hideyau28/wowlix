import RouteSpinner from "@/components/RouteSpinner";

/**
 * `(home)` route group 唔改 URL（仍然係 `/{locale}`），淨係令呢個 skeleton
 * **只**罩住租戶店首頁 —— 以前佢住喺 `(customer)/loading.tsx`，順手罩埋
 * `product/[id]` / `categories/[slug]`，將嗰兩頁嘅 `notFound()` 整成 soft 200。
 *
 * 首頁本身唔會 `notFound()`（租戶認唔到出 `<StoreNotFoundScreen />`），
 * 所以喺呢一層擺 Suspense 係安全嘅。
 */
export default function HomeLoading() {
  return <RouteSpinner />;
}
