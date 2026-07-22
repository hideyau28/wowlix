import { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { getDict } from "@/lib/i18n";
import { getStoreName } from "@/lib/get-store-name";
import { prisma } from "@/lib/prisma";
import TopNav from "@/components/TopNav";
import CategoryNavWrapper from "@/components/CategoryNavWrapper";
import BottomTab from "@/components/BottomTab";
import Footer from "@/components/Footer";
import { CurrencyProvider } from "@/lib/currency";
import { ThemeProvider } from "@/lib/theme-context";
import { FilterProvider } from "@/lib/filter-context";
import { AuthProvider } from "@/lib/auth-context";
import Analytics from "@/components/Analytics";
import WelcomePopup from "@/components/WelcomePopup";
import CartFlyAnimation from "@/components/CartFlyAnimation";
import AdminPreviewBanner from "@/components/AdminPreviewBanner";
import StorefrontTemplate from "@/components/StorefrontTemplate";
import ScrollToTop from "@/components/ScrollToTop";
import { getServerTenantId, isPlatformMode } from "@/lib/tenant";

// Force dynamic rendering because we need headers() for tenant resolution
export const dynamic = "force-dynamic";

// storeName branding title —— 以前住喺 root layout generateMetadata（isPlatformMode
// + getStoreName 都讀 headers）。root shell 搬入 [locale] 靜態化之後，呢套 headers
// 邏輯落返嚟 (customer)（本身 force-dynamic，唔會拖累其他 route）。有自己
// generateMetadata 嘅頁（home/product/legal…）照 override title/description。
export async function generateMetadata(): Promise<Metadata> {
  if (await isPlatformMode()) {
    return {
      title: "WoWlix — Turn Followers into Customers",
      description:
        "Instagram 小店嘅最強武器。2 分鐘開店，一條連結搞掂所有嘢。免費開始。",
    };
  }
  const storeName = await getStoreName();
  return {
    title: `${storeName} — WoWlix`,
    description:
      "WoWlix — The all-in-one store builder for Hong Kong Instagram merchants | 香港 IG 小店一站式開店平台，一條 Link 將 Follower 變成生意",
  };
}

export default async function CustomerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locale || locale === "undefined") {
    redirect("/zh-HK");
  }

  const l = locale as Locale;
  const t = getDict(l);

  // Platform bare domain (wowlix.com) → minimal layout, 冇 store chrome
  if (await isPlatformMode()) {
    return (
      <ThemeProvider>
        <main>{children}</main>
      </ThemeProvider>
    );
  }

  // Fetch tenant template + welcome popup settings (tenant-aware).
  // If tenant lookup fails (slug unknown, tenant disabled, DB hiccup) we
  // fall through to a minimal layout so page.tsx's catch can render the
  // landing page instead of 500-ing the whole route.
  let tenantId: string;
  try {
    tenantId = await getServerTenantId();
  } catch {
    return (
      <ThemeProvider>
        <main>{children}</main>
      </ThemeProvider>
    );
  }
  const [tenantRow, storeSettings] = await Promise.all([
    prisma.tenant
      .findUnique({
        where: { id: tenantId },
        select: {
          slug: true,
          region: true,
          templateId: true,
          hideBranding: true,
          plan: true,
          planExpiresAt: true,
          languages: true,
        },
      })
      .catch(() => null),
    prisma.storeSettings
      .findFirst({
        where: { tenantId },
      })
      .catch(() => null),
  ]);

  // Get store name with fallback
  const storeName = storeSettings?.storeName || "WoWlix";

  // Only Pro plan (not expired) with hideBranding enabled can hide branding
  const isPro =
    tenantRow?.plan === "pro" &&
    (!tenantRow?.planExpiresAt || tenantRow.planExpiresAt > new Date());
  const effectiveHideBranding = isPro && (tenantRow?.hideBranding ?? false);

  const isZh = l === "zh-HK";
  const welcomePopupConfig = {
    enabled: storeSettings?.welcomePopupEnabled ?? true,
    title:
      storeSettings?.welcomePopupTitle ||
      (isZh ? `歡迎來到 ${storeName}` : `Welcome to ${storeName}`),
    subtitle:
      storeSettings?.welcomePopupSubtitle ||
      (isZh
        ? "探索最新波鞋及運動裝備，正品保證！"
        : "Shop the latest sneakers and sports gear. 100% authentic!"),
    promoText:
      storeSettings?.welcomePopupPromoText ||
      (isZh
        ? "🎉 訂單滿 $600 免運費！"
        : "🎉 Free shipping on orders over $600!"),
    buttonText:
      storeSettings?.welcomePopupButtonText ||
      (isZh ? "開始購物" : "Start Shopping"),
  };

  return (
    <ThemeProvider>
      <StorefrontTemplate templateId={tenantRow?.templateId || "mochi"}>
        <CurrencyProvider>
          <FilterProvider>
            <AuthProvider>
              <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
                <Analytics />
                <AdminPreviewBanner locale={l} />
                <TopNav
                  locale={l}
                  t={t}
                  storeName={storeName}
                  languages={tenantRow?.languages}
                />
                <CategoryNavWrapper
                  locale={l}
                  tenantSlug={tenantRow?.slug ?? "maysshop"}
                />
                <main>{children}</main>
                <Footer
                  locale={l}
                  t={t}
                  storeName={storeName}
                  hideBranding={effectiveHideBranding}
                  whatsappNumber={storeSettings?.whatsappNumber}
                  instagramUrl={storeSettings?.instagramUrl}
                  region={tenantRow?.region}
                />
                <BottomTab t={t} />
                <ScrollToTop />
                <WelcomePopup config={welcomePopupConfig} />
                <CartFlyAnimation />
              </div>
            </AuthProvider>
          </FilterProvider>
        </CurrencyProvider>
      </StorefrontTemplate>
    </ThemeProvider>
  );
}
