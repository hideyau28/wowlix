import { serializeJsonLd } from "@/lib/escape";

export type FaqEntry = { question: string; answer: string };

/**
 * FAQ 版面 + FAQPage JSON-LD —— 平台版同租戶版共用。
 *
 * ⚠️ 特登住喺 `components/`（唔係 `components/marketing/`）：呢個 component
 * 俾 `(customer)/faq`（租戶）同 `platform/faq`（平台）兩條 route 一齊 import，
 * 一 pull 到任何 marketing 嘢就會將 Fraunces 綁返落租戶 route 個 font
 * manifest（per-page manifest 連 dynamic import() 都照計，見
 * `components/marketing/fonts.ts`）。**呢個檔淨係准 import 純邏輯 util。**
 */
export default function FaqSection({
  faqs,
  isZh,
  subtitle,
}: {
  faqs: readonly FaqEntry[];
  isZh: boolean;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 pb-32">
      {/* FAQ JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
              },
            })),
          }),
        }}
      />

      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
        {isZh ? "常見問題" : "Frequently Asked Questions"}
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">{subtitle}</p>

      <div className="space-y-6">
        {faqs.map((faq, index) => (
          <details
            key={index}
            className="group border border-zinc-200 dark:border-zinc-800 rounded-lg"
          >
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 rounded-lg transition-colors">
              <span>{faq.question}</span>
              <svg
                className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="px-4 pb-4 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
