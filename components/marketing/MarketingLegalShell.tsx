import Link from "next/link";
import type { ReactNode } from "react";
import { marketingBrandVars } from "./theme";
import { fraunces, notoSerifHK } from "./fonts";
import MarketingTypeStyles from "./TypeStyles";

/**
 * Platform mode 嘅法律/內容頁外殼（about / terms / privacy / contact / faq）。
 *
 * 點解要有佢：呢啲頁同租戶店共用 route，(customer)/layout 喺 platform mode
 * 係「裸 body」（冇 TopNav / Footer），所以 marketing 皮 + 導覽 + 頁腳要自帶。
 * 用法：頁內 `if (await isPlatformMode())` 先包呢個 shell —— 租戶店一 pixel 都唔變。
 *
 * 內容 re-voice 用 unlayered scoped CSS（.wlx-legal-content 之下）：
 * unlayered 一定贏 @layer utilities，所以連內容入面嘅 zinc / dark: utility
 * 都會俾 Ink & Bone token 蓋過，唔使逐頁改 class（DESIGN.md §8 坑 7 同一機制）。
 */
export default function MarketingLegalShell({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}) {
  const isZh = locale === "zh-HK";

  return (
    <div
      style={marketingBrandVars}
      className={`${fraunces.variable} ${notoSerifHK.variable} wlx-legal min-h-screen bg-wlx-paper text-wlx-ink`}
    >
      <MarketingTypeStyles />
      <style>{`
        .wlx-legal-content h1,
        .wlx-legal-content h2,
        .wlx-legal-content h3,
        .wlx-legal-content summary {
          font-family: var(--wlx-font-display-latin, var(--font-geist-sans)),
            var(--wlx-font-display-cjk, "PingFang HK", "PingFang TC",
              "Microsoft JhengHei", "Noto Sans TC", sans-serif);
          font-optical-sizing: auto;
          font-feature-settings: 'kern', 'liga', 'calt', 'halt';
          color: var(--wlx-ink);
        }
        .wlx-legal-content h1 {
          font-size: clamp(30px, 4.5vw, 40px);
          line-height: 1.15;
          letter-spacing: -0.025em;
          font-weight: 600;
        }
        .wlx-legal-content p,
        .wlx-legal-content li,
        .wlx-legal-content td,
        .wlx-legal-content span {
          color: var(--wlx-stone);
        }
        .wlx-legal-content strong,
        .wlx-legal-content th {
          color: var(--wlx-ink);
        }
        /* .wlx-cta = 內容入面嘅 pill 掣（ink 底）— 唔准俾下面條 a 規則蓋成
           ink-on-ink（DESIGN.md §2 accent==ink 隱形問題，同一機制） */
        .wlx-legal-content a:not(.wlx-cta) {
          color: var(--wlx-ink);
          text-underline-offset: 3px;
        }
        .wlx-legal-content a.wlx-cta {
          color: var(--wlx-paper);
        }
        .wlx-legal-content * {
          border-color: var(--wlx-mist);
        }
      `}</style>

      <header className="border-b border-wlx-mist">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link
            href={`/${locale}`}
            className="font-wlx-display text-lg tracking-tight text-wlx-ink"
          >
            WoWlix
          </Link>
          <nav className="flex items-center gap-5">
            <Link
              href={`/${locale}/pricing`}
              className="text-sm text-wlx-stone hover:text-wlx-ink transition-colors"
            >
              {isZh ? "定價" : "Pricing"}
            </Link>
            <Link
              href={`/${locale}/start`}
              className="inline-flex items-center rounded-full bg-wlx-ink px-4 py-1.5 text-[12px] uppercase tracking-[0.18em] text-wlx-paper transition-colors hover:bg-wlx-ink/90"
            >
              {isZh ? "免費開店" : "Start free"}
            </Link>
          </nav>
        </div>
      </header>

      <main className="wlx-legal-content">{children}</main>

      <footer className="border-t border-wlx-mist">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-xs text-wlx-stone">
          <p>© 2026 WoWlix · Hong Kong</p>
          <nav className="flex gap-4">
            <Link href={`/${locale}/terms`} className="hover:text-wlx-ink transition-colors">
              {isZh ? "服務條款" : "Terms"}
            </Link>
            <Link href={`/${locale}/privacy`} className="hover:text-wlx-ink transition-colors">
              {isZh ? "私隱政策" : "Privacy"}
            </Link>
            <Link href={`/${locale}/contact`} className="hover:text-wlx-ink transition-colors">
              {isZh ? "聯絡我們" : "Contact"}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
