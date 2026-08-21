import Link from "next/link";
import ErrorScreen, { errorActionClass } from "@/components/ErrorScreen";

/**
 * 「呢間店唔存在」—— 各入口共用同一份文案同畫面：
 *   • app/[locale]/[slug]/not-found.tsx（path biolink 撞唔到 slug）
 *   • app/[locale]/(customer)/(home)/page.tsx（host 解到嘅租戶唔存在／已停用）
 *   • app/[locale]/(customer)/search/page.tsx
 *   • app/[locale]/(customer)/collections/page.tsx
 *
 * 後三個都係「呢頁有 loading.tsx，所以唔可以 notFound()」嗰類 —— 出畫面
 * 而唔係掟 404。會 notFound() 嗰啲頁（product/[id]、categories/[slug]）冇
 * loading.tsx，行真 404，唔經呢度。
 *
 * ⚠️ 唔准喺呢度（或者 ErrorScreen）import marketing fonts —— 呢兩個入口都係
 * 租戶共用 route，一 import 就將 Fraunces preload 綁返落成條 route graph
 * （見 components/marketing/fonts.ts）。
 */
export default function StoreNotFoundScreen() {
  return (
    <ErrorScreen
      code="404"
      title="呢間店唔存在"
      action={
        <Link href="/zh-HK/start" className={errorActionClass}>
          免費開店
        </Link>
      }
    >
      <p>搵唔到呢間店鋪，可能已經關閉或者網址有誤。</p>
    </ErrorScreen>
  );
}
