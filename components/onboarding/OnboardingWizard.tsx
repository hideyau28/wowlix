"use client";

import { useState, useCallback, useEffect, useRef, type RefObject } from "react";
import { DollarSign, Sparkles, Check, Circle } from "lucide-react";
import StepIndicator from "./StepIndicator";
import { COVER_TEMPLATES } from "@/lib/cover-templates";
import type { Locale } from "@/lib/i18n";

// --- Bilingual labels ---
const t = {
  en: {
    // Step 1: Plan
    choosePlan: "Choose your plan",
    choosePlanSub: "Start free, upgrade anytime",
    freePlan: "Free",
    litePlan: "Lite",
    proPlan: "Pro",
    month: "/mo",
    selectPlan: "Select",
    selected: "Selected",
    mostPopular: "Most popular",
    billingLater: "Set up billing after opening",
    freeForever: "Free forever",
    zeroPlatformFee: "0% platform fee",
    // Step 2: Store Info
    storeInfo: "Store details",
    storeInfoSub: "Tell us about your shop",
    storeSection: "Your Store",
    storeName: "Store Name *",
    storeNamePlaceholder: "",
    storeUrl: "Store URL",
    slugChecking: "Checking...",
    slugAvailable: "Available!",
    slugTaken: "Already taken",
    slugFormatError: "3-30 chars, lowercase letters, numbers & hyphens only",
    nameMinError: "At least 2 characters",
    nameMaxError: "Maximum 50 characters",
    required: "Required",
    accountSection: "Your Account",
    email: "Email *",
    emailPlaceholder: "",
    emailFormatError: "Invalid email format",
    password: "Password *",
    passwordPlaceholder: "At least 8 chars, with a number",
    passwordMinError: "At least 8 chars with 1 number",
    confirmPassword: "Confirm Password *",
    confirmPasswordPlaceholder: "Re-enter your password",
    passwordMismatch: "Passwords do not match",
    // Step 3: WhatsApp
    whatsappTitle: "Your WhatsApp",
    whatsappSub: "Customers will reach you here",
    whatsapp: "WhatsApp Number *",
    whatsappPlaceholder: "e.g. 91234567",
    whatsappHint: "Enter your WhatsApp number",
    whatsappFormatError: "Please enter a valid number",
    // Step 4: Payment methods
    fpsTitle: "Payment Setup",
    fpsSub: "Set up at least one payment method",
    paymentSelectHint: "Select at least one method",
    fpsLabel: "FPS",
    fpsDesc: "Customers transfer via FPS",
    paymeLabel: "PayMe",
    paymeDesc: "Customers scan your PayMe QR",
    alipayLabel: "AlipayHK",
    alipayDesc: "Customers scan your Alipay QR",
    fpsId: "FPS Phone / ID *",
    fpsIdPlaceholder: "e.g. 91234567 or FPS ID",
    fpsIdHint: "Your FPS registered phone or ID",
    fpsUseWhatsapp: "Use my WhatsApp number for FPS",
    fpsUseWhatsappHint: "Auto-filled from previous step",
    fpsUsePhone: "Use a different FPS phone number",
    fpsUseId: "Use FPS ID",
    fpsPhonePlaceholder: "e.g. 91234567",
    fpsIdOnlyPlaceholder: "e.g. FPS123456",
    fpsAccountName: "Account Name (optional)",
    fpsAccountNamePlaceholder: "e.g. Chan Tai Man",
    uploadQr: "Upload QR Code",
    uploadQrHint: "JPG / PNG, max 5MB",
    uploading: "Uploading...",
    uploadSuccess: "Uploaded!",
    uploadError: "Upload failed, please retry",
    paymentAtLeastOne: "Select at least one payment method",
    paymentSetupLater: "You can add more methods later in Settings",
    // Navigation
    next: "Next",
    back: "Back",
    // Step 5: Theme
    pickStyle: "Pick a style",
    pickStyleSub: "You can change this later",
    storeStyle: "Store style",
    taglineOptional: "Tagline (optional)",
    taglinePlaceholder: "e.g. Artisan Oolong Tea Shop",
    taglineSkipHint: "You can skip this",
    createStore: "Create my store",
    creating: "Creating your store...",
    // Step 6: Done
    congrats: "Your store is ready!",
    storeLink: "Your store link:",
    copied: "Copied!",
    copyLink: "Copy",
    openMyStore: "Open my store",
    goToAdmin: "Go to admin dashboard",
    paymentReminder: "Remember to add your payment details in Settings → Payment Methods",
    checklistStoreCreated: "Store created",
    checklistPaymentSet: "Payment methods set up",
    checklistNextProduct: "Next: Upload your first product",
    checklistNextShipping: "Next: Set up delivery methods",
    templateLabel: "Theme:",
    // Google signup
    signUpWithGoogle: "Sign up with Google",
    orDivider: "or",
    googleConnected: "Connected via Google",
    // Errors
    registerError: "Registration failed, please try again",
    haveAccount: "Already have an account?",
    login: "Log in",
    // Billing
    setupBilling: "Set up billing",
    setupBillingDesc: "Activate your {plan} plan ($\u200B{price}/mo) via Stripe",
    setupBillingLater: "Set up later in admin",
    // Upgrade CTA (free users)
    upgradeCta: "Upgrade your plan",
    upgradeCtaDesc: "Unlock more products, orders & features as your store grows",
    liteTag: "Lite — $78/mo",
    proTag: "Pro — $198/mo",
    liteBenefitShort: "50 products, unlimited orders, all payment methods, coupons + WhatsApp",
    proBenefitShort: "Unlimited everything, custom domain (add-on), abandoned cart recovery, CRM + analytics",
    viewPlans: "View plans & upgrade",
  },
  "zh-HK": {
    // Step 1: Plan
    choosePlan: "揀個計劃",
    choosePlanSub: "免費開始，隨時升級",
    freePlan: "Free",
    litePlan: "Lite",
    proPlan: "Pro",
    month: "/月",
    selectPlan: "選擇",
    selected: "已選擇",
    mostPopular: "最受歡迎",
    billingLater: "開店後設定付款",
    freeForever: "永久免費",
    zeroPlatformFee: "0% 平台抽成",
    // Step 2: Store Info
    storeInfo: "店鋪資料",
    storeInfoSub: "設定你嘅小店",
    storeSection: "你嘅店",
    storeName: "店鋪名稱 *",
    storeNamePlaceholder: "",
    storeUrl: "店舖網址",
    slugChecking: "檢查中...",
    slugAvailable: "可以用！",
    slugTaken: "已被使用",
    slugFormatError: "3-30 個字，只可以用細楷英文、數字同連字號",
    nameMinError: "最少 2 個字",
    nameMaxError: "最多 50 個字",
    required: "必填",
    accountSection: "帳戶資料",
    email: "電郵地址 *",
    emailPlaceholder: "",
    emailFormatError: "電郵格式唔啱",
    password: "密碼 *",
    passwordPlaceholder: "最少 8 個字，包含數字",
    passwordMinError: "密碼需要最少 8 個字，包含至少 1 個數字",
    confirmPassword: "確認密碼 *",
    confirmPasswordPlaceholder: "再輸入一次密碼",
    passwordMismatch: "密碼不一致",
    // Step 3: WhatsApp
    whatsappTitle: "你嘅 WhatsApp",
    whatsappSub: "客人會用呢個號碼搵你",
    whatsapp: "WhatsApp 號碼 *",
    whatsappPlaceholder: "例如 91234567",
    whatsappHint: "輸入你嘅 WhatsApp 號碼",
    whatsappFormatError: "請輸入有效號碼",
    // Step 4: Payment methods
    fpsTitle: "收款設定",
    fpsSub: "先設定其中一個收款方式",
    paymentSelectHint: "至少揀一個收款方式",
    fpsLabel: "FPS 轉數快",
    fpsDesc: "客人用 FPS 轉賬",
    paymeLabel: "PayMe",
    paymeDesc: "客人掃你嘅 PayMe QR Code",
    alipayLabel: "AlipayHK",
    alipayDesc: "客人掃你嘅 AlipayHK QR Code",
    fpsId: "FPS 收款電話 / ID *",
    fpsIdPlaceholder: "例如 91234567 或 FPS ID",
    fpsIdHint: "你登記 FPS 嘅電話或 ID",
    fpsUseWhatsapp: "用上一步嘅 WhatsApp 號碼收 FPS",
    fpsUseWhatsappHint: "自動帶入，唔使再輸入",
    fpsUsePhone: "另輸入 FPS 收款電話號碼",
    fpsUseId: "輸入 FPS ID",
    fpsPhonePlaceholder: "例如 91234567",
    fpsIdOnlyPlaceholder: "例如 FPS123456",
    fpsAccountName: "收款人名稱（選填）",
    fpsAccountNamePlaceholder: "例如：陳大文",
    uploadQr: "上傳 QR Code",
    uploadQrHint: "JPG / PNG，最大 5MB",
    uploading: "上傳中...",
    uploadSuccess: "已上傳！",
    uploadError: "上傳失敗，請重試",
    paymentAtLeastOne: "至少揀一個收款方式",
    paymentSetupLater: "之後可以喺「設定」加更多收款方式",
    // Navigation
    next: "下一步",
    back: "返回",
    // Step 5: Theme
    pickStyle: "揀個風格",
    pickStyleSub: "之後可以隨時改",
    storeStyle: "店舖風格",
    taglineOptional: "簡介（選填）",
    taglinePlaceholder: "例如：手工烏龍茶專門店",
    taglineSkipHint: "可以跳過",
    createStore: "開店",
    creating: "建立緊你嘅小店...",
    // Step 6: Done
    congrats: "你嘅店已準備好！",
    storeLink: "你嘅店舖連結：",
    copied: "已複製！",
    copyLink: "複製",
    openMyStore: "開啟我的店",
    goToAdmin: "去管理後台",
    paymentReminder: "記得去「設定 → 收款方式」加入你嘅收款資料",
    checklistStoreCreated: "店舖已建立",
    checklistPaymentSet: "收款方式已設定",
    checklistNextProduct: "下一步：上傳第一件商品",
    checklistNextShipping: "下一步：設定送貨方式",
    templateLabel: "風格：",
    // Google signup
    signUpWithGoogle: "以 Google 註冊",
    orDivider: "或",
    googleConnected: "已透過 Google 連結",
    // Errors
    registerError: "註冊失敗，請再試",
    haveAccount: "已有帳號？",
    login: "登入",
    // Billing
    setupBilling: "設定付款",
    setupBillingDesc: "透過 Stripe 啟用你嘅 {plan} 方案（${price}/月）",
    setupBillingLater: "之後喺後台設定",
    // Upgrade CTA (free users)
    upgradeCta: "升級你嘅方案",
    upgradeCtaDesc: "解鎖更多產品、訂單同進階功能",
    liteTag: "Lite — $78/月",
    proTag: "Pro — $198/月",
    liteBenefitShort: "50 件產品、無限訂單、全部收款方式、優惠碼 + WhatsApp",
    proBenefitShort: "無限全部、自訂域名（加購）、棄單挽回、CRM + 數據分析",
    viewPlans: "睇方案 & 升級",
  },
} as const;

// --- Plan data ---
function getOnboardingPlans(isZh: boolean) {
  return [
    {
      id: "free",
      name: "Free",
      price: 0,
      features: isZh
        ? ["10 件商品", "每月 50 單", "全部收款方式", "1 款店鋪主題"]
        : ["10 products", "50 orders/mo", "All payment methods", "1 store theme"],
      badge: null,
      footnote: isZh ? "永久免費" : "Free forever",
    },
    {
      id: "lite",
      name: "Lite",
      price: 78,
      features: isZh
        ? ["50 件商品", "無限訂單", "全部收款方式", "全部主題", "優惠碼 + WhatsApp"]
        : ["50 products", "Unlimited orders", "All payment methods", "All themes", "Coupons + WhatsApp"],
      badge: isZh ? "最受歡迎" : "Most popular",
      footnote: isZh ? "開店後設定付款" : "Set up billing after opening",
    },
    {
      id: "pro",
      name: "Pro",
      price: 198,
      features: isZh
        ? ["無限商品/訂單", "自訂域名（加購・即將推出）", "棄單挽回", "熱賣排行", "CRM + 數據分析", "移除 branding"]
        : ["Unlimited everything", "Custom domain (add-on, coming soon)", "Abandoned cart recovery", "Bestseller ranking", "CRM + Analytics", "Remove branding"],
      badge: null,
      footnote: isZh ? "開店後設定付款" : "Set up billing after opening",
    },
  ];
}

// --- Validation patterns ---
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*\d).{8,}$/;

// Strip leading dial code digits from a phone number (e.g. "+852","85297363147" → "97363147")
const stripDialCode = (phone: string, dialCode: string): string => {
  const digits = dialCode.replace("+", "");
  return digits && phone.startsWith(digits) ? phone.slice(digits.length) : phone;
};

// --- WhatsApp dial codes ---
const DIAL_CODES = [
  { code: "+852", label: "+852 香港" },
  { code: "+86", label: "+86 中國" },
  { code: "+886", label: "+886 台灣" },
  { code: "+853", label: "+853 澳門" },
  { code: "+65", label: "+65 新加坡" },
  { code: "+60", label: "+60 馬來西亞" },
  { code: "other", label: "其他 / Other" },
];

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

interface OnboardingData {
  plan: string;
  shopName: string;
  slug: string;
  slugManuallyEdited: boolean;
  email: string;
  password: string;
  confirmPassword: string;
  whatsapp: string;
  whatsappDialCode: string;
  whatsappCustomDialCode: string;
  selectedPayments: string[]; // "fps" | "payme" | "alipay_hk"
  fpsId: string;
  fpsAccountName: string;
  paymeQrUrl: string;
  alipayQrUrl: string;
  templateId: string;
  tagline: string;
}

interface OnboardingWizardProps {
  locale: Locale;
  initialGoogleEmail?: string | null;
}

const STORAGE_KEY = "onboarding-wizard-state";
const TOTAL_STEPS = 6;

/* ─── Payment method toggle card ─── */
function PaymentMethodCard({
  id,
  label,
  desc,
  selected,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  desc: string;
  selected: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border-2 p-4 transition-all duration-200 ${
        selected
          ? "border-wlx-ink ring-2 ring-wlx-ink/15 bg-wlx-cream"
          : "border-wlx-mist bg-wlx-paper hover:border-wlx-stone/50"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 text-left"
      >
        {/* Checkbox */}
        <div
          className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            selected ? "border-wlx-ink bg-wlx-ink" : "border-wlx-mist"
          }`}
        >
          {selected && (
            <svg className="w-3 h-3 text-wlx-paper" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-wlx-ink text-sm">{label}</p>
          <p className="text-xs text-wlx-stone">{desc}</p>
        </div>
      </button>
      {children}
    </div>
  );
}

/* ─── QR code uploader (PayMe / AlipayHK) ─── */
function QrUploader({
  currentUrl,
  onUploaded,
  labels,
}: {
  currentUrl: string;
  onUploaded: (url: string) => void;
  labels: { uploadQr: string; uploadQrHint: string; uploading: string; uploadSuccess: string; uploadError: string };
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "payments/qr");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (json.ok && json.data?.url) {
        onUploaded(json.data.url);
      } else {
        setError(json.error?.message || labels.uploadError);
      }
    } catch {
      setError(labels.uploadError);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {currentUrl ? (
        <div className="flex items-center gap-3">
          <img
            src={currentUrl}
            alt="QR Code"
            className="w-16 h-16 rounded-lg border border-wlx-mist object-cover"
          />
          <div className="flex-1">
            <p className="text-xs text-wlx-ink font-medium">&#10003; {labels.uploadSuccess}</p>
            <label className="text-xs text-wlx-ink font-medium cursor-pointer hover:underline">
              {labels.uploadQr}
              <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </label>
          </div>
        </div>
      ) : (
        <label
          className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed py-4 cursor-pointer transition-colors ${
            uploading ? "border-wlx-mist bg-wlx-cream" : "border-wlx-mist hover:border-wlx-ink hover:bg-wlx-cream"
          }`}
        >
          {uploading ? (
            <span className="text-sm text-wlx-stone animate-pulse">{labels.uploading}</span>
          ) : (
            <>
              <svg className="w-6 h-6 text-wlx-stone" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-wlx-stone">{labels.uploadQr}</span>
              <span className="text-xs text-wlx-stone">{labels.uploadQrHint}</span>
            </>
          )}
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={uploading} />
        </label>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

export default function OnboardingWizard({ locale, initialGoogleEmail }: OnboardingWizardProps) {
  const labels = locale === "zh-HK" ? t["zh-HK"] : t.en;
  const isZh = locale === "zh-HK";
  const plans = getOnboardingPlans(isZh);

  const [step, setStep] = useState<OnboardingStep>(1);
  const [direction, setDirection] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    plan: "free",
    shopName: "",
    slug: "",
    slugManuallyEdited: false,
    email: "",
    password: "",
    confirmPassword: "",
    whatsapp: "",
    whatsappDialCode: "+852",
    whatsappCustomDialCode: "",
    selectedPayments: [],
    fpsId: "",
    fpsAccountName: "",
    paymeQrUrl: "",
    alipayQrUrl: "",
    templateId: "mochi",
    tagline: "",
  });
  const [fpsMode, setFpsMode] = useState<"whatsapp" | "phone" | "id">("whatsapp");
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [slugReason, setSlugReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdSlug, setCreatedSlug] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [billingRedirecting, setBillingRedirecting] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Restore form data from sessionStorage on mount ---
  // Always start from step 1 (plan selection); only restore form data
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.data) setData((prev) => ({ ...prev, ...parsed.data }));
      }
    } catch (error) {
      console.error("Failed to restore onboarding state:", error);
    }

    // Check if returning from Google OAuth with email.
    // Email is passed as a server-side prop (read from httpOnly cookie) to
    // avoid exposing it in the redirect URL.
    if (initialGoogleEmail) {
      setGoogleEmail(initialGoogleEmail);
      setData((prev) => ({ ...prev, email: initialGoogleEmail }));
      setStep(2);
    }
  }, [initialGoogleEmail]);

  // --- Save state to sessionStorage whenever it changes ---
  // 唔存密碼落 sessionStorage，避免明文洩露
  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, confirmPassword, ...safeData } = data;
      const state = { step, data: safeData };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to save onboarding state:", error);
    }
  }, [step, data]);

  // --- Slug availability check ---
  const checkSlug = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!value || value.length < 3) {
        setSlugStatus("idle");
        setSlugReason("");
        return;
      }

      if (!SLUG_REGEX.test(value)) {
        setSlugStatus("invalid");
        setSlugReason(labels.slugFormatError);
        return;
      }

      setSlugStatus("checking");
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/tenant/check-slug?slug=${encodeURIComponent(value)}`
          );
          const json = await res.json();

          if (!res.ok || !json.ok) {
            setSlugStatus("idle");
            setSlugReason("");
            return;
          }

          if (json.data?.available) {
            setSlugStatus("available");
            setSlugReason("");
          } else {
            setSlugStatus("taken");
            setSlugReason(json.data?.reason || labels.slugTaken);
          }
        } catch {
          setSlugStatus("idle");
        }
      }, 400);
    },
    [labels.slugFormatError, labels.slugTaken]
  );

  useEffect(() => {
    if (step === 2) checkSlug(data.slug);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [data.slug, checkSlug, step]);

  // --- Field update helper ---
  const update = <K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K]
  ) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleNameChange = (value: string) => {
    update("shopName", value);
    if (!data.slugManuallyEdited) {
      update("slug", nameToSlug(value));
    }
  };

  const handleSlugChange = (raw: string) => {
    const v = raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setData((prev) => ({ ...prev, slug: v, slugManuallyEdited: true }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.slug;
      return next;
    });
  };

  // --- Step navigation ---
  const goNext = () => {
    setDirection(1);
    setGlobalError("");
    setErrors({});
    setStep((s) => Math.min(s + 1, TOTAL_STEPS) as OnboardingStep);
  };

  const goBack = () => {
    setDirection(-1);
    setGlobalError("");
    setErrors({});
    setStep((s) => Math.max(s - 1, 1) as OnboardingStep);
  };

  // --- Validation per step ---
  // Step 2 input refs — validation fail 時 focus 返第一個錯誤欄位
  const shopNameRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const step2Refs: Record<string, RefObject<HTMLInputElement | null>> = {
    shopName: shopNameRef,
    slug: slugRef,
    email: emailRef,
    password: passwordRef,
    confirmPassword: confirmPasswordRef,
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};
    const name = data.shopName.trim();
    if (!name) newErrors.shopName = labels.required;
    else if (name.length < 2) newErrors.shopName = labels.nameMinError;
    else if (name.length > 50) newErrors.shopName = labels.nameMaxError;

    if (!data.slug.trim()) newErrors.slug = labels.required;
    else if (!SLUG_REGEX.test(data.slug))
      newErrors.slug = labels.slugFormatError;

    if (slugStatus === "taken" || slugStatus === "invalid") {
      newErrors.slug = slugReason || labels.slugFormatError;
    }

    if (!data.email.trim()) newErrors.email = labels.required;
    else if (!EMAIL_REGEX.test(data.email.trim()))
      newErrors.email = labels.emailFormatError;

    // Skip password validation if signed up with Google
    if (!googleEmail) {
      if (!data.password) newErrors.password = labels.required;
      else if (!PASSWORD_REGEX.test(data.password))
        newErrors.password = labels.passwordMinError;

      if (!data.confirmPassword) newErrors.confirmPassword = labels.required;
      else if (data.password !== data.confirmPassword)
        newErrors.confirmPassword = labels.passwordMismatch;
    }

    setErrors(newErrors);
    // Focus 第一個錯誤欄位（screen reader 會即時讀出 aria-describedby 嘅錯誤）
    const firstError = ["shopName", "slug", "email", "password", "confirmPassword"]
      .find((k) => newErrors[k]);
    if (firstError) step2Refs[firstError]?.current?.focus();
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const newErrors: Record<string, string> = {};
    const wa = data.whatsapp.trim();
    if (!wa) {
      newErrors.whatsapp = labels.required;
    } else if (data.whatsappDialCode === "+852" && (wa.length < 6 || wa.length > 11)) {
      newErrors.whatsapp = labels.whatsappFormatError;
    } else if (data.whatsappDialCode !== "+852" && (wa.length < 6 || wa.length > 15)) {
      newErrors.whatsapp = labels.whatsappFormatError;
    }
    if (data.whatsappDialCode === "other") {
      const custom = data.whatsappCustomDialCode.trim();
      if (!custom) {
        newErrors.whatsappCustomDialCode = labels.required;
      } else if (!/^\+\d{1,4}$/.test(custom)) {
        newErrors.whatsappCustomDialCode = isZh ? "格式：+ 加 1-4 位數字" : "Format: + followed by 1-4 digits";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep4 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (data.selectedPayments.length === 0) {
      newErrors.selectedPayments = labels.paymentAtLeastOne;
    }
    if (data.selectedPayments.includes("fps") && fpsMode !== "whatsapp" && !data.fpsId.trim()) {
      newErrors.fpsId = labels.required;
    }
    if (data.selectedPayments.includes("payme") && !data.paymeQrUrl) {
      newErrors.paymeQr = labels.required;
    }
    if (data.selectedPayments.includes("alipay_hk") && !data.alipayQrUrl) {
      newErrors.alipayQr = labels.required;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 2 && !validateStep2()) return;
    if (step === 2 && slugStatus === "checking") return;
    if (step === 3 && !validateStep3()) return;
    if (step === 4 && !validateStep4()) return;
    if (step === 5) {
      handleRegister();
      return;
    }
    goNext();
  };

  // --- Submit registration at end of Step 5 ---
  const handleRegister = async () => {
    if (!validateStep2()) {
      setDirection(-1);
      setStep(2);
      return;
    }
    setErrors({});
    if (!validateStep3()) {
      setDirection(-1);
      setStep(3);
      return;
    }
    if (!validateStep4()) {
      setDirection(-1);
      setStep(4);
      return;
    }

    setSubmitting(true);
    setGlobalError("");

    try {
      const res = await fetch("/api/tenant/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.shopName.trim(),
          slug: data.slug.trim().toLowerCase(),
          email: data.email.trim().toLowerCase(),
          password: googleEmail ? undefined : data.password,
          googleAuth: !!googleEmail,
          whatsapp: `${effectiveDialCode}${data.whatsapp.trim()}`,
          paymentMethods: data.selectedPayments,
          fpsId: data.selectedPayments.includes("fps")
            ? (fpsMode === "whatsapp" ? stripDialCode(data.whatsapp.trim(), effectiveDialCode) : data.fpsId.trim())
            : undefined,
          fpsAccountName: data.selectedPayments.includes("fps") ? (data.fpsAccountName.trim() || undefined) : undefined,
          paymeQrUrl: data.selectedPayments.includes("payme") ? data.paymeQrUrl : undefined,
          alipayQrUrl: data.selectedPayments.includes("alipay_hk") ? data.alipayQrUrl : undefined,
          templateId: data.templateId,
          tagline: data.tagline.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        const msg =
          json.error?.message || json.error || labels.registerError;
        if (msg.includes("email") || msg.includes("電郵")) {
          setErrors((prev) => ({ ...prev, email: msg }));
          setDirection(-1);
          setStep(2);
        } else if (
          msg.includes("slug") ||
          msg.includes("Slug") ||
          msg.includes("名")
        ) {
          setErrors((prev) => ({ ...prev, slug: msg }));
          setDirection(-1);
          setStep(2);
        } else {
          setGlobalError(msg);
        }
        setSubmitting(false);
        return;
      }

      // Success → show step 6 (Done)
      setCreatedSlug(json.data?.slug || data.slug);
      setSubmitting(false);
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error("Failed to clear onboarding state:", error);
      }
      goNext();
    } catch {
      setGlobalError(labels.registerError);
      setSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    const link = `https://wowlix.com/${createdSlug}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleLoginClick = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear onboarding state:", error);
    }
  };

  const handleSetupBilling = async () => {
    if (data.plan !== "lite" && data.plan !== "pro") return;
    setBillingRedirecting(true);
    try {
      const origin = window.location.origin;
      const res = await fetch("/api/admin/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: data.plan,
          successUrl: `${origin}/${locale}/admin/billing?session_id={CHECKOUT_SESSION_ID}&success=1`,
          cancelUrl: `${origin}/${locale}/admin/billing?cancelled=1`,
        }),
      });
      const json = await res.json();
      if (json.ok && json.data?.url) {
        window.location.href = json.data.url;
        return;
      }
    } catch {
      // Fallback to billing page
    }
    setBillingRedirecting(false);
    window.location.href = `/${locale}/admin/billing`;
  };

  // 計算實際區號（處理 "other" 情況）
  const effectiveDialCode =
    data.whatsappDialCode === "other"
      ? data.whatsappCustomDialCode.trim()
      : data.whatsappDialCode;

  const inputClass = (field: string) =>
    `w-full px-3 py-2.5 rounded-xl border text-[16px] ${
      errors[field] ? "border-red-400" : "border-wlx-mist"
    } focus:outline-none focus:ring-2 focus:ring-wlx-ink/20 focus:border-wlx-ink text-wlx-ink placeholder:text-wlx-stone`;

  // a11y helpers — 錯誤時 aria-invalid + 指向對應 error message
  const inputA11y = (field: string) => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `ob-${field}-err` : undefined,
  });

  const selectedTemplate = COVER_TEMPLATES.find(
    (tmpl) => tmpl.id === data.templateId
  );

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Global error */}
      {globalError && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {globalError}
        </div>
      )}

      {/* Step content — marketing double-bezel card（同 landing bento / pricing 卡同一個 recipe） */}
      <div className="rounded-[26px] bg-wlx-mist/40 p-[5px] shadow-[0_30px_60px_-30px_rgba(26,24,21,0.32)]">
      <div className="bg-wlx-paper rounded-[21px] border border-wlx-mist shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] p-6 relative">
        <div key={step}>
            {/* ======== STEP 1: Choose Plan ======== */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="text-center">
                  <h1 className="font-wlx-display text-2xl tracking-tight text-wlx-ink">
                    {labels.choosePlan}
                  </h1>
                  <p className="text-wlx-stone text-sm mt-1">
                    {labels.choosePlanSub}
                  </p>
                </div>

                {/* Plan cards */}
                <div className="space-y-3">
                  {plans.map((plan) => {
                    const isSelected = data.plan === plan.id;
                    const isDark = plan.id === "pro";
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => update("plan", plan.id)}
                        className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-200 relative overflow-hidden ${
                          isDark
                            ? "bg-wlx-ink"
                            : plan.id === "lite"
                            ? "bg-wlx-cream"
                            : "bg-wlx-paper"
                        } ${
                          // 深色卡選中態一定要反白 — ink ring 喺 ink 底上係隱形（DESIGN.md §2）
                          isSelected
                            ? isDark
                              ? "border-wlx-paper ring-2 ring-wlx-paper/25"
                              : "border-wlx-ink ring-2 ring-wlx-ink/15"
                            : isDark
                            ? "border-wlx-paper/15"
                            : "border-wlx-mist hover:border-wlx-stone/50"
                        }`}
                      >
                        {/* Badge */}
                        {plan.badge && (
                          <span className="absolute top-3 right-3 bg-wlx-ink text-wlx-paper text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {plan.badge}
                          </span>
                        )}

                        <div className="flex items-start gap-3">
                          {/* Radio indicator */}
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                              isSelected
                                ? isDark
                                  ? "border-wlx-paper bg-wlx-paper"
                                  : "border-wlx-ink bg-wlx-ink"
                                : isDark
                                ? "border-wlx-paper/40"
                                : "border-wlx-mist"
                            }`}
                          >
                            {isSelected && (
                              <svg className={`w-3 h-3 ${isDark ? "text-wlx-ink" : "text-wlx-paper"}`} fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span
                                className={`font-bold text-base ${
                                  isDark ? "text-wlx-paper" : "text-wlx-ink"
                                }`}
                              >
                                {plan.name}
                              </span>
                              <span className={`text-lg font-extrabold ${isDark ? "text-wlx-paper" : "text-wlx-ink"}`}>
                                ${plan.price}
                              </span>
                              <span className={`text-sm ${isDark ? "text-wlx-paper/60" : "text-wlx-stone"}`}>
                                {labels.month}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                              {plan.features.map((f, i) => (
                                <span
                                  key={i}
                                  className={`text-xs ${isDark ? "text-wlx-paper/60" : "text-wlx-stone"}`}
                                >
                                  {/* ✓ 喺深色卡要反白 — text-wlx-ink 落 bg-wlx-ink 係隱形（§2） */}
                                  <span className={`mr-0.5 ${isDark ? "text-wlx-paper" : "text-wlx-ink"}`}>&#10003;</span> {f}
                                </span>
                              ))}
                            </div>
                            <p className={`text-[10px] mt-1.5 ${isDark ? "text-wlx-paper/60" : "text-wlx-stone"}`}>
                              {plan.footnote}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 0% platform fee badge */}
                <p className="text-center text-xs text-wlx-stone">
                  {labels.zeroPlatformFee}
                </p>

                {/* Next button */}
                <button
                  onClick={goNext}
                  className="w-full py-3 rounded-full bg-wlx-ink text-wlx-paper font-semibold text-base hover:bg-wlx-ink/90 transition-colors min-h-[48px]"
                >
                  {labels.next} &rarr;
                </button>

                {/* Login link */}
                <p className="text-center text-sm text-wlx-stone">
                  {labels.haveAccount}{" "}
                  <a
                    href={`/${locale}/admin/login`}
                    onClick={handleLoginClick}
                    className="text-wlx-ink font-medium hover:underline"
                  >
                    {labels.login}
                  </a>
                </p>
              </div>
            )}

            {/* ======== STEP 2: Store Info + Account ======== */}
            {step === 2 && (
              <form
                className="space-y-4"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  handleNext();
                }}
              >
                <div className="text-center">
                  <h2 className="font-wlx-display text-2xl tracking-tight text-wlx-ink">
                    {labels.storeInfo}
                  </h2>
                </div>

                {/* Store section */}
                <div className="space-y-3">
                  {/* Store name */}
                  <div>
                    <label htmlFor="ob-shopName" className="block text-sm font-medium text-wlx-stone mb-1">
                      {labels.storeName}
                    </label>
                    <input
                      id="ob-shopName"
                      name="organization"
                      autoComplete="organization"
                      ref={shopNameRef}
                      type="text"
                      value={data.shopName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder={labels.storeNamePlaceholder}
                      maxLength={50}
                      className={inputClass("shopName")}
                      {...inputA11y("shopName")}
                    />
                    {errors.shopName && (
                      <p id="ob-shopName-err" role="alert" className="text-red-500 text-xs mt-1">{errors.shopName}</p>
                    )}
                  </div>

                  {/* Slug */}
                  <div>
                    <label htmlFor="ob-slug" className="block text-sm font-medium text-wlx-stone mb-1">
                      {labels.storeUrl}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-wlx-stone text-sm select-none">
                        wowlix.com/
                      </span>
                      <input
                        id="ob-slug"
                        name="slug"
                        autoComplete="off"
                        ref={slugRef}
                        type="text"
                        value={data.slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        className={`w-full pl-[100px] pr-9 py-2.5 rounded-xl border text-[16px] ${
                          errors.slug ? "border-red-400" : "border-wlx-mist"
                        } focus:outline-none focus:ring-2 focus:ring-wlx-ink/20 focus:border-wlx-ink text-wlx-ink`}
                        maxLength={30}
                        aria-invalid={
                          errors.slug || slugStatus === "taken" || slugStatus === "invalid"
                            ? true
                            : undefined
                        }
                        aria-describedby={
                          errors.slug || slugStatus === "taken" || slugStatus === "invalid"
                            ? "ob-slug-err"
                            : undefined
                        }
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                        {slugStatus === "checking" && (
                          <span className="text-wlx-stone animate-pulse">...</span>
                        )}
                        {slugStatus === "available" && (
                          <span className="text-wlx-ink">&#10003;</span>
                        )}
                        {(slugStatus === "taken" || slugStatus === "invalid") && (
                          <span className="text-red-500">&#10007;</span>
                        )}
                      </span>
                    </div>
                    {slugStatus === "available" && (
                      <p className="text-wlx-ink text-xs mt-1">&#10003; {labels.slugAvailable}</p>
                    )}
                    {slugStatus === "checking" && (
                      <p className="text-wlx-stone text-xs mt-1">{labels.slugChecking}</p>
                    )}
                    {(slugStatus === "taken" || slugStatus === "invalid") && slugReason && (
                      <p id="ob-slug-err" role="alert" className="text-red-500 text-xs mt-1">{slugReason}</p>
                    )}
                    {errors.slug && slugStatus !== "taken" && slugStatus !== "invalid" && (
                      <p id="ob-slug-err" role="alert" className="text-red-500 text-xs mt-1">{errors.slug}</p>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-wlx-mist" />

                {/* Account section */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-wlx-stone uppercase tracking-wider">
                    {labels.accountSection}
                  </p>

                  {/* Google signup button */}
                  {!googleEmail && (
                    <>
                      <a
                        href={`/api/tenant-admin/google?onboarding=true&locale=${locale}`}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-wlx-mist bg-wlx-paper px-4 py-2.5 text-sm font-medium text-wlx-stone hover:bg-wlx-cream transition-colors min-h-[44px]"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        {labels.signUpWithGoogle}
                      </a>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 border-t border-wlx-mist" />
                        <span className="text-xs text-wlx-stone">{labels.orDivider}</span>
                        <div className="flex-1 border-t border-wlx-mist" />
                      </div>
                    </>
                  )}

                  {/* Google connected indicator */}
                  {googleEmail && (
                    <div className="flex items-center gap-2 rounded-xl border border-wlx-mist bg-wlx-cream px-3 py-2 text-sm text-wlx-ink">
                      <svg width="16" height="16" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <span>{labels.googleConnected} ({googleEmail})</span>
                    </div>
                  )}

                  {/* Email */}
                  <div>
                    <label htmlFor="ob-email" className="block text-sm font-medium text-wlx-stone mb-1">
                      {labels.email}
                    </label>
                    <input
                      id="ob-email"
                      name="email"
                      autoComplete="email"
                      ref={emailRef}
                      type="email"
                      value={data.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder={labels.emailPlaceholder}
                      readOnly={!!googleEmail}
                      className={`${inputClass("email")} ${googleEmail ? "bg-wlx-cream text-wlx-stone" : ""}`}
                      {...inputA11y("email")}
                    />
                    {errors.email && (
                      <p id="ob-email-err" role="alert" className="text-red-500 text-xs mt-1">{errors.email}</p>
                    )}
                  </div>

                  {/* Password — hidden when using Google */}
                  {!googleEmail && (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="ob-password" className="block text-sm font-medium text-wlx-stone mb-1">
                        {labels.password}
                      </label>
                      <input
                        id="ob-password"
                        name="password"
                        ref={passwordRef}
                        type="password"
                        value={data.password}
                        onChange={(e) => update("password", e.target.value)}
                        placeholder={labels.passwordPlaceholder}
                        autoComplete="new-password"
                        className={inputClass("password")}
                        {...inputA11y("password")}
                      />
                      {errors.password && (
                        <p id="ob-password-err" role="alert" className="text-red-500 text-xs mt-1">{errors.password}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="ob-confirmPassword" className="block text-sm font-medium text-wlx-stone mb-1">
                        {labels.confirmPassword}
                      </label>
                      <input
                        id="ob-confirmPassword"
                        name="confirm-password"
                        ref={confirmPasswordRef}
                        type="password"
                        value={data.confirmPassword}
                        onChange={(e) => update("confirmPassword", e.target.value)}
                        placeholder={labels.confirmPasswordPlaceholder}
                        autoComplete="new-password"
                        className={inputClass("confirmPassword")}
                        {...inputA11y("confirmPassword")}
                      />
                      {errors.confirmPassword && (
                        <p id="ob-confirmPassword-err" role="alert" className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
                      )}
                    </div>
                  </div>
                  )}
                </div>

                {/* Nav buttons */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={goBack}
                    type="button"
                    className="flex-1 py-3 rounded-full border border-wlx-mist text-wlx-stone font-semibold text-base hover:bg-wlx-cream transition-colors min-h-[48px]"
                  >
                    &larr; {labels.back}
                  </button>
                  <button
                    type="submit"
                    disabled={slugStatus === "checking"}
                    className="flex-1 py-3 rounded-full bg-wlx-ink text-wlx-paper font-semibold text-base hover:bg-wlx-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
                  >
                    {labels.next} &rarr;
                  </button>
                </div>
              </form>
            )}

            {/* ======== STEP 3: WhatsApp ======== */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-wlx-ink text-wlx-paper text-2xl mb-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 21.785c-1.726 0-3.42-.464-4.9-1.342l-.352-.209-3.65.957.974-3.558-.23-.365a9.687 9.687 0 01-1.487-5.17c.002-5.36 4.365-9.72 9.731-9.72a9.67 9.67 0 016.882 2.852 9.67 9.67 0 012.85 6.874c-.003 5.36-4.366 9.72-9.731 9.72h-.004zm8.284-17.99A11.616 11.616 0 0012.05.42C5.495.42.16 5.753.157 12.098a11.63 11.63 0 001.555 5.828L0 24l6.258-1.64a11.67 11.67 0 005.788 1.527h.005c6.554 0 11.89-5.334 11.893-11.9a11.82 11.82 0 00-3.48-8.413z"/></svg>
                  </div>
                  <h2 className="font-wlx-display text-2xl tracking-tight text-wlx-ink">
                    {labels.whatsappTitle}
                  </h2>
                  <p className="text-wlx-stone text-sm mt-1">
                    {labels.whatsappSub}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-wlx-stone mb-1">
                    {labels.whatsapp}
                  </label>
                  <div className="flex">
                    <select
                      value={data.whatsappDialCode}
                      onChange={(e) => {
                        update("whatsappDialCode", e.target.value);
                        if (e.target.value !== "other") update("whatsappCustomDialCode", "");
                      }}
                      className="rounded-l-xl border border-r-0 border-wlx-mist bg-wlx-cream px-2 py-3 text-sm text-wlx-stone focus:outline-none focus:ring-2 focus:ring-wlx-ink/20 min-w-[110px]"
                    >
                      {DIAL_CODES.map((d) => (
                        <option key={d.code} value={d.code}>{d.label}</option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={data.whatsapp}
                      onChange={(e) =>
                        update("whatsapp", e.target.value.replace(/\D/g, ""))
                      }
                      placeholder={labels.whatsappPlaceholder}
                      className={`flex-1 rounded-r-xl border border-wlx-mist px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-wlx-ink/20 ${errors.whatsapp ? "border-red-400" : ""}`}
                      autoFocus
                    />
                  </div>
                  {/* Custom dial code input when "Other" is selected */}
                  {data.whatsappDialCode === "other" && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={data.whatsappCustomDialCode}
                        onChange={(e) => {
                          // 只接受 + 開頭 + 最多 4 位數字
                          const raw = e.target.value;
                          const cleaned = raw.startsWith("+")
                            ? "+" + raw.slice(1).replace(/\D/g, "").slice(0, 4)
                            : raw.replace(/\D/g, "").slice(0, 4)
                              ? "+" + raw.replace(/\D/g, "").slice(0, 4)
                              : raw === "+" ? "+" : "";
                          update("whatsappCustomDialCode", cleaned);
                        }}
                        placeholder={isZh ? "例如 +44" : "e.g. +44"}
                        className={`w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-wlx-ink/20 focus:border-wlx-ink ${
                          errors.whatsappCustomDialCode ? "border-red-400" : "border-wlx-mist"
                        }`}
                      />
                      {errors.whatsappCustomDialCode && (
                        <p className="text-red-500 text-xs mt-1">{errors.whatsappCustomDialCode}</p>
                      )}
                    </div>
                  )}
                  {errors.whatsapp ? (
                    <p className="text-red-500 text-xs mt-1">{errors.whatsapp}</p>
                  ) : (
                    <p className="text-wlx-stone text-xs mt-1">{labels.whatsappHint}</p>
                  )}
                </div>

                {/* Nav buttons */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={goBack}
                    type="button"
                    className="flex-1 py-3 rounded-full border border-wlx-mist text-wlx-stone font-semibold text-base hover:bg-wlx-cream transition-colors min-h-[48px]"
                  >
                    &larr; {labels.back}
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-1 py-3 rounded-full bg-wlx-ink text-wlx-paper font-semibold text-base hover:bg-wlx-ink/90 transition-colors min-h-[48px]"
                  >
                    {labels.next} &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* ======== STEP 4: Payment Methods ======== */}
            {step === 4 && (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-wlx-ink mb-3">
                    <DollarSign className="w-6 h-6 text-wlx-paper" strokeWidth={2.5} />
                  </div>
                  <h2 className="font-wlx-display text-2xl tracking-tight text-wlx-ink">
                    {labels.fpsTitle}
                  </h2>
                  <p className="text-wlx-stone text-sm mt-1">
                    {labels.fpsSub}
                  </p>
                </div>

                {errors.selectedPayments && (
                  <p className="text-red-500 text-sm text-center">{errors.selectedPayments}</p>
                )}

                {/* Payment method cards */}
                <div className="space-y-3">
                  {/* FPS */}
                  <PaymentMethodCard
                    id="fps"
                    label={labels.fpsLabel}
                    desc={labels.fpsDesc}
                    selected={data.selectedPayments.includes("fps")}
                    onToggle={() => {
                      const sel = data.selectedPayments.includes("fps")
                        ? data.selectedPayments.filter((m) => m !== "fps")
                        : [...data.selectedPayments, "fps"];
                      update("selectedPayments", sel);
                    }}
                  >
                    {data.selectedPayments.includes("fps") && (
                      <div className="space-y-3 mt-3 pt-3 border-t border-wlx-mist">
                        {/* Radio option 1: use WhatsApp number */}
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="radio"
                            name="fpsMode"
                            value="whatsapp"
                            checked={fpsMode === "whatsapp"}
                            onChange={() => { setFpsMode("whatsapp"); update("fpsId", ""); }}
                            className="mt-0.5 accent-wlx-ink"
                          />
                          <div>
                            <p className="text-sm font-medium text-wlx-ink">{labels.fpsUseWhatsapp}</p>
                            {fpsMode === "whatsapp" && data.whatsapp && (
                              <p className="text-xs text-wlx-stone mt-0.5">
                                {labels.fpsUseWhatsappHint}
                                {" · "}
                                <span className="font-mono text-wlx-stone">{stripDialCode(data.whatsapp, effectiveDialCode)}</span>
                              </p>
                            )}
                          </div>
                        </label>

                        {/* Radio option 2: different phone number */}
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="radio"
                            name="fpsMode"
                            value="phone"
                            checked={fpsMode === "phone"}
                            onChange={() => { setFpsMode("phone"); update("fpsId", ""); }}
                            className="mt-0.5 accent-wlx-ink"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-wlx-ink">{labels.fpsUsePhone}</p>
                            {fpsMode === "phone" && (
                              <input
                                type="tel"
                                value={data.fpsId}
                                onChange={(e) => update("fpsId", e.target.value.replace(/\D/g, "").slice(0, 8))}
                                placeholder={labels.fpsPhonePlaceholder}
                                maxLength={8}
                                className={`mt-2 ${inputClass("fpsId")}`}
                                autoFocus
                              />
                            )}
                          </div>
                        </label>

                        {/* Radio option 3: FPS ID */}
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="radio"
                            name="fpsMode"
                            value="id"
                            checked={fpsMode === "id"}
                            onChange={() => { setFpsMode("id"); update("fpsId", ""); }}
                            className="mt-0.5 accent-wlx-ink"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-wlx-ink">{labels.fpsUseId}</p>
                            {fpsMode === "id" && (
                              <input
                                type="text"
                                value={data.fpsId}
                                onChange={(e) => update("fpsId", e.target.value)}
                                placeholder={labels.fpsIdOnlyPlaceholder}
                                className={`mt-2 ${inputClass("fpsId")}`}
                                autoFocus
                              />
                            )}
                          </div>
                        </label>

                        {errors.fpsId && (
                          <p className="text-red-500 text-xs">{errors.fpsId}</p>
                        )}

                        {/* Account name (optional) */}
                        <div>
                          <label className="block text-sm font-medium text-wlx-stone mb-1">
                            {labels.fpsAccountName}
                          </label>
                          <input
                            type="text"
                            value={data.fpsAccountName}
                            onChange={(e) => update("fpsAccountName", e.target.value)}
                            placeholder={labels.fpsAccountNamePlaceholder}
                            className={inputClass("fpsAccountName")}
                          />
                        </div>
                      </div>
                    )}
                  </PaymentMethodCard>

                  {/* PayMe */}
                  <PaymentMethodCard
                    id="payme"
                    label={labels.paymeLabel}
                    desc={labels.paymeDesc}
                    selected={data.selectedPayments.includes("payme")}
                    onToggle={() => {
                      const sel = data.selectedPayments.includes("payme")
                        ? data.selectedPayments.filter((m) => m !== "payme")
                        : [...data.selectedPayments, "payme"];
                      update("selectedPayments", sel);
                    }}
                  >
                    {data.selectedPayments.includes("payme") && (
                      <div className="mt-3 pt-3 border-t border-wlx-mist">
                        <QrUploader
                          currentUrl={data.paymeQrUrl}
                          onUploaded={(url) => {
                            update("paymeQrUrl", url);
                            setErrors((prev) => { const n = { ...prev }; delete n.paymeQr; return n; });
                          }}
                          labels={labels}
                        />
                        {errors.paymeQr && (
                          <p className="text-red-500 text-xs mt-1">{errors.paymeQr}</p>
                        )}
                      </div>
                    )}
                  </PaymentMethodCard>

                  {/* AlipayHK */}
                  <PaymentMethodCard
                    id="alipay_hk"
                    label={labels.alipayLabel}
                    desc={labels.alipayDesc}
                    selected={data.selectedPayments.includes("alipay_hk")}
                    onToggle={() => {
                      const sel = data.selectedPayments.includes("alipay_hk")
                        ? data.selectedPayments.filter((m) => m !== "alipay_hk")
                        : [...data.selectedPayments, "alipay_hk"];
                      update("selectedPayments", sel);
                    }}
                  >
                    {data.selectedPayments.includes("alipay_hk") && (
                      <div className="mt-3 pt-3 border-t border-wlx-mist">
                        <QrUploader
                          currentUrl={data.alipayQrUrl}
                          onUploaded={(url) => {
                            update("alipayQrUrl", url);
                            setErrors((prev) => { const n = { ...prev }; delete n.alipayQr; return n; });
                          }}
                          labels={labels}
                        />
                        {errors.alipayQr && (
                          <p className="text-red-500 text-xs mt-1">{errors.alipayQr}</p>
                        )}
                      </div>
                    )}
                  </PaymentMethodCard>
                </div>

                <p className="text-center text-xs text-wlx-stone">
                  {labels.paymentSetupLater}
                </p>

                {/* Nav buttons */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={goBack}
                    type="button"
                    className="flex-1 py-3 rounded-full border border-wlx-mist text-wlx-stone font-semibold text-base hover:bg-wlx-cream transition-colors min-h-[48px]"
                  >
                    &larr; {labels.back}
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-1 py-3 rounded-full bg-wlx-ink text-wlx-paper font-semibold text-base hover:bg-wlx-ink/90 transition-colors min-h-[48px]"
                  >
                    {labels.next} &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* ======== STEP 5: Theme ======== */}
            {step === 5 && (
              <div className="space-y-5">
                <div className="text-center">
                  <h2 className="font-wlx-display text-2xl tracking-tight text-wlx-ink">
                    {labels.pickStyle}
                  </h2>
                  <p className="text-wlx-stone text-sm mt-1">
                    {labels.pickStyleSub}
                  </p>
                </div>

                {/* Template preview gallery — 2x2 grid */}
                <div>
                  <p className="text-sm font-medium text-wlx-stone mb-3">
                    {labels.storeStyle}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {COVER_TEMPLATES.map((tmpl) => {
                      const isSelected = data.templateId === tmpl.id;
                      const shopInitial = data.shopName?.[0]?.toUpperCase() || "W";
                      return (
                        <button
                          key={tmpl.id}
                          type="button"
                          onClick={() => update("templateId", tmpl.id)}
                          className={`rounded-xl overflow-hidden border-2 transition-all duration-200 text-left ${
                            isSelected
                              ? "border-wlx-ink ring-2 ring-wlx-ink/20 scale-[1.02]"
                              : "border-wlx-mist hover:border-wlx-mist"
                          }`}
                        >
                          {/* Mini storefront mockup */}
                          <div style={{ background: tmpl.bg }} className="p-0">
                            <div
                              className="h-8"
                              style={{ background: tmpl.headerGradient }}
                            />
                            <div className="px-2.5 pb-2.5 -mt-2.5">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 border border-white/20"
                                  style={{ backgroundColor: tmpl.accent }}
                                >
                                  {shopInitial}
                                </div>
                                <span
                                  className="text-[9px] font-semibold truncate"
                                  style={{ color: tmpl.text }}
                                >
                                  {data.shopName || "My Shop"}
                                </span>
                              </div>
                              <div className="flex gap-1 mt-1.5">
                                {[1, 2, 3].map((i) => (
                                  <div
                                    key={i}
                                    className="flex-1 h-7"
                                    style={{
                                      backgroundColor: tmpl.card,
                                      borderRadius: tmpl.borderRadius.image,
                                      boxShadow: tmpl.shadow === "none" ? undefined : tmpl.shadow,
                                    }}
                                  />
                                ))}
                              </div>
                              <div
                                className="mt-1.5 h-4 w-2/3 mx-auto"
                                style={{
                                  borderRadius: tmpl.borderRadius.button,
                                  ...(tmpl.buttonStyle === "filled"
                                    ? { backgroundColor: tmpl.accent }
                                    : { border: `1px solid ${tmpl.accent}` }),
                                }}
                              />
                            </div>
                          </div>
                          <div className="bg-wlx-paper px-2.5 py-2 border-t border-wlx-mist">
                            <p className="text-xs font-semibold text-wlx-ink">
                              {isZh ? tmpl.label : tmpl.labelEn}
                            </p>
                            <p className="text-[10px] text-wlx-stone">
                              {isZh ? tmpl.descZh : tmpl.descEn}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tagline */}
                <div>
                  <label className="block text-sm font-medium text-wlx-stone mb-1.5">
                    {labels.taglineOptional}
                  </label>
                  <input
                    type="text"
                    value={data.tagline}
                    onChange={(e) => update("tagline", e.target.value)}
                    placeholder={labels.taglinePlaceholder}
                    maxLength={100}
                    className={inputClass("tagline")}
                  />
                  <p className="text-wlx-stone text-xs mt-1">
                    {labels.taglineSkipHint}
                  </p>
                </div>

                {/* Nav buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={goBack}
                    type="button"
                    disabled={submitting}
                    className="flex-1 py-3 rounded-full border border-wlx-mist text-wlx-stone font-semibold text-base hover:bg-wlx-cream transition-colors min-h-[48px] disabled:opacity-50"
                  >
                    &larr; {labels.back}
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-full bg-wlx-ink text-wlx-paper font-semibold text-base hover:bg-wlx-ink/90 transition-colors min-h-[48px] disabled:opacity-50"
                  >
                    {submitting ? labels.creating : `${labels.createStore} →`}
                  </button>
                </div>
              </div>
            )}

            {/* ======== STEP 6: Done ======== */}
            {step === 6 && (
              <div className="space-y-5 text-center">
                <Sparkles className="w-10 h-10 text-wlx-ink mx-auto" strokeWidth={1.5} />
                <h2 className="font-wlx-display text-2xl tracking-tight text-wlx-ink">
                  {labels.congrats}
                </h2>

                {/* Checklist + template preview card */}
                <div className="rounded-xl border border-wlx-mist overflow-hidden">
                  {/* Template preview header */}
                  <div
                    className="px-4 py-3 flex items-center gap-2"
                    style={{
                      background:
                        selectedTemplate?.headerGradient ||
                        "linear-gradient(135deg, #FFFFFF, #F0F5EE)",
                      color: selectedTemplate?.text || "#18181B",
                    }}
                  >
                    <p className="font-semibold text-sm" style={{ color: selectedTemplate?.text || "#18181B" }}>
                      {data.shopName}
                    </p>
                    <span className="text-xs opacity-70" style={{ color: selectedTemplate?.subtext || "#71717A" }}>
                      {labels.templateLabel} {locale === "zh-HK" ? selectedTemplate?.label : selectedTemplate?.labelEn}
                    </span>
                  </div>

                  {/* Checklist */}
                  <div className="p-4 space-y-2.5 text-left">
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-wlx-ink shrink-0" strokeWidth={2.5} />
                      <span className="text-sm text-wlx-stone">{labels.checklistStoreCreated}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-wlx-ink shrink-0" strokeWidth={2.5} />
                      <span className="text-sm text-wlx-stone">{labels.checklistPaymentSet}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Circle className="w-4 h-4 text-wlx-mist shrink-0" strokeWidth={2} />
                      <span className="text-sm text-wlx-stone">{labels.checklistNextProduct}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Circle className="w-4 h-4 text-wlx-mist shrink-0" strokeWidth={2} />
                      <span className="text-sm text-wlx-stone">{labels.checklistNextShipping}</span>
                    </div>
                  </div>
                </div>

                {/* Store link */}
                <div className="bg-wlx-cream rounded-xl px-4 py-3 border border-wlx-mist">
                  <p className="text-xs text-wlx-stone mb-1.5">
                    {labels.storeLink}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-wlx-ink font-semibold text-base">
                      wowlix.com/{createdSlug}
                    </span>
                    <button
                      onClick={handleCopyLink}
                      className="text-xs px-3 py-1.5 rounded-lg bg-wlx-paper border border-wlx-mist text-wlx-stone hover:bg-wlx-cream transition-colors font-medium"
                    >
                      {linkCopied ? labels.copied : labels.copyLink}
                    </button>
                  </div>
                </div>

                {/* Primary CTA: Go to admin */}
                <a
                  href={`/${locale}/admin`}
                  className="block w-full py-3 rounded-full bg-wlx-ink text-wlx-paper font-semibold text-base hover:bg-wlx-ink/90 transition-colors min-h-[48px] leading-[48px]"
                >
                  {labels.goToAdmin} &rarr;
                </a>

                {/* Billing CTA for paid plans */}
                {(data.plan === "lite" || data.plan === "pro") && (
                  <div className="space-y-2">
                    <button
                      onClick={handleSetupBilling}
                      disabled={billingRedirecting}
                      className="block w-full py-2.5 rounded-full border border-wlx-mist text-wlx-stone font-semibold text-sm hover:bg-wlx-cream transition-colors disabled:opacity-70"
                    >
                      {billingRedirecting
                        ? "..."
                        : `${labels.setupBilling} →`}
                    </button>
                    <p className="text-[11px] text-wlx-stone">
                      {labels.setupBillingDesc
                        .replace("{plan}", data.plan === "pro" ? "Pro" : "Lite")
                        .replace("{price}", data.plan === "pro" ? "198" : "78")}
                    </p>
                  </div>
                )}

                {/* Upgrade CTA for free users */}
                {data.plan === "free" && (
                  <div className="bg-wlx-cream rounded-xl border border-wlx-mist p-4 space-y-3">
                    <div className="text-center">
                      <p className="font-semibold text-wlx-ink text-sm">
                        {labels.upgradeCta}
                      </p>
                      <p className="text-xs text-wlx-stone mt-0.5">
                        {labels.upgradeCtaDesc}
                      </p>
                    </div>
                    <div className="space-y-2 text-left">
                      <div className="bg-wlx-paper rounded-lg p-2.5 border border-wlx-mist">
                        <p className="text-xs font-bold text-wlx-ink">{labels.liteTag}</p>
                        <p className="text-[11px] text-wlx-stone mt-0.5">{labels.liteBenefitShort}</p>
                      </div>
                      <div className="bg-wlx-paper rounded-lg p-2.5 border border-wlx-mist">
                        <p className="text-xs font-bold text-wlx-ink">{labels.proTag}</p>
                        <p className="text-[11px] text-wlx-stone mt-0.5">{labels.proBenefitShort}</p>
                      </div>
                    </div>
                    <a
                      href={`/${locale}/admin/billing`}
                      className="block w-full py-2.5 rounded-full bg-wlx-ink text-wlx-paper font-semibold text-sm text-center hover:bg-wlx-ink/90 transition-colors"
                    >
                      {labels.viewPlans} &rarr;
                    </a>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
      </div>

      {/* Progress bar */}
      <StepIndicator total={TOTAL_STEPS} current={step} locale={locale} />

      {/* Language toggle */}
      <div className="text-center mt-4">
        <a
          href={locale === "zh-HK" ? "/en/start" : "/zh-HK/start"}
          className="text-sm text-wlx-stone hover:text-wlx-ink transition-colors"
        >
          {locale === "zh-HK" ? "English" : "中文"}
        </a>
      </div>
    </div>
  );
}
