"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { BioCartItem } from "@/lib/biolink-cart";
import {
  formatPrice,
  type TenantForBioLink,
  type DeliveryOption,
} from "@/lib/biolink-helpers";
import { useTemplate } from "@/lib/template-context";
import { getAccentForeground } from "@/lib/cover-templates";
import {
  Package,
  RefreshCw,
  MessageCircle,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";

type PaymentProvider = {
  providerId: string;
  displayName: string | null;
  name: string;
  nameZh: string;
  type: "online" | "manual";
  icon: string;
  config: Record<string, unknown>;
  instructions?: string;
};

type OrderResult = {
  orderId: string;
  orderNumber: string;
  status: string;
  total: number;
  storeName: string;
  whatsapp: string | null;
  fpsInfo?: {
    accountName: string | null;
    id: string | null;
    qrCode: string | null;
  };
  paymeInfo?: { link: string | null; qrCode: string | null };
  items?: Array<{ name: string; qty: number; unitPrice: number }>;
  customer?: { name: string; phone: string };
  delivery?: {
    method: string;
    label: string;
    fee: number;
    address?: string | null;
  };
  paymentMethod?: string;
  paymentProof?: boolean;
  paymentProofUrl?: string | null;
  currency?: string;
  providerConfig?: Record<string, unknown>;
  providerInstructions?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  cart: BioCartItem[];
  tenant: TenantForBioLink;
  onOrderComplete: (result: OrderResult) => void;
};

export default function CheckoutPage({
  open,
  onClose,
  cart,
  tenant,
  onOrderComplete,
}: Props) {
  const tmpl = useTemplate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [delivery, setDelivery] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availablePayments, setAvailablePayments] = useState<
    Array<{ id: string; label: string; sub: string }>
  >([]);
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponApplied, setCouponApplied] = useState(false);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponFeatureEnabled, setCouponFeatureEnabled] = useState(false);

  const currency = tenant.currency || "HKD";
  const enabledOptions = (tenant.deliveryOptions || []).filter(
    (o: DeliveryOption) => o.enabled,
  );

  // Computed values (needed by effects below)
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const selectedDelivery = enabledOptions.find((o) => o.id === delivery);
  let deliveryFee = selectedDelivery?.price || 0;
  const freeShippingReached =
    tenant.freeShippingThreshold != null &&
    subtotal >= tenant.freeShippingThreshold;
  if (freeShippingReached) deliveryFee = 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  // Auto-select first delivery option
  useEffect(() => {
    if (
      enabledOptions.length > 0 &&
      !enabledOptions.find((o) => o.id === delivery)
    ) {
      setDelivery(enabledOptions[0].id);
    }
  }, [enabledOptions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if coupon feature is enabled for this tenant
  useEffect(() => {
    fetch(`/api/features/coupon?slug=${tenant.slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.data?.enabled) setCouponFeatureEnabled(true);
      })
      .catch(() => {});
  }, [tenant.slug]);

  // Fetch all active payment methods from API
  useEffect(() => {
    fetch(`/api/payment-config?tenant=${tenant.slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.data?.providers?.length > 0) {
          const providerList = data.data.providers as PaymentProvider[];
          setProviders(providerList);
          const methods = providerList.map((p) => ({
            id: p.providerId,
            label: p.displayName || p.nameZh,
            sub: p.type === "online" ? "線上支付" : "手動確認",
          }));
          setAvailablePayments(methods);
          setPayment(methods[0].id);
        } else {
          // Fallback to legacy tenant flags
          const fallback: Array<{ id: string; label: string; sub: string }> =
            [];
          if (tenant.fpsEnabled)
            fallback.push({ id: "fps", label: "FPS 轉帳", sub: "手動確認" });
          if (tenant.paymeEnabled)
            fallback.push({ id: "payme", label: "PayMe", sub: "手動確認" });
          if (tenant.stripeOnboarded && tenant.stripeAccountId) {
            fallback.push({ id: "stripe", label: "信用卡", sub: "Stripe" });
          }
          if (fallback.length === 0) {
            fallback.push({ id: "fps", label: "FPS 轉帳", sub: "手動確認" });
          }
          setAvailablePayments(fallback);
          setPayment(fallback[0].id);
        }
      })
      .catch(() => {
        // Fallback to legacy tenant flags on error
        const fallback: Array<{ id: string; label: string; sub: string }> = [];
        if (tenant.fpsEnabled)
          fallback.push({ id: "fps", label: "FPS 轉帳", sub: "手動確認" });
        if (tenant.paymeEnabled)
          fallback.push({ id: "payme", label: "PayMe", sub: "手動確認" });
        if (fallback.length === 0) {
          fallback.push({ id: "fps", label: "FPS 轉帳", sub: "手動確認" });
        }
        setAvailablePayments(fallback);
        setPayment(fallback[0].id);
      });
  }, [tenant.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Current selected provider (full data)
  const selectedProvider = providers.find((p) => p.providerId === payment);
  const isManualPayment = selectedProvider
    ? selectedProvider.type === "manual"
    : !["stripe"].includes(payment);

  // Apply coupon handler
  const applyCoupon = useCallback(
    async (code?: string) => {
      const finalCode = (code ?? couponCode).trim();
      if (!finalCode) {
        setCouponError("請輸入優惠碼");
        return;
      }

      setApplyingCoupon(true);
      setCouponError(null);

      try {
        const res = await fetch("/api/coupons/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: finalCode,
            subtotal,
            deliveryFee,
            tenantId: tenant.id,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setCouponError(json?.error?.message || "優惠碼無效");
          setDiscount(0);
          setCouponApplied(false);
        } else {
          setDiscount(json.data.discount || 0);
          setCouponApplied(true);
        }
      } catch {
        setCouponError("驗證失敗，請重試");
        setDiscount(0);
        setCouponApplied(false);
      } finally {
        setApplyingCoupon(false);
      }
    },
    [couponCode, subtotal, deliveryFee, tenant.id],
  );

  // Auto-revalidate coupon when delivery/subtotal changes
  useEffect(() => {
    if (!couponApplied) return;
    void applyCoupon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery, subtotal]);

  // 面交/自取唔使填地址，其他送貨方式需要
  const needsAddress =
    !!delivery && !["meetup", "pickup", "self-pickup"].includes(delivery);

  const validate = useCallback(() => {
    if (name.trim().length < 2) return "請輸入姓名（最少 2 個字）";
    if (!/^\d{8}$/.test(phone.trim())) return "請輸入 8 位電話號碼";
    if (!delivery) return "請選擇送貨方式";
    if (needsAddress && address.trim().length < 5) return "請輸入送貨地址";
    return null;
  }, [name, phone, delivery, needsAddress, address]);

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/biolink/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          tenantId: tenant.id,
          items: cart.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            productName: item.name,
            variant: item.variant || null,
            qty: item.qty,
            price: item.price,
            image: item.image,
          })),
          customer: {
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim() || null,
          },
          delivery: {
            method: delivery,
            address: needsAddress ? address.trim() : null,
          },
          payment: { method: payment },
          paymentProof: null,
          note: note.trim() || null,
          couponCode: couponApplied
            ? couponCode.trim().toUpperCase()
            : undefined,
          total: subtotal,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message || "落單失敗，請重試");
      }

      const deliveryOpt = enabledOptions.find((d) => d.id === delivery);
      const result: OrderResult = {
        ...(json.data as OrderResult),
        items: cart.map((item) => ({
          name:
            item.name +
            (item.variant ? ` · ${item.variant.replace(/\|/g, " · ")}` : ""),
          qty: item.qty,
          unitPrice: item.price,
        })),
        customer: { name: name.trim(), phone: phone.trim() },
        delivery: {
          method: delivery,
          label: deliveryOpt?.label || delivery,
          fee: deliveryFee,
          address: needsAddress ? address.trim() : null,
        },
        paymentMethod: payment,
        paymentProofUrl: null,
        providerConfig: selectedProvider?.config,
        providerInstructions: selectedProvider?.instructions,
        currency,
      };
      onOrderComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "落單失敗，請重試");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  // Derived colors for inputs / borders
  const inputBg = `${tmpl.card}18`; // ~10% opacity card color
  const borderColor = `${tmpl.subtext}30`;
  const subtleBorder = `${tmpl.subtext}20`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Full panel */}
      <div
        className="relative w-full max-w-[480px] h-full overflow-y-auto"
        style={{ backgroundColor: tmpl.bg, animation: "slideUp 0.3s ease-out" }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-5 pt-4 pb-3"
          style={{
            backgroundColor: tmpl.bg,
            borderBottom: `1px solid ${subtleBorder}`,
          }}
        >
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="text-sm font-medium"
              style={{ color: tmpl.subtext }}
            >
              ← 返回
            </button>
            <h2 className="font-bold text-base" style={{ color: tmpl.text }}>
              結帳
            </h2>
            <div className="w-10" />
          </div>
        </div>

        <div className="px-5 pb-8">
          {/* Customer info */}
          <div className="mt-6">
            <h3
              className="text-xs font-bold uppercase tracking-wider mb-3"
              style={{ color: `${tmpl.text}CC` }}
            >
              聯絡資料
            </h3>
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="checkout-name"
                  className="text-xs mb-1 block"
                  style={{ color: tmpl.subtext }}
                >
                  姓名 *
                </label>
                <input
                  id="checkout-name"
                  autoComplete="name"
                  type="text"
                  placeholder="陳大文"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-colors"
                  style={{
                    backgroundColor: inputBg,
                    color: tmpl.text,
                    border: `1px solid ${borderColor}`,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = tmpl.accent;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = borderColor;
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="checkout-phone"
                  className="text-xs mb-1 block"
                  style={{ color: tmpl.subtext }}
                >
                  電話 *
                </label>
                <input
                  id="checkout-phone"
                  autoComplete="tel"
                  type="tel"
                  placeholder="9XXX XXXX"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 8));
                    setError(null);
                  }}
                  inputMode="numeric"
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-colors"
                  style={{
                    backgroundColor: inputBg,
                    color: tmpl.text,
                    border: `1px solid ${borderColor}`,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = tmpl.accent;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = borderColor;
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="checkout-email"
                  className="text-xs mb-1 block"
                  style={{ color: tmpl.subtext }}
                >
                  Email（可選）
                </label>
                <input
                  id="checkout-email"
                  autoComplete="email"
                  type="email"
                  placeholder="hello@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-colors"
                  style={{
                    backgroundColor: inputBg,
                    color: tmpl.text,
                    border: `1px solid ${borderColor}`,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = tmpl.accent;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = borderColor;
                  }}
                />
              </div>
            </div>
          </div>

          {/* Delivery options */}
          <div className="mt-6">
            <h3
              className="text-xs font-bold uppercase tracking-wider mb-3"
              style={{ color: `${tmpl.text}CC` }}
            >
              送貨方式
            </h3>
            <div className="space-y-2">
              {enabledOptions.map((opt) => {
                const showFree = freeShippingReached && opt.price > 0;
                const isSelected = delivery === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setDelivery(opt.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors"
                    style={{
                      borderColor: isSelected ? tmpl.accent : borderColor,
                      backgroundColor: isSelected
                        ? `${tmpl.accent}18`
                        : inputBg,
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor: isSelected
                          ? tmpl.accent
                          : `${tmpl.subtext}50`,
                      }}
                    >
                      {isSelected && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: tmpl.accent }}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <span
                        className="text-sm font-medium"
                        style={{ color: tmpl.text }}
                      >
                        {opt.label}
                      </span>
                      <span
                        className="text-xs ml-2"
                        style={{ color: tmpl.subtext }}
                      >
                        {showFree ? (
                          <span className="line-through mr-1">
                            {formatPrice(opt.price, currency)}
                          </span>
                        ) : null}
                        {opt.price > 0 && !showFree
                          ? formatPrice(opt.price, currency)
                          : "（免運費）"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {freeShippingReached && (
              <p className="mt-2 text-sm text-green-400 font-medium">
                滿 {formatPrice(tenant.freeShippingThreshold!, currency)}{" "}
                免運費！
              </p>
            )}
          </div>

          {/* 送貨地址 — 非面交/自取先顯示 */}
          {needsAddress && (
            <div className="mt-6">
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-3"
                style={{ color: `${tmpl.text}CC` }}
              >
                送貨地址
              </h3>
              <div>
                <label
                  htmlFor="checkout-address"
                  className="text-xs mb-1 block"
                  style={{ color: tmpl.subtext }}
                >
                  地址 *
                </label>
                <textarea
                  id="checkout-address"
                  autoComplete="street-address"
                  placeholder="例：九龍觀塘成業街 10 號 xx 大廈 5 樓 A 室"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setError(null);
                  }}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-colors resize-none"
                  style={{
                    backgroundColor: inputBg,
                    color: tmpl.text,
                    border: `1px solid ${borderColor}`,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = tmpl.accent;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = borderColor;
                  }}
                />
              </div>
            </div>
          )}

          {/* Note */}
          <div className="mt-6">
            <h3
              className="text-xs font-bold uppercase tracking-wider mb-3"
              style={{ color: `${tmpl.text}CC` }}
            >
              備註（可選）
            </h3>
            <textarea
              id="checkout-note"
              autoComplete="off"
              // 個「備註（可選）」係 <h3> 唔係 <label>，關聯唔到 —— 用 aria-label 補
              aria-label="備註（可選）"
              placeholder="星期六下午方便 / 刻字內容 / 過敏資料..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-colors resize-none"
              style={{
                backgroundColor: inputBg,
                color: tmpl.text,
                border: `1px solid ${borderColor}`,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = tmpl.accent;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = borderColor;
              }}
            />
          </div>

          {/* Coupon code */}
          {couponFeatureEnabled && (
            <div className="mt-6">
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-3"
                style={{ color: `${tmpl.text}CC` }}
              >
                優惠碼
              </h3>
              <div className="flex gap-2">
                <input
                  id="checkout-coupon"
                  autoComplete="off"
                  aria-label="優惠碼"
                  type="text"
                  placeholder="輸入優惠碼"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value);
                    setCouponError(null);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl text-sm focus:outline-none transition-colors"
                  style={{
                    backgroundColor: inputBg,
                    color: tmpl.text,
                    border: `1px solid ${borderColor}`,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = tmpl.accent;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = borderColor;
                  }}
                />
                <button
                  onClick={() => applyCoupon()}
                  disabled={applyingCoupon}
                  className="px-5 py-3 rounded-xl text-sm font-medium text-white transition-opacity"
                  style={{
                    backgroundColor: tmpl.accent,
                    opacity: applyingCoupon ? 0.5 : 1,
                  }}
                >
                  {applyingCoupon ? "驗證中..." : "套用"}
                </button>
              </div>
              {couponError && (
                <p className="mt-2 text-xs text-red-400">{couponError}</p>
              )}
              {couponApplied && discount > 0 && (
                <p className="mt-2 text-xs text-green-400 font-medium">
                  已套用優惠碼，折扣 {formatPrice(discount, currency)}
                </p>
              )}
            </div>
          )}

          {/* Payment method */}
          <div className="mt-6">
            <h3
              className="text-xs font-bold uppercase tracking-wider mb-3"
              style={{ color: `${tmpl.text}CC` }}
            >
              付款方式
            </h3>
            <div className="space-y-2">
              {availablePayments.map((opt) => {
                const isSelected = payment === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setPayment(opt.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors"
                    style={{
                      borderColor: isSelected ? tmpl.accent : borderColor,
                      backgroundColor: isSelected
                        ? `${tmpl.accent}18`
                        : inputBg,
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor: isSelected
                          ? tmpl.accent
                          : `${tmpl.subtext}50`,
                      }}
                    >
                      {isSelected && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: tmpl.accent }}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <span
                        className="text-sm font-medium"
                        style={{ color: tmpl.text }}
                      >
                        {opt.label}
                      </span>
                      <span
                        className="text-xs ml-2"
                        style={{ color: tmpl.subtext }}
                      >
                        （{opt.sub}）
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manual payment info + upload */}
          {isManualPayment && selectedProvider && (
            <div className="mt-6">
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-3"
                style={{ color: `${tmpl.text}CC` }}
              >
                收款資料
              </h3>
              <div
                className="rounded-wlx-soft p-4"
                style={{
                  backgroundColor: inputBg,
                  border: `1px solid ${subtleBorder}`,
                }}
              >
                <div className="text-center">
                  {/* Transfer amount */}
                  <div
                    className="rounded-xl px-4 py-3 mb-4"
                    style={{ backgroundColor: `${tmpl.accent}20` }}
                  >
                    <p className="text-xs" style={{ color: tmpl.accent }}>
                      請轉帳以下金額
                    </p>
                    <p
                      className="text-2xl font-bold"
                      style={{ color: tmpl.accent }}
                    >
                      {formatPrice(total, currency)}
                    </p>
                  </div>

                  {/* QR Code */}
                  {!!selectedProvider.config.qrCodeUrl && (
                    <div className="mx-auto w-full max-w-[200px] overflow-hidden rounded-xl bg-white p-2 mb-4">
                      <img
                        src={selectedProvider.config.qrCodeUrl as string}
                        alt={
                          selectedProvider.displayName ||
                          selectedProvider.nameZh
                        }
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  {/* Account info */}
                  {!!(
                    selectedProvider.config.bankName ||
                    selectedProvider.config.accountName ||
                    selectedProvider.config.accountId ||
                    selectedProvider.config.accountNumber ||
                    selectedProvider.config.paymeLink
                  ) && (
                    <div
                      className="rounded-xl p-3 text-left space-y-2 text-sm"
                      style={{ backgroundColor: `${tmpl.subtext}10` }}
                    >
                      {!!selectedProvider.config.bankName && (
                        <div className="flex justify-between">
                          <span style={{ color: tmpl.subtext }}>銀行</span>
                          <span
                            className="font-medium"
                            style={{ color: tmpl.text }}
                          >
                            {selectedProvider.config.bankName as string}
                          </span>
                        </div>
                      )}
                      {!!selectedProvider.config.accountName && (
                        <div className="flex justify-between">
                          <span style={{ color: tmpl.subtext }}>收款人</span>
                          <span
                            className="font-medium"
                            style={{ color: tmpl.text }}
                          >
                            {selectedProvider.config.accountName as string}
                          </span>
                        </div>
                      )}
                      {!!(
                        selectedProvider.config.accountId ||
                        selectedProvider.config.accountNumber
                      ) && (
                        <div className="flex justify-between">
                          <span style={{ color: tmpl.subtext }}>
                            帳號 / FPS ID
                          </span>
                          <span
                            className="font-mono font-medium"
                            style={{ color: tmpl.text }}
                          >
                            {
                              (selectedProvider.config.accountId ||
                                selectedProvider.config.accountNumber) as string
                            }
                          </span>
                        </div>
                      )}
                      {!!selectedProvider.config.paymeLink && (
                        <div className="pt-1">
                          <a
                            href={selectedProvider.config.paymeLink as string}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-[#db0011] px-4 py-2 text-sm font-medium text-white"
                          >
                            打開 PayMe 連結 →
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {!!selectedProvider.instructions && (
                    <p className="mt-3 text-xs" style={{ color: tmpl.subtext }}>
                      {selectedProvider.instructions}
                    </p>
                  )}
                </div>
              </div>

              {/* 落單後先喺 OrderConfirmation 上傳付款截圖 */}
            </div>
          )}

          {/* Order summary */}
          <div className="mt-6">
            <h3
              className="text-xs font-bold uppercase tracking-wider mb-3"
              style={{ color: `${tmpl.text}CC` }}
            >
              訂單摘要
            </h3>
            <div
              className="rounded-wlx-soft p-4"
              style={{
                backgroundColor: inputBg,
                border: `1px solid ${subtleBorder}`,
              }}
            >
              <div className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={`${item.productId}-${item.variant || "default"}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span
                      className="flex-1 min-w-0 truncate"
                      style={{ color: `${tmpl.text}CC` }}
                    >
                      {item.name}
                      {item.variant
                        ? ` ${item.variant.replace(/\|/g, " · ")}`
                        : ""}
                      {" × "}
                      {item.qty}
                    </span>
                    <span
                      className="font-medium ml-3 flex-shrink-0"
                      style={{ color: tmpl.text }}
                    >
                      {formatPrice(item.price * item.qty, currency)}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="mt-3 pt-3 space-y-1"
                style={{ borderTop: `1px solid ${subtleBorder}` }}
              >
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: tmpl.subtext }}>商品小計</span>
                  <span style={{ color: `${tmpl.text}B3` }}>
                    {formatPrice(subtotal, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: tmpl.subtext }}>運費</span>
                  <span style={{ color: `${tmpl.text}B3` }}>
                    {deliveryFee > 0
                      ? formatPrice(deliveryFee, currency)
                      : "免運費"}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: "#4ade80" }}>優惠折扣</span>
                    <span style={{ color: "#4ade80" }}>
                      −{formatPrice(discount, currency)}
                    </span>
                  </div>
                )}
                <div
                  className="flex items-center justify-between pt-2"
                  style={{ borderTop: `1px solid ${subtleBorder}` }}
                >
                  <span className="font-medium" style={{ color: tmpl.text }}>
                    總計
                  </span>
                  <span
                    className="font-bold text-lg"
                    style={{ color: tmpl.accent }}
                  >
                    {formatPrice(total, currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Trust signals */}
          <div
            className="mt-5 rounded-wlx-soft px-4 py-4"
            style={{
              backgroundColor: `${tmpl.subtext}08`,
              border: `1px solid ${tmpl.subtext}12`,
            }}
          >
            <p
              className="text-xs font-semibold tracking-wide mb-3 flex items-center gap-1.5"
              style={{ color: `${tmpl.text}B3` }}
            >
              <ShieldCheck size={14} style={{ color: tmpl.accent }} />
              安心購物保障
            </p>
            <div className="space-y-2">
              {[
                { Icon: Package, text: "落單後 1-3 個工作天出貨" },
                { Icon: RefreshCw, text: "收貨 7 日內可退換" },
                ...(tenant.whatsapp
                  ? [{ Icon: MessageCircle, text: "有問題隨時 WhatsApp 聯絡" }]
                  : []),
                { Icon: CheckCircle, text: "付款後會收到訂單確認通知" },
              ].map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <Icon
                    size={13}
                    className="flex-shrink-0"
                    style={{ color: `${tmpl.subtext}99` }}
                  />
                  <span
                    className="text-xs leading-relaxed"
                    style={{ color: `${tmpl.subtext}CC` }}
                  >
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20"
            >
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-6 w-full py-4 rounded-none font-bold text-base active:scale-[0.98] transition-transform disabled:active:scale-100"
            style={{
              backgroundColor: tmpl.accent,
              // 硬寫 text-white 喺 noir(#FF9500) 上面得 2.20:1 —— 呢粒係
              // 「確認落單」最後一掣，唔可以要人估。
              color: getAccentForeground(tmpl.accent),
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {submitting
              ? "處理中..."
              : `確認落單　${formatPrice(total, currency)}`}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export type { OrderResult };
