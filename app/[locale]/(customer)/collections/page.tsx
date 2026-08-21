import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getServerTenantIdOrNull } from "@/lib/tenant";
import StoreNotFoundScreen from "@/components/StoreNotFoundScreen";
import { getStoreName } from "@/lib/get-store-name";
import { CollectionsClient } from "./collections-client";
import { Metadata } from "next";

// Force dynamic rendering because we need headers() for tenant resolution
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const storeName = await getStoreName();

  return {
    title: `My Wishlist - ${storeName}`,
    description: `Your saved products and favorites at ${storeName}.`,
    openGraph: {
      title: `My Wishlist - ${storeName}`,
      description: `Your saved products and favorites at ${storeName}.`,
      type: "website",
      locale: locale === "zh-HK" ? "zh_HK" : "en_US",
    },
  };
}

export default async function CollectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = locale as Locale;

  // Fetch active products for this tenant (client will filter by wishlist IDs)
  // 同 search 一樣：租戶認唔到係「呢間店唔存在」，唔係 server 死咗。
  // 見 lib/tenant.ts getServerTenantIdOrNull() 註解。
  const tenantId = await getServerTenantIdOrNull();
  if (!tenantId) {
    return <StoreNotFoundScreen />;
  }
  const products = await prisma.product.findMany({
    where: { active: true, hidden: false, tenantId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const productMap = products.map((p) => ({
    id: p.id,
    brand: p.brand || undefined,
    title: p.title,
    image: p.imageUrl || undefined,
    price: p.price,
    stock: (p as any).stock ?? 0,
    badges: p.badges && Array.isArray(p.badges) ? (p.badges as string[]) : undefined,
  }));

  return (
    <div className="px-4 py-6 pb-28">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold text-zinc-900">{l === "zh-HK" ? "我的清單" : "My Wishlist"}</h1>
        <p className="mt-1 text-zinc-500 text-sm">{l === "zh-HK" ? "你收藏嘅商品" : "Products you've saved"}</p>

        <CollectionsClient locale={l} allProducts={productMap} />

        {/* Fallback navigation */}
        <div className="mt-10 hidden">
          <Link href={`/${l}`}>Back</Link>
        </div>
      </div>
    </div>
  );
}
