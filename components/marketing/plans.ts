// Single source of truth for marketing-facing plan display data (landing page
// pricing teaser + the full /pricing page). Both components map over
// MARKETING_PLANS instead of hardcoding plan copy, so price/feature-list
// inconsistencies between the two surfaces can't recur.
//
// Keep in sync with lib/plan.ts (PLAN_LIMITS — entitlements) and
// lib/stripe-subscription.ts (PLAN_PRICES — billing amounts).
//
// Do NOT import lib/plan.ts here: it imports prisma (server-only), while this
// file is consumed by "use client" marketing components.

export type MarketingPlanId = "free" | "lite" | "pro";

export type MarketingPlan = {
  id: MarketingPlanId;
  name: string; // "Free" | "Lite" | "Pro"
  priceHKD: number; // 0 | 78 | 198
  recommended?: boolean; // Lite only
  tagline: { "zh-HK": string; en: string };
  features: { "zh-HK": string[]; en: string[] };
  teaserCount: number; // how many features the landing teaser shows
};

export const MARKETING_PLANS: readonly MarketingPlan[] = [
  {
    id: "free",
    name: "Free",
    priceHKD: 0,
    tagline: { "zh-HK": "零成本試水溫", en: "Zero cost to start" },
    features: {
      "zh-HK": [
        "10 件商品",
        "每月 50 張訂單",
        "全部收款方式（FPS · PayMe · 信用卡）",
        "1 款店鋪主題",
      ],
      en: [
        "10 products",
        "50 orders / mo",
        "All payment methods (FPS · PayMe · card)",
        "1 store theme",
      ],
    },
    teaserCount: 3,
  },
  {
    id: "lite",
    name: "Lite",
    priceHKD: 78,
    recommended: true,
    tagline: { "zh-HK": "認真副業", en: "Serious side hustle" },
    features: {
      "zh-HK": [
        "50 件商品",
        "無限訂單",
        "全部主題",
        "WhatsApp 預填訊息",
        "折扣碼",
        "訂單 CSV 匯出",
        "基本數據分析",
      ],
      en: [
        "50 products",
        "Unlimited orders",
        "All themes",
        "WhatsApp prefill",
        "Discount codes",
        "Order CSV export",
        "Basic analytics",
      ],
    },
    teaserCount: 4,
  },
  {
    id: "pro",
    name: "Pro",
    priceHKD: 198,
    tagline: { "zh-HK": "全職生意", en: "Full-time business" },
    features: {
      "zh-HK": [
        "無限商品",
        "無限訂單",
        "全部主題",
        "進階數據分析 + 熱賣排行",
        "棄單挽回",
        "CRM 客戶庫",
        "優先客服",
        "移除 WoWlix branding",
        "自訂域名（即將推出）",
      ],
      en: [
        "Unlimited products",
        "Unlimited orders",
        "All themes",
        "Advanced analytics + bestsellers",
        "Abandoned cart recovery",
        "CRM customer database",
        "Priority support",
        "Remove WoWlix branding",
        "Custom domain (coming soon)",
      ],
    },
    teaserCount: 4,
  },
];
