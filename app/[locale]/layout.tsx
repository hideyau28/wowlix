import { ReactNode } from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";
import {
  Bebas_Neue,
  Playfair_Display,
  Montserrat,
  Cormorant_Garamond,
  Inter,
  Lato,
} from "next/font/google";
import "../globals.css";
import { OG_DEFAULT_IMAGE } from "@/lib/site-url";
import { cn } from "@/lib/utils";
import { ToastProvider } from "@/components/Toast";
import { TenantBrandingProvider } from "@/lib/tenant-branding";
import HtmlLangSync from "@/components/HtmlLangSync";

// ── Root shell ───────────────────────────────────────────────────────────────
// <html>/<body> 以前住喺 app/layout.tsx，靠 headers().get("x-locale") set lang —
// 嗰下 headers() 令全站每一條 route 都焗住 dynamic（包括 /pricing 呢啲純靜態頁）。
// 搬入 [locale] 之後 lang 由 param 嚟（build time 已知），platform landing / pricing
// 先至可以真 static（HANDOFF 跟進 task ③ 嘅前提）。

// Local Geist serves both the legacy `--font-geist-sans` and shadcn's `--font-sans`.
const geistSans = localFont({
  src: "../fonts/GeistVF.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistSansShadcn = localFont({
  src: "../fonts/GeistVF.woff2",
  variable: "--font-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../fonts/GeistMonoVF.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// ── Template fonts (self-hosted via next/font) ───────────────────────────────
// These CSS variables are available on every page.
// Browsers only download the woff2 files when font-family var is actually used.

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const montserrat = Montserrat({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const cormorantGaramond = Cormorant_Garamond({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-cormorant",
  display: "swap",
});

const inter = Inter({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const lato = Lato({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-lato",
  display: "swap",
});

// 靜態 defaults（manifest / icons / og）。以前 root generateMetadata 用
// isPlatformMode() + getStoreName()（兩個都讀 headers）出 storeName title —
// 嗰套搬咗落 (customer) / (admin) layout（本身已經 force-dynamic）。呢度只留
// 唔會逼 route 變 dynamic 嘅嘢；有自己 metadata 嘅頁（landing / pricing /
// start / admin login）照 override。
export const metadata: Metadata = {
  title: "WoWlix",
  description:
    "WoWlix — The all-in-one store builder for Hong Kong Instagram merchants | 香港 IG 小店一站式開店平台，一條 Link 將 Follower 變成生意",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    images: [OG_DEFAULT_IMAGE],
  },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // params.locale 冇 route 層驗證（reserved bare path 例如 /about 會以
  // locale="about" 入嚟）—— 一律 normalize，唔准垃圾值落 <html lang>
  const lang = locale === "en" ? "en" : "zh-HK";
  return (
    <html lang={lang} suppressHydrationWarning className={cn("font-sans", geistSansShadcn.variable)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} ${playfairDisplay.variable} ${montserrat.variable} ${cormorantGaramond.variable} ${inter.variable} ${lato.variable} bg-white text-zinc-900 antialiased`}
      >
        <TenantBrandingProvider>
          {/* client nav 切 locale 時 belt-and-braces sync（server 端 lang 已由 param 嚟） */}
          <HtmlLangSync lang={lang} />
          <ToastProvider>{children}</ToastProvider>
        </TenantBrandingProvider>
      </body>
    </html>
  );
}
