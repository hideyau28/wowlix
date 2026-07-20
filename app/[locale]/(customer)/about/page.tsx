import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getStoreName } from "@/lib/get-store-name";
import { getTenantInfo } from "@/lib/get-tenant-info";
import { getAboutContent } from "@/lib/tenant-content";
import { isPlatformMode } from "@/lib/tenant";
import MarketingLegalShell from "@/components/marketing/MarketingLegalShell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const storeName = await getStoreName();
  const isZh = locale === "zh-HK";
  const title = isZh ? `關於我們 - ${storeName}` : `About Us - ${storeName}`;
  const description = isZh
    ? `了解更多關於 ${storeName}`
    : `Learn more about ${storeName}`;

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

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const storeName = await getStoreName();
  const tenant = await getTenantInfo();
  const content = getAboutContent(tenant.slug);
  const isZh = locale === "zh-HK";

  // Platform mode 先包 marketing 殼（Ink & Bone）；租戶店行原本 zinc 版
  const platform = await isPlatformMode();
  const shell = (node: ReactNode) =>
    platform ? <MarketingLegalShell locale={locale}>{node}</MarketingLegalShell> : node;

  // For non-default tenants (e.g. Bull Kicks), always show English content
  const showEnglish = tenant.slug !== "maysshop" || !isZh;

  if (!showEnglish) {
    // Original maysshop zh-HK content
    return shell(
      <div className="mx-auto max-w-3xl px-4 py-10 pb-32">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          關於我們
        </h1>

        <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              我們嘅使命
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {storeName}{" "}
              致力為香港顧客提供優質嘅產品同購物體驗。我們精心挑選每一件商品，確保品質同性價比。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              點解揀我哋？
            </h2>
            <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
              <li>正品保證</li>
              <li>快速本地送貨</li>
              <li>貼心客戶服務</li>
              <li>安全付款方式</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              聯絡我們
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              如有任何查詢，歡迎聯絡我們：
            </p>
            <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
              <li>
                電郵：{" "}
                <a
                  href="mailto:wowlix@flowstudiohk.com"
                  className="underline"
                >
                  wowlix@flowstudiohk.com
                </a>
              </li>
              <li>
                網站：{" "}
                <a
                  href="https://wowlix.com"
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://wowlix.com
                </a>
              </li>
            </ul>
          </section>

          <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            本平台由 Wowlix 提供技術支援，由 Flow Studio HK 營運。
          </p>
        </div>
      </div>
    );
  }

  // English content — tenant-specific via content config
  const body = content.missionBody.replace("{storeName}", storeName);

  return shell(
    <div className="mx-auto max-w-3xl px-4 py-10 pb-32">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        About Us
      </h1>

      <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            {content.mission}
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {body}
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            {content.whyChooseUs}
          </h2>
          <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
            {content.whyChooseUsItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            {content.getInTouch}
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {content.getInTouchBody}
          </p>
          <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
            {content.contactLinks.map((link) => (
              <li key={link.label}>
                {link.label}:{" "}
                <a
                  href={link.href}
                  className="underline"
                  target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                  rel={link.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                >
                  {link.text}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          {content.footer}
        </p>
      </div>
    </div>
  );
}
