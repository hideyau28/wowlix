"use client";

import { useState, useEffect } from "react";
import { TrendLine, TopBar } from "./charts/LazyCharts";
import { ShoppingCart, DollarSign, TrendingUp } from "lucide-react";

type Summary = {
  today: { orderCount: number; revenue: number };
  week: { orderCount: number; revenue: number };
  month: { orderCount: number; revenue: number };
};

type DailyPoint = { date: string; orders: number; revenue: number };

type TopProduct = {
  name: string;
  quantity: number;
  revenue: number;
  imageUrl?: string | null;
};

type TopProductRange = "7d" | "30d" | "all";

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-wlx-mist p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-wlx-stone">{label}</div>
          <div className="text-2xl font-bold text-wlx-ink mt-2 truncate">
            {value}
          </div>
        </div>
        <div className="text-wlx-stone">{icon}</div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-wlx-mist p-6 animate-pulse">
      <div className="h-4 w-20 bg-wlx-mist rounded mb-3" />
      <div className="h-7 w-16 bg-wlx-mist rounded" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-white rounded-2xl border border-wlx-mist p-6 animate-pulse">
      <div className="h-4 w-40 bg-wlx-mist rounded mb-4" />
      <div className="h-64 bg-wlx-cream rounded-xl" />
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topRange, setTopRange] = useState<TopProductRange>("30d");
  const [loading, setLoading] = useState(true);
  const [topLoading, setTopLoading] = useState(false);

  // Fetch summary + daily on mount
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/analytics/summary").then((r) => r.json()),
      fetch("/api/admin/analytics/daily").then((r) => r.json()),
      fetch(`/api/admin/analytics/top-products?range=30d`).then((r) =>
        r.json(),
      ),
    ])
      .then(([summaryRes, dailyRes, topRes]) => {
        if (summaryRes.ok) setSummary(summaryRes.data);
        if (dailyRes.ok) setDaily(dailyRes.data || []);
        if (topRes.ok) setTopProducts(topRes.data?.topProducts || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Refetch top products when range changes
  useEffect(() => {
    setTopLoading(true);
    fetch(`/api/admin/analytics/top-products?range=${topRange}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setTopProducts(res.data?.topProducts || []);
      })
      .catch(() => {})
      .finally(() => setTopLoading(false));
  }, [topRange]);

  // Format daily data for charts
  const chartData = daily.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-HK", {
      month: "short",
      day: "numeric",
    }),
    orders: d.orders,
    revenue: d.revenue,
  }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SkeletonChart />
          </div>
          <SkeletonChart />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="今日訂單"
            value={summary.today.orderCount}
            icon={<ShoppingCart size={24} />}
          />
          <StatCard
            label="今日收入"
            value={`$${Math.round(summary.today.revenue)}`}
            icon={<DollarSign size={24} />}
          />
          <StatCard
            label="本月訂單"
            value={summary.month.orderCount}
            icon={<TrendingUp size={24} />}
          />
          <StatCard
            label="本月收入"
            value={`$${Math.round(summary.month.revenue)}`}
            icon={<DollarSign size={24} />}
          />
        </div>
      )}

      {/* Week stats */}
      {summary && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-wlx-mist p-6">
            <div className="text-sm text-wlx-stone">本週訂單</div>
            <div className="text-2xl font-bold text-wlx-ink mt-2">
              {summary.week.orderCount}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-wlx-mist p-6">
            <div className="text-sm text-wlx-stone">本週收入</div>
            <div className="text-2xl font-bold text-wlx-ink mt-2">
              ${Math.round(summary.week.revenue)}
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Orders trend */}
        <div className="rounded-2xl border border-wlx-mist bg-white p-6 lg:col-span-2">
          <div className="mb-4 text-sm font-semibold text-wlx-ink">
            訂單趨勢（過去 30 日）
          </div>
          <div className="h-64">
            {chartData.length > 0 ? (
              <TrendLine
                data={chartData}
                xKey="date"
                yKey="orders"
                stroke="#4b5e3c"
                allowDecimals={false}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-wlx-stone text-sm">
                未有數據
              </div>
            )}
          </div>
        </div>

        {/* Revenue trend */}
        <div className="rounded-2xl border border-wlx-mist bg-white p-6">
          <div className="mb-4 text-sm font-semibold text-wlx-ink">
            收入趨勢（30 日）
          </div>
          <div className="h-64">
            {chartData.length > 0 ? (
              <TrendLine
                data={chartData}
                xKey="date"
                yKey="revenue"
                stroke="#4b5e3c"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-wlx-stone text-sm">
                未有數據
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top products */}
      <div className="rounded-2xl border border-wlx-mist bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-wlx-ink">熱門商品</div>
          <div className="flex gap-1">
            {(["7d", "30d", "all"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTopRange(r)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  topRange === r
                    ? "bg-wlx-ink text-white"
                    : "bg-wlx-cream text-wlx-stone hover:bg-wlx-mist"
                }`}
              >
                {r === "7d" ? "7 日" : r === "30d" ? "30 日" : "全部"}
              </button>
            ))}
          </div>
        </div>

        {topLoading ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-4 bg-wlx-mist rounded" />
                <div className="h-4 flex-1 bg-wlx-mist rounded" />
                <div className="h-4 w-12 bg-wlx-mist rounded" />
              </div>
            ))}
          </div>
        ) : topProducts.length === 0 ? (
          <div className="py-8 text-center text-wlx-stone text-sm">
            未有銷售記錄
          </div>
        ) : (
          <div className="space-y-1">
            {topProducts.map((p, idx) => (
              <div
                key={p.name}
                className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-wlx-cream"
              >
                <span className="text-xs text-wlx-stone w-5 text-right font-mono">
                  {idx + 1}
                </span>
                <span className="flex-1 text-sm text-wlx-stone truncate">
                  {p.name}
                </span>
                <span className="text-sm font-semibold text-wlx-ink tabular-nums">
                  {p.quantity} 件
                </span>
                <span className="text-xs text-wlx-stone tabular-nums w-20 text-right">
                  ${Math.round(p.revenue)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Bar chart for top products */}
        {topProducts.length > 0 && (
          <div className="mt-4 h-48">
            <TopBar
              data={topProducts.slice(0, 5).map((p) => ({
                name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name,
                quantity: p.quantity,
              }))}
              xKey="name"
              yKey="quantity"
              fill="#4b5e3c"
            />
          </div>
        )}
      </div>
    </div>
  );
}
