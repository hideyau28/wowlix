"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Boxes,
  Check,
  Languages,
  ListChecks,
  Users,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { marketingBrandVars } from "@/components/marketing/theme";
import { MARKETING_PLANS } from "@/components/marketing/plans";
import { fraunces, notoSerifHK } from "@/components/marketing/fonts";

/* ─── i18n ─── */
const T = {
  "zh-HK": {
    navPricing: "定價",
    navLogin: "登入",
    navStart: "免費開店",

    heroPill: "新功能：電郵驗證碼登入",
    heroTitleA: "一條 link，",
    heroTitleAccent: "follower",
    heroTitleB: "變現。",
    heroSub:
      "專為香港 IG 小店而設 —— 上架、收款、訂單、客戶，一個位搞掂，最快 2 分鐘上線。",
    heroCta: "免費開店",
    heroSecondary: "已有帳戶？登入",
    heroTrust: "0% 佣金 · 唔使信用卡 · 即開即用",

    statsEyebrow: "我哋承諾",
    statsHeading: "開店之前，先講清楚。",
    stat1Num: "0",
    stat1Suffix: "%",
    stat1Label: "佣金",
    stat2Num: "2",
    stat2Suffix: "分鐘",
    stat2Label: "最快開店時間",
    stat3Num: "$0",
    stat3Suffix: "",
    stat3Label: "免費開始",
    stat4Num: "0",
    stat4Suffix: "",
    stat4Label: "長約 · 隨時取消",

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
    pricingTitle: "你賺嘅，全部落你袋。",
    pricingSub: "0% 平台佣金，冇隱藏收費。我哋靠月費營運 —— 賣幾多都唔抽你一蚊。",
    pricingPeriod: "／月",
    pricingLiteBadge: "推薦",
    pricingCta: "選擇方案",
    pricingFullLink: "查看完整定價",
    pricingTrust: "月繳、隨時取消，唔鎖約 · 你嘅數據，隨時屬於你。",

    howEyebrow: "三步開店",
    howTitle: "由 link 到生意，最快兩分鐘。",
    howStep1: "填店名",
    howStep1Desc: "30 秒搞掂",
    howStep2: "揀風格",
    howStep2Desc: "現成模板任你揀",
    howStep3: "上架開賣",
    howStep3Desc: "影相上架，即刻收單",

    voiceEyebrow: "首批商戶回饋",
    voiceHeading: "佢哋已經開咗店。",
    voice1Quote: "訂單自動入 system，付款狀態一目了然，慳返好多時間。",
    voice1Name: "May",
    voice1Handle: "@maysshop",
    voice1Type: "飾物店",
    voice2Quote: "客人自己揀 FPS 定 PayMe，所有訂單一覽無遺。",
    voice2Name: "K 小姐",
    voice2Handle: "K 小姐",
    voice2Type: "手作店",
    voice3Quote: "終於唔使再用 Excel 記庫存，規格管理好方便。",
    voice3Name: "陳先生",
    voice3Handle: "陳先生",
    voice3Type: "波鞋代購",

    ctaEyebrow: "你 ready，我哋就 ready。",
    ctaTitle: "係時候，唔再靠 DM 同截圖做生意。",
    ctaSub: "最快 2 分鐘開店 · 0% 佣金 · 唔使信用卡。",
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
    heroTitleA: "Turn your",
    heroTitleAccent: "followers",
    heroTitleB: "into a business.",
    heroSub:
      "Built for Hong Kong IG shops — listings, payments, orders and customers in one place. Live in as fast as 2 minutes.",
    heroCta: "Start free",
    heroSecondary: "Have an account? Login",
    heroTrust: "0% commission · No credit card · Live instantly",

    statsEyebrow: "What we promise",
    statsHeading: "Straight terms, before you start.",
    stat1Num: "0",
    stat1Suffix: "%",
    stat1Label: "Commission",
    stat2Num: "2",
    stat2Suffix: "min",
    stat2Label: "Fastest to launch",
    stat3Num: "$0",
    stat3Suffix: "",
    stat3Label: "Free to start",
    stat4Num: "0",
    stat4Suffix: "",
    stat4Label: "lock-in · cancel anytime",

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
    pricingTitle: "What you earn, you keep.",
    pricingSub: "0% platform commission, no hidden fees. We run on subscriptions — never a cut of your sales.",
    pricingPeriod: "/mo",
    pricingLiteBadge: "Recommended",
    pricingCta: "Choose plan",
    pricingFullLink: "See full pricing",
    pricingTrust: "Monthly, cancel anytime, no lock-in · Your data always stays yours.",

    howEyebrow: "Three steps",
    howTitle: "From link to live in two minutes.",
    howStep1: "Name your shop",
    howStep1Desc: "Done in 30 seconds",
    howStep2: "Pick a style",
    howStep2Desc: "Curated templates",
    howStep3: "List & sell",
    howStep3Desc: "Photos up, orders in",

    voiceEyebrow: "From our first merchants",
    voiceHeading: "They're already selling.",
    voice1Quote:
      "Orders auto-track and payment status is crystal clear — saves me hours.",
    voice1Name: "May",
    voice1Handle: "@maysshop",
    voice1Type: "Jewelry",
    voice2Quote:
      "Customers pick FPS or PayMe themselves. All orders in one dashboard.",
    voice2Name: "K",
    voice2Handle: "K",
    voice2Type: "Handmade",
    voice3Quote: "No more Excel for inventory. Variant management just works.",
    voice3Name: "Mr. Chan",
    voice3Handle: "Mr. Chan",
    voice3Type: "Sneaker Reseller",

    ctaEyebrow: "Ready when you are",
    ctaTitle: "Stop running your business in DMs.",
    ctaSub: "As fast as 2 min setup · 0% commission · No credit card.",
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
  // 同 T 一樣嘅 fallback：runtime 收到怪 locale（例如 middleware 冇 normalize 嘅 path segment）一律當 en
  const lang: "zh-HK" | "en" = locale === "zh-HK" ? "zh-HK" : "en";
  const otherLocale = locale === "zh-HK" ? "en" : "zh-HK";
  const [scrolled, setScrolled] = useState(false);

  // Signature "real stores" section: a pinned phone cross-fades through three
  // real storefronts as you scroll past their captions. `activeShop` is driven
  // by an IntersectionObserver (works in every browser, unlike Chromium-only
  // CSS scroll-timelines).
  const [activeShop, setActiveShop] = useState(0);
  const shops = [
    {
      img: "/demos/petitfleur.png",
      tag: lang === "zh-HK" ? "甜品 · 花語甜室" : "Dessert · Petit Fleur",
      line: lang === "zh-HK" ? "手工甜品店。" : "A patisserie.",
    },
    {
      img: "/demos/hypedrops.png",
      tag: lang === "zh-HK" ? "街頭 · HYPEDROPS" : "Streetwear · Hypedrops",
      line: lang === "zh-HK" ? "波鞋潮流舖。" : "A sneaker drop.",
    },
    {
      img: "/demos/greenday.png",
      tag: lang === "zh-HK" ? "有機 · 綠日" : "Organic · Green Day",
      line: lang === "zh-HK" ? "有機生活店。" : "An organic grocer.",
    },
  ];

  // Testimonials: split into a hero pull-quote + a stacked pair, for the
  // asymmetric 7/5 dark-editorial layout (Wave 3). New arrays only — never
  // mutates the underlying `t` copy.
  const voices = [
    { q: t.voice1Quote, n: t.voice1Name, h: t.voice1Handle, ty: t.voice1Type },
    { q: t.voice2Quote, n: t.voice2Name, h: t.voice2Handle, ty: t.voice2Type },
    { q: t.voice3Quote, n: t.voice3Name, h: t.voice3Handle, ty: t.voice3Type },
  ];
  const [heroVoice, ...restVoices] = voices;

  useEffect(() => {
    const captions = document.querySelectorAll<HTMLElement>("[data-shop]");
    if (!captions.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.shop);
            if (!Number.isNaN(idx)) setActiveShop(idx);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    captions.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

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

  // Wave 4: magnetic pull on the primary CTAs. Desktop-pointer only — guarded
  // by matchMedia so touch devices and reduced-motion users never attach
  // listeners at all (not just visually no-op). Sets --mx/--my custom
  // properties consumed by the .wlx-magnetic CSS rule; the transform lives on
  // a wrapper span, never on the Link itself, so it can't fight the Link's
  // own Tailwind `active:scale-[0.98]` press effect.
  useEffect(() => {
    const canHover = window.matchMedia("(pointer:fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    if (!canHover || reduced) return;

    const MAX_PULL = 14;
    const STRENGTH = 0.18;
    const els = document.querySelectorAll<HTMLElement>(".wlx-magnetic");
    if (!els.length) return;

    const cleanups = Array.from(els).map((el) => {
      const onMove = (e: PointerEvent) => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const mx = Math.max(-MAX_PULL, Math.min(MAX_PULL, (e.clientX - cx) * STRENGTH));
        const my = Math.max(-MAX_PULL, Math.min(MAX_PULL, (e.clientY - cy) * STRENGTH));
        el.style.setProperty("--mx", String(mx));
        el.style.setProperty("--my", String(my));
      };
      const onLeave = () => {
        el.style.setProperty("--mx", "0");
        el.style.setProperty("--my", "0");
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
      return () => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerleave", onLeave);
      };
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  // Creator-first warm palette — scoped to THIS landing only via CSS-var overrides,
  // so it never bleeds into the shared --wlx-* tokens the biolink "studio" tenant
  // template also consumes. Tenant storefronts keep the base palette.
  const brandVars = marketingBrandVars;

  return (
    <div
      style={brandVars}
      className={`${fraunces.variable} ${notoSerifHK.variable} min-h-screen bg-wlx-paper text-wlx-ink font-wlx-sans antialiased [font-feature-settings:'kern','liga','calt'] [text-rendering:optimizeLegibility]`}
    >
      {/* Page-wide film grain — one consistent tactile layer over every section
          (soft-light so it reads on both the cream and the dark CTA). */}
      <div className="pointer-events-none fixed inset-0 z-[1]" aria-hidden>
        <svg
          className="h-full w-full opacity-[0.04] mix-blend-soft-light"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="wlx-grain-page">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.82"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#wlx-grain-page)" />
        </svg>
      </div>
      {/* Fixed vignette — gently deepens the ink toward the top edge across
          every section, reinforcing the editorial "printed page" feel. */}
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        aria-hidden
        style={{
          background:
            "radial-gradient(120% 100% at 50% 0%, transparent 55%, rgba(26,24,21,0.06) 100%)",
        }}
      />

      {/* ───────── Nav ───────── */}
      <header
        className={`relative sticky top-0 z-50 transition-[background,border,backdrop-filter] duration-300 ${
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
              className="group inline-flex items-center gap-2 rounded-full bg-wlx-ink py-1.5 pl-5 pr-1.5 text-[12px] uppercase tracking-[0.18em] text-wlx-paper transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[0_16px_36px_-16px_rgba(26,24,21,0.5)] active:scale-[0.97] will-change-transform"
            >
              {t.navStart}
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-wlx-paper/15 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:scale-105">
                <ArrowRight size={13} strokeWidth={1.5} />
              </span>
            </Link>
          </nav>
        </div>
        <span
          aria-hidden
          className="wlx-progress pointer-events-none absolute bottom-0 left-0 h-px w-full origin-left bg-wlx-ink/70"
        />
      </header>

      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden">
        {/* Atmospheric background — layered gradients + subtle grain */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute inset-0 opacity-80"
            style={{
              background:
                "radial-gradient(60% 50% at 18% 28%, rgba(26,24,21,0.05) 0%, transparent 60%), radial-gradient(52% 58% at 88% 72%, color-mix(in srgb, var(--wlx-blush) 45%, transparent) 0%, transparent 65%), radial-gradient(70% 80% at 50% 0%, rgba(244,241,234,1) 0%, rgba(244,241,234,0) 60%)",
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
            className="wlx-drift absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full opacity-50 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, color-mix(in srgb, var(--wlx-blush) 55%, transparent), transparent)",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-[1240px] px-5 pb-20 pt-24 sm:px-8 sm:pb-32 sm:pt-32">
          {/* Announcement pill */}
          <div
            className="wlx-fade-up inline-flex items-center rounded-full border border-wlx-mist bg-wlx-paper/60 px-3 py-1.5 backdrop-blur-sm"
            style={{ animationDelay: "60ms" }}
          >
            <span className="text-[11px] uppercase tracking-[0.18em] text-wlx-ink">
              {t.heroPill}
            </span>
          </div>

          {/* Headline — titleA on its own line; accent + titleB stay together
              on line 2 so the italic word never mid-word-splits. Constrained
              to a narrow measure so the big type wraps tight and leaves the
              right whitespace clear for the phone to bleed into. Each line
              is masked (overflow-hidden) with an inner .wlx-line span that
              clip-path wipes in on mount, staggered so the italic accent
              resolves last. */}
          <h1
            className="wlx-fade-up mt-6 max-w-[16ch] font-wlx-display text-[clamp(46px,10vw,128px)] font-bold leading-[0.96] tracking-[-0.04em] [hanging-punctuation:first] text-balance lg:max-w-[64%]"
            style={{ animationDelay: "140ms" }}
          >
            <span className="block overflow-hidden">
              <span className="block wlx-line" style={{ animationDelay: "120ms" }}>
                {t.heroTitleA}
              </span>
            </span>
            <span className="block overflow-hidden">
              <span className="block wlx-line" style={{ animationDelay: "260ms" }}>
                <span className="font-wlx-serif text-wlx-accent italic font-normal text-[1.06em]">
                  {t.heroTitleAccent}
                </span>{" "}
                {t.heroTitleB}
              </span>
            </span>
          </h1>

          {/* Sub + CTAs + trust line — narrow measured column beneath the
              masthead, an editorial support-copy width. */}
          <div className="max-w-[40ch]">
            {/* Sub */}
            <p
              className="wlx-fade-up mt-7 text-base leading-[1.65] [text-wrap:pretty] text-wlx-stone sm:text-lg"
              style={{ animationDelay: "220ms" }}
            >
              {t.heroSub}
            </p>

            {/* CTAs */}
            <div
              className="wlx-fade-up mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
              style={{ animationDelay: "300ms" }}
            >
              <span className="wlx-magnetic">
                <Link
                  href={`/${locale}/start`}
                  className="group inline-flex items-center gap-3 rounded-full bg-wlx-accent py-2 pl-7 pr-2 text-[12px] uppercase tracking-[0.22em] text-wlx-accent-fg transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[0_22px_50px_-18px_rgba(26,24,21,0.5)] active:scale-[0.98] will-change-transform"
                >
                  {t.heroCta}
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wlx-paper/15 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:scale-105">
                    <ArrowRight size={15} strokeWidth={1.5} />
                  </span>
                </Link>
              </span>
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

          {/* ── Phone mockup ── Mini storefront preview. Below lg it sits in
              normal centered flow under the copy. From lg it breaks out of
              flow and bleeds up over the headline's right whitespace —
              pinned top-right, tuned so it crashes the clear space rather
              than the (max-w-64%) headline column itself. */}
          <div
            className="wlx-fade-up wlx-hero-parallax flex justify-center lg:block lg:absolute lg:right-0 lg:top-8 lg:z-20 lg:w-[38%] lg:-mt-0"
            style={{ animationDelay: "460ms" }}
            aria-hidden
          >
            <div className="relative origin-top -rotate-2 scale-[0.82] sm:scale-90 lg:scale-100">
              {/* Soft halo behind the phone */}
              <div
                className="absolute -inset-16 -z-10 rounded-full opacity-70 blur-3xl"
                style={{
                  background:
                    "radial-gradient(45% 45% at 60% 35%, rgba(110,106,96,0.32), transparent 70%), radial-gradient(50% 50% at 35% 75%, rgba(150,142,128,0.3), transparent 72%)",
                }}
              />

              {/* Phone outer frame (bezel) */}
              <div className="relative w-[300px] rounded-[44px] bg-wlx-ink p-[10px] shadow-[0_44px_90px_-28px_rgba(44,32,28,0.62),0_18px_40px_-20px_rgba(110,106,96,0.22)] ring-1 ring-white/10">
                {/* Notch */}
                <div className="absolute left-1/2 top-[10px] z-20 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-wlx-ink" />

                {/* Inner screen — a real WoWlix storefront (花語甜室 demo) so the
                    hero shows the actual product, not a wireframe. */}
                <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[34px] bg-wlx-paper">
                  <Image
                    src="/demos/petitfleur.png"
                    alt=""
                    fill
                    sizes="300px"
                    className="object-cover object-top"
                    priority
                  />
                  {/* soft screen gloss for realism */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-wlx-ink/5" />
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
      <section className="wlx-reveal relative bg-wlx-cream">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--wlx-mist)_12%,var(--wlx-mist)_88%,transparent)]"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,var(--wlx-mist)_12%,var(--wlx-mist)_88%,transparent)]"
        />
        <div className="relative overflow-hidden mx-auto max-w-[1200px] px-5 py-12 sm:px-8 sm:py-16">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-10 select-none font-wlx-serif leading-none text-[clamp(120px,22vw,300px)] text-wlx-ink/[0.035]"
          >
            0
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] tracking-[0.24em] text-wlx-stone tabular-nums">
              01
            </span>
            <p className="inline-flex items-center rounded-full border border-wlx-mist bg-wlx-paper/50 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-wlx-stone">
              {t.statsEyebrow}
            </p>
          </div>
          <h2 className="mt-5 max-w-[24ch] font-wlx-display text-[clamp(28px,4.8vw,48px)] font-semibold leading-[1.06] tracking-[-0.025em] [text-wrap:balance]">
            {t.statsHeading}
          </h2>
          <dl className="mt-8 grid grid-cols-2 gap-y-8 sm:gap-x-8 lg:grid-cols-4">
            {[
              { num: t.stat1Num, suf: t.stat1Suffix, label: t.stat1Label },
              { num: t.stat2Num, suf: t.stat2Suffix, label: t.stat2Label },
              { num: t.stat3Num, suf: t.stat3Suffix, label: t.stat3Label },
              { num: t.stat4Num, suf: t.stat4Suffix, label: t.stat4Label },
            ].map((s, i) => (
              <div
                key={i}
                className="wlx-stagger border-l border-wlx-mist pl-5 sm:pl-6"
                style={{ "--i": i } as CSSProperties}
              >
                <dt className="wlx-stat-num font-wlx-display text-[clamp(44px,8vw,88px)] font-[830] tabular-nums leading-none tracking-tight text-wlx-ink">
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

      {/* ───────── Signature: real stores (pinned cross-fade) ───────── */}
      <section id="stores" className="wlx-reveal relative bg-wlx-paper">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--wlx-mist)_12%,var(--wlx-mist)_88%,transparent)]"
        />
        <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8">
          {/* intro */}
          <div className="pt-24 sm:pt-32">
            <div className="flex items-center gap-3">
              <span className="text-[11px] tracking-[0.24em] text-wlx-stone">
                ✦
              </span>
              <p className="inline-flex items-center rounded-full border border-wlx-mist bg-wlx-paper/50 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-wlx-stone">
                {lang === "zh-HK" ? "真實店舖" : "Real stores"}
              </p>
            </div>
            <h2 className="mt-5 max-w-[15ch] font-wlx-display text-[clamp(30px,5vw,56px)] font-semibold leading-[1.06] tracking-[-0.025em] [text-wrap:balance]">
              {lang === "zh-HK"
                ? "同一個 WoWlix，乜嘢店都撐得起。"
                : "One WoWlix. Any kind of shop."}
            </h2>
          </div>

          <div className="grid lg:grid-cols-[1fr_0.82fr] lg:gap-12">
            {/* LEFT — scroll track of captions */}
            <div>
              {shops.map((s, i) => (
                <div
                  key={i}
                  data-shop={i}
                  className="wlx-stagger flex flex-col justify-center py-12 lg:min-h-[72vh] lg:py-0"
                  style={{ "--i": i } as CSSProperties}
                >
                  <span className="text-[12px] uppercase tracking-[0.2em] text-wlx-stone">
                    {s.tag}
                  </span>
                  <p className="mt-3 font-wlx-display text-[clamp(34px,6vw,72px)] font-semibold leading-[1] tracking-[-0.03em]">
                    {s.line}
                  </p>
                  {/* mobile inline store shot (the sticky phone is desktop-only) */}
                  <div className="mt-8 overflow-hidden rounded-[28px] border border-wlx-mist shadow-[0_30px_60px_-30px_rgba(26,24,21,0.4)] lg:hidden">
                    <Image
                      src={s.img}
                      alt=""
                      width={786}
                      height={880}
                      className="h-auto w-full object-cover object-top"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* RIGHT — pinned phone that cross-fades through the stores */}
            <div className="hidden lg:block">
              <div className="sticky top-[14vh] flex h-[72vh] flex-col items-center justify-center gap-6">
                <div className="relative w-[300px] rounded-[44px] bg-wlx-ink p-[10px] shadow-[0_50px_100px_-30px_rgba(26,24,21,0.6)] ring-1 ring-white/10">
                  <div className="absolute left-1/2 top-[10px] z-20 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-wlx-ink" />
                  <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[34px] bg-wlx-paper">
                    {shops.map((s, i) => (
                      <Image
                        key={i}
                        src={s.img}
                        alt=""
                        fill
                        sizes="300px"
                        className="object-cover object-top transition-opacity duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                        style={{ opacity: activeShop === i ? 1 : 0 }}
                      />
                    ))}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-wlx-ink/5" />
                  </div>
                </div>
                <div className="flex gap-1.5" aria-hidden>
                  {shops.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        activeShop === i
                          ? "w-6 bg-wlx-ink"
                          : "w-1.5 bg-wlx-ink/25"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Features ───────── */}
      <section className="wlx-reveal relative">
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,var(--wlx-mist)_12%,var(--wlx-mist)_88%,transparent)]"
        />
        <div className="relative overflow-hidden mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-40">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-10 select-none font-wlx-serif leading-none text-[clamp(120px,22vw,300px)] text-wlx-ink/[0.035]"
          >
            ＋
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] tracking-[0.24em] text-wlx-stone tabular-nums">
              02
            </span>
            <p className="inline-flex items-center rounded-full border border-wlx-mist bg-wlx-paper/50 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-wlx-stone">
              {t.featEyebrow}
            </p>
          </div>
          <h2 className="mt-5 max-w-[24ch] font-wlx-display text-[clamp(28px,4.8vw,48px)] font-semibold leading-[1.06] tracking-[-0.025em] [text-wrap:balance]">
            {t.featTitle}
          </h2>

          <ul className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:auto-rows-[minmax(190px,auto)]">
            {FEATURES.map(({ key, Icon }, index) => {
              const title = t[`${key}Title` as keyof typeof t] as string;
              const desc = t[`${key}Desc` as keyof typeof t] as string;
              const body = (
                <>
                  <div className="flex items-center gap-4">
                    <span
                      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-wlx-mist bg-wlx-cream text-wlx-accent transition-all duration-300 group-hover:border-wlx-accent group-hover:bg-wlx-accent group-hover:text-wlx-accent-fg"
                      style={{ transitionTimingFunction: "var(--wlx-ease)" }}
                    >
                      <Icon size={20} strokeWidth={1.4} />
                    </span>
                    <h3 className="font-wlx-display text-xl font-semibold tracking-[-0.01em]">
                      {title}
                    </h3>
                  </div>
                  <p className="mt-5 text-[15px] leading-[1.65] [text-wrap:pretty] text-wlx-stone">
                    {desc}
                  </p>
                </>
              );

              // Bento break: 商品管理 spans 2×2 on desktop and bleeds a real
              // screenshot bottom-right — a single refined frame (skips the
              // double-bezel wrap below) so the bleed isn't clipped.
              if (index === 0) {
                return (
                  <li
                    key={key}
                    className="wlx-stagger group relative overflow-hidden rounded-3xl border border-wlx-mist bg-gradient-to-br from-wlx-cream/70 to-wlx-paper p-7 shadow-[0_2px_2px_rgba(44,32,28,0.03),0_16px_34px_-26px_rgba(44,32,28,0.28),inset_0_1px_0_rgba(255,255,255,0.6)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(44,32,28,0.05),0_26px_46px_-24px_rgba(44,32,28,0.34)] will-change-transform sm:p-9 lg:col-span-2 lg:row-span-2"
                    style={{ transitionTimingFunction: "var(--wlx-ease)", "--i": index } as CSSProperties}
                  >
                    {body}
                    <Image
                      src="/demos/hypedrops.png"
                      alt=""
                      width={520}
                      height={640}
                      className="pointer-events-none absolute -bottom-10 -right-8 hidden w-[52%] rotate-2 rounded-2xl shadow-[0_40px_80px_-30px_rgba(26,24,21,0.5)] grayscale-[0.2] transition duration-700 group-hover:grayscale-0 lg:block"
                    />
                  </li>
                );
              }

              // Double-bezel (Doppelrand): concentric outer frame + inner card.
              return (
                <li
                  key={key}
                  className="wlx-stagger rounded-[26px] bg-wlx-mist/40 p-[5px] shadow-[0_30px_60px_-30px_rgba(26,24,21,0.32)]"
                  style={{ "--i": index } as CSSProperties}
                >
                  <div
                    className="group relative flex h-full flex-col rounded-[21px] border border-wlx-mist bg-gradient-to-br from-wlx-cream/70 to-wlx-paper p-7 shadow-[0_2px_2px_rgba(44,32,28,0.03),0_16px_34px_-26px_rgba(44,32,28,0.28),inset_0_1px_0_rgba(255,255,255,0.7)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(44,32,28,0.05),0_26px_46px_-24px_rgba(44,32,28,0.34)] will-change-transform sm:p-9"
                    style={{ transitionTimingFunction: "var(--wlx-ease)" }}
                  >
                    {body}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section className="wlx-reveal relative bg-wlx-cream">
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,var(--wlx-mist)_12%,var(--wlx-mist)_88%,transparent)]"
        />
        <div className="relative overflow-hidden mx-auto max-w-[1200px] px-5 py-16 sm:px-8 sm:py-20">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-10 select-none font-wlx-serif leading-none text-[clamp(120px,22vw,300px)] text-wlx-ink/[0.035]"
          >
            →
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] tracking-[0.24em] text-wlx-stone tabular-nums">
              03
            </span>
            <p className="inline-flex items-center rounded-full border border-wlx-mist bg-wlx-paper/50 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-wlx-stone">
              {t.howEyebrow}
            </p>
          </div>
          <h2 className="mt-5 max-w-[28ch] font-wlx-display text-[clamp(28px,4.8vw,48px)] font-semibold leading-[1.06] tracking-[-0.025em] [text-wrap:balance]">
            {t.howTitle}
          </h2>
          <ol className="mt-14 grid grid-cols-1 gap-12 sm:grid-cols-3">
            {[
              { n: "01", h: t.howStep1, d: t.howStep1Desc },
              { n: "02", h: t.howStep2, d: t.howStep2Desc },
              { n: "03", h: t.howStep3, d: t.howStep3Desc },
            ].map((step, i) => (
              <li key={i} className="relative border-t border-wlx-mist pt-6">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-8 right-0 font-wlx-serif italic leading-none text-[clamp(90px,12vw,150px)] tabular-nums text-wlx-ink/[0.05]"
                >
                  {step.n}
                </span>
                <div className="relative z-10">
                  <span className="font-wlx-serif text-3xl italic text-wlx-stone">
                    {step.n}
                  </span>
                  <h3 className="mt-3 font-wlx-display text-xl font-semibold tracking-[-0.01em]">
                    {step.h}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-wlx-stone">
                    {step.d}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────── Testimonials — dark editorial ledger ───────── */}
      <section className="wlx-reveal relative bg-wlx-ink text-wlx-paper">
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-wlx-paper/10" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-wlx-paper/10" />
        <div className="relative overflow-hidden mx-auto max-w-[1200px] px-5 py-24 sm:px-8 sm:py-40">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-10 select-none font-wlx-serif leading-none text-[clamp(120px,22vw,300px)] text-wlx-paper/[0.05]"
          >
            「
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] tracking-[0.24em] text-wlx-paper/50 tabular-nums">
              04
            </span>
            <p className="inline-flex items-center rounded-full border border-wlx-paper/20 bg-transparent px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-wlx-paper/70">
              {t.voiceEyebrow}
            </p>
          </div>
          <h2 className="mt-5 max-w-[24ch] font-wlx-display text-[clamp(28px,4.8vw,48px)] font-semibold leading-[1.06] tracking-[-0.025em] [text-wrap:balance]">
            {t.voiceHeading}
          </h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-12">
            {/* Hero pull-quote — the widest, largest-type card */}
            <figure
              className="wlx-stagger group relative flex flex-col rounded-3xl border border-wlx-paper/10 bg-wlx-paper/[0.04] p-8 shadow-[inset_0_1px_0_rgba(244,241,234,0.18)] transition-all duration-300 hover:-translate-y-1 hover:border-wlx-paper/20 hover:bg-wlx-paper/[0.06] will-change-transform lg:col-span-7"
              style={{ transitionTimingFunction: "var(--wlx-ease)", "--i": 0 } as CSSProperties}
            >
              <span
                aria-hidden
                className="font-wlx-serif text-[64px] leading-[0.6] text-wlx-paper/25"
              >
                {lang === "zh-HK" ? "「" : "“"}
              </span>
              {/* font-synthesis-style:none — Noto Serif HK 冇 italic face，唔封住
                  browser 會機械剪切出假斜體漢字。字體匹配係逐字符嘅，所以句入面
                  嘅 Latin 照行 Fraunces 真斜體（font-synthesis 只管假 face）。 */}
              <blockquote className="mt-2 font-wlx-serif italic [font-synthesis-style:none] [text-wrap:pretty] text-wlx-paper text-[clamp(22px,3vw,34px)] leading-[1.3]">
                {heroVoice.q}
              </blockquote>
              <figcaption className="mt-auto flex items-center gap-3 border-t border-wlx-paper/12 pt-6">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wlx-paper font-wlx-display text-base font-semibold text-wlx-ink">
                  {heroVoice.n.charAt(0)}
                </span>
                <span className="flex flex-col">
                  <span className="font-wlx-display text-sm font-semibold text-wlx-paper">
                    {heroVoice.n}
                    {heroVoice.h && heroVoice.h !== heroVoice.n && (
                      <span className="ml-1.5 font-normal text-wlx-paper/60">
                        {heroVoice.h}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-wlx-paper/60">
                    {heroVoice.ty}
                  </span>
                </span>
              </figcaption>
            </figure>

            {/* Stacked pair — smaller, quieter column */}
            <div className="flex flex-col gap-6 lg:col-span-5">
              {restVoices.map((v, i) => (
                <figure
                  key={i}
                  className="wlx-stagger group relative flex flex-col rounded-3xl border border-wlx-paper/10 bg-wlx-paper/[0.04] p-8 shadow-[inset_0_1px_0_rgba(244,241,234,0.18)] transition-all duration-300 hover:-translate-y-1 hover:border-wlx-paper/20 hover:bg-wlx-paper/[0.06] will-change-transform"
                  style={{ transitionTimingFunction: "var(--wlx-ease)", "--i": i + 1 } as CSSProperties}
                >
                  <span
                    aria-hidden
                    className="font-wlx-serif text-[64px] leading-[0.6] text-wlx-paper/25"
                  >
                    {lang === "zh-HK" ? "「" : "“"}
                  </span>
                  <blockquote className="mt-2 font-wlx-serif text-lg italic [font-synthesis-style:none] leading-[1.65] [text-wrap:pretty] text-wlx-paper">
                    {v.q}
                  </blockquote>
                  <figcaption className="mt-auto flex items-center gap-3 border-t border-wlx-paper/12 pt-6">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wlx-paper font-wlx-display text-base font-semibold text-wlx-ink">
                      {v.n.charAt(0)}
                    </span>
                    <span className="flex flex-col">
                      <span className="font-wlx-display text-sm font-semibold text-wlx-paper">
                        {v.n}
                        {v.h && v.h !== v.n && (
                          <span className="ml-1.5 font-normal text-wlx-paper/60">
                            {v.h}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-wlx-paper/60">
                        {v.ty}
                      </span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Pricing ───────── */}
      <section className="wlx-reveal relative bg-wlx-cream">
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,var(--wlx-mist)_12%,var(--wlx-mist)_88%,transparent)]"
        />
        <div className="relative overflow-hidden mx-auto max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-10 select-none font-wlx-serif leading-none text-[clamp(120px,22vw,300px)] text-wlx-ink/[0.035]"
          >
            $
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] tracking-[0.24em] text-wlx-stone tabular-nums">
              05
            </span>
            <p className="inline-flex items-center rounded-full border border-wlx-mist bg-wlx-paper/50 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-wlx-stone">
              {t.pricingEyebrow}
            </p>
          </div>
          <h2 className="mt-5 max-w-[26ch] font-wlx-display text-[clamp(28px,4.8vw,48px)] font-semibold leading-[1.06] tracking-[-0.025em] [text-wrap:balance]">
            {t.pricingTitle}
          </h2>
          <p className="mt-3 max-w-[44ch] text-base leading-relaxed [text-wrap:pretty] text-wlx-stone sm:text-lg">
            {t.pricingSub}
          </p>

          <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {MARKETING_PLANS.map((plan, i) => {
              const href =
                plan.id === "free"
                  ? `/${locale}/start`
                  : `/${locale}/start?plan=${plan.id}`;
              const feats = plan.features[lang].slice(0, plan.teaserCount);

              if (plan.recommended) {
                return (
                  <div
                    key={plan.id}
                    className="wlx-stagger rounded-[26px] bg-wlx-ink p-[5px] shadow-[0_36px_66px_-28px_rgba(44,32,28,0.55)] lg:-my-2"
                    style={{ "--i": i } as CSSProperties}
                  >
                    <article className="relative flex h-full flex-col rounded-[21px] bg-[#232019] p-8 text-wlx-paper shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                      <div className="absolute -top-3 left-8 rounded-full bg-wlx-paper px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-wlx-ink">
                        {t.pricingLiteBadge}
                      </div>
                      <h3 className="font-wlx-display text-xl font-semibold tracking-[-0.01em]">
                        {plan.name}
                      </h3>
                      <p className="mt-1 text-[12px] uppercase tracking-[0.18em] text-wlx-paper/70">
                        {plan.tagline[lang]}
                      </p>
                      <p className="mt-7 font-wlx-display text-4xl font-semibold tabular-nums tracking-tight [font-feature-settings:'tnum','lnum']">
                        ${plan.priceHKD}
                        <span className="ml-1 text-sm font-normal text-wlx-paper/70">
                          {t.pricingPeriod}
                        </span>
                      </p>
                      <ul className="mt-7 flex-1 space-y-3 text-sm">
                        {feats.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check
                              size={16}
                              strokeWidth={1.5}
                              className="mt-0.5 shrink-0 text-wlx-paper"
                            />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={href}
                        className="mt-8 inline-block rounded-full bg-wlx-paper py-3 text-center text-[12px] uppercase tracking-[0.22em] text-wlx-ink transition-all duration-200 hover:bg-wlx-paper/90 active:scale-[0.98]"
                        style={{ transitionTimingFunction: "var(--wlx-ease)" }}
                      >
                        {t.pricingCta}
                      </Link>
                    </article>
                  </div>
                );
              }

              return (
                <div
                  key={plan.id}
                  className="wlx-stagger rounded-[26px] bg-wlx-mist/40 p-[5px] shadow-[0_30px_60px_-30px_rgba(26,24,21,0.32)]"
                  style={{ "--i": i } as CSSProperties}
                >
                  <article
                    className="group relative flex h-full flex-col rounded-[21px] border border-wlx-mist bg-wlx-paper p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-all duration-500 hover:-translate-y-1.5 hover:border-wlx-accent/40 hover:shadow-[0_28px_55px_-30px_rgba(44,32,28,0.35)] will-change-transform"
                    style={{ transitionTimingFunction: "var(--wlx-ease)" }}
                  >
                    <h3 className="font-wlx-display text-xl font-semibold tracking-[-0.01em]">
                      {plan.name}
                    </h3>
                    <p className="mt-1 text-[12px] uppercase tracking-[0.18em] text-wlx-stone">
                      {plan.tagline[lang]}
                    </p>
                    <p className="mt-7 font-wlx-display text-4xl font-semibold tabular-nums tracking-tight [font-feature-settings:'tnum','lnum']">
                      ${plan.priceHKD}
                      <span className="ml-1 text-sm font-normal text-wlx-stone">
                        {t.pricingPeriod}
                      </span>
                    </p>
                    <ul className="mt-7 flex-1 space-y-3 text-sm text-wlx-ink">
                      {feats.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <Check
                            size={16}
                            strokeWidth={1.5}
                            className="mt-0.5 shrink-0 text-wlx-ink"
                          />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={href}
                      className="mt-8 inline-block rounded-full border border-wlx-ink py-3 text-center text-[12px] uppercase tracking-[0.22em] text-wlx-ink transition-all duration-200 hover:bg-wlx-ink hover:text-wlx-paper active:scale-[0.98]"
                      style={{ transitionTimingFunction: "var(--wlx-ease)" }}
                    >
                      {t.pricingCta}
                    </Link>
                  </article>
                </div>
              );
            })}
          </div>

          <p className="mt-10 max-w-[52ch] text-[12px] uppercase tracking-[0.18em] text-wlx-stone">
            {t.pricingTrust}
          </p>
          <Link
            href={`/${locale}/pricing`}
            className="mt-4 inline-flex items-center gap-1 text-[12px] uppercase tracking-[0.22em] text-wlx-stone transition-colors duration-200 hover:text-wlx-ink"
            style={{ transitionTimingFunction: "var(--wlx-ease)" }}
          >
            {t.pricingFullLink}
            <ArrowRight size={12} />
          </Link>
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
                "radial-gradient(closest-side, rgba(214,205,191,0.5), transparent)",
            }}
          />
          <div
            className="absolute -bottom-32 -right-16 h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(244,241,234,0.4), transparent)",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-[900px] px-5 py-24 text-center sm:px-8 sm:py-32">
          <p className="inline-flex items-center rounded-full border border-wlx-paper/20 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-wlx-paper/60">
            {t.ctaEyebrow}
          </p>
          <h2 className="mt-5 font-wlx-display text-[clamp(36px,7vw,72px)] font-semibold leading-[1.05] tracking-[-0.02em] text-wlx-paper [text-wrap:balance]">
            {t.ctaTitle}
          </h2>
          <p className="mx-auto mt-6 max-w-[44ch] text-base text-wlx-paper/70 sm:text-lg">
            {t.ctaSub}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <span className="wlx-magnetic">
              <Link
                href={`/${locale}/start`}
                className="group inline-flex items-center gap-3 rounded-full bg-wlx-paper py-2 pl-7 pr-2 text-[12px] uppercase tracking-[0.22em] text-wlx-ink transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[0_22px_50px_-18px_rgba(244,241,234,0.3)] active:scale-[0.98] will-change-transform"
              >
                {t.ctaPrimary}
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wlx-ink/10 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:scale-105">
                  <ArrowRight size={15} strokeWidth={1.5} />
                </span>
              </Link>
            </span>
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
        /* halt = half-width 約物。Noto Serif HK 跟港台慣例將全形標點置中擺喺
           em 格入面 —— 內文啱，但 display 尺寸就變成一個 51px 嘅窿。halt 換半形
           advance 收返實。呢個 property 係取代唔係 merge，所以 root 嘅
           kern/liga/calt 要喺度重寫一次，唔係就會靜靜雞跌咗。 */
        .font-wlx-display {
          font-optical-sizing: auto;
          font-feature-settings: 'kern', 'liga', 'calt', 'halt';
        }
        /* Oversized stat numerals — progressive-enhancement wipe driven by
           scroll (view()-timeline). Gated behind @supports + .wlx-js so
           unsupported browsers (and no-JS) always show the number fully
           visible; nothing here can hide content permanently. */
        @supports (animation-timeline: view()) {
          .wlx-js .wlx-stat-num {
            clip-path: inset(0 100% 0 0);
            animation: wlxWipe linear both;
            animation-timeline: view();
            animation-range: entry 10% cover 40%;
          }
        }
        @keyframes wlxWipe {
          to {
            clip-path: inset(0 0 0 0);
          }
        }
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
        /* Kinetic masthead reveal — each h1 line sits in an overflow-hidden
           mask; the inner .wlx-line wipes its clip-path open on mount. Runs
           alongside (not instead of) the h1's own wlx-fade-up opacity. */
        .wlx-line {
          clip-path: inset(0 105% 0 0);
          transform: translateY(0.1em);
          animation: wlxLineWipe 900ms var(--wlx-ease) forwards;
        }
        @keyframes wlxLineWipe {
          to {
            clip-path: inset(0 -2% 0 0);
            transform: translateY(0);
          }
        }
        @keyframes wlxDrift {
          from {
            transform: translate3d(0, 0, 0) scale(1);
          }
          to {
            transform: translate3d(12px, 10px, 0) scale(1.05);
          }
        }
        .wlx-drift {
          animation: wlxDrift 18s ease-in-out infinite alternate;
        }
        /* Wave 4: hero phone depth parallax — Chromium-enhanced only. Gated
           behind @supports (animation-timeline: view()) so Safari/Firefox
           (and any browser without CSS scroll-timelines) simply keep the
           static look already shipped; the lg:absolute positioning above
           is untouched, this only layers a translate on top via animation. */
        @supports (animation-timeline: view()) {
          @media (prefers-reduced-motion: no-preference) {
            /* Carry BOTH the mount fade-up (opacity, time-based) and the
               scroll parallax (transform) so neither clobbers the other —
               one animation shorthand alone would drop the fade-up and
               leave the phone stuck at opacity 0. */
            .wlx-hero-parallax {
              animation:
                wlxFadeUp 700ms var(--wlx-ease) both,
                wlxRiseSlow linear both;
              animation-timeline: auto, scroll(root);
              animation-range: normal, 0 70vh;
              will-change: transform;
            }
            @keyframes wlxRiseSlow {
              to {
                transform: translate3d(0, -40px, 0);
              }
            }
          }
        }
        /* Wave 4: sticky-nav scroll-progress hairline — Chromium-enhanced
           only, zero JS. Hidden entirely where animation-timeline: scroll()
           is unsupported so it never ships as a static full-width bar. */
        @supports (animation-timeline: scroll()) {
          .wlx-progress {
            transform: scaleX(0);
            animation: wlxProgress linear both;
            animation-timeline: scroll(root);
          }
          @keyframes wlxProgress {
            to {
              transform: scaleX(1);
            }
          }
        }
        @supports not (animation-timeline: scroll()) {
          .wlx-progress {
            display: none;
          }
        }
        /* Wave 4: magnetic primary CTA — desktop pointer only. The pull is
           applied to a wrapper span (not the Link itself) so it never fights
           the Link's own Tailwind active:scale-[0.98] press effect; the two
           transforms live on different elements and compose visually. */
        .wlx-magnetic {
          display: inline-block;
          transform: translate3d(calc(var(--mx, 0) * 1px), calc(var(--my, 0) * 1px), 0);
          transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1);
        }
        @media (prefers-reduced-motion: reduce), (pointer: coarse) {
          .wlx-magnetic {
            transform: none !important;
          }
        }
        /* Visible by default (no JS / observer stall = content still shows). */
        .wlx-reveal {
          opacity: 1;
          transform: none;
        }
        /* Wave 4: the section itself no longer hides — only its mapped
           children (.wlx-stagger) cascade in once .is-visible lands. The
           IntersectionObserver still adds/removes is-visible on the
           .wlx-reveal section exactly as before; this rule is intentionally
           inert so the parent never goes blank. */
        .wlx-js .wlx-reveal {
        }
        /* 呢條 rule 收窄咗 transition-property，而佢係 unlayered，Tailwind 啲
           utility 喺 @layer utilities —— unlayered 硬食 layered，所以卡自己嘅
           transition-all + duration-300 會輸。四張大卡（bento 2x2、pull-quote、
           兩張口碑卡）同一個元素上面兩者都有 → hover 嘅 translate / box-shadow
           唔喺 list 入面就 0ms 硬跳。所以 hover 嗰啲 property 要喺呢度一齊報
           name，用 per-property delay（唔可以用 blanket transition-delay，
           否則 hover 都會孭埋個 stagger delay）。§8 坑 2 喺 transition 上重演。 */
        .wlx-js .wlx-reveal .wlx-stagger {
          opacity: 0;
          transform: translateY(28px);
          clip-path: inset(0 0 14% 0);
          transition:
            opacity 0.7s var(--wlx-ease) calc(var(--i, 0) * 90ms),
            transform 0.7s var(--wlx-ease) calc(var(--i, 0) * 90ms),
            clip-path 0.7s var(--wlx-ease) calc(var(--i, 0) * 90ms),
            translate 0.3s var(--wlx-ease) 0s,
            box-shadow 0.3s var(--wlx-ease) 0s,
            background-color 0.3s var(--wlx-ease) 0s,
            border-color 0.3s var(--wlx-ease) 0s;
        }
        .wlx-js .wlx-reveal.is-visible .wlx-stagger {
          opacity: 1;
          transform: none;
          clip-path: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .wlx-fade-up,
          .wlx-reveal {
            opacity: 1 !important;
            transform: none !important;
            animation: none !important;
            transition: none !important;
          }
          .wlx-line {
            clip-path: none !important;
            transform: none !important;
            animation: none !important;
          }
          .wlx-drift {
            animation: none !important;
          }
          .wlx-stat-num {
            clip-path: none !important;
          }
          .wlx-stagger {
            opacity: 1 !important;
            transform: none !important;
            clip-path: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
