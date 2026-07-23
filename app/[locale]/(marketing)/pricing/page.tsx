import PricingPage from "@/components/marketing/StudioPricingPage";
import { MARKETING_PLANS } from "@/components/marketing/plans";
import type { Locale } from "@/lib/i18n";
import type { Metadata } from "next";

// ── 真 prerender（HANDOFF 跟進 task ②）────────────────────────────────────────
// 成條 chain 冇 headers()/cookies()/DB，一直都係 static-compatible，但冇
// generateStaticParams 就只係 on-demand cache —— 補呢兩句變 build-time SSG，
// 學 [locale]/landing 一樣。定價由 plans.ts 烘死喺 build（同 landing 一致，
// 改價要 redeploy —— HANDOFF「有意識接受」嗰項）。
export function generateStaticParams() {
  return [{ locale: "zh-HK" }, { locale: "en" }];
}

// 冇呢句 /fr/pricing /xx/pricing 垃圾 locale 會 on-demand render 200 兼永久
// 佔 full-route cache（landing 嗰邊實測過）。鎖死兩個值，其他一律 404。
export const dynamicParams = false;

export const metadata: Metadata = {
  title: "Pricing | WoWlix — IG Shop Builder",
  description:
    "0% platform fee, $0 to start. Free / Lite $78 / Pro $198 plans for IG shops.",
  alternates: {
    canonical: "https://wowlix.com/pricing",
  },
  openGraph: {
    title: "全港最平 IG 網店方案 | WoWlix",
    description:
      "0% platform fee, $0 to start. Free / Lite $78 / Pro $198 plans for IG shops.",
    url: "https://wowlix.com/pricing",
    siteName: "WoWlix",
    type: "website",
    images: [
      { url: "https://wowlix.com/og-default.png", width: 1200, height: 630 },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["https://wowlix.com/og-default.png"],
  },
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // SoftwareApplication + AggregateOffer JSON-LD — 直接由 MARKETING_PLANS
  // 出 offer（single source of truth，價錢唔會同頁面 drift）
  const prices = MARKETING_PLANS.map((p) => p.priceHKD);
  const pricingJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "WoWlix",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://wowlix.com/pricing",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "HKD",
      lowPrice: String(Math.min(...prices)),
      highPrice: String(Math.max(...prices)),
      offerCount: String(MARKETING_PLANS.length),
      offers: MARKETING_PLANS.map((p) => ({
        "@type": "Offer",
        name: p.name,
        price: String(p.priceHKD),
        priceCurrency: "HKD",
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />
      <PricingPage locale={locale as Locale} />
    </>
  );
}
