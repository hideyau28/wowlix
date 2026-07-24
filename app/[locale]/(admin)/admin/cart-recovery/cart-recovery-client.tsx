"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";

type OrderItem = {
  title?: string;
  name?: string;
  quantity?: number;
  qty?: number;
};

type AbandonedOrder = {
  id: string;
  orderNumber: string | null;
  customerName: string;
  phone: string;
  items: unknown;
  amounts: unknown;
  createdAt: string;
  recoveryStatus: string | null;
};

type Stats = {
  totalAbandoned: number;
  totalAmount: number;
  recoveryRate: number;
};

type Props = {
  orders: AbandonedOrder[];
  stats: Stats;
  locale: Locale;
  currentRange: string;
  storeUrl: string;
};

function formatTimeAgo(dateStr: string, t: ReturnType<typeof getDict>): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 60) {
    return t.admin.cartRecovery.minutesAgo.replace("{n}", String(diffMins));
  }
  if (diffHours < 24) {
    return t.admin.cartRecovery.hoursAgo.replace("{n}", String(diffHours));
  }
  return t.admin.cartRecovery.daysAgo.replace("{n}", String(diffDays));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-HK", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getItemsSummary(items: unknown): string {
  if (!Array.isArray(items)) return "-";
  const list = items as OrderItem[];
  if (list.length === 0) return "-";
  const first = list[0];
  const name = first.title || first.name || "Item";
  const qty = first.quantity || first.qty || 1;
  if (list.length === 1) return `${name} x${qty}`;
  return `${name} x${qty} +${list.length - 1}`;
}

function getFirstItemName(items: unknown): string {
  if (!Array.isArray(items)) return "items";
  const list = items as OrderItem[];
  if (list.length === 0) return "items";
  return list[0].title || list[0].name || "items";
}

function getRecoveryStatusStyle(status: string | null): string {
  switch (status) {
    case "contacted":
      return "bg-blue-100 text-blue-700 border border-blue-200";
    case "recovered":
      return "bg-green-100 text-green-700 border border-green-200";
    case "dismissed":
      return "bg-wlx-cream text-wlx-stone border border-wlx-mist";
    default:
      return "bg-yellow-100 text-yellow-700 border border-yellow-200";
  }
}

function getRecoveryStatusLabel(
  status: string | null,
  t: ReturnType<typeof getDict>
): string {
  switch (status) {
    case "contacted":
      return t.admin.cartRecovery.statusContacted;
    case "recovered":
      return t.admin.cartRecovery.statusRecovered;
    case "dismissed":
      return t.admin.cartRecovery.statusDismissed;
    default:
      return t.admin.cartRecovery.statusPending;
  }
}

export function CartRecoveryClient({
  orders,
  stats,
  locale,
  currentRange,
  storeUrl,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const t = getDict(locale);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const ranges = [
    { key: "today", label: t.admin.cartRecovery.filterToday },
    { key: "7d", label: t.admin.cartRecovery.filter7d },
    { key: "30d", label: t.admin.cartRecovery.filter30d },
    { key: "all", label: t.admin.cartRecovery.filterAll },
  ];

  function handleRangeChange(range: string) {
    const params = new URLSearchParams();
    if (range !== "all") params.set("range", range);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  async function updateRecoveryStatus(orderId: string, status: string) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/admin/cart-recovery/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryStatus: status }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setUpdatingId(null);
    }
  }

  function buildWhatsAppUrl(order: AbandonedOrder): string {
    const phone = order.phone.replace(/\D/g, "");
    const itemName = getFirstItemName(order.items);
    const checkoutLink = storeUrl;
    const msg = t.admin.cartRecovery.whatsappMessage
      .replace("{customerName}", order.customerName)
      .replace("{itemName}", itemName)
      .replace("{checkoutLink}", checkoutLink);
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-wlx-mist bg-white p-5">
          <div className="text-wlx-stone text-sm">
            {t.admin.cartRecovery.totalAbandoned}
          </div>
          <div className="text-2xl font-bold text-wlx-ink mt-1">
            {stats.totalAbandoned}
          </div>
        </div>
        <div className="rounded-2xl border border-wlx-mist bg-white p-5">
          <div className="text-wlx-stone text-sm">
            {t.admin.cartRecovery.abandonedAmount}
          </div>
          <div className="text-2xl font-bold text-wlx-ink mt-1">
            ${stats.totalAmount.toLocaleString()}
          </div>
        </div>
        <div className="rounded-2xl border border-wlx-mist bg-white p-5">
          <div className="text-wlx-stone text-sm">
            {t.admin.cartRecovery.recoveryRate}
          </div>
          <div className="text-2xl font-bold text-wlx-ink mt-1">
            {stats.recoveryRate}%
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {ranges.map((r) => (
          <button
            key={r.key}
            onClick={() => handleRangeChange(r.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              currentRange === r.key
                ? "bg-wlx-ink text-white"
                : "bg-wlx-cream text-wlx-stone hover:bg-wlx-mist"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-wlx-mist bg-white p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-wlx-cream flex items-center justify-center mb-4">
            <svg
              className="h-8 w-8 text-wlx-stone"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
              />
            </svg>
          </div>
          <p className="text-wlx-stone max-w-md">
            {t.admin.cartRecovery.empty}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const amounts = order.amounts as Record<string, unknown> | null;
            const total = Number(amounts?.total) || 0;
            const isUpdating = updatingId === order.id;
            const isDismissed = order.recoveryStatus === "dismissed";

            return (
              <div
                key={order.id}
                className={`rounded-2xl border border-wlx-mist bg-white p-4 ${
                  isDismissed ? "opacity-60" : ""
                }`}
              >
                {/* Top row: customer info + status badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-wlx-ink truncate">
                      {order.customerName}
                    </div>
                    <div className="text-wlx-stone text-sm">{order.phone}</div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${getRecoveryStatusStyle(
                      order.recoveryStatus
                    )}`}
                  >
                    {getRecoveryStatusLabel(order.recoveryStatus, t)}
                  </span>
                </div>

                {/* Middle: items + amount + time */}
                <div className="flex items-center justify-between gap-3 mb-3 text-sm">
                  <div className="text-wlx-stone truncate min-w-0">
                    {getItemsSummary(order.items)}
                  </div>
                  <div className="font-semibold text-wlx-ink shrink-0">
                    ${total.toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 mb-3 text-xs text-wlx-stone">
                  <span>{formatDate(order.createdAt)}</span>
                  <span>{formatTimeAgo(order.createdAt, t)}</span>
                </div>

                {/* Actions */}
                {!isDismissed && (
                  <div className="flex gap-2 flex-wrap">
                    {/* WhatsApp Remind */}
                    <a
                      href={buildWhatsAppUrl(order)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#25D366] text-white text-sm font-medium hover:bg-[#1ebe57] active:scale-[0.98] transition-transform"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      {t.admin.cartRecovery.whatsappRemind}
                    </a>

                    {/* Mark Contacted */}
                    {order.recoveryStatus !== "contacted" && (
                      <button
                        onClick={() =>
                          updateRecoveryStatus(order.id, "contacted")
                        }
                        disabled={isUpdating}
                        className="px-3 py-2 rounded-xl bg-blue-100 text-blue-700 text-sm font-medium hover:bg-blue-200 disabled:opacity-50 transition-colors"
                      >
                        {t.admin.cartRecovery.markContacted}
                      </button>
                    )}

                    {/* Dismiss */}
                    <button
                      onClick={() =>
                        updateRecoveryStatus(order.id, "dismissed")
                      }
                      disabled={isUpdating}
                      className="px-3 py-2 rounded-xl bg-wlx-cream text-wlx-stone text-sm font-medium hover:bg-wlx-mist disabled:opacity-50 transition-colors"
                    >
                      {t.admin.cartRecovery.markDismissed}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
