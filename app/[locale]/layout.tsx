import { ReactNode } from "react";
import { ToastProvider } from "@/components/Toast";
import { TenantBrandingProvider } from "@/lib/tenant-branding";
import HtmlLangSync from "@/components/HtmlLangSync";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <TenantBrandingProvider>
      <HtmlLangSync lang={locale === "en" ? "en" : "zh-HK"} />
      <ToastProvider>{children}</ToastProvider>
    </TenantBrandingProvider>
  );
}
