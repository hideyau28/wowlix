/**
 * Bio Link 前台 data helpers
 * 處理 product variants / images / badges fallback logic
 */

// ─── Types ───

/** Variant from ProductVariant relation (actual schema) */
export type VariantForBioLink = {
  id: string;
  name: string;
  price: number | null;
  compareAtPrice: number | null;
  stock: number;
  active: boolean;
  imageUrl: string | null;
};

/** 雙維 variant 格式（顏色 × 尺碼） */
export type DualVariantData = {
  dimensions: string[];
  options: Record<string, string[]>;
  optionImages?: Record<string, number>;
  combinations: Record<string, { qty: number; status: string }>;
};

/** Check if sizes data is dual-variant format */
export function isDualVariant(
  sizes: Record<string, number> | DualVariantData | null,
): sizes is DualVariantData {
  if (!sizes || typeof sizes !== "object") return false;
  return (
    "dimensions" in sizes &&
    Array.isArray((sizes as DualVariantData).dimensions) &&
    (sizes as DualVariantData).dimensions.length >= 2
  );
}

export type ProductForBioLink = {
  id: string;
  title: string;
  price: number;
  originalPrice: number | null;
  imageUrl: string | null;
  images: string[];
  videoUrl?: string | null;
  description?: string | null;
  brand?: string | null;
  sku?: string | null;
  /** 產品層庫存（冇 variant 嗰啲貨用）—— JSON-LD availability 靠佢 */
  stock?: number | null;
  sizes: Record<string, number> | DualVariantData | null;
  sizeSystem?: string | null;
  badges: string[] | null;
  category?: string | null;
  featured: boolean;
  createdAt: Date;
  // ProductVariant relation (may be included)
  variants?: VariantForBioLink[];
};

export type DeliveryOption = {
  id: string;
  label: string;
  price: number;
  enabled: boolean;
};

export type OrderConfirmConfig = {
  thanks: string;
  whatsappTemplate: string;
};

export type TenantForBioLink = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  whatsapp: string | null;
  instagram: string | null;
  socialLinks: Array<{ platform: string; url: string }>;
  brandColor: string | null;
  logoUrl: string | null;
  coverPhoto: string | null;
  coverTemplate: string | null;
  template: string;
  // Payment fields
  fpsEnabled: boolean;
  fpsAccountName: string | null;
  fpsAccountId: string | null;
  fpsQrCodeUrl: string | null;
  paymeEnabled: boolean;
  paymeLink: string | null;
  paymeQrCodeUrl: string | null;
  stripeAccountId: string | null;
  stripeOnboarded: boolean;
  // Checkout settings
  currency: string;
  region?: string;
  languages?: string[];
  deliveryOptions: DeliveryOption[];
  freeShippingThreshold: number | null;
  orderConfirmMessage: OrderConfirmConfig;
};

// ─── Image helpers ───

export function getAllImages(product: ProductForBioLink): string[] {
  const all: string[] = [];
  if (product.imageUrl) all.push(product.imageUrl);
  if (product.images && Array.isArray(product.images)) {
    for (const url of product.images) {
      if (url && !all.includes(url)) all.push(url);
    }
  }
  return all;
}

// ─── Variant helpers ───

/**
 * Get visible variants for a product.
 * Priority: ProductVariant relation → legacy sizes JSON → null
 * 雙維 variant 唔用呢個 function — 用 getDualVariantData() 代替
 */
export function getVisibleVariants(
  product: ProductForBioLink,
): { name: string; stock: number; price: number | null }[] | null {
  // 雙維 variant — 唔返回 flat list，由 VariantSelector 自己處理
  if (isDualVariant(product.sizes)) return null;
  // New format: ProductVariant relation
  if (product.variants && product.variants.length > 0) {
    return product.variants
      .filter((v) => v.active && v.stock >= 0)
      .map((v) => ({ name: v.name, stock: v.stock, price: v.price }));
  }
  // Fallback: sizes JSON (new or legacy format)
  if (product.sizes && typeof product.sizes === "object") {
    const raw = product.sizes as Record<string, unknown>;
    const entries = Object.entries(raw);
    if (entries.length > 0) {
      // New format: {"S": {"qty": 5, "status": "available"}}
      const firstVal = entries[0][1];
      if (
        typeof firstVal === "object" &&
        firstVal !== null &&
        "qty" in (firstVal as Record<string, unknown>)
      ) {
        return entries
          .filter(([, val]) => {
            const v = val as { qty: number; status?: string };
            return v.status !== "hidden";
          })
          .map(([name, val]) => ({
            name,
            stock: (val as { qty: number }).qty,
            price: null,
          }));
      }
      // Legacy format: {"S": 5}
      return entries.map(([name, qty]) => ({
        name,
        stock: Number(qty),
        price: null,
      }));
    }
  }
  return null;
}

/** Get dual-variant data if product uses dual-variant format */
export function getDualVariantData(
  product: ProductForBioLink,
): DualVariantData | null {
  if (isDualVariant(product.sizes)) return product.sizes;
  return null;
}

export function getVariantLabel(
  product: ProductForBioLink,
  languages?: string[],
): string {
  const isZh = (languages || ["zh-HK"]).includes("zh-HK");
  // 雙維 — 用第二維嘅名做 label
  if (isDualVariant(product.sizes))
    return product.sizes.dimensions[1] || (isZh ? "款式" : "Style");
  // If has ProductVariant relation, generic label
  if (product.variants && product.variants.length > 0)
    return isZh ? "款式" : "Style";
  // 用 sizeSystem 做 label（商戶自訂選項名稱）
  if (product.sizeSystem) return product.sizeSystem;
  // Fallback: if has sizes, use generic label
  if (product.sizes && Object.keys(product.sizes).length > 0)
    return isZh ? "尺碼" : "Size";
  return isZh ? "款式" : "Style";
}

export function isSoldOut(product: ProductForBioLink): boolean {
  // 雙維 — check all combinations
  if (isDualVariant(product.sizes)) {
    const combos = Object.values(product.sizes.combinations);
    if (combos.length === 0) return false;
    return combos.every((c) => c.qty === 0 || c.status === "hidden");
  }
  const variants = getVisibleVariants(product);
  if (!variants) return false;
  if (variants.length === 0) return false;
  return variants.every((v) => v.stock === 0);
}

export function isNew(product: ProductForBioLink): boolean {
  const now = Date.now();
  const created = new Date(product.createdAt).getTime();
  return now - created < 48 * 60 * 60 * 1000; // 48 hours
}

export function getTotalVisibleStock(
  variants: { name: string; stock: number }[],
): number {
  return variants
    .filter((v) => v.stock > 0)
    .reduce((sum, v) => sum + v.stock, 0);
}

export function getLowStockCount(
  variants: { name: string; stock: number }[],
): number | null {
  const total = getTotalVisibleStock(variants);
  return total > 0 && total <= 3 ? total : null;
}

// ─── Product categorization ───

export function splitProducts(products: ProductForBioLink[]) {
  const featured = products.filter((p) => p.featured);
  const grid = products; // Grid 顯示全部（包括 featured）
  return { featured, grid };
}

// ─── Rarity mapping (for loot card glow) ───

export type Rarity = "common" | "rare" | "hot" | "legendary";

export const rarityConfig: Record<
  Rarity,
  { glow: string; color: string; label: string }
> = {
  common: { glow: "shadow-zinc-400/30", color: "#8a8a8a", label: "COMMON" },
  rare: { glow: "shadow-blue-500/40", color: "#3b82f6", label: "RARE" },
  hot: { glow: "shadow-orange-500/40", color: "#FF9500", label: "HOT" },
  legendary: {
    glow: "shadow-purple-500/40",
    color: "#a855f7",
    label: "LEGENDARY",
  },
};

export function getRarity(product: ProductForBioLink): Rarity | null {
  const badges = Array.isArray(product.badges) ? product.badges : [];
  if (badges.includes("限量")) return "legendary";
  if (badges.includes("熱賣") || badges.includes("快售罄")) return "hot";
  if (badges.includes("減價") || badges.includes("店長推介")) return "rare";
  return null;
}

export function getBadgeText(product: ProductForBioLink): string | null {
  const badges = Array.isArray(product.badges) ? product.badges : [];
  return badges[0] || null;
}

// ─── Avatar ───

export function getAvatarFallback(tenant: { name: string }): string {
  return tenant.name.charAt(0).toUpperCase();
}

// ─── Price formatting ───

const CURRENCIES: Record<string, { symbol: string; code: string }> = {
  HKD: { symbol: "$", code: "HKD" },
  USD: { symbol: "US$", code: "USD" },
  TWD: { symbol: "NT$", code: "TWD" },
  SGD: { symbol: "S$", code: "SGD" },
  MYR: { symbol: "RM", code: "MYR" },
};

export function formatPrice(amount: number, currency: string = "HKD"): string {
  const c = CURRENCIES[currency] || CURRENCIES.HKD;
  return `${c.symbol}${amount.toLocaleString()}`;
}

/** @deprecated Use formatPrice() instead */
export function formatHKD(price: number): string {
  return `$${price.toLocaleString("en-HK")}`;
}

export const DEFAULT_DELIVERY_OPTIONS: DeliveryOption[] = [
  { id: "meetup", label: "面交", price: 0, enabled: true },
  { id: "sf-collect", label: "順豐到付", price: 0, enabled: true },
  { id: "sf-prepaid", label: "順豐寄付", price: 30, enabled: true },
];

export const DEFAULT_ORDER_CONFIRM: OrderConfirmConfig = {
  thanks: "多謝你嘅訂單！",
  whatsappTemplate: "你好！我落咗單 #{orderNumber}",
};
