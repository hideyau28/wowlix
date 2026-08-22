import type { Metadata } from "next";
import MarketingLegalShell from "@/components/marketing/MarketingLegalShell";
import { OG_DEFAULT_IMAGE, platformAlternates } from "@/lib/site-url";
import {
  PLATFORM_EMAIL,
  PLATFORM_WHATSAPP,
  PLATFORM_WHATSAPP_DISPLAY,
  PLATFORM_WHATSAPP_INTL,
  platformAbout,
} from "@/lib/platform-content";

/**
 * 平台版 /about —— **公開 URL 仍然係 `/{locale}/about`**，middleware 喺平台
 * host 內部 rewrite 過嚟（同 `/landing` 一模一樣嘅做法）。
 *
 * 點解要開獨立 route：呢五頁法律／資訊頁以前同租戶版共用
 * `(customer)/about`，入面 `await import("MarketingLegalShell")` 拉住
 * marketing fonts。**Next 16 / turbopack 個 per-page font manifest 連 dynamic
 * `import()` 都照計** —— #391 實測推翻咗「lazy 所以唔 preload」呢個講法，
 * 一入條 route 個 graph 就照 preload。結果每個租戶店客人開 about 都白食
 * 145.5 KB Fraunces（396.1 KB vs 純租戶 route 250.6 KB）。
 *
 * **唯一斷得開嘅界線係 route 邊界**，所以平台版搬晒出嚟呢度，
 * `(customer)/about` 淨返租戶內容，跌返 250.6 KB。
 *
 * ⚠️ 呢度可以 static import MarketingLegalShell —— 呢條 route 本身就係平台面，
 * 用 marketing fonts 係應該嘅。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isZh = locale === "zh-HK";
  const alt = platformAlternates(locale, "/about");
  const title = isZh ? "關於我們 - WoWlix" : "About Us - WoWlix";
  const description = isZh ? "了解更多關於 WoWlix" : "Learn more about WoWlix";

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
      // og:url 直接食 canonical，保證兩者永遠一致。
      url: alt.canonical,
      images: [OG_DEFAULT_IMAGE],
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PlatformAboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === "zh-HK";
  const c = platformAbout[isZh ? "zh" : "en"];

  return (
    <MarketingLegalShell locale={locale}>

      <div className="mx-auto max-w-3xl px-4 py-10 pb-32">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          {c.title}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
          {c.intro}
        </p>

        <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none space-y-6">
          <section>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {c.body}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              {c.whyTitle}
            </h2>
            <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
              {c.why.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              {c.contactTitle}
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {c.contactBody}
            </p>
            <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1 mt-2">
              <li>
                WhatsApp:{" "}
                <a
                  href={`https://wa.me/${PLATFORM_WHATSAPP}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {isZh ? PLATFORM_WHATSAPP_DISPLAY : PLATFORM_WHATSAPP_INTL}
                </a>
              </li>
              <li>
                Email:{" "}
                <a href={`mailto:${PLATFORM_EMAIL}`} className="underline">
                  {PLATFORM_EMAIL}
                </a>
              </li>
            </ul>
          </section>

          <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            {c.footer}
          </p>
        </div>
      </div>
    </MarketingLegalShell>
  );
}
