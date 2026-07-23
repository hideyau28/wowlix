import { getDict, type Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getStoreName } from "@/lib/get-store-name";
import { getServerTenantId, isPlatformMode } from "@/lib/tenant";
import { productUrl } from "@/lib/biolink-data";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import ProductDetailClient from "@/components/ProductDetailClient";
import ProductImageCarousel from "@/components/ProductImageCarousel";
import CurrencyPrice from "@/components/CurrencyPrice";

// Category translations for breadcrumb
const categoryTranslations: Record<string, { en: string; "zh-HK": string }> = {
  Shoes: { en: "Shoes", "zh-HK": "鞋款" },
  Tops: { en: "Tops", "zh-HK": "上衣" },
  Pants: { en: "Pants", "zh-HK": "褲裝" },
  Jackets: { en: "Jackets", "zh-HK": "外套" },
  Socks: { en: "Socks", "zh-HK": "襪子" },
  Accessories: { en: "Accessories", "zh-HK": "配飾" },
};

// Force dynamic rendering because we need headers() for tenant resolution
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params;
  const storeName = await getStoreName();

  const tenantId = await getServerTenantId();

  const product = await prisma.product.findFirst({
    where: { id, active: true, hidden: false, tenantId, deletedAt: null },
  });

  if (!product) {
    return {
      title: `Product Not Found - ${storeName}`,
    };
  }

  const description = locale === "zh-HK"
    ? `選購 ${product.title}${product.brand ? ` (${product.brand})` : ""}，正品保證！`
    : `Shop ${product.title}${product.brand ? ` by ${product.brand}` : ""} at ${storeName}. 100% authentic!`;

  // Platform bare host（www/apex）上呢條 route 解析做 default 店 —— 同一件商品
  // 而家有第二個 200 URL（path biolink /[slug]/product/[id]，sitemap 出嗰個）。
  // 兩邊各自 self-canonical 會分薄 signal（review 抓住）—— platform mode 一律
  // canonical 併軌去 biolink 形式；subdomain host（第日 (a) 補咗 DNS 先存在）
  // 先用返自己形式。
  let canonical = `https://wowlix.com/${locale}/product/${id}`;
  if (await isPlatformMode()) {
    const { headers } = await import("next/headers");
    const tenantSlug = (await headers()).get("x-tenant-slug") || "maysshop";
    const tenantLangs = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { languages: true },
    });
    const storeLocale = tenantLangs?.languages?.[0] || "en";
    canonical = productUrl(storeLocale, tenantSlug, id);
  }

  return {
    title: `${product.title} - ${storeName}`,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: `${product.title} - ${storeName}`,
      description,
      siteName: storeName,
      type: "website",
      locale: locale === "zh-HK" ? "zh_HK" : "en_US",
      images: product.imageUrl ? [product.imageUrl] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.title} - ${storeName}`,
      description,
      images: product.imageUrl ? [product.imageUrl] : [],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = getDict(locale as Locale);

  // Fetch product from database with variants (scoped to current tenant)
  const tenantId = await getServerTenantId();
  const product = await prisma.product.findFirst({
    where: { id, active: true, hidden: false, tenantId, deletedAt: null },
    include: {
      variants: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!product) {
    notFound();
  }

  // Get images array, fallback to single imageUrl
  const productImages = product.images && product.images.length > 0
    ? product.images
    : product.imageUrl
      ? [product.imageUrl]
      : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=60"];

  // Determine if product is kids based on shoeType
  const kidsShoeTypes = ["grade_school", "preschool", "toddler"];
  const isKids = product.shoeType ? kidsShoeTypes.includes(product.shoeType) : false;

  const p = {
    id: product.id,
    brand: product.brand || "—",
    title: product.title,
    price: product.price,
    originalPrice: product.originalPrice,
    image: product.imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=60",
    images: productImages,
    videoUrl: product.videoUrl || null,
    category: product.category,
    sizeSystem: (product as any).sizeSystem || null,
    sizes: (product as any).sizes || null,
    stock: (product as any).stock ?? 0,
    shoeType: product.shoeType || null,
    isKids,
    promotionBadges: (product as any).promotionBadges || [],
    variants: product.variants.map((v: any) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      stock: v.stock,
      options: v.options as Record<string, string> | null,
      imageUrl: v.imageUrl,
      active: v.active,
    })),
  };

  // Get translated category name
  const categoryName = p.category && categoryTranslations[p.category]
    ? categoryTranslations[p.category][locale as "en" | "zh-HK"] || p.category
    : p.category;

  // Fetch related products (same category, same tenant, max 4)
  const relatedProducts = product.category
    ? await prisma.product.findMany({
        where: {
          active: true,
          hidden: false,
          tenantId,
          category: product.category,
          id: { not: product.id },
          deletedAt: null,
        },
        take: 4,
        orderBy: { createdAt: "desc" },
      })
    : [];

  const related = relatedProducts.map((rp) => ({
    id: rp.id,
    brand: rp.brand || "",
    title: rp.title,
    price: rp.price,
    image: rp.imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=60",
    stock: (rp as any).stock ?? 0,
  }));

  return (
    <div className="pb-40 pt-4">
      <span className="sr-only" data-product-name={p.title} />

      {/* Product JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: p.title,
            description: p.brand !== "—" ? `${p.title} by ${p.brand}` : p.title,
            image: p.image || undefined,
            ...(p.brand !== "—" && { brand: { "@type": "Brand", name: p.brand } }),
            offers: {
              "@type": "Offer",
              price: p.price,
              priceCurrency: "HKD",
              availability: p.stock > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
              url: `https://wowlix.com/${locale}/product/${p.id}`,
            },
          }),
        }}
      />

      {/* BreadcrumbList JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: locale === "zh-HK" ? "主頁" : "Home",
                item: `https://wowlix.com/${locale}`,
              },
              ...(p.category ? [{
                "@type": "ListItem",
                position: 2,
                name: categoryName,
                item: `https://wowlix.com/${locale}/products?category=${p.category}`,
              }] : []),
              {
                "@type": "ListItem",
                position: p.category ? 3 : 2,
                name: p.title,
              },
            ],
          }),
        }}
      />
      {/* Breadcrumb - hidden on mobile, shown on desktop */}
      <div className="hidden md:flex items-center gap-2 text-sm text-zinc-500 mb-4 px-4">
        <Link href={`/${locale}`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
          {t.product.home}
        </Link>
        {p.category && (
          <>
            <ChevronRight className="h-4 w-4" />
            <Link href={`/${locale}?category=${p.category}`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
              {categoryName}
            </Link>
          </>
        )}
        <ChevronRight className="h-4 w-4" />
        <span className="text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]">{p.title}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Image Carousel with floating effect */}
        <ProductImageCarousel images={p.images} alt={p.title} stock={p.stock} productId={p.id} videoUrl={p.videoUrl} />
        <div className="px-4 md:px-0">
          <ProductDetailClient
            product={p}
            locale={locale}
            t={t}
          />
        </div>
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <div className="mt-6 px-4">
          <h2 className="text-xl font-semibold text-zinc-900 mb-4 dark:text-zinc-100">
            {t.product.relatedProducts}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {related.map((item) => (
              <Link
                key={item.id}
                href={`/${locale}/product/${item.id}`}
                className="group rounded-xl border border-zinc-200 bg-white overflow-hidden hover:border-zinc-300 transition-colors dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div className="relative aspect-square overflow-hidden">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                </div>
                <div className="p-2.5">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{item.brand}</div>
                  <div className="mt-0.5 text-sm font-medium text-zinc-900 line-clamp-2 dark:text-zinc-100">{item.title}</div>
                  <div className="mt-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    <CurrencyPrice amount={item.price} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
