import type { CSSProperties } from "react";

/** Creator-first warm palette — scoped to marketing surfaces only (never tenant stores). */
export const marketingBrandVars = {
  "--wlx-cream": "#F6ECE2",
  "--wlx-paper": "#FBF4EC",
  "--wlx-ink": "#2C201C",
  "--wlx-stone": "#77645A",
  "--wlx-mist": "#EBDFD3",
  "--wlx-accent": "#C25A4E",
  "--wlx-accent-fg": "#FFFFFF",
  "--wlx-blush": "#E0B2A0",

  // Warm editorial type — re-voices --font-wlx-display / --font-wlx-serif
  // (see app/globals.css) with Fraunces (Latin) + Noto Serif HK (CJK) fonts
  // registered in components/marketing/fonts.ts. Scoped the same way as the
  // colors above: only marketing pages set these, so nothing else changes.
  "--wlx-font-display-latin": "var(--font-fraunces)",
  "--wlx-font-display-cjk":
    "var(--font-noto-serif-hk), 'Noto Serif TC', 'PingFang HK', serif",
  "--wlx-font-serif-latin": "var(--font-fraunces)",
  "--wlx-font-serif-cjk":
    "var(--font-noto-serif-hk), 'Songti TC', 'Noto Serif TC', serif",
} as CSSProperties;
