import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import BioLinkPage from "@/components/biolink/BioLinkPage";
import { resolveTemplateId } from "@/lib/cover-templates";
import type { Metadata } from "next";
import type {
  ProductForBioLink,
  DualVariantData,
  DeliveryOption,
  OrderConfirmConfig,
} from "@/lib/biolink-helpers";
import {
  DEFAULT_DELIVERY_OPTIONS,
  DEFAULT_ORDER_CONFIRM,
} from "@/lib/biolink-helpers";

// Force dynamic rendering — tenant slug pages need DB access per request
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string; locale: string }>;
};

export default async function SlugPage({ params }: PageProps) {
  const { slug } = await params;

  let tenant;
  try {
    tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        whatsapp: true,
        instagram: true,
        socialLinks: true,
        brandColor: true,
        logoUrl: true,
        coverPhoto: true,
        coverTemplate: true,
        template: true,
        fpsEnabled: true,
        fpsAccountName: true,
        fpsAccountId: true,
        fpsQrCodeUrl: true,
        paymeEnabled: true,
        paymeLink: true,
        paymeQrCodeUrl: true,
        stripeAccountId: true,
        stripeOnboarded: true,
        // Checkout settings
        currency: true,
        region: true,
        languages: true,
        deliveryOptions: true,
        freeShippingThreshold: true,
        orderConfirmMessage: true,
      },
    });
  } catch (err) {
    console.error(`[slug/${slug}] tenant query failed:`, err);
    notFound();
  }

  if (!tenant) notFound();

  // Fetch hero banners for the biolink store
  const heroBanners = await prisma.homepageBanner
    .findMany({
      where: { tenantId: tenant.id, active: true, position: "hero" },
      orderBy: { sortOrder: "asc" },
      take: 1,
    })
    .catch(() => []);

  const products = await prisma.product
    .findMany({
      where: {
        tenantId: tenant.id,
        active: true,
        hidden: false,
        deletedAt: null,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        price: true,
        originalPrice: true,
        imageUrl: true,
        images: true,
        videoUrl: true,
        sizes: true,
        sizeSystem: true,
        badges: true,
        category: true,
        featured: true,
        createdAt: true,
        variants: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            price: true,
            compareAtPrice: true,
            stock: true,
            active: true,
            imageUrl: true,
          },
        },
      },
    })
    .catch((err) => {
      console.error(`[slug/${slug}] products query failed:`, err);
      return [];
    });

  // Serialize for client component (dates → strings via JSON, Json fields → typed)
  const serialized: ProductForBioLink[] = products.map((p) => ({
    id: p.id,
    title: p.title,
    price: p.price,
    originalPrice: p.originalPrice,
    imageUrl: p.imageUrl,
    images: p.images,
    videoUrl: p.videoUrl,
    sizes: p.sizes as Record<string, number> | DualVariantData | null,
    sizeSystem: p.sizeSystem,
    badges: p.badges as string[] | null,
    category: p.category,
    featured: p.featured,
    createdAt: p.createdAt,
    variants: p.variants,
  }));

  // Use HomepageBanner hero image as coverPhoto fallback
  const heroBanner = heroBanners[0] ?? null;
  const resolvedCoverPhoto =
    tenant.coverPhoto || (heroBanner?.imageUrl ?? null);

  // Parse JSON checkout settings with defaults, resolve legacy template IDs
  const tenantForBioLink = {
    ...tenant,
    coverPhoto: resolvedCoverPhoto,
    coverTemplate: resolveTemplateId(tenant.coverTemplate || tenant.template),
    currency: tenant.currency || "HKD",
    region: tenant.region || "HK",
    languages: tenant.languages || ["zh-HK", "en"],
    deliveryOptions:
      (tenant.deliveryOptions as DeliveryOption[] | null) ||
      DEFAULT_DELIVERY_OPTIONS,
    socialLinks:
      (tenant.socialLinks as Array<{ platform: string; url: string }>) || [],
    freeShippingThreshold: tenant.freeShippingThreshold,
    orderConfirmMessage:
      (tenant.orderConfirmMessage as OrderConfirmConfig | null) ||
      DEFAULT_ORDER_CONFIRM,
  };

  // Store + ItemList JSON-LD（ItemList cap 100 控制 HTML 重量；
  // 商品 URL 用 subdomain canonical 形式，對應 sitemap）
  const storeBase = `https://${slug}.wowlix.com`;
  const storeLocale =
    (tenant.languages && tenant.languages[0]) || "en";
  const storeJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Store",
        name: tenant.name,
        url: `${storeBase}/${storeLocale}`,
        ...(tenant.description ? { description: tenant.description } : {}),
      },
      {
        "@type": "ItemList",
        itemListElement: serialized.slice(0, 100).map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: p.title,
          url: `${storeBase}/${storeLocale}/product/${p.id}`,
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd) }}
      />
      <BioLinkPage tenant={tenantForBioLink} products={serialized} />
    </>
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { name: true, description: true, coverPhoto: true },
    });
    if (!tenant) return {};

    const title = `${tenant.name} | WoWlix`;
    const description = tenant.description || `Shop at ${tenant.name}`;
    const pageUrl = `https://www.wowlix.com/${slug}`;

    // Note: do NOT set `openGraph.images` / `twitter.images` here. Next.js
    // auto-discovers the dynamic image from `opengraph-image.tsx` co-located
    // with this route — explicitly setting an array shadows it and forces
    // the static fallback.
    return {
      title,
      description,
      alternates: { canonical: pageUrl },
      openGraph: {
        title: `${tenant.name} | WoWlix`,
        description,
        type: "website",
        url: pageUrl,
        siteName: "WoWlix",
      },
      twitter: {
        card: "summary_large_image",
        title: `${tenant.name} | WoWlix`,
        description,
      },
    };
  } catch (err) {
    console.error(`[slug/${slug}] metadata query failed:`, err);
    return {};
  }
}
