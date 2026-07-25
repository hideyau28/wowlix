import { getDict, type Locale } from "@/lib/i18n";
import { getOrderById } from "./actions";
import Link from "next/link";

const STATUS_DISPLAY: Record<string, { en: string; zh: string }> = {
  PENDING: { en: "Pending", zh: "待付款" },
  PENDING_CONFIRMATION: { en: "Awaiting Confirmation", zh: "待確認收款" },
  CONFIRMED: { en: "Confirmed", zh: "已確認" },
  PAID: { en: "Paid", zh: "已付款" },
  CREATED: { en: "Created", zh: "已建立" },
  PROCESSING: { en: "Processing", zh: "處理中" },
  FULFILLING: { en: "Fulfilling", zh: "備貨中" },
  SHIPPED: { en: "Shipped", zh: "已發貨" },
  DELIVERED: { en: "Delivered", zh: "已送達" },
  COMPLETED: { en: "Completed", zh: "已完成" },
  CANCELLED: { en: "Cancelled", zh: "已取消" },
  REFUNDED: { en: "Refunded", zh: "已退款" },
  DISPUTED: { en: "Disputed", zh: "爭議中" },
};

function translateStatus(status: string, locale: string): string {
  const t = STATUS_DISPLAY[status];
  return t ? (locale === "zh-HK" ? t.zh : t.en) : status;
}

export default async function OrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = getDict(locale as Locale);

  const result = await getOrderById(id);

  // If we can't fetch the order (no admin secret or error), show minimal confirmation
  if (!result.ok) {
    return (
      <div className="px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
            <h1 className="text-2xl font-semibold text-zinc-900">{t.order.thankYou}</h1>
            <div className="mt-4">
              <p className="text-zinc-600">{t.order.orderId}</p>
              <p className="mt-1 font-mono text-lg text-zinc-900">{id}</p>
            </div>
            <Link
              href={`/${locale}`}
              className="mt-6 inline-block rounded-2xl bg-olive-600 px-6 py-3 text-white font-semibold hover:bg-olive-700"
            >
              {t.order.backToHome}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const order = result.data;
  // 陌生人（冇 grant cookie、又唔係張單個會員）淨係見得單號／狀態／總額。
  // 姓名／電話／送貨地址／逐件貨一律唔出 —— 以前呢頁對任何攞到 order id 嘅人
  // 都 render 晒，等於未認證讀客人 PII。
  const canViewDetail = result.canViewDetail;
  const items = order.items as Array<{ productId: string; name: string; unitPrice: number; quantity: number }>;
  const amounts = order.amounts as {
    subtotal: number;
    deliveryFee?: number;
    total: number;
    currency: string;
  };
  const fulfillmentAddress = order.fulfillmentAddress as
    | { line1: string; district?: string; notes?: string }
    | null
    | undefined;

  // Manual payment detection: PENDING_CONFIRMATION or has paymentMethod (non-Stripe)
  const isManualPayment = order.status === "PENDING_CONFIRMATION" || (order.paymentMethod && order.paymentMethod !== "stripe");

  // WhatsApp contact store button
  const showWhatsApp = result.whatsappEnabled && result.tenantWhatsapp;
  const whatsappUrl = showWhatsApp
    ? (() => {
        const msg = t.whatsapp.orderContactStoreMessage
          .replace("{storeName}", result.tenantName || "")
          .replace("{orderNumber}", order.orderNumber || order.id);
        const phone = result.tenantWhatsapp!.replace(/\D/g, "");
        return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
      })()
    : null;

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8">
          <h1 className="text-2xl font-semibold text-zinc-900">{t.order.thankYou}</h1>

          {/* Manual payment: pending confirmation banner */}
          {isManualPayment && order.status === "PENDING_CONFIRMATION" && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">⏳</span>
                <div>
                  <p className="font-semibold text-amber-900">
                    {locale === "zh-HK" ? "已提交，等待商戶確認" : "Submitted — Awaiting Confirmation"}
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    {locale === "zh-HK"
                      ? "付款證明已收到，商戶確認收款後會通知你，請耐心等候。"
                      : "Payment proof received. The store will notify you once confirmed."}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-zinc-500 text-sm">{t.order.orderId}</p>
              <p className="mt-1 font-mono text-zinc-900">{order.orderNumber || order.id}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-sm">{t.order.status}</p>
              <p className="mt-1 font-semibold text-zinc-900">{translateStatus(order.status, locale)}</p>
            </div>
            {canViewDetail && (
              <>
                <div>
                  <p className="text-zinc-500 text-sm">{t.order.customerName}</p>
                  <p className="mt-1 text-zinc-900">{order.customerName}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-sm">{t.order.phone}</p>
                  <p className="mt-1 text-zinc-900">{order.phone}</p>
                </div>
              </>
            )}
          </div>

          {canViewDetail && (
            <div className="mt-6 border-t border-zinc-200 pt-6">
              <p className="text-zinc-500 text-sm">{t.order.fulfillmentType}</p>
              <p className="mt-1 font-semibold text-zinc-900">
                {order.fulfillmentType === "PICKUP" ? t.order.pickup : t.order.delivery}
              </p>
              {order.fulfillmentType === "DELIVERY" && fulfillmentAddress && (
                <div className="mt-2">
                  <p className="text-zinc-500 text-sm">{t.order.deliveryAddress}</p>
                  <p className="mt-1 text-zinc-900">{fulfillmentAddress.line1}</p>
                  {fulfillmentAddress.district && <p className="text-zinc-700 text-sm">{fulfillmentAddress.district}</p>}
                  {fulfillmentAddress.notes && (
                    <p className="mt-1 text-zinc-500 text-sm">{fulfillmentAddress.notes}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {canViewDetail && (
            <div className="mt-6 border-t border-zinc-200 pt-6">
              <h2 className="font-semibold text-zinc-900">{t.order.items}</h2>
              <div className="mt-4 space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-zinc-700">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="text-zinc-900">
                      ${Math.round(item.unitPrice * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 space-y-2 border-t border-zinc-200 pt-6">
            {canViewDetail && (
              <>
                <div className="flex justify-between">
                  <span className="text-zinc-700">{t.order.subtotal}</span>
                  <span className="text-zinc-900">
                    ${Math.round(amounts.subtotal).toLocaleString()}
                  </span>
                </div>
                {amounts.deliveryFee ? (
                  <div className="flex justify-between">
                    <span className="text-zinc-700">{t.order.deliveryFee}</span>
                    <span className="text-zinc-900">
                      ${Math.round(amounts.deliveryFee).toLocaleString()}
                    </span>
                  </div>
                ) : null}
              </>
            )}
            <div className="flex justify-between border-t border-zinc-200 pt-2 text-lg font-semibold">
              <span className="text-zinc-900">{t.order.total}</span>
              <span className="text-zinc-900">
                ${Math.round(amounts.total).toLocaleString()}
              </span>
            </div>
          </div>

          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 flex items-center justify-center gap-2 w-full rounded-2xl bg-[#25D366] py-4 text-center text-white font-semibold hover:bg-[#1ebe57] active:scale-[0.98] transition-transform"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.118.553 4.107 1.518 5.833L0 24l6.334-1.476A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6c-1.876 0-3.653-.502-5.18-1.38l-.37-.22-3.849.898.975-3.562-.242-.384A9.543 9.543 0 012.4 12c0-5.302 4.298-9.6 9.6-9.6s9.6 4.298 9.6 9.6-4.298 9.6-9.6 9.6z" />
              </svg>
              {isManualPayment
                ? locale === "zh-HK"
                  ? "有問題？WhatsApp 聯絡商戶"
                  : "Questions? Contact store via WhatsApp"
                : t.whatsapp.contactStore}
            </a>
          )}

          <Link
            href={`/${locale}`}
            className={`${whatsappUrl ? "mt-3" : "mt-8"} block w-full rounded-2xl bg-olive-600 py-4 text-center text-white font-semibold hover:bg-olive-700`}
          >
            {t.order.backToHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
