import { prisma } from "@/lib/prisma";
import { getAdminTenantId } from "@/lib/tenant";
import { hasFeature } from "@/lib/plan";
import type { Locale } from "@/lib/i18n";
import { getDict } from "@/lib/i18n";
import SidebarToggle from "@/components/admin/SidebarToggle";
import Link from "next/link";
import { CartRecoveryClient } from "./cart-recovery-client";
import { storeShareUrl } from "@/lib/site-url";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ range?: string }>;
};

export default async function AdminCartRecovery({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const { range } = await searchParams;
  const l = locale as Locale;
  const t = getDict(l);

  const tenantId = await getAdminTenantId();

  // Plan gating — cart_recovery 只限 Pro
  const cartRecoveryEnabled = await hasFeature(tenantId, "cart_recovery");

  if (!cartRecoveryEnabled) {
    return (
      <div className="p-4 pb-16">
        <div className="flex items-center gap-4 mb-6">
          <SidebarToggle />
          <div>
            <div className="text-wlx-stone text-sm">Admin</div>
            <h1 className="text-2xl font-semibold text-wlx-ink">
              {t.admin.cartRecovery.title}
            </h1>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-wlx-mist bg-white p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mb-4">
            <svg
              className="h-8 w-8 text-violet-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-wlx-ink mb-2">
            {t.admin.cartRecovery.proFeature}
          </h2>
          <p className="text-wlx-stone mb-6 max-w-md">
            {t.admin.cartRecovery.proFeatureDesc}
          </p>
          <Link
            href={`/${locale}/admin/settings`}
            className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
          >
            {t.admin.cartRecovery.upgrade}
          </Link>
        </div>
      </div>
    );
  }

  // 計算日期範圍篩選
  const currentRange = range || "all";
  const now = new Date();
  let dateFilter: Date | undefined;
  if (currentRange === "today") {
    dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (currentRange === "7d") {
    dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (currentRange === "30d") {
    dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const where: Record<string, unknown> = {
    tenantId,
    status: "PENDING",
    paymentStatus: "pending",
  };

  if (dateFilter) {
    where.createdAt = { gte: dateFilter };
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      phone: true,
      items: true,
      amounts: true,
      createdAt: true,
      recoveryStatus: true,
    },
  });

  // 統計
  const totalAbandoned = orders.length;
  const totalAmount = orders.reduce((sum, o) => {
    const amounts = o.amounts as Record<string, unknown> | null;
    return sum + (Number(amounts?.total) || 0);
  }, 0);
  const contactedCount = orders.filter(
    (o) => o.recoveryStatus === "contacted"
  ).length;
  const recoveredCount = orders.filter(
    (o) => o.recoveryStatus === "recovered"
  ).length;
  const recoveryRate =
    contactedCount + recoveredCount > 0
      ? Math.round((recoveredCount / (contactedCount + recoveredCount)) * 100)
      : 0;

  // Get tenant slug for building checkout links
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true, customDomain: true },
  });
  // ⚠️ 以前係 `${slug}.wowlix.com` —— wildcard DNS 唔存在（NXDOMAIN），
  // 即係追單 WhatsApp send 咗條開唔到嘅 link 俾真客人。呢條係人真係會撳
  // 嘅 URL，一律行 lib/site-url.ts 個 storeShareUrl（自訂域名 → path biolink）。
  const storeUrl = storeShareUrl(tenant?.slug, tenant?.customDomain);

  return (
    <div className="p-4 pb-16">
      <div className="flex items-center gap-4 mb-6">
        <SidebarToggle />
        <div>
          <div className="text-wlx-stone text-sm">Admin</div>
          <h1 className="text-2xl font-semibold text-wlx-ink">
            {t.admin.cartRecovery.title}
          </h1>
          <div className="text-wlx-stone text-sm">
            {t.admin.cartRecovery.subtitle}
          </div>
        </div>
      </div>

      <CartRecoveryClient
        orders={orders.map((o) => ({
          ...o,
          createdAt: o.createdAt.toISOString(),
        }))}
        stats={{ totalAbandoned, totalAmount, recoveryRate }}
        locale={l}
        currentRange={currentRange}
        storeUrl={storeUrl}
      />
    </div>
  );
}
