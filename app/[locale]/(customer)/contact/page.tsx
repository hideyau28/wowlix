import type { Metadata } from "next";
import { getStoreName } from "@/lib/get-store-name";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { getTenantInfo } from "@/lib/get-tenant-info";
import { getContactContent } from "@/lib/tenant-content";

/**
 * 租戶店版 /contact。
 *
 * ⚠️ 平台版搬咗去 `app/[locale]/platform/contact`（middleware 喺平台 host
 * 內部 rewrite，公開 URL 唔變）。**唔好再喺呢個檔 import 任何
 * `components/marketing/*`** —— 一 import 返，每個租戶店客人就即刻白食
 * 145.5 KB Fraunces（#391 實測：per-page font manifest 連 dynamic import()
 * 都照計，只有 route 邊界斷得開）。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isZh = locale === "zh-HK";
  // 平台 host 唔好用 default 店個名（會出「Contact Us - B」）—— 用 WoWlix。
  const storeName = await getStoreName();
  const title = isZh ? `聯絡我們 - ${storeName}` : `Contact Us - ${storeName}`;
  const description = isZh
    ? `聯絡 ${storeName}，WhatsApp 或電郵查詢`
    : `Contact ${storeName} via WhatsApp or email`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: storeName,
      type: "website",
      locale: locale === "zh-HK" ? "zh_HK" : "en_US",
      // Next 每個 segment 係成個 openGraph object 覆蓋（唔會同 root layout
      // deep-merge），唔喺度補就連分享圖都冇 —— 呢三頁正正係 WhatsApp／IG
      // 分享面。og:url 直接食 canonical，保證兩者永遠一致。
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}


export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === "zh-HK";

  const waBtnClass =
    "inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1da851] transition-colors";

  // 非平台（租戶店）先至查 DB —— 平台頁上面已經 return。
  // （呢度冇 getStoreName()：租戶 contact 兩個 branch 都唔用 storeName，
  //  call 咗淨係白燒 2 條 query。generateMetadata 嗰邊先真係要。）
  const tenant = await getTenantInfo();
  const content = getContactContent(tenant.slug);

  // For non-default tenants, always show English
  const showEnglish = tenant.slug !== "maysshop" || !isZh;

  if (!showEnglish) {
    // Original maysshop zh-HK content
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 pb-32">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          聯絡我們
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
          如有任何查詢，歡迎透過以下方式聯絡我們。
        </p>

        <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              WhatsApp
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              最快捷嘅聯絡方式，一般喺辦公時間內回覆。
            </p>
            <a
              href={`https://wa.me/${content.whatsapp.number}`}
              target="_blank"
              rel="noopener noreferrer"
              className={waBtnClass}
            >
              <WhatsAppIcon />
              WhatsApp 聯絡我們
            </a>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              電郵
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              如需詳細查詢或提交文件，可透過電郵聯絡：
            </p>
            <a
              href={`mailto:${content.email.address}`}
              className="text-zinc-900 dark:text-zinc-100 underline hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
            >
              {content.email.address}
            </a>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              辦公時間
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              星期一至五：10:00 - 18:00（公眾假期除外）
            </p>
          </section>

          <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            本平台由 Wowlix 提供技術支援，由 Flow Studio HK 營運。
          </p>
        </div>
      </div>
    );
  }

  // English content — tenant-specific
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 pb-32">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Contact Us
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        {content.intro}
      </p>

      <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            WhatsApp
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {content.whatsapp.description}
          </p>
          <a
            href={`https://wa.me/${content.whatsapp.number}`}
            target="_blank"
            rel="noopener noreferrer"
            className={waBtnClass}
          >
            <WhatsAppIcon />
            {content.whatsapp.label}
          </a>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            Email
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {content.email.description}
          </p>
          <a
            href={`mailto:${content.email.address}`}
            className="text-zinc-900 dark:text-zinc-100 underline hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
          >
            {content.email.address}
          </a>
        </section>

        {content.instagram && (
          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              Instagram
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {content.instagram.description}
            </p>
            <a
              href={`https://instagram.com/${content.instagram.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-900 dark:text-zinc-100 underline hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
            >
              @{content.instagram.handle}
            </a>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            Business Hours
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {content.businessHours}
          </p>
          {content.responseTime && (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
              {content.responseTime}
            </p>
          )}
        </section>

        <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          {content.footer}
        </p>
      </div>
    </div>
  );
}
