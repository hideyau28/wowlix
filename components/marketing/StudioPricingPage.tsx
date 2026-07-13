"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { marketingBrandVars } from "@/components/marketing/theme";
import { MARKETING_PLANS } from "@/components/marketing/plans";
import { fraunces, notoSerifHK } from "@/components/marketing/fonts";

type Props = { locale?: Locale };

const T = {
  "zh-HK": {
    navHome: "首頁",
    navStart: "免費開店",
    eyebrow: "定價",
    title: "簡單透明，0% 佣金。",
    sub: "你賺幾多就係幾多。月繳、隨時取消，唔需要長合約。",
    period: "／月",
    badge: "推薦",
    ctaFree: "免費開始",
    ctaChoose: "選擇",
    faqEyebrow: "常見問題",
    faq: [
      {
        q: "Free Plan 有冇限制？",
        a: "10 件商品、每月 50 張訂單，過咗就需要升級。0% 平台佣金，永遠免費。",
      },
      {
        q: "可以隨時取消嗎？",
        a: "可以。月繳，隨時取消，下個 billing cycle 自動降級到 Free。",
      },
      {
        q: "升級會扣咩錢？",
        a: "我哋按月計，按比例計算嗰個月剩餘日數。冇隱藏收費。",
      },
      {
        q: "支援邊啲收款方式？",
        a: "FPS 轉數快、PayMe、AlipayHK、信用卡（經 Stripe Connect）。所有 plan 都包。",
      },
    ],
    ctaTitle: "夠晒料？開始啦。",
    ctaSub: "2 分鐘開店 · 唔使信用卡 · 永遠 0% 佣金",
    ctaBtn: "免費開始",
  },
  en: {
    navHome: "Home",
    navStart: "Start free",
    eyebrow: "Pricing",
    title: "Simple, transparent, 0% commission.",
    sub: "What you earn is what you keep. Monthly, cancel anytime, no contracts.",
    period: "/mo",
    badge: "Recommended",
    ctaFree: "Start free",
    ctaChoose: "Choose",
    faqEyebrow: "FAQ",
    faq: [
      {
        q: "What are the limits on Free?",
        a: "10 products and 50 orders per month. Past that, upgrade. 0% commission forever.",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes. Monthly billing, cancel anytime, downgrades to Free at next cycle.",
      },
      {
        q: "How does upgrading work?",
        a: "Pro-rated for the remainder of the month. No hidden fees.",
      },
      {
        q: "Which payment methods are supported?",
        a: "FPS, PayMe, AlipayHK, and credit cards (via Stripe Connect). Available on all plans.",
      },
    ],
    ctaTitle: "Seen enough? Start building.",
    ctaSub: "2 min setup · No credit card · 0% commission, always",
    ctaBtn: "Start free",
  },
};

export default function StudioPricingPage({ locale = "zh-HK" }: Props) {
  const t = T[locale] || T.en;
  const otherLocale = locale === "zh-HK" ? "en" : "zh-HK";

  // Scroll-reveal for sections marked with .studio-reveal.
  // Robustness: content is visible by DEFAULT (see CSS). Only after JS confirms it
  // can run do we add `studio-js` (which enables the hidden→animate state), so a
  // stalled observer or JS failure can never ship a blank page. A failsafe timer
  // also force-reveals everything if the observer never fires.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("studio-js");
    const els = document.querySelectorAll<HTMLElement>(".studio-reveal");
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
      { threshold: 0.12, rootMargin: "120px" },
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

  // Creator-first warm palette — scoped to THIS page only via CSS-var overrides,
  // mirroring WowlixLandingPage.tsx so /pricing stays visually consistent with
  // the landing without bleeding into the shared --wlx-* tokens elsewhere.
  const brandVars = marketingBrandVars;

  return (
    <div
      style={brandVars}
      className={`${fraunces.variable} ${notoSerifHK.variable} min-h-screen bg-wlx-paper text-wlx-ink font-wlx-sans antialiased`}
    >
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-wlx-mist bg-wlx-paper/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 sm:px-8">
          <Link
            href={`/${locale}`}
            className="font-wlx-display text-lg tracking-tight"
          >
            WoWlix
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href={`/${locale}`}
              className="text-[12px] uppercase tracking-[0.18em] text-wlx-stone hover:text-wlx-ink transition-colors duration-200"
              style={{ transitionTimingFunction: "var(--wlx-ease)" }}
            >
              {t.navHome}
            </Link>
            <Link
              href={`/${otherLocale}/pricing`}
              className="text-[12px] uppercase tracking-[0.18em] text-wlx-stone hover:text-wlx-ink transition-colors duration-200"
              style={{ transitionTimingFunction: "var(--wlx-ease)" }}
            >
              {locale === "zh-HK" ? "EN" : "繁"}
            </Link>
            <Link
              href={`/${locale}/start`}
              className="group hidden sm:inline-flex items-center gap-1.5 rounded-full bg-wlx-ink px-4 py-2.5 text-[12px] uppercase tracking-[0.18em] text-wlx-paper hover:bg-wlx-ink/90 transition-all duration-200 active:scale-[0.97] will-change-transform"
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

      {/* Header */}
      <section className="border-b border-wlx-mist">
        <div className="mx-auto max-w-[1200px] px-5 pt-16 pb-12 sm:px-8 sm:pt-24 sm:pb-16">
          <p className="text-[11px] uppercase tracking-[0.22em] text-wlx-stone">
            {t.eyebrow}
          </p>
          <h1 className="mt-6 font-wlx-display text-[clamp(36px,7vw,72px)] font-bold leading-[1.05] tracking-[-0.02em] text-balance">
            {t.title}
          </h1>
          <p className="mt-5 max-w-[48ch] text-base sm:text-lg text-wlx-stone">
            {t.sub}
          </p>
        </div>
      </section>

      {/* Plan cards */}
      <section className="studio-reveal border-b border-wlx-mist">
        <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {MARKETING_PLANS.map((plan) => {
              const href =
                plan.id === "free"
                  ? `/${locale}/start`
                  : `/${locale}/start?plan=${plan.id}`;
              const cta =
                plan.id === "free" ? t.ctaFree : `${t.ctaChoose} ${plan.name}`;

              if (plan.recommended) {
                return (
                  <article
                    key={plan.id}
                    className="relative flex flex-col rounded-3xl bg-wlx-ink p-8 text-wlx-paper shadow-[0_36px_66px_-28px_rgba(44,32,28,0.55)] lg:-my-2"
                  >
                    <div className="absolute -top-3 left-8 rounded-full bg-wlx-accent px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-wlx-accent-fg">
                      {t.badge}
                    </div>
                    <h3 className="font-wlx-display text-xl font-semibold tracking-tight">
                      {plan.name}
                    </h3>
                    <p className="mt-1 text-[12px] uppercase tracking-[0.18em] text-wlx-paper/70">
                      {plan.tagline[locale]}
                    </p>
                    <p className="mt-7 font-wlx-display text-4xl font-semibold tabular-nums tracking-tight">
                      ${plan.priceHKD}
                      <span className="ml-1 text-sm font-normal text-wlx-paper/70">
                        {t.period}
                      </span>
                    </p>
                    <ul className="mt-7 flex-1 space-y-3 text-sm">
                      {plan.features[locale].map((f) => (
                        <li key={f} className="flex items-start gap-2.5">
                          <Check size={16} className="mt-0.5 shrink-0 text-wlx-accent" aria-hidden />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={href}
                      className="group mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-wlx-accent px-8 py-4 text-center text-[12px] uppercase tracking-[0.22em] text-wlx-accent-fg transition-all duration-300 hover:brightness-[1.06] hover:shadow-[0_18px_44px_-16px_rgba(194,90,78,0.55)] active:scale-[0.98]"
                      style={{ transitionTimingFunction: "var(--wlx-ease)" }}
                    >
                      {cta}
                    </Link>
                  </article>
                );
              }

              return (
                <article
                  key={plan.id}
                  className="flex flex-col rounded-3xl border border-wlx-mist p-8 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(44,32,28,0.35)]"
                >
                  <h3 className="font-wlx-display text-xl font-semibold tracking-tight">
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-[12px] uppercase tracking-[0.18em] text-wlx-stone">
                    {plan.tagline[locale]}
                  </p>
                  <p className="mt-7 font-wlx-display text-4xl font-semibold tabular-nums tracking-tight">
                    ${plan.priceHKD}
                    <span className="ml-1 text-sm font-normal text-wlx-stone">{t.period}</span>
                  </p>
                  <ul className="mt-7 flex-1 space-y-3 text-sm text-wlx-ink">
                    {plan.features[locale].map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check size={16} className="mt-0.5 shrink-0 text-wlx-accent" aria-hidden />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={href}
                    className="mt-8 inline-block rounded-full border border-wlx-ink py-3 text-center text-[12px] uppercase tracking-[0.22em] text-wlx-ink transition-all duration-200 hover:bg-wlx-ink hover:text-wlx-paper active:scale-[0.98]"
                    style={{ transitionTimingFunction: "var(--wlx-ease)" }}
                  >
                    {cta}
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="studio-reveal border-b border-wlx-mist bg-wlx-cream">
        <div className="mx-auto max-w-[860px] px-5 py-20 sm:px-8 sm:py-28">
          <p className="text-[11px] uppercase tracking-[0.22em] text-wlx-stone">
            {t.faqEyebrow}
          </p>
          <dl className="mt-12 divide-y divide-wlx-mist">
            {t.faq.map((item) => (
              <div key={item.q} className="grid grid-cols-1 gap-4 py-8 sm:grid-cols-3">
                <dt className="font-wlx-display text-base sm:text-lg font-semibold tracking-tight sm:col-span-1">
                  {item.q}
                </dt>
                <dd className="text-sm leading-relaxed text-wlx-stone sm:col-span-2">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Final CTA */}
      <section className="studio-reveal bg-wlx-ink">
        <div className="mx-auto max-w-[900px] px-5 py-24 sm:px-8 sm:py-32 text-center">
          <h2 className="font-wlx-display text-[clamp(36px,6vw,64px)] tracking-tight leading-[1.05] text-wlx-paper">
            {t.ctaTitle}
          </h2>
          <p className="mt-6 text-base sm:text-lg text-wlx-paper/75">
            {t.ctaSub}
          </p>
          <Link
            href={`/${locale}/start`}
            className="group mt-10 inline-flex items-center justify-center gap-2 rounded-full bg-wlx-accent px-8 py-4 text-[12px] uppercase tracking-[0.22em] text-wlx-accent-fg transition-all duration-300 hover:brightness-[1.06] hover:shadow-[0_18px_44px_-16px_rgba(194,90,78,0.55)] active:scale-[0.98]"
            style={{ transitionTimingFunction: "var(--wlx-ease)" }}
          >
            {t.ctaBtn}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-wlx-mist bg-wlx-paper">
        <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14">
          <p className="text-[12px] uppercase tracking-[0.18em] text-wlx-stone">
            © 2026 WoWlix · Hong Kong
          </p>
        </div>
      </footer>

      {/* Scroll-reveal animation: `studio-reveal` is visible by default; only
          once JS confirms it can run do we hide-then-reveal on scroll. */}
      <style jsx global>{`
        .studio-reveal {
          opacity: 1;
          transform: none;
        }
        .studio-js .studio-reveal {
          opacity: 0;
          transform: translateY(40px);
          transition: opacity 700ms cubic-bezier(0.22, 1, 0.36, 1),
            transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .studio-js .studio-reveal.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          .studio-reveal {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
