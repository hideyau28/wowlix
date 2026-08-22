import type { Metadata } from "next";
import MarketingLegalShell from "@/components/marketing/MarketingLegalShell";
import FaqSection from "@/components/FaqSection";
import { OG_DEFAULT_IMAGE, platformAlternates } from "@/lib/site-url";
import { platformFaq } from "@/lib/platform-content";

/**
 * 平台版 /faq —— 公開 URL 仍然係 `/{locale}/faq`，middleware 喺平台 host
 * 內部 rewrite 過嚟。點解要拆 route：見 `app/[locale]/platform/about/page.tsx`。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isZh = locale === "zh-HK";
  const alt = platformAlternates(locale, "/faq");
  const title = isZh ? "常見問題 - WoWlix" : "FAQ - WoWlix";
  const description = isZh
    ? "WoWlix 常見問題"
    : "Frequently asked questions about WoWlix";

  return {
    title,
    description,
    alternates: alt,
    openGraph: {
      title,
      description,
      siteName: "WoWlix",
      type: "website",
      locale: isZh ? "zh_HK" : "en_US",
      url: alt.canonical,
      images: [OG_DEFAULT_IMAGE],
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function PlatformFaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === "zh-HK";

  return (
    <MarketingLegalShell locale={locale}>
      <FaqSection
        faqs={platformFaq[isZh ? "zh" : "en"]}
        isZh={isZh}
        // WoWlix 係開店工具，唔係俾人買嘢嘅店 —— 唔可以寫 shopping with
        subtitle={
          isZh ? "以下係關於 WoWlix 嘅常見問題。" : "Common questions about WoWlix."
        }
      />
    </MarketingLegalShell>
  );
}
