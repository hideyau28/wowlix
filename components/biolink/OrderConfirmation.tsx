"use client";

import { useState, useEffect, useRef } from "react";
import { useStoreLocale, useStoreSlug } from "./use-store-locale";
import { formatPrice, type OrderConfirmConfig } from "@/lib/biolink-helpers";
import { buildMerchantNotifyUrl } from "@/lib/whatsapp-notify";
import { useTemplate } from "@/lib/template-context";
import { ClipboardList, MessageCircle } from "lucide-react";

type OrderItem = {
  name: string;
  qty: number;
  unitPrice: number;
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
  items?: OrderItem[];
  customer?: { name: string; phone: string };
  delivery?: {
    method: string;
    label: string;
    fee?: number;
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
  order: OrderResult;
  onClose: () => void;
  orderConfirmMessage?: OrderConfirmConfig;
  languages?: string[];
};

export default function OrderConfirmation({
  order,
  onClose,
  orderConfirmMessage,
  languages,
}: Props) {
  const tmpl = useTemplate();
  // ⚠️ 唔准由 pathname append 砌 order link —— 商品獨立頁（/{locale}/{slug}/
  // product/{id}）checkout 完 append /order/{id} 會砌出 5 段死 path → 404
  //（review 2026-07-23 抓住）。由 store 身份砌，喺邊條 biolink route 都啱。
  const storeLocale = useStoreLocale();
  const storeSlug = useStoreSlug();
  const currency = order.currency || "HKD";
  const isZh = (languages || ["zh-HK"]).includes("zh-HK");
  const config = orderConfirmMessage || {
    thanks: isZh ? "多謝訂購！" : "Thank you for your order!",
    whatsappTemplate: isZh
      ? "你好！我落咗單 #{orderNumber}"
      : "Hi! I just placed order #{orderNumber}",
  };

  // Payment proof upload state
  const [proofUploaded, setProofUploaded] = useState(!!order.paymentProof);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(
    order.paymentProofUrl || null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build WhatsApp link using tenant's custom template
  const waText = config.whatsappTemplate.replace(
    "#{orderNumber}",
    order.orderNumber,
  );

  // Build WhatsApp notify URL with full order details
  const notifyUrl =
    order.whatsapp && order.items && order.customer && order.delivery
      ? buildMerchantNotifyUrl(order.whatsapp, {
          orderNumber: order.orderNumber,
          customer: order.customer,
          items: order.items,
          deliveryLabel: order.delivery.label,
          deliveryAddress: order.delivery.address,
          paymentMethod: order.paymentMethod || "fps",
          total: order.total,
          paymentProofUrl: proofUrl,
        })
      : order.whatsapp
        ? `https://wa.me/${order.whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(waText)}`
        : null;

  // 落單後自動打開 WhatsApp 通知店主（只觸發一次）
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (notifyUrl && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      const timer = setTimeout(() => {
        window.open(notifyUrl, "_blank");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [notifyUrl]);

  // 判斷係咪手動付款（非 Stripe）
  const isManualPayment =
    !!order.paymentMethod && order.paymentMethod !== "stripe";

  // Provider config — 用嚟顯示收款資料
  const cfg = order.providerConfig || {};
  const hasProviderConfig = !!(
    cfg.qrCodeUrl ||
    cfg.accountId ||
    cfg.accountNumber ||
    cfg.accountName ||
    cfg.bankName ||
    cfg.paymeLink
  );

  // Legacy FPS/PayMe info fallback
  const hasFpsInfo =
    !!order.fpsInfo && (!!order.fpsInfo.qrCode || !!order.fpsInfo.id);
  const hasPaymeInfo =
    !!order.paymeInfo && (!!order.paymeInfo.qrCode || !!order.paymeInfo.link);
  const hasAnyPaymentInfo = hasProviderConfig || hasFpsInfo || hasPaymeInfo;

  // File handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError(isZh ? "請上傳圖片檔案" : "Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(isZh ? "圖片大小不能超過 5MB" : "Image must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setProofFile(file);
      setProofPreview(reader.result as string);
      setUploadError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveProof = () => {
    setProofFile(null);
    setProofPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Upload proof + submit to API
  const handleSubmitProof = async () => {
    if (!proofFile) return;
    setUploading(true);
    setUploadError(null);

    try {
      // 1. Upload file to /api/upload
      const formData = new FormData();
      formData.append("file", proofFile);
      formData.append("folder", "payments");
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || !uploadJson.ok) {
        throw new Error(
          isZh ? "上傳截圖失敗，請重試" : "Upload failed, please retry",
        );
      }
      const url = uploadJson.data.url as string;

      // 2. Attach proof to order
      const proofRes = await fetch(
        `/api/biolink/orders/${order.orderId}/payment-proof`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentProof: url }),
        },
      );
      const proofJson = await proofRes.json();
      if (!proofRes.ok || !proofJson.ok) {
        throw new Error(
          proofJson.error?.message ||
            (isZh ? "提交付款證明失敗" : "Failed to submit proof"),
        );
      }

      setProofUrl(url);
      setProofUploaded(true);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : isZh
            ? "上傳失敗，請重試"
            : "Upload failed",
      );
    } finally {
      setUploading(false);
    }
  };

  // Derived colors
  const subtleBorder = `${tmpl.subtext}20`;
  const cardBg = `${tmpl.card}18`;
  const inputBg = `${tmpl.card}18`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel — full height scrollable */}
      <div
        className="relative w-full max-w-[480px] max-h-[92vh] rounded-t-3xl overflow-y-auto"
        style={{ backgroundColor: tmpl.bg, animation: "slideUp 0.3s ease-out" }}
      >
        <div className="px-5 pt-6 pb-8">
          {/* Success header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
              <svg
                className="w-8 h-8 text-green-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold" style={{ color: tmpl.text }}>
              {config.thanks}
            </h2>
            <p className="text-sm mt-1" style={{ color: tmpl.subtext }}>
              {isZh ? "訂單編號：" : "Order #"}
              {order.orderNumber}
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: `${tmpl.subtext}99` }}
            >
              {proofUploaded
                ? isZh
                  ? "狀態：等待商戶確認"
                  : "Status: Awaiting confirmation"
                : isZh
                  ? "狀態：請完成付款"
                  : "Status: Please complete payment"}
            </p>
          </div>

          {/* Order summary */}
          {order.items && order.items.length > 0 && (
            <div
              className="rounded-wlx-soft p-4 mb-4"
              style={{
                backgroundColor: cardBg,
                border: `1px solid ${subtleBorder}`,
              }}
            >
              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm"
                  >
                    <span
                      className="flex-1 min-w-0 truncate"
                      style={{ color: `${tmpl.text}CC` }}
                    >
                      {item.name} × {item.qty}
                    </span>
                    <span
                      className="font-medium ml-3 flex-shrink-0"
                      style={{ color: tmpl.text }}
                    >
                      {formatPrice(item.unitPrice * item.qty, currency)}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="mt-3 pt-3"
                style={{ borderTop: `1px solid ${subtleBorder}` }}
              >
                {order.delivery && (
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span style={{ color: tmpl.subtext }}>
                      {isZh ? "送貨方式" : "Delivery"}
                    </span>
                    <span style={{ color: `${tmpl.text}B3` }}>
                      {order.delivery.label}
                    </span>
                  </div>
                )}
                {order.delivery?.address && (
                  <div className="flex items-start justify-between text-sm mb-1">
                    <span style={{ color: tmpl.subtext }}>
                      {isZh ? "送貨地址" : "Address"}
                    </span>
                    <span
                      className="text-right max-w-[60%]"
                      style={{ color: `${tmpl.text}B3` }}
                    >
                      {order.delivery.address}
                    </span>
                  </div>
                )}
                {order.delivery?.fee != null && order.delivery.fee > 0 && (
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span style={{ color: tmpl.subtext }}>
                      {isZh ? "運費" : "Shipping"}
                    </span>
                    <span style={{ color: `${tmpl.text}B3` }}>
                      {formatPrice(order.delivery.fee, currency)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: tmpl.subtext }}>
                    {isZh ? "合計" : "Total"}
                  </span>
                  <span
                    className="font-bold text-lg"
                    style={{ color: tmpl.accent }}
                  >
                    {formatPrice(order.total, currency)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ─── Payment proof uploaded → waiting for merchant ─── */}
          {proofUploaded && (
            <div
              className="rounded-wlx-soft p-5 mb-4 text-center"
              style={{
                backgroundColor: cardBg,
                border: `1px solid ${subtleBorder}`,
              }}
            >
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
                style={{ backgroundColor: `${tmpl.accent}20` }}
              >
                <svg
                  className="w-6 h-6"
                  style={{ color: tmpl.accent }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: tmpl.text }}>
                {isZh
                  ? "付款證明已提交，等待商戶確認"
                  : "Payment proof submitted, awaiting confirmation"}
              </p>
              <p className="text-xs mt-1" style={{ color: tmpl.subtext }}>
                {isZh
                  ? "商戶收到你嘅付款截圖後會確認訂單"
                  : "The merchant will confirm after reviewing your payment"}
              </p>
            </div>
          )}

          {/* ─── Payment section — show when proof NOT yet uploaded + manual payment ─── */}
          {!proofUploaded && isManualPayment && (
            <div className="space-y-4 mb-4">
              {/* Payment info card — provider config or legacy fallback */}
              {hasAnyPaymentInfo && (
                <div
                  className="rounded-wlx-soft p-5"
                  style={{
                    backgroundColor: cardBg,
                    border: `1px solid ${subtleBorder}`,
                  }}
                >
                  <h3
                    className="text-xs font-bold uppercase tracking-wider mb-4 text-center"
                    style={{ color: `${tmpl.text}99` }}
                  >
                    {isZh ? "請完成付款" : "Complete Payment"}
                  </h3>

                  {/* Transfer amount badge */}
                  <div
                    className="rounded-xl px-4 py-3 mb-4 text-center"
                    style={{ backgroundColor: `${tmpl.accent}15` }}
                  >
                    <p
                      className="text-xs mb-0.5"
                      style={{ color: `${tmpl.accent}CC` }}
                    >
                      {isZh ? "請轉帳" : "Please transfer"}
                    </p>
                    <p
                      className="text-2xl font-bold tracking-tight"
                      style={{ color: tmpl.accent }}
                    >
                      {formatPrice(order.total, currency)}
                    </p>
                  </div>

                  {/* Provider config — new unified display */}
                  {hasProviderConfig && (
                    <>
                      {/* QR Code */}
                      {!!cfg.qrCodeUrl && (
                        <div className="flex justify-center mb-4">
                          <div className="w-48 h-48 rounded-xl overflow-hidden bg-white p-2">
                            <img
                              src={cfg.qrCodeUrl as string}
                              alt="Payment QR"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        </div>
                      )}

                      {/* Account details */}
                      {!!(
                        cfg.bankName ||
                        cfg.accountName ||
                        cfg.accountId ||
                        cfg.accountNumber
                      ) && (
                        <div
                          className="rounded-xl p-3 space-y-2 text-sm"
                          style={{ backgroundColor: `${tmpl.subtext}10` }}
                        >
                          {!!cfg.bankName && (
                            <div className="flex justify-between">
                              <span style={{ color: tmpl.subtext }}>
                                {isZh ? "銀行" : "Bank"}
                              </span>
                              <span
                                className="font-medium"
                                style={{ color: tmpl.text }}
                              >
                                {cfg.bankName as string}
                              </span>
                            </div>
                          )}
                          {!!cfg.accountName && (
                            <div className="flex justify-between">
                              <span style={{ color: tmpl.subtext }}>
                                {isZh ? "收款人" : "Recipient"}
                              </span>
                              <span
                                className="font-medium"
                                style={{ color: tmpl.text }}
                              >
                                {cfg.accountName as string}
                              </span>
                            </div>
                          )}
                          {!!(cfg.accountId || cfg.accountNumber) && (
                            <div className="flex justify-between">
                              <span style={{ color: tmpl.subtext }}>
                                {isZh ? "帳號 / FPS ID" : "Account / FPS ID"}
                              </span>
                              <span
                                className="font-mono font-medium"
                                style={{ color: tmpl.text }}
                              >
                                {(cfg.accountId || cfg.accountNumber) as string}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* PayMe link */}
                      {!!cfg.paymeLink && (
                        <div className="mt-3">
                          <a
                            href={cfg.paymeLink as string}
                            target="_blank"
                            rel="noreferrer"
                            className="block w-full py-3 rounded-xl bg-[#db0011] text-white font-bold text-sm text-center active:scale-[0.98] transition-transform"
                          >
                            {isZh ? "打開 PayMe" : "Open PayMe"}
                          </a>
                        </div>
                      )}
                    </>
                  )}

                  {/* Legacy FPS info fallback */}
                  {!hasProviderConfig && hasFpsInfo && (
                    <>
                      {order.fpsInfo!.qrCode && (
                        <div className="flex justify-center mb-4">
                          <div className="w-48 h-48 rounded-xl overflow-hidden bg-white p-2">
                            <img
                              src={order.fpsInfo!.qrCode}
                              alt="FPS QR Code"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        </div>
                      )}
                      {order.fpsInfo!.id && (
                        <p
                          className="text-center text-sm"
                          style={{ color: `${tmpl.text}B3` }}
                        >
                          FPS ID:{" "}
                          <span
                            className="font-mono font-bold"
                            style={{ color: tmpl.text }}
                          >
                            {order.fpsInfo!.id}
                          </span>
                        </p>
                      )}
                      {order.fpsInfo!.accountName && (
                        <p
                          className="text-center text-sm mt-1"
                          style={{ color: `${tmpl.text}B3` }}
                        >
                          {isZh ? "收款人:" : "Recipient:"}{" "}
                          <span
                            className="font-medium"
                            style={{ color: tmpl.text }}
                          >
                            {order.fpsInfo!.accountName}
                          </span>
                        </p>
                      )}
                    </>
                  )}

                  {/* Legacy PayMe info fallback */}
                  {!hasProviderConfig && !hasFpsInfo && hasPaymeInfo && (
                    <>
                      {order.paymeInfo!.qrCode && (
                        <div className="flex justify-center mb-4">
                          <div className="w-48 h-48 rounded-xl overflow-hidden bg-white p-2">
                            <img
                              src={order.paymeInfo!.qrCode}
                              alt="PayMe QR Code"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        </div>
                      )}
                      {order.paymeInfo!.link && (
                        <a
                          href={order.paymeInfo!.link}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-full py-3 rounded-xl bg-[#EC1C24] text-white font-bold text-sm text-center active:scale-[0.98] transition-transform"
                        >
                          {isZh ? "打開 PayMe" : "Open PayMe"}
                        </a>
                      )}
                    </>
                  )}

                  {/* Provider instructions */}
                  {!!order.providerInstructions && (
                    <p
                      className="mt-3 text-xs text-center"
                      style={{ color: tmpl.subtext }}
                    >
                      {order.providerInstructions}
                    </p>
                  )}
                </div>
              )}

              {/* No payment info fallback */}
              {!hasAnyPaymentInfo && (
                <div
                  className="rounded-wlx-soft p-5 mb-4 text-center"
                  style={{
                    backgroundColor: cardBg,
                    border: `1px solid ${subtleBorder}`,
                  }}
                >
                  <p className="text-sm" style={{ color: tmpl.subtext }}>
                    {isZh
                      ? "請 WhatsApp 聯絡店主完成付款"
                      : "Please contact the store via WhatsApp to complete payment"}
                  </p>
                </div>
              )}

              {/* ─── Upload payment proof ─── */}
              <div
                className="rounded-wlx-soft p-5"
                style={{
                  backgroundColor: inputBg,
                  border: `1px solid ${subtleBorder}`,
                }}
              >
                <h4
                  className="text-sm font-semibold mb-1"
                  style={{ color: tmpl.text }}
                >
                  {isZh ? "上傳付款截圖" : "Upload Payment Proof"}
                </h4>
                <p className="text-xs mb-4" style={{ color: tmpl.subtext }}>
                  {isZh
                    ? "完成轉帳後，上傳截圖以通知商戶"
                    : "After transferring, upload a screenshot to notify the merchant"}
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {proofPreview ? (
                  <div className="space-y-3">
                    <div
                      className="relative overflow-hidden rounded-xl"
                      style={{ border: `1px solid ${subtleBorder}` }}
                    >
                      <img
                        src={proofPreview}
                        alt={isZh ? "付款截圖" : "Payment proof"}
                        className="w-full max-h-56 object-contain"
                        style={{ backgroundColor: `${tmpl.subtext}10` }}
                      />
                      <button
                        type="button"
                        onClick={handleRemoveProof}
                        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white text-xs backdrop-blur-sm"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Submit proof button */}
                    <button
                      onClick={handleSubmitProof}
                      disabled={uploading}
                      className="w-full py-3.5 rounded-xl text-white font-bold text-sm active:scale-[0.98] transition-all disabled:active:scale-100"
                      style={{
                        backgroundColor: tmpl.accent,
                        opacity: uploading ? 0.6 : 1,
                      }}
                    >
                      {uploading
                        ? isZh
                          ? "提交中..."
                          : "Submitting..."
                        : isZh
                          ? "提交付款證明"
                          : "Submit Payment Proof"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-xl border-2 border-dashed p-6 text-center transition-colors active:scale-[0.98]"
                    style={{
                      borderColor: `${tmpl.subtext}40`,
                      backgroundColor: `${tmpl.subtext}08`,
                    }}
                  >
                    <div className="text-3xl mb-1">📷</div>
                    <div
                      className="text-sm font-medium"
                      style={{ color: `${tmpl.text}CC` }}
                    >
                      {isZh ? "點擊上傳付款截圖" : "Tap to upload screenshot"}
                    </div>
                    <div
                      className="text-xs mt-1"
                      style={{ color: tmpl.subtext }}
                    >
                      JPG, PNG, WebP
                      {isZh ? "（最大 5MB）" : " (max 5MB)"}
                    </div>
                  </button>
                )}

                {uploadError && (
                  <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-red-400 text-xs">{uploadError}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Next steps */}
          <div
            className="rounded-wlx-soft p-5 mb-4"
            style={{
              backgroundColor: cardBg,
              border: `1px solid ${subtleBorder}`,
            }}
          >
            <p
              className="text-xs font-semibold tracking-wide mb-3.5 flex items-center gap-1.5"
              style={{ color: `${tmpl.text}B3` }}
            >
              <ClipboardList size={14} style={{ color: tmpl.accent }} />
              {isZh ? "接下來會發生咩？" : "What happens next?"}
            </p>
            <div className="space-y-3">
              {[
                isZh
                  ? "轉帳後上傳付款截圖"
                  : "Upload payment proof after transfer",
                isZh
                  ? "商戶確認收款（通常 1 小時內）"
                  : "Merchant confirms payment (usually within 1 hour)",
                isZh ? "商戶安排出貨" : "Merchant arranges shipping",
                isZh ? "收到出貨通知" : "Receive shipping notification",
              ].map((step, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-px"
                    style={{
                      backgroundColor: `${tmpl.accent}18`,
                      color: tmpl.accent,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className="text-xs leading-relaxed"
                    style={{ color: `${tmpl.subtext}CC` }}
                  >
                    {step}
                  </span>
                </div>
              ))}
            </div>

            {order.whatsapp && (
              <a
                href={`https://wa.me/${order.whatsapp.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium py-2.5 rounded-xl transition-colors active:scale-[0.98]"
                style={{
                  backgroundColor: `${tmpl.subtext}10`,
                  color: `${tmpl.text}CC`,
                }}
              >
                <MessageCircle size={13} />
                {isZh
                  ? "有問題？WhatsApp 聯絡商戶"
                  : "Questions? WhatsApp the store"}
              </a>
            )}
          </div>

          {/* WhatsApp notify merchant */}
          {notifyUrl && (
            <a
              href={notifyUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#25D366] text-white font-bold text-sm active:scale-[0.98] transition-transform"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.118.553 4.107 1.518 5.833L0 24l6.334-1.476A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6c-1.876 0-3.653-.502-5.18-1.38l-.37-.22-3.849.898.975-3.562-.242-.384A9.543 9.543 0 012.4 12c0-5.302 4.298-9.6 9.6-9.6s9.6 4.298 9.6 9.6-4.298 9.6-9.6 9.6z" />
              </svg>
              {isZh ? "WhatsApp 聯絡店主" : "WhatsApp Store"}
            </a>
          )}

          {/* Track order link */}
          <a
            href={`/${storeLocale}/${storeSlug}/order/${order.orderId}`}
            className="block mt-4 w-full py-3.5 rounded-xl font-medium text-sm text-center active:scale-[0.98] transition-transform"
            style={{
              backgroundColor: `${tmpl.accent}15`,
              color: tmpl.accent,
            }}
          >
            {isZh ? "追蹤訂單" : "Track Order"}
          </a>

          {/* Continue shopping button */}
          <button
            onClick={onClose}
            className="mt-3 w-full py-3.5 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
            style={{
              backgroundColor: `${tmpl.text}15`,
              color: `${tmpl.text}CC`,
            }}
          >
            {isZh ? "繼續購物" : "Continue Shopping"}
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
