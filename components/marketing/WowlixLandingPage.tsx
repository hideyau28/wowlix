"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Check,
  Languages,
  ListChecks,
  Sparkles,
  Users,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";

/* ─── i18n ─── */
const T = {
  "zh-HK": {
    navPricing: "定價",
    navLogin: "登入",
    navStart: "免費開店",

    heroPill: "新功能：電郵驗證碼登入",
    heroTitleA: "香港 IG 小店嘅",
    heroTitleAccent: "一站式",
    heroTitleB: "開店平台",
    heroSub:
      "由商品上架到訂單追蹤，由客戶管理到多語言支援。一條 link 開始，2 分鐘上線。",
    heroCta: "免費開店",
    heroSecondary: "已有帳戶？登入",
    heroTrust: "0% 佣金 · 唔使信用卡 · 即開即用",

    statsEyebrow: "我哋承諾",
    stat1Num: "0",
    stat1Suffix: "%",
    stat1Label: "佣金",
    stat2Num: "2",
    stat2Suffix: "分鐘",
    stat2Label: "開店時間",
    stat3Num: "$0",
    stat3Suffix: "",
    stat3Label: "免費開始",
    stat4Num: "新",
    stat4Suffix: "",
    stat4Label: "首批商戶招募中",

    featEyebrow: "為小店而設",
    featTitle: "你需要嘅一切，都喺呢度。",
    feat1Title: "商品管理",
    feat1Desc:
      "拖放上架、規格組合、批量編輯。CSV 匯入匯出，由 Excel 過渡毫無壓力。",
    feat2Title: "訂單追蹤",
    feat2Desc:
      "由收單、付款、出貨、送達，全程一覽無遺。客人自助查單，慳返 DM 嘅時間。",
    feat3Title: "客戶管理",
    feat3Desc:
      "自動建立客戶檔案，回購率、訂單歷史、聯絡資料一目了然。",
    feat4Title: "多語言支援",
    feat4Desc: "繁中 / 英文同步切換，海外客人都睇得明。SEO 自動處理。",

    pricingEyebrow: "定價",
    pricingTitle: "簡單透明，0% 佣金。",
    pricingSub: "你賺幾多就係幾多。冇隱藏收費。",
    pricingFreeName: "Free",
    pricingFreeDesc: "試水溫",
    pricingFreePrice: "$0",
    pricingFreePeriod: "／月",
    pricingFreeFeats: ["50 件商品", "基本模板", "Email 驗證碼登入"],
    pricingLiteName: "Lite",
    pricingLiteDesc: "認真做生意",
    pricingLitePrice: "$99",
    pricingLitePeriod: "／月",
    pricingLiteBadge: "推薦",
    pricingLiteFeats: ["500 件商品", "所有模板", "自訂域名", "優先支援"],
    pricingProName: "Pro",
    pricingProDesc: "規模化",
    pricingProPrice: "$299",
    pricingProPeriod: "／月",
    pricingProFeats: ["無限商品", "API 接入", "多分店", "專屬客服支援"],
    pricingCta: "選擇方案",
    pricingFullLink: "查看完整定價",

    howEyebrow: "三步開店",
    howTitle: "由 link 到生意，最快兩分鐘。",
    howStep1: "填店名",
    howStep1Desc: "30 秒搞掂",
    howStep2: "揀風格",
    howStep2Desc: "現成模板任你揀",
    howStep3: "上架開賣",
    howStep3Desc: "影相上架，即刻收單",

    voiceEyebrow: "首批商戶真實回饋",
    voice1Quote: "訂單自動入 system，付款狀態一目了然，慳返好多時間。",
    voice1Name: "May",
    voice1Shop: "@maysshop · 飾物店",
    voice2Quote: "客人自己揀 FPS 定 PayMe，所有訂單一覽無遺。",
    voice2Name: "K 小姐",
    voice2Shop: "K 小姐 · 手作店",
    voice3Quote: "終於唔使再用 Excel 記庫存，規格管理好方便。",
    voice3Name: "陳先生",
    voice3Shop: "陳先生 · 波鞋代購",

    ctaEyebrow: "Ready when you are",
    ctaTitle: "由今日起，唔使再喺 DM 度做生意。",
    ctaSub: "2 分鐘開店 · 0% 佣金 · 唔使信用卡。",
    ctaPrimary: "免費開店",
    ctaSecondary: "睇示範",

    footerCopy: "© 2026 WoWlix · Hong Kong",
    footerTerms: "服務條款",
    footerPrivacy: "私隱政策",
    footerContact: "聯絡",
  },
  en: {
    navPricing: "Pricing",
    navLogin: "Login",
    navStart: "Start free",

    heroPill: "New: sign in with email code",
    heroTitleA: "The all-in-one",
    heroTitleAccent: "storefront",
    heroTitleB: "for HK IG shops.",
    heroSub:
      "From products to orders, customers to multi-language — one link to start, two minutes to launch.",
    heroCta: "Start free",
    heroSecondary: "Have an account? Login",
    heroTrust: "0% commission · No credit card · Live instantly",

    statsEyebrow: "What we promise",
    stat1Num: "0",
    stat1Suffix: "%",
    stat1Label: "Commission",
    stat2Num: "2",
    stat2Suffix: "min",
    stat2Label: "To launch",
    stat3Num: "$0",
    stat3Suffix: "",
    stat3Label: "Free to start",
    stat4Num: "New",
    stat4Suffix: "",
    stat4Label: "Onboarding now",

    featEyebrow: "Built for small shops",
    featTitle: "Everything you need, nothing you don't.",
    feat1Title: "Product management",
    feat1Desc:
      "Drag-and-drop listings, variants, bulk edits. CSV import/export — leave Excel behind.",
    feat2Title: "Order tracking",
    feat2Desc:
      "From order to delivery, in one view. Customers self-track — fewer DMs, more sales.",
    feat3Title: "Customer CRM",
    feat3Desc:
      "Auto-built profiles. See repeat rate, order history, and contact info at a glance.",
    feat4Title: "Multilingual",
    feat4Desc:
      "Bilingual zh-HK / EN out of the box. Overseas customers welcomed. SEO handled.",

    pricingEyebrow: "Pricing",
    pricingTitle: "Simple, transparent, 0% commission.",
    pricingSub: "What you earn is what you keep. No hidden fees.",
    pricingFreeName: "Free",
    pricingFreeDesc: "Test the waters",
    pricingFreePrice: "$0",
    pricingFreePeriod: "/mo",
    pricingFreeFeats: ["50 products", "Basic templates", "Email OTP login"],
    pricingLiteName: "Lite",
    pricingLiteDesc: "Serious business",
    pricingLitePrice: "$99",
    pricingLitePeriod: "/mo",
    pricingLiteBadge: "Recommended",
    pricingLiteFeats: [
      "500 products",
      "All templates",
      "Custom domain",
      "Priority support",
    ],
    pricingProName: "Pro",
    pricingProDesc: "Scale up",
    pricingProPrice: "$299",
    pricingProPeriod: "/mo",
    pricingProFeats: [
      "Unlimited products",
      "API access",
      "Multi-store",
      "Dedicated support",
    ],
    pricingCta: "Choose plan",
    pricingFullLink: "See full pricing",

    howEyebrow: "Three steps",
    howTitle: "From link to live in two minutes.",
    howStep1: "Name your shop",
    howStep1Desc: "Done in 30 seconds",
    howStep2: "Pick a style",
    howStep2Desc: "Curated templates",
    howStep3: "List & sell",
    howStep3Desc: "Photos up, orders in",

    voiceEyebrow: "Founding merchants",
    voice1Quote:
      "Orders auto-track and payment status is crystal clear — saves me hours.",
    voice1Name: "May",
    voice1Shop: "@maysshop · Jewelry",
    voice2Quote:
      "Customers pick FPS or PayMe themselves. All orders in one dashboard.",
    voice2Name: "K",
    voice2Shop: "K · Handmade",
    voice3Quote: "No more Excel for inventory. Variant management just works.",
    voice3Name: "Mr. Chan",
    voice3Shop: "Mr. Chan · Sneaker Reseller",

    ctaEyebrow: "Ready when you are",
    ctaTitle: "Stop running your business in DMs.",
    ctaSub: "2 min setup · 0% commission · No credit card.",
    ctaPrimary: "Start free",
    ctaSecondary: "See demo",

    footerCopy: "© 2026 WoWlix · Hong Kong",
    footerTerms: "Terms",
    footerPrivacy: "Privacy",
    footerContact: "Contact",
  },
};

type Props = { locale?: Locale };

const FEATURES = [
  { key: "feat1", Icon: Boxes },
  { key: "feat2", Icon: ListChecks },
  { key: "feat3", Icon: Users },
  { key: "feat4", Icon: Languages },
] as const;

export default function WowlixLandingPage({ locale = "zh-HK" }: Props) {
  const t = T[locale] || T.en;
  const otherLocale = locale === "zh-HK" ? "en" : "zh-HK";
  const [scrolled, setScrolled] = useState(false);

  // Nav fills in once user scrolls past hero peak
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-reveal for sections marked with .wlx-reveal.
  // Robustness: content is visible by DEFAULT (see CSS). Only after JS confirms it
  // can run do we add `wlx-js` (which enables the hidden→animate state), so a
  // stalled observer or JS failure can never ship a blank page. A failsafe timer
  // also force-reveals everything if the observer never fires.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("wlx-js");
    const els = document.querySelectorAll<HTMLElement>(".wlx-reveal");
    if (!els.length) return;
    const reveal = (el: Element) => el.classList.add("is-visible");
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            reveal(e.target);
            obs.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "80px" },
    );
    els.forEach((el) => obs.observe(el));
    // Failsafe: if anything is still hidden after 2.5s (observer stalled, tab was
    // backgrounded on load, headless render), reveal it anyway.
    const failsafe = window.setTimeout(() => els.forEach(reveal), 2500);
    return () => {
      obs.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  // Creator-first warm palette — scoped to THIS landing only via CSS-var overrides,
  // so it never bleeds into the shared --wlx-* tokens the biolink "studio" tenant
  // template also consumes. Tenant storefronts keep the base palette.
  const brandVars = {
    "--wlx-cream": "#F6ECE2",
    "--wlx-paper": "#FBF4EC",
    "--wlx-ink": "#2C201C",
    "--wlx-stone": "#77645A",
    "--wlx-mist": "#EBDFD3",
    "--wlx-accent": "#C25A4E",
    "--wlx-accent-fg": "#FFFFFF",
    "--wlx-blush": "#E0B2A0",
  } as CSSProperties;

  return (
    <div
      style={brandVars}
      className="min-h-screen bg-wlx-paper text-wlx-ink font-wlx-sans antialiased"
    >
      {/* ───────── Nav ───────── */}
      <header
        className={`sticky top-0 z-50 transition-[background,border,backdrop-filter] duration-300 ${
          scrolled
            ? "border-b border-wlx-mist bg-wlx-paper/85 backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
        style={{ transitionTimingFunction: "var(--wlx-ease)" }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 sm:px-8">
          <Link
            href={`/${locale}`}
            className="font-wlx-display text-lg tracking-tight"
          >
            WoWlix
          </Link>
          <nav className="flex items-center gap-5 sm:gap-7">
            <Link
              href={`/${locale}/pricing`}
              className="text-[12px] uppercase tracking-[0.18em] text-wlx-stone hover:text-wlx-ink transition-colors duration-200"
              style={{ transitionTimingFunction: "var(--wlx-ease)" }}
            >
              {t.navPricing}
            </Link>
            <Link
              href={`/${otherLocale}`}
              className="text-[12px] uppercase tracking-[0.18em] text-wlx-stone hover:text-wlx-ink transition-colors duration-200"
              style={{ transitionTimingFunction: "var(--wlx-ease)" }}
            >
              {locale === "zh-HK" ? "EN" : "繁"}
            </Link>
            <Link
              href={`/${locale}/admin/login`}
              className="hidden sm:inline text-[12px] uppercase tracking-[0.18em] text-wlx-stone hover:text-wlx-ink transition-colors duration-200"
              style={{ transitionTimingFunction: "var(--wlx-ease)" }}
            >
              {t.navLogin}
            </Link>
            <Link
              href={`/${locale}/start`}
              className="group inline-flex items-center gap-1.5 rounded-full bg-wlx-ink px-4 py-2.5 text-[12px] uppercase tracking-[0.18em] text-wlx-paper hover:bg-wlx-ink/90 transition-all duration-200 active:scale-[0.97] will-change-transform"
              style={{ transitionTimingFunction: "var(--wlx-ease)" }}
            >
              {t.navStart}
              <ArrowRight
                size={14}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
                style={{ transitionTimingFunction: "var(--wlx-ease)" }}
              />
            </Link>
          </nav>
        </div>
      </header>

      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden">
        {/* Atmospheric background — layered gradients + subtle grain */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute inset-0 opacity-80"
            style={{
              background:
                "radial-gradient(60% 50% at 18% 28%, rgba(194,90,78,0.16) 0%, transparent 60%), radial-gradient(52% 58% at 88% 72%, color-mix(in srgb, var(--wlx-blush) 28%, transparent) 0%, transparent 65%), radial-gradient(70% 80% at 50% 0%, rgba(251,244,236,1) 0%, rgba(251,244,236,0) 60%)",
            }}
          />
          {/* SVG grain — soft noise overlay */}
          <svg
            className="absolute inset-0 h-full w-full opacity-[0.035] mix-blend-multiply"
            xmlns="http://www.w3.org/2000/svg"
          >
            <filter id="wlx-grain">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.9"
                numOctaves="2"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#wlx-grain)" />
          </svg>
          {/* Faint accent glow ring */}
          <div
            className="absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full opacity-50 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(194,90,78,0.30), transparent)",
            }}
          />
        </div>

        <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-6 px-5 pb-20 pt-24 sm:gap-12 sm:px-8 sm:pb-32 sm:pt-32 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
          {/* ── Left: copy ── */}
          <div>
            {/* Announcement pill */}
            <div
              className="wlx-fade-up inline-flex items-center gap-2 rounded-full border border-wlx-mist bg-wlx-paper/60 px-3 py-1.5 backdrop-blur-sm"
              style={{ animationDelay: "60ms" }}
            >
              <Sparkles size={12} className="text-wlx-accent" />
              <span className="text-[11px] uppercase tracking-[0.18em] text-wlx-ink">
                {t.heroPill}
              </span>
            </div>

            {/* Headline — titleA on its own line; accent + titleB stay
                together on line 2 so the italic word never mid-word-splits. */}
            <h1
              className="wlx-fade-up mt-6 font-wlx-display text-[clamp(42px,6.6vw,74px)] font-bold leading-[1.04] tracking-[-0.02em] text-balance"
              style={{ animationDelay: "140ms" }}
            >
              <span className="block">{t.heroTitleA}</span>
              <span className="block">
                <span className="font-wlx-serif text-wlx-accent italic font-normal">
                  {t.heroTitleAccent}
                </span>{" "}
                {t.heroTitleB}
              </span>
            </h1>

            {/* Sub */}
            <p
              className="wlx-fade-up mt-7 max-w-[44ch] text-base leading-relaxed text-wlx-stone sm:text-lg"
              style={{ animationDelay: "220ms" }}
            >
              {t.heroSub}
            </p>

            {/* CTAs */}
            <div
              className="wlx-fade-up mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
              style={{ animationDelay: "300ms" }}
            >
              <Link
                href={`/${locale}/start`}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-wlx-accent px-8 py-4 text-[12px] uppercase tracking-[0.22em] text-wlx-accent-fg transition-all duration-300 hover:brightness-[1.06] hover:shadow-[0_18px_44px_-16px_rgba(194,90,78,0.55)] active:scale-[0.98] will-change-transform"
                style={{ transitionTimingFunction: "var(--wlx-ease)" }}
              >
                {t.heroCta}
                <ArrowRight
                  size={14}
                  className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-px group-hover:scale-110"
                  style={{ transitionTimingFunction: "var(--wlx-ease)" }}
                />
              </Link>
              <Link
                href={`/${locale}/admin/login`}
                className="inline-flex items-center justify-center gap-1 px-2 py-4 text-[12px] uppercase tracking-[0.22em] text-wlx-stone transition-colors duration-200 hover:text-wlx-ink sm:px-4"
                style={{ transitionTimingFunction: "var(--wlx-ease)" }}
              >
                {t.heroSecondary}
                <ArrowRight size={12} />
              </Link>
            </div>

            {/* Trust line */}
            <p
              className="wlx-fade-up mt-8 text-[12px] uppercase tracking-[0.18em] text-wlx-stone"
              style={{ animationDelay: "380ms" }}
            >
              {t.heroTrust}
            </p>
          </div>

          {/* ── Right: phone mockup (lg+ only) ──
              Mini storefront preview drawn entirely with CSS — no images,
              uses the same wlx-* tokens so it tracks tenant-overridden accent. */}
          <div
            className="wlx-fade-up flex justify-center"
            style={{ animationDelay: "460ms" }}
            aria-hidden
          >
            <div className="relative origin-top -rotate-2 scale-[0.82] sm:scale-90 lg:scale-100">
              {/* Soft halo behind the phone */}
              <div
                className="absolute -inset-10 -z-10 rounded-full opacity-60 blur-3xl"
                style={{
                  background:
                    "radial-gradient(closest-side, rgba(194,90,78,0.35), transparent 70%)",
                }}
              />

              {/* Phone outer frame (bezel) */}
              <div className="relative w-[300px] rounded-[44px] bg-wlx-ink p-[10px] shadow-[0_30px_60px_-20px_rgba(44,32,28,0.55)] ring-1 ring-wlx-ink/30">
                {/* Notch */}
                <div className="absolute left-1/2 top-[10px] z-20 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-wlx-ink" />

                {/* Inner screen */}
                <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[34px] bg-wlx-paper">
                  {/* Top app bar */}
                  <div className="flex items-center justify-between border-b border-wlx-mist px-4 pb-3 pt-9">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-wlx-accent to-wlx-stone" />
                      <span className="font-wlx-display text-[13px] font-semibold tracking-tight text-wlx-ink">
                        @maysshop
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-wlx-accent" />
                      <span className="text-[9px] uppercase tracking-[0.18em] text-wlx-stone">
                        Live
                      </span>
                    </div>
                  </div>

                  {/* Banner */}
                  <div className="mx-3 mt-3 flex h-16 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-wlx-cream via-wlx-mist to-wlx-paper">
                    <span className="font-wlx-serif text-xs italic text-wlx-stone">
                      Spring drop
                    </span>
                  </div>

                  {/* Product grid 2×2 */}
                  <div className="mx-3 mt-3 grid grid-cols-2 gap-2">
                    {[
                      { name: "Hoop ring", price: "$ 280" },
                      { name: "Pearl set", price: "$ 480" },
                      { name: "Charm bracelet", price: "$ 360" },
                      { name: "Mini studs", price: "$ 180" },
                    ].map((p, i) => (
                      <div key={i} className="space-y-1">
                        <div className="aspect-square overflow-hidden rounded-md border border-wlx-mist bg-wlx-cream">
                          {/* Tiny abstract motif so cards aren't visually empty */}
                          <div
                            className="h-full w-full"
                            style={{
                              background:
                                i % 2 === 0
                                  ? "radial-gradient(circle at 35% 40%, rgba(194,90,78,0.4), transparent 55%)"
                                  : "radial-gradient(circle at 60% 60%, rgba(111,106,99,0.3), transparent 55%)",
                            }}
                          />
                        </div>
                        <div className="truncate text-[9px] text-wlx-ink">
                          {p.name}
                        </div>
                        <div className="text-[10px] font-semibold tabular-nums text-wlx-ink">
                          {p.price}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Sticky cart bar */}
                  <div className="absolute inset-x-0 bottom-0 border-t border-wlx-mist bg-wlx-paper/95 px-3 py-3 backdrop-blur">
                    <div className="rounded bg-wlx-ink py-2 text-center text-[10px] uppercase tracking-[0.18em] text-wlx-paper">
                      View cart · 2
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating accent badge */}
              <div className="absolute -left-6 top-12 hidden rotate-[8deg] rounded-full border border-wlx-mist bg-wlx-paper px-3 py-1.5 shadow-md xl:block">
                <span className="text-[10px] uppercase tracking-[0.18em] text-wlx-ink">
                  0% commission
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Stats ───────── */}
      <section className="wlx-reveal border-y border-wlx-mist bg-wlx-cream/50">
        <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8 sm:py-16">
          <p className="text-[11px] uppercase tracking-[0.22em] text-wlx-stone">
            {t.statsEyebrow}
          </p>
          <dl className="mt-8 grid grid-cols-2 gap-y-8 sm:gap-x-8 lg:grid-cols-4">
            {[
              { num: t.stat1Num, suf: t.stat1Suffix, label: t.stat1Label },
              { num: t.stat2Num, suf: t.stat2Suffix, label: t.stat2Label },
              { num: t.stat3Num, suf: t.stat3Suffix, label: t.stat3Label },
              { num: t.stat4Num, suf: t.stat4Suffix, label: t.stat4Label },
            ].map((s, i) => (
              <div key={i} className="border-l border-wlx-mist pl-5 sm:pl-6">
                <dt className="font-wlx-display text-[clamp(32px,5vw,48px)] font-semibold leading-none tabular-nums tracking-tight text-wlx-ink">
                  {s.num}
                  <span className="text-wlx-accent">{s.suf}</span>
                </dt>
                <dd className="mt-3 text-[12px] uppercase tracking-[0.18em] text-wlx-stone">
                  {s.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ───────── Features ───────── */}
      <section className="wlx-reveal border-b border-wlx-mist">
        <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
          <p className="text-[11px] uppercase tracking-[0.22em] text-wlx-stone">
            {t.featEyebrow}
          </p>
          <h2 className="mt-5 max-w-[24ch] font-wlx-display text-[clamp(28px,4.8vw,48px)] font-semibold leading-[1.1] tracking-[-0.02em]">
            {t.featTitle}
          </h2>

          <ul className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FEATURES.map(({ key, Icon }) => {
              const title = t[`${key}Title` as keyof typeof t] as string;
              const desc = t[`${key}Desc` as keyof typeof t] as string;
              return (
                <li
                  key={key}
                  className="group relative rounded-3xl border border-wlx-mist bg-wlx-paper p-7 shadow-[0_2px_2px_rgba(44,32,28,0.03),0_16px_34px_-26px_rgba(44,32,28,0.28)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(44,32,28,0.05),0_26px_46px_-24px_rgba(44,32,28,0.34)] will-change-transform sm:p-9"
                  style={{ transitionTimingFunction: "var(--wlx-ease)" }}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-wlx-mist bg-wlx-cream text-wlx-accent transition-all duration-300 group-hover:border-wlx-accent group-hover:bg-wlx-accent group-hover:text-wlx-accent-fg"
                      style={{ transitionTimingFunction: "var(--wlx-ease)" }}
                    >
                      <Icon size={20} strokeWidth={1.75} />
                    </span>
                    <h3 className="font-wlx-display text-xl font-semibold tracking-tight">
                      {title}
                    </h3>
                  </div>
                  <p className="mt-5 text-[15px] leading-relaxed text-wlx-stone">
                    {desc}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ───────── Pricing ───────── */}
      <section className="wlx-reveal border-b border-wlx-mist">
        <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
          <p className="text-[11px] uppercase tracking-[0.22em] text-wlx-stone">
            {t.pricingEyebrow}
          </p>
          <h2 className="mt-5 max-w-[26ch] font-wlx-display text-[clamp(28px,4.8vw,48px)] font-semibold leading-[1.1] tracking-[-0.02em]">
            {t.pricingTitle}
          </h2>
          <p className="mt-3 max-w-[44ch] text-base leading-relaxed text-wlx-stone sm:text-lg">
            {t.pricingSub}
          </p>

          <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Free */}
            <article className="group relative flex flex-col rounded-3xl border border-wlx-mist bg-wlx-paper p-8 transition-all duration-500 hover:-translate-y-1.5 hover:border-wlx-accent/40 hover:shadow-[0_28px_55px_-30px_rgba(44,32,28,0.35)] will-change-transform" style={{ transitionTimingFunction: "var(--wlx-ease)" }}>
              <h3 className="font-wlx-display text-xl font-semibold tracking-tight">
                {t.pricingFreeName}
              </h3>
              <p className="mt-1 text-[12px] uppercase tracking-[0.18em] text-wlx-stone">
                {t.pricingFreeDesc}
              </p>
              <p className="mt-7 font-wlx-display text-4xl font-semibold tabular-nums tracking-tight">
                {t.pricingFreePrice}
                <span className="ml-1 text-sm font-normal text-wlx-stone">
                  {t.pricingFreePeriod}
                </span>
              </p>
              <ul className="mt-7 flex-1 space-y-3 text-sm text-wlx-ink">
                {t.pricingFreeFeats.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check
                      size={16}
                      strokeWidth={2}
                      className="mt-0.5 shrink-0 text-wlx-ink"
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/${locale}/start`}
                className="mt-8 inline-block rounded-full border border-wlx-ink py-3 text-center text-[12px] uppercase tracking-[0.22em] text-wlx-ink transition-all duration-200 hover:bg-wlx-ink hover:text-wlx-paper active:scale-[0.98]"
                style={{ transitionTimingFunction: "var(--wlx-ease)" }}
              >
                {t.pricingCta}
              </Link>
            </article>

            {/* Lite — recommended */}
            <article className="relative flex flex-col rounded-3xl bg-wlx-ink p-8 text-wlx-paper shadow-[0_36px_66px_-28px_rgba(44,32,28,0.55)] lg:-my-2">
              <div className="absolute -top-3 left-8 rounded-full bg-wlx-accent px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-wlx-accent-fg">
                {t.pricingLiteBadge}
              </div>
              <h3 className="font-wlx-display text-xl font-semibold tracking-tight">
                {t.pricingLiteName}
              </h3>
              <p className="mt-1 text-[12px] uppercase tracking-[0.18em] text-wlx-paper/70">
                {t.pricingLiteDesc}
              </p>
              <p className="mt-7 font-wlx-display text-4xl font-semibold tabular-nums tracking-tight">
                {t.pricingLitePrice}
                <span className="ml-1 text-sm font-normal text-wlx-paper/70">
                  {t.pricingLitePeriod}
                </span>
              </p>
              <ul className="mt-7 flex-1 space-y-3 text-sm">
                {t.pricingLiteFeats.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check
                      size={16}
                      strokeWidth={2}
                      className="mt-0.5 shrink-0 text-wlx-accent"
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/${locale}/start?plan=lite`}
                className="mt-8 inline-block rounded-full bg-wlx-paper py-3 text-center text-[12px] uppercase tracking-[0.22em] text-wlx-ink transition-all duration-200 hover:bg-wlx-paper/90 active:scale-[0.98]"
                style={{ transitionTimingFunction: "var(--wlx-ease)" }}
              >
                {t.pricingCta}
              </Link>
            </article>

            {/* Pro */}
            <article className="group relative flex flex-col rounded-3xl border border-wlx-mist bg-wlx-paper p-8 transition-all duration-500 hover:-translate-y-1.5 hover:border-wlx-accent/40 hover:shadow-[0_28px_55px_-30px_rgba(44,32,28,0.35)] will-change-transform" style={{ transitionTimingFunction: "var(--wlx-ease)" }}>
              <h3 className="font-wlx-display text-xl font-semibold tracking-tight">
                {t.pricingProName}
              </h3>
              <p className="mt-1 text-[12px] uppercase tracking-[0.18em] text-wlx-stone">
                {t.pricingProDesc}
              </p>
              <p className="mt-7 font-wlx-display text-4xl font-semibold tabular-nums tracking-tight">
                {t.pricingProPrice}
                <span className="ml-1 text-sm font-normal text-wlx-stone">
                  {t.pricingProPeriod}
                </span>
              </p>
              <ul className="mt-7 flex-1 space-y-3 text-sm text-wlx-ink">
                {t.pricingProFeats.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check
                      size={16}
                      strokeWidth={2}
                      className="mt-0.5 shrink-0 text-wlx-ink"
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/${locale}/start?plan=pro`}
                className="mt-8 inline-block rounded-full border border-wlx-ink py-3 text-center text-[12px] uppercase tracking-[0.22em] text-wlx-ink transition-all duration-200 hover:bg-wlx-ink hover:text-wlx-paper active:scale-[0.98]"
                style={{ transitionTimingFunction: "var(--wlx-ease)" }}
              >
                {t.pricingCta}
              </Link>
            </article>
          </div>

          <Link
            href={`/${locale}/pricing`}
            className="mt-10 inline-flex items-center gap-1 text-[12px] uppercase tracking-[0.22em] text-wlx-stone transition-colors duration-200 hover:text-wlx-ink"
            style={{ transitionTimingFunction: "var(--wlx-ease)" }}
          >
            {t.pricingFullLink}
            <ArrowRight size={12} />
          </Link>
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section className="wlx-reveal border-b border-wlx-mist bg-wlx-cream">
        <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
          <p className="text-[11px] uppercase tracking-[0.22em] text-wlx-stone">
            {t.howEyebrow}
          </p>
          <h2 className="mt-5 max-w-[28ch] font-wlx-display text-[clamp(28px,4.5vw,44px)] font-semibold leading-tight tracking-[-0.02em]">
            {t.howTitle}
          </h2>
          <ol className="mt-14 grid grid-cols-1 gap-12 sm:grid-cols-3">
            {[
              { n: "01", h: t.howStep1, d: t.howStep1Desc },
              { n: "02", h: t.howStep2, d: t.howStep2Desc },
              { n: "03", h: t.howStep3, d: t.howStep3Desc },
            ].map((step, i) => (
              <li key={i} className="border-t border-wlx-mist pt-6">
                <span className="font-wlx-serif text-3xl italic text-wlx-stone">
                  {step.n}
                </span>
                <h3 className="mt-3 font-wlx-display text-xl font-semibold tracking-tight">
                  {step.h}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-wlx-stone">
                  {step.d}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────── Testimonials ───────── */}
      <section className="wlx-reveal border-b border-wlx-mist">
        <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
          <p className="text-[11px] uppercase tracking-[0.22em] text-wlx-stone">
            {t.voiceEyebrow}
          </p>
          <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-12">
            {[
              { q: t.voice1Quote, n: t.voice1Name, s: t.voice1Shop },
              { q: t.voice2Quote, n: t.voice2Name, s: t.voice2Shop },
              { q: t.voice3Quote, n: t.voice3Name, s: t.voice3Shop },
            ].map((v, i) => (
              <figure key={i} className="border-t border-wlx-mist pt-6">
                <blockquote className="font-wlx-serif text-lg italic leading-relaxed text-wlx-ink">
                  &ldquo;{v.q}&rdquo;
                </blockquote>
                <figcaption className="mt-5 text-[12px] uppercase tracking-[0.18em] text-wlx-stone">
                  {v.n} <span className="mx-1">·</span> {v.s}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Final CTA ───────── */}
      <section className="relative overflow-hidden bg-wlx-ink">
        {/* Subtle gradient orb in dark section */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute -left-24 -top-24 h-[360px] w-[360px] rounded-full opacity-40 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(194,90,78,0.6), transparent)",
            }}
          />
          <div
            className="absolute -bottom-32 -right-16 h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(251,244,236,0.4), transparent)",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-[900px] px-5 py-24 text-center sm:px-8 sm:py-32">
          <p className="text-[11px] uppercase tracking-[0.22em] text-wlx-paper/60">
            {t.ctaEyebrow}
          </p>
          <h2 className="mt-5 font-wlx-display text-[clamp(36px,7vw,72px)] font-semibold leading-[1.05] tracking-[-0.02em] text-wlx-paper">
            {t.ctaTitle}
          </h2>
          <p className="mx-auto mt-6 max-w-[44ch] text-base text-wlx-paper/70 sm:text-lg">
            {t.ctaSub}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={`/${locale}/start`}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-wlx-accent px-8 py-4 text-[12px] uppercase tracking-[0.22em] text-wlx-accent-fg transition-all duration-300 hover:brightness-[1.06] hover:shadow-[0_18px_44px_-16px_rgba(194,90,78,0.55)] active:scale-[0.98]"
              style={{ transitionTimingFunction: "var(--wlx-ease)" }}
            >
              {t.ctaPrimary}
              <ArrowRight
                size={14}
                className="transition-transform duration-300 group-hover:translate-x-1"
                style={{ transitionTimingFunction: "var(--wlx-ease)" }}
              />
            </Link>
            <Link
              href={`/${locale}/maysshop`}
              className="inline-flex items-center justify-center gap-1 rounded-full px-7 py-4 text-[12px] uppercase tracking-[0.22em] text-wlx-paper border border-wlx-paper/30 transition-colors duration-200 hover:border-wlx-paper"
              style={{ transitionTimingFunction: "var(--wlx-ease)" }}
            >
              {t.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-wlx-mist bg-wlx-paper">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-14">
          <p className="text-[12px] uppercase tracking-[0.18em] text-wlx-stone">
            {t.footerCopy}
          </p>
          <ul className="flex flex-wrap gap-6">
            {[
              { href: `/${locale}/terms`, label: t.footerTerms },
              { href: `/${locale}/privacy`, label: t.footerPrivacy },
              { href: `/${locale}/contact`, label: t.footerContact },
            ].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-[12px] uppercase tracking-[0.18em] text-wlx-stone transition-colors duration-200 hover:text-wlx-ink"
                  style={{ transitionTimingFunction: "var(--wlx-ease)" }}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </footer>

      {/* Animations — `wlx-fade-up` is a one-shot on mount; `wlx-reveal`
          uses IntersectionObserver to add `is-visible` when scrolled into view. */}
      <style jsx global>{`
        @keyframes wlxFadeUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .wlx-fade-up {
          opacity: 0;
          animation: wlxFadeUp 700ms var(--wlx-ease) forwards;
        }
        /* Visible by default (no JS / observer stall = content still shows). */
        .wlx-reveal {
          opacity: 1;
          transform: none;
        }
        /* Only once JS confirms it can run do we hide-then-reveal on scroll. */
        .wlx-js .wlx-reveal {
          opacity: 0;
          transform: translateY(40px);
          transition: opacity 700ms var(--wlx-ease),
            transform 700ms var(--wlx-ease);
        }
        .wlx-js .wlx-reveal.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          .wlx-fade-up,
          .wlx-reveal {
            opacity: 1 !important;
            transform: none !important;
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
