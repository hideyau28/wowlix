import type { Metadata } from "next";
import { ThemeProvider } from "@/lib/theme-context";
import LandingPage from "@/components/marketing/WowlixLandingPage";
import type { Locale } from "@/lib/i18n";
import {
  OG_DEFAULT_IMAGE,
  ORGANIZATION_ID,
  SITE_URL,
  platformUrl,
} from "@/lib/site-url";

// ── 靜態 platform landing ────────────────────────────────────────────────────
// wowlix.com/en | /zh-HK 由 middleware 內部 rewrite 嚟呢度（公開 URL 不變）。
// 成條 chain（[locale] layout → 呢頁）冇 headers()/cookies()/DB —— build time
// prerender，TTFB 唔使等 server render（HANDOFF 跟進 task ③）。
// "landing" 喺 lib/slug-policy.ts 個 shared RESERVED list（middleware routing +
// register/rename 都食同一份），唔會同租戶 slug 撞。
//
// (customer)/page.tsx 仲留住 platform/unknown-tenant fallback（lazy import）——
// middleware 冇捕到嘅邊緣 case 照有得 render，只係行返 dynamic 路。

export function generateStaticParams() {
  return [{ locale: "zh-HK" }, { locale: "en" }];
}

// 冇呢句嘅話 /xx/landing /fr/landing 呢類垃圾 locale 會 on-demand render 200
// 兼每個 segment 永久佔一份 full-route cache（review 實測 .next 入面真係堆咗
// fr/ xx/ 兩份 77KB）。鎖死淨返 generateStaticParams 兩個值，其他一律 404。
// middleware rewrite 只 target /en /zh-HK，不受影響。
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // 唔掂 dynamic API（await params 唔算），保持 route 靜態。
  // 內容照抄 (customer)/page.tsx platformMeta —— 兩邊必須一致。
  const { locale } = await params;
  return {
    title: "WoWlix — Turn Followers into Customers",
    description:
      "Instagram 小店嘅最強武器。2 分鐘開店，一條連結搞掂所有嘢。免費開始。",
    alternates: {
      // Self-referencing canonical per locale（唔好指去會 redirect 嘅 apex ——
      // apex 全路徑 307 → www，見 lib/site-url.ts）+ 絕對 hreflang。
      // 直接開 /{locale}/landing 嘅人都會 canonical 返去 rewrite 前嘅公開 URL。
      canonical: platformUrl(locale === "en" ? "en" : "zh-HK"),
      languages: {
        en: platformUrl("en"),
        "zh-HK": platformUrl("zh-HK"),
        "x-default": platformUrl("zh-HK"),
      },
    },
    openGraph: {
      title: "WoWlix — Turn Followers into Customers",
      description: "Instagram 小店嘅最強武器。2 分鐘開店，一條連結搞掂所有嘢。",
      url: SITE_URL,
      siteName: "WoWlix",
      locale: "zh_HK",
      type: "website" as const,
      images: [
        {
          url: OG_DEFAULT_IMAGE,
          width: 1200,
          height: 630,
          alt: "WoWlix",
        },
      ],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: "WoWlix — Turn Followers into Customers",
      description: "Instagram 小店嘅最強武器。2 分鐘開店，一條連結搞掂所有嘢。",
      images: [OG_DEFAULT_IMAGE],
    },
  };
}

export default async function PlatformLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = (locale === "en" ? "en" : "zh-HK") as Locale;

  // Organization + SoftwareApplication JSON-LD — 平台首頁結構化資料
  // （照抄 (customer)/page.tsx platform branch —— 兩邊必須一致）
  const platformJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: "WoWlix",
        url: SITE_URL,
        logo: OG_DEFAULT_IMAGE,
      },
      {
        "@type": "SoftwareApplication",
        name: "WoWlix",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        description:
          "Instagram 小店嘅最強武器。2 分鐘開店，一條連結搞掂所有嘢。免費開始。",
        offers: { "@type": "Offer", price: "0", priceCurrency: "HKD" },
      },
    ],
  };

  // ThemeProvider + <main> 對齊 (customer)/layout platform branch 嘅殼 —— DOM
  // 結構同動態 fallback 版一致。LandingPage 喺度係 static import（同 (customer)
  // 嗰邊 lazy 相反）—— 有意嘅：marketing fonts preload hint 跟 static graph 行，
  // 呢條 route 正正係要 preload Fraunces 嘅 LCP 面（見 fonts.ts 註釋）。
  return (
    <ThemeProvider>
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(platformJsonLd) }}
        />
        <LandingPage locale={l} />
      </main>
    </ThemeProvider>
  );
}
