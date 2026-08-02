// Template definitions for storefront themes
// 4 templates: noir, linen, mochi (default), petal

export interface CoverTemplate {
  id: string;
  label: string;        // zh-HK name
  labelEn: string;      // English name
  descZh: string;       // zh-HK description
  descEn: string;       // English description
  // Design tokens
  bg: string;           // page background color
  card: string;         // card background color
  text: string;         // primary text color
  subtext: string;      // secondary text color
  accent: string;       // accent / price color
  headerGradient: string; // CSS linear-gradient for header band
  borderRadius: { card: number; button: number; image: number };
  buttonStyle: "filled" | "outline";
  shadow: string;       // CSS box-shadow (or "none")
  // Font tokens
  headingFont: string;  // Google Fonts family name for headings
  bodyFont: string;     // Google Fonts family name for body text
  // Banner
  defaultBanner: string; // path to default cover image in /public
}

/** accent 底色之上嘅深色字 —— 同 noir 個 card 差唔多，唔會好似純黑咁硬。 */
const ACCENT_FG_DARK = "#1A1A1A";
const ACCENT_FG_LIGHT = "#FFFFFF";

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance。認唔到嘅色值當中灰，兩邊都唔會過分自信。 */
function relativeLuminance(hex: string): number {
  const clean = hex.trim().replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return 0.5;
  const r = srgbToLinear(parseInt(full.slice(0, 2), 16));
  const g = srgbToLinear(parseInt(full.slice(2, 4), 16));
  const b = srgbToLinear(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(lumA: number, lumB: number): number {
  const [hi, lo] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * accent 色之上應該用邊隻字色。
 *
 * 點解要即場計，唔用一個寫死喺 template 嘅 token：storefront 到處都係
 * `tenant.brandColor || tmpl.accent`（ProfileSection.tsx:102、
 * StickyHeader.tsx:44）—— 商戶自訂咗品牌色，固定 token 就會錯，隨時由
 * 「白字睇唔清」變成「深字睇唔清」。
 *
 * 修之前全部硬寫 text-white：noir #FF9500 = 2.20:1、studio #C9A961 = 2.25:1、
 * linen 2.40、petal 2.83 —— WCAG AA 要 4.5:1，5 個 template 得 mochi 過關，
 * 而中招嗰粒係「確認落單」最後一掣。
 */
export function getAccentForeground(accent: string): string {
  const lum = relativeLuminance(accent);
  const onLight = contrastRatio(lum, relativeLuminance(ACCENT_FG_LIGHT));
  const onDark = contrastRatio(lum, relativeLuminance(ACCENT_FG_DARK));
  return onDark >= onLight ? ACCENT_FG_DARK : ACCENT_FG_LIGHT;
}

export const COVER_TEMPLATES: CoverTemplate[] = [
  {
    id: "noir",
    label: "暗黑",
    labelEn: "Noir",
    descZh: "型格街頭",
    descEn: "Bold & edgy",
    bg: "#0D0D0D",
    card: "#1A1A1A",
    text: "#FFFFFF",
    subtext: "#A0A0A0",
    accent: "#FF9500",
    headerGradient: "linear-gradient(135deg, #1A1A1A, #0D0D0D)",
    borderRadius: { card: 4, button: 4, image: 2 },
    buttonStyle: "filled",
    shadow: "none",
    headingFont: "Bebas Neue",
    bodyFont: "Inter",
    defaultBanner: "/banners/noir.webp",
  },
  {
    id: "linen",
    label: "棉麻",
    labelEn: "Linen",
    descZh: "溫暖精緻",
    descEn: "Warm & elegant",
    bg: "#FAF7F2",
    card: "#FFFFFF",
    text: "#3D3229",
    subtext: "#8C7B6B",
    accent: "#C49A6C",
    headerGradient: "linear-gradient(135deg, #FAF7F2, #F0E8DA)",
    borderRadius: { card: 16, button: 24, image: 12 },
    buttonStyle: "outline",
    shadow: "0 2px 8px rgba(0,0,0,0.06)",
    headingFont: "Playfair Display",
    bodyFont: "Lato",
    defaultBanner: "/banners/linen.webp",
  },
  {
    id: "mochi",
    label: "抹茶",
    labelEn: "Mochi",
    descZh: "清新專業",
    descEn: "Clean & fresh",
    bg: "#FFFFFF",
    card: "#F8FAF7",
    text: "#1A1A1A",
    subtext: "#6B7280",
    accent: "#2D6A4F",
    headerGradient: "linear-gradient(135deg, #FFFFFF, #F0F5EE)",
    borderRadius: { card: 12, button: 12, image: 8 },
    buttonStyle: "filled",
    shadow: "0 1px 3px rgba(0,0,0,0.08)",
    headingFont: "Montserrat",
    bodyFont: "Inter",
    defaultBanner: "/banners/mochi.webp",
  },
  {
    id: "petal",
    label: "花瓣",
    labelEn: "Petal",
    descZh: "優雅奢華",
    descEn: "Soft & luxe",
    bg: "#FDF2F4",
    card: "#FFFFFF",
    text: "#4A2040",
    subtext: "#8E6B7F",
    accent: "#C77D91",
    headerGradient: "linear-gradient(135deg, #FDF2F4, #F8E4E8)",
    borderRadius: { card: 20, button: 999, image: 16 },
    buttonStyle: "filled",
    shadow: "0 2px 12px rgba(199,125,145,0.12)",
    headingFont: "Cormorant Garamond",
    bodyFont: "Lato",
    defaultBanner: "/banners/petal.webp",
  },
  {
    id: "studio",
    label: "工作室",
    labelEn: "Studio",
    descZh: "精緻編輯感",
    descEn: "Editorial premium",
    bg: "#FBFAF7",          // wlx-paper
    card: "#F8F6F2",        // wlx-cream
    text: "#1A1A1A",        // wlx-ink
    subtext: "#6F6A63",     // wlx-stone
    accent: "#C9A961",      // wlx-accent (default; tenant brandColor overrides)
    headerGradient: "linear-gradient(180deg, rgba(26,26,26,0) 0%, rgba(26,26,26,0.45) 100%)",
    borderRadius: { card: 0, button: 0, image: 0 },
    buttonStyle: "filled",
    shadow: "0 4px 12px rgba(26,26,26,0.06)",
    headingFont: "Geist",
    bodyFont: "Geist",
    defaultBanner: "/banners/mochi.webp",
  },
];

// 所有舊 template ID → mochi（backward compat）
const LEGACY_MAP: Record<string, string> = {
  "warm-gradient": "mochi",
  "ocean-blue": "mochi",
  "pastel-pink": "mochi",
  monochrome: "mochi",
  "nature-green": "mochi",
  sunset: "mochi",
  warm: "mochi",
  ocean: "mochi",
  pastel: "mochi",
  mono: "mochi",
  blue: "mochi",
  pink: "mochi",
  green: "mochi",
  purple: "mochi",
  default: "mochi",
};

const VALID_IDS = new Set(COVER_TEMPLATES.map((t) => t.id));

/** Resolve any template ID (including legacy) to a canonical ID */
export function resolveTemplateId(id: string | null | undefined): string {
  if (!id) return "mochi";
  if (VALID_IDS.has(id)) return id;
  return LEGACY_MAP[id] || "mochi";
}

/** Convert hex (#RRGGBB) to rgba string */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Get template by ID (handles legacy IDs). Always returns a valid template. */
export function getCoverTemplate(id: string | null | undefined): CoverTemplate {
  const canonicalId = resolveTemplateId(id);
  return COVER_TEMPLATES.find((t) => t.id === canonicalId) || COVER_TEMPLATES[2]; // mochi fallback
}
