import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { resolveTemplateId, getCoverTemplate } from "@/lib/cover-templates";
import { TemplateProvider } from "@/lib/template-context";
import OrderTracker from "@/components/biolink/OrderTracker";
import { getStoreName } from "@/lib/get-store-name";
import { isPlatformMode } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// 以前由 root layout generateMetadata 供應 title；root 靜態化後呢條 route 唔喺
// (customer)/(admin) group 入面，要自己補返。必須先查 isPlatformMode —— 舊 root
// 都係咁行：wowlix.com/{slug}/order/{id} 呢條主流 path-based 訂單 link 上，
// x-tenant-slug 係 DEFAULT_SLUG（maysshop）而唔係 path slug，唔 gate 就會將
// May's Shop 個名印落其他店嘅訂單頁 tab（review Cluster B 抓住嘅跨租戶漏名）。
export async function generateMetadata(): Promise<Metadata> {
  if (await isPlatformMode()) {
    return { title: "WoWlix — Turn Followers into Customers" };
  }
  const storeName = await getStoreName();
  return { title: `${storeName} — WoWlix` };
}

type PageProps = {
  params: Promise<{ slug: string; locale: string; id: string }>;
};

export default async function OrderTrackPage({ params }: PageProps) {
  const { slug, id } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      coverTemplate: true,
      template: true,
      currency: true,
    },
  });

  if (!tenant) notFound();

  // Verify order exists and belongs to this tenant
  const order = await prisma.order.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true },
  });

  if (!order) notFound();

  const tmpl = getCoverTemplate(
    resolveTemplateId(tenant.coverTemplate || tenant.template),
  );

  return (
    <TemplateProvider value={tmpl}>
      <OrderTracker
        orderId={id}
        storeSlug={slug}
        storeName={tenant.name}
        logoUrl={tenant.logoUrl}
        currency={tenant.currency || "HKD"}
      />
    </TemplateProvider>
  );
}
