import type { CSSProperties } from "react";

/** Ink & Bone — monochrome editorial palette, scoped to marketing surfaces
 *  only (never tenant stores). Accent IS the ink (near-black); on dark
 *  surfaces, elements invert to `paper` (bone) rather than using the accent. */
export const marketingBrandVars = {
  "--wlx-cream": "#EBE5DB",
  "--wlx-paper": "#F4F1EA",
  "--wlx-ink": "#1A1815",
  "--wlx-stone": "#6E6A60",
  "--wlx-mist": "#DCD6CA",
  "--wlx-accent": "#1A1815",
  "--wlx-accent-fg": "#F4F1EA",
  "--wlx-blush": "#D6CDBF",

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
