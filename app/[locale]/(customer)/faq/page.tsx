import type { Metadata } from "next";
import { getStoreName } from "@/lib/get-store-name";
import { getTenantInfo } from "@/lib/get-tenant-info";
import { getFAQContent } from "@/lib/tenant-content";
import FaqSection from "@/components/FaqSection";

/**
 * 租戶店版 /faq。
 *
 * ⚠️ 平台版搬咗去 `app/[locale]/platform/faq`（middleware 喺平台 host 內部
 * rewrite，公開 URL 唔變）。**唔好再喺呢個檔 import 任何
 * `components/marketing/*`** —— 佢哋拉住 marketing fonts，而 per-page font
 * manifest 連 dynamic `import()` 都照計（#391 實測）。一 import 返，每個租戶
 * 店客人開 FAQ 就即刻白食 145.5 KB。界線只有 route 邊界斷得開。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isZh = locale === "zh-HK";
  const storeName = await getStoreName();
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
      locale: isZh ? "zh_HK" : "en_US",
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function FAQPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === "zh-HK";

  const storeName = await getStoreName();
  const faqs = getFAQContent((await getTenantInfo()).slug);

  return (
    <FaqSection
      faqs={faqs}
      isZh={isZh}
      subtitle={
        isZh
          ? `以下係關於 ${storeName} 嘅常見問題。`
          : `Common questions about shopping with ${storeName}.`
      }
    />
  );
}
