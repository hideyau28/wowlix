import { Fraunces, Noto_Serif_HK } from "next/font/google";

// Marketing-only display/serif type — registered here (not app/layout.tsx) so
// tenant stores, admin, and biolink surfaces never load these fonts. See
// app/globals.css --wlx-font-*-latin / --wlx-font-*-cjk hooks for how these
// wire into --font-wlx-display / --font-wlx-serif on marketing pages only.
export const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

export const notoSerifHK = Noto_Serif_HK({
  weight: ["500", "700", "900"],
  subsets: ["latin"],
  preload: false,
  variable: "--font-noto-serif-hk",
  display: "swap",
});
