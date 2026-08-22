import type { Metadata } from "next";
import MarketingLegalShell from "@/components/marketing/MarketingLegalShell";
import TermsBody from "@/components/legal/TermsBody";
import { getStoreName } from "@/lib/get-store-name";
import { getTenantInfo } from "@/lib/get-tenant-info";

/**
 * 平台版 /terms —— 公開 URL 仍然係 `/{locale}/terms`，middleware 喺平台 host
 * 內部 rewrite 過嚟。拆 route 嘅原因見 `app/[locale]/platform/about/page.tsx`。
 *
 * 🔴 **呢頁而家出緊 default 店（maysshop）嘅條款，唔係 WoWlix 自己嘅。**
 * 呢個 PR 純粹拆 route 斷字體，**內容一個字冇改** —— 行為同拆之前一模一樣。
 * 要出真正嘅平台條款，等 Yau 俾①法律實體全名 ②data 清單（見 HANDOFF「Yau
 * 拍板位」）。⚠️ **唔准 AI 作住 ship 法律文字。** 屆時呢個檔就唔應該再
 * import TermsBody / getTenantInfo，改為出平台自己嗰份。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const storeName = await getStoreName();
  const isZh = locale === "zh-HK";
  const title = isZh ? `服務條款 - ${storeName}` : `Terms of Service - ${storeName}`;
  const description = isZh
    ? `${storeName} 平台服務條款`
    : `Terms of Service for ${storeName}`;

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

export default async function PlatformTermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const storeName = await getStoreName();
  const tenant = await getTenantInfo();
  const isZh = locale === "zh-HK";

  return (
    <MarketingLegalShell locale={locale}>
      <TermsBody tenantSlug={tenant.slug} storeName={storeName} isZh={isZh} />
    </MarketingLegalShell>
  );
}
