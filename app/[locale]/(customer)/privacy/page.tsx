import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { getStoreName } from "@/lib/get-store-name";
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

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const storeName = await getStoreName();
  const isZh = locale === "zh-HK";

  // Platform mode 先包 marketing 殼（Ink & Bone）；租戶店行原本 zinc 版
  const platform = await isPlatformMode();
  const shell = (node: ReactNode) =>
    platform ? <MarketingLegalShell locale={locale}>{node}</MarketingLegalShell> : node;

  if (isZh) {
    return shell(
      <div className="mx-auto max-w-3xl px-4 py-10 pb-32">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          私隱政策
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
              WoWlix（下稱「本平台」）重視您嘅私隱。本平台由 Flow Studio HK
              營運。本政策說明我們如何收集、使用及保護您嘅個人資料。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              2. 資料收集
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              我們可能收集以下資料：
            </p>
            <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
              <li>姓名、電郵地址、電話號碼</li>
              <li>送貨地址及帳單資料</li>
              <li>訂單記錄及交易資料</li>
              <li>瀏覽器類型、IP 地址及裝置資料</li>
              <li>Cookie 及網站使用數據</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              3. 資料用途
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              您嘅個人資料將用於：
            </p>
            <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
              <li>處理及送遞訂單</li>
              <li>管理您嘅帳戶</li>
              <li>提供客戶服務及回應查詢</li>
              <li>發送訂單更新及通知</li>
              <li>改善平台服務及用戶體驗</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              4. 資料保護
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              我們採取合理嘅技術及管理措施保護您嘅個人資料，防止未經授權嘅存取、使用或洩露。付款資料經加密處理，我們不會儲存完整嘅信用卡號碼。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              5. 資料分享
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              我們不會出售您嘅個人資料。我們可能會與以下第三方分享必要資料：
            </p>
            <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
              <li>物流合作夥伴（用於送貨）</li>
              <li>付款處理商（用於交易處理）</li>
              <li>法律要求嘅政府機構</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              6. Cookie 使用
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              本平台使用 Cookie
              以改善瀏覽體驗及分析網站流量。您可以透過瀏覽器設定管理
              Cookie 偏好。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              7. 您嘅權利
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              根據適用法律，您有權：
            </p>
            <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
              <li>查閱我們持有嘅您嘅個人資料</li>
              <li>要求更正不準確嘅資料</li>
              <li>要求刪除您嘅個人資料</li>
              <li>反對或限制資料處理</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              8. 政策更新
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              我們可能會不時更新本私隱政策。更新後嘅版本將於本頁面發佈，並以頁面頂部嘅日期為準。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              9. 聯絡我們
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              如對本私隱政策有任何疑問，請透過以下方式與我們聯繫：
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
        Privacy Policy
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
            WoWlix (the &ldquo;Platform&rdquo;) values your privacy. This
            Platform is operated by Flow Studio HK. This policy explains how we
            collect, use, and protect your personal data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            2. Data Collection
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            We may collect the following information:
          </p>
          <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
            <li>Name, email address, and phone number</li>
            <li>Delivery address and billing information</li>
            <li>Order history and transaction data</li>
            <li>Browser type, IP address, and device information</li>
            <li>Cookies and website usage data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            3. Use of Data
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            Your personal data is used to:
          </p>
          <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
            <li>Process and deliver orders</li>
            <li>Manage your account</li>
            <li>Provide customer service and respond to enquiries</li>
            <li>Send order updates and notifications</li>
            <li>Improve Platform services and user experience</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            4. Data Protection
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            We implement reasonable technical and organisational measures to
            protect your personal data against unauthorised access, use, or
            disclosure. Payment information is encrypted, and we do not store
            full credit card numbers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            5. Data Sharing
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            We do not sell your personal data. We may share necessary data with
            the following third parties:
          </p>
          <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
            <li>Logistics partners (for delivery)</li>
            <li>Payment processors (for transaction processing)</li>
            <li>Government authorities (as required by law)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            6. Cookies
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            The Platform uses cookies to improve browsing experience and analyse
            website traffic. You can manage cookie preferences through your
            browser settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            7. Your Rights
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            Under applicable law, you have the right to:
          </p>
          <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your personal data</li>
            <li>Object to or restrict data processing</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            8. Policy Updates
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            We may update this Privacy Policy from time to time. The updated
            version will be posted on this page, effective as of the date shown
            at the top.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            9. Contact Us
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            If you have any questions about this Privacy Policy, please reach
            out to us:
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
