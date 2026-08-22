import type { Metadata } from "next";
import MarketingLegalShell from "@/components/marketing/MarketingLegalShell";
import PrivacyBody from "@/components/legal/PrivacyBody";
import { getStoreName } from "@/lib/get-store-name";

/**
 * 平台版 /privacy —— 公開 URL 仍然係 `/{locale}/privacy`，middleware 喺平台
 * host 內部 rewrite 過嚟。拆 route 嘅原因見 `app/[locale]/platform/about/page.tsx`。
 *
 * 🔴 **呢頁而家出緊 default 店嘅私隱政策，唔係 WoWlix 自己嘅。** 呢個 PR 純粹
 * 拆 route 斷字體，**內容一個字冇改** —— 行為同拆之前一模一樣。要出真正嘅
 * 平台私隱政策，等 Yau 俾①法律實體全名 ②data 清單（見 HANDOFF「Yau 拍板位」）。
 * ⚠️ **唔准 AI 作住 ship 法律文字。**
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const storeName = await getStoreName();
  const isZh = locale === "zh-HK";
  const title = isZh ? `私隱政策 - ${storeName}` : `Privacy Policy - ${storeName}`;
  const description = isZh
    ? `${storeName} 私隱政策`
    : `Privacy Policy for ${storeName}`;

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

export default async function PlatformPrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === "zh-HK";

  return (
    <MarketingLegalShell locale={locale}>
      <PrivacyBody isZh={isZh} />
    </MarketingLegalShell>
  );
}
