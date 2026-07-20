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
import { getStoreName } from "@/lib/get-store-name";
import { isPlatformMode } from "@/lib/tenant";
import "./globals.css";
import { cn } from "@/lib/utils";

// Local Geist serves both the legacy `--font-geist-sans` and shadcn's `--font-sans`.
const geistSans = localFont({
  src: "./fonts/GeistVF.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistSansShadcn = localFont({
  src: "./fonts/GeistVF.woff2",
  variable: "--font-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff2",
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

export async function generateMetadata(): Promise<Metadata> {
  // Platform bare domain → WoWlix branding
  if (await isPlatformMode()) {
    return {
      title: "WoWlix — Turn Followers into Customers",
      description:
        "Instagram 小店嘅最強武器。2 分鐘開店，一條連結搞掂所有嘢。免費開始。",
      manifest: "/manifest.json",
      icons: {
        icon: "/favicon.svg",
      },
      openGraph: {
        images: ["https://wowlix.com/og-default.png"],
      },
    };
  }

  const storeName = await getStoreName();

  return {
    title: `${storeName} — WoWlix`,
    description:
      "WoWlix — The all-in-one store builder for Hong Kong Instagram merchants | 香港 IG 小店一站式開店平台，一條 Link 將 Follower 變成生意",
    manifest: "/manifest.json",
    icons: {
      icon: "/favicon.svg",
    },
    openGraph: {
      images: ["https://wowlix.com/og-default.png"],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // lang 跟返真 locale 行（middleware set x-locale）—— 以前寫死 zh-HK，
  // /en 頁 screen reader 會用中文聲讀英文（e2e a11y/locale gate 抓住）
  const { headers } = await import("next/headers");
  const headersList = await headers();
  const lang = headersList.get("x-locale") || "zh-HK";
  return (
    <html lang={lang} suppressHydrationWarning className={cn("font-sans", geistSansShadcn.variable)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} ${playfairDisplay.variable} ${montserrat.variable} ${cormorantGaramond.variable} ${inter.variable} ${lato.variable} bg-white text-zinc-900 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
