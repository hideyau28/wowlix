import type { Metadata } from "next";
import MarketingLegalShell from "@/components/marketing/MarketingLegalShell";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { OG_DEFAULT_IMAGE, platformAlternates } from "@/lib/site-url";
import {
  PLATFORM_EMAIL,
  PLATFORM_WHATSAPP,
  PLATFORM_WHATSAPP_DISPLAY,
  PLATFORM_WHATSAPP_INTL,
  platformContact,
} from "@/lib/platform-content";

/**
 * 平台版 /contact —— 公開 URL 仍然係 `/{locale}/contact`，middleware 喺平台
 * host 內部 rewrite 過嚟。點解要拆 route：見
 * `app/[locale]/platform/about/page.tsx`。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isZh = locale === "zh-HK";
  const alt = platformAlternates(locale, "/contact");
  const title = isZh ? "聯絡我們 - WoWlix" : "Contact Us - WoWlix";
  const description = isZh
    ? "聯絡 WoWlix，WhatsApp 或電郵查詢"
    : "Contact WoWlix via WhatsApp or email";

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

export default async function PlatformContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === "zh-HK";
  const c = platformContact[isZh ? "zh" : "en"];

  return (
    <MarketingLegalShell locale={locale}>

      <div className="mx-auto max-w-3xl px-4 py-10 pb-32">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          {c.title}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
          {c.intro}
        </p>

        <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              {c.whatsappTitle}
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {c.whatsappBody}
            </p>
            <a
              href={`https://wa.me/${PLATFORM_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="wlx-cta inline-flex items-center gap-2 rounded-full bg-wlx-ink px-5 py-2.5 text-sm font-medium hover:bg-wlx-ink/90 transition-colors"
            >
              <WhatsAppIcon />
              {c.whatsappCta}
            </a>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              {c.emailTitle}
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {c.emailBody}
            </p>
            <a
              href={`mailto:${PLATFORM_EMAIL}`}
              className="text-zinc-900 dark:text-zinc-100 underline hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
            >
              {PLATFORM_EMAIL}
            </a>
          </section>

          <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            {c.footer}
          </p>
        </div>
      </div>
    </MarketingLegalShell>
  );
}
