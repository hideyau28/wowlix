import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getStoreName } from "@/lib/get-store-name";
import { getTenantInfo } from "@/lib/get-tenant-info";
import { isPlatformMode } from "@/lib/tenant";

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

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const storeName = await getStoreName();
  const tenant = await getTenantInfo();
  const isZh = locale === "zh-HK";

  // Platform mode 先包 marketing 殼（Ink & Bone）；租戶店行原本 zinc 版。
  // lazy import：static import 會將 marketing fonts（preload:true）綁入呢條
  // 租戶共用 route（見 components/marketing/fonts.ts 註釋）
  const platform = await isPlatformMode();
  const MarketingLegalShell = platform
    ? (await import("@/components/marketing/MarketingLegalShell")).default
    : null;
  const shell = (node: ReactNode) =>
    MarketingLegalShell ? (
      <MarketingLegalShell locale={locale}>{node}</MarketingLegalShell>
    ) : (
      node
    );

  // Bull Kicks / non-default tenants: English-only terms
  if (tenant.slug !== "maysshop") {
    return shell(
      <div className="mx-auto max-w-3xl px-4 py-10 pb-32">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          Terms of Service
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
          Last updated: 17 March 2026
        </p>

        <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              1. Introduction
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Welcome to {storeName} (the &ldquo;Store&rdquo;). By accessing or
              using this Store, you agree to be bound by these Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              2. Products &amp; Authenticity
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              All products sold through {storeName} are authenticated before
              shipping. We guarantee authenticity and provide a Certificate of
              Authenticity with each order.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              3. Orders &amp; Payments
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              All orders are subject to confirmation. We reserve the right to
              refuse or cancel orders due to stock unavailability or pricing
              errors. Payment is processed securely via our payment providers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              4. Shipping &amp; Delivery
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              All orders ship from Hong Kong. Import duties and VAT are the
              buyer&apos;s responsibility. See our Shipping Policy page for
              details on shipping options and delivery times.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              5. Returns &amp; Refunds
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              All items are final sale due to their limited-edition nature.
              Returns are accepted only for wrong item or wrong size shipped.
              See our Returns Policy page for full details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              6. Intellectual Property
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              All content on this Store, including text, images, logos, and
              designs, is protected by intellectual property laws. Unauthorised
              reproduction or distribution is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              7. Disclaimer
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              The Store is provided on an &ldquo;as is&rdquo; basis. We do not
              guarantee uninterrupted or error-free service. To the fullest
              extent permitted by law, we shall not be liable for any indirect
              or consequential losses.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              8. Contact Us
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              If you have any questions about these Terms, please contact us via
              WhatsApp or email. See our Contact page for details.
            </p>
          </section>

          <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            {storeName} is operated independently. Powered by Wowlix.
          </p>
        </div>
      </div>
    );
  }

  // maysshop — original bilingual content
  if (isZh) {
    return shell(
      <div className="mx-auto max-w-3xl px-4 py-10 pb-32">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          服務條款
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
          最後更新日期：2026 年 2 月 16 日
        </p>

        <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              1. 簡介
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              歡迎使用 WoWlix（下稱「本平台」）。本平台由 Flow Studio HK
              營運。使用本平台即表示您同意遵守以下服務條款。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              2. 服務範圍
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              本平台提供網上購物服務，包括但不限於產品瀏覽、下單、付款及送貨安排。所有交易均受本條款約束。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              3. 用戶責任
            </h2>
            <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
              <li>您必須提供準確嘅個人資料及聯絡方式</li>
              <li>您有責任妥善保管帳戶資料</li>
              <li>禁止將本平台用於任何非法用途</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              4. 訂單與付款
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              所有訂單以本平台確認為準。我們保留因庫存不足或其他原因拒絕或取消訂單嘅權利。付款完成後，訂單將按照送貨政策處理。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              5. 退換貨政策
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              退換貨須於收貨後 7 日內提出，商品必須保持原始狀態及包裝完整。個人衛生用品及已拆封商品不設退換。詳情請聯絡客服。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              6. 知識產權
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              本平台所有內容（包括但不限於文字、圖片、標誌及設計）均受知識產權法保護。未經授權，不得複製、修改或分發任何平台內容。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              7. 免責聲明
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              本平台按「現狀」提供服務。我們不保證服務不會中斷或不含錯誤。在法律允許嘅範圍內，我們對任何間接損失概不負責。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              8. 條款修改
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              我們保留隨時修改本條款嘅權利。修改後繼續使用本平台即視為接受更新後嘅條款。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              9. 聯絡我們
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              如有任何查詢，請透過以下方式與我們聯繫：
            </p>
            <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
              <li>電郵：wowlix@flowstudiohk.com</li>
              <li>
                網站：
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

  return shell(
    <div className="mx-auto max-w-3xl px-4 py-10 pb-32">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Terms of Service
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        Last updated: 16 February 2026
      </p>

      <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            1. Introduction
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            Welcome to WoWlix (the &ldquo;Platform&rdquo;). This Platform is
            operated by Flow Studio HK. By accessing or using the Platform, you
            agree to be bound by these Terms of Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            2. Scope of Service
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            The Platform provides online shopping services including but not
            limited to product browsing, ordering, payment processing, and
            delivery arrangements. All transactions are governed by these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            3. User Responsibilities
          </h2>
          <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
            <li>You must provide accurate personal and contact information</li>
            <li>
              You are responsible for maintaining the security of your account
            </li>
            <li>Use of the Platform for any unlawful purpose is prohibited</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            4. Orders &amp; Payments
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            All orders are subject to confirmation by the Platform. We reserve
            the right to refuse or cancel orders due to stock unavailability or
            other reasons. Once payment is completed, orders will be processed
            according to our delivery policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            5. Returns &amp; Exchanges
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            Return or exchange requests must be made within 7 days of delivery.
            Items must be in their original condition with packaging intact.
            Personal hygiene products and opened items are not eligible for
            return. Please contact customer service for details.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            6. Intellectual Property
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            All content on the Platform, including but not limited to text,
            images, logos, and designs, is protected by intellectual property
            laws. Unauthorised reproduction, modification, or distribution of
            any Platform content is prohibited.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            7. Disclaimer
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            The Platform is provided on an &ldquo;as is&rdquo; basis. We do not
            guarantee uninterrupted or error-free service. To the fullest extent
            permitted by law, we shall not be liable for any indirect or
            consequential losses.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            8. Modifications to Terms
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            We reserve the right to modify these Terms at any time. Continued
            use of the Platform after changes constitutes acceptance of the
            updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            9. Contact Us
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            If you have any questions, please reach out to us:
          </p>
          <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
            <li>Email: wowlix@flowstudiohk.com</li>
            <li>
              Website:{" "}
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
          This Platform is powered by Wowlix and operated by Flow Studio HK.
        </p>
      </div>
    </div>
  );
}
