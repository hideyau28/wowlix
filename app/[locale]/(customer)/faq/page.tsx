import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getStoreName } from "@/lib/get-store-name";
import { getTenantInfo } from "@/lib/get-tenant-info";
import { getFAQContent } from "@/lib/tenant-content";
import { isPlatformMode } from "@/lib/tenant";
import { platformFaq } from "@/lib/platform-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isZh = locale === "zh-HK";
  // 平台 host 唔好用 default 店個名（會出「FAQ - B」）—— 用 WoWlix。
  const storeName = (await isPlatformMode()) ? "WoWlix" : await getStoreName();
  const title = isZh ? `常見問題 - ${storeName}` : `FAQ - ${storeName}`;
  const description = isZh
    ? `${storeName} 常見問題`
    : `Frequently asked questions about ${storeName}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: storeName,
      type: "website",
      locale: locale === "zh-HK" ? "zh_HK" : "en_US",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function FAQPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tenant = await getTenantInfo();
  const isZh = locale === "zh-HK";

  // Platform mode 先包 marketing 殼（Ink & Bone）；租戶店行原本 zinc 版。
  // lazy import：static import 會將 marketing fonts（preload:true）綁入呢條
  // 租戶共用 route（見 components/marketing/fonts.ts 註釋）
  const platform = await isPlatformMode();
  // 平台 host：出 WoWlix 自己嘅雙語 FAQ + 用 WoWlix 做名；租戶店維持原狀
  //（同一段 JSX，淨係換 data source，JSON-LD 都跟住出平台 Q&A）。
  const storeName = platform ? "WoWlix" : await getStoreName();
  const faqs = platform
    ? platformFaq[isZh ? "zh" : "en"]
    : getFAQContent(tenant.slug);
  const MarketingLegalShell = platform
    ? (await import("@/components/marketing/MarketingLegalShell")).default
    : null;
  const shell = (node: ReactNode) =>
    MarketingLegalShell ? (
      <MarketingLegalShell locale={locale}>{node}</MarketingLegalShell>
    ) : (
      node
    );

  return shell(
    <div className="mx-auto max-w-3xl px-4 py-10 pb-32">
      {/* FAQ JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
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
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        {isZh
          ? `以下係關於 ${storeName} 嘅常見問題。`
          : `Common questions about shopping with ${storeName}.`}
      </p>

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
