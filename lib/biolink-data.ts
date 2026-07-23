import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { resolveTemplateId } from "@/lib/cover-templates";
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

// Biolink 店數據 loader —— [slug]/page.tsx 同 [slug]/product/[id]/page.tsx 共用
//（以前 inline 喺 [slug]/page.tsx，起商品獨立頁時抽出嚟）。
// React cache()：同一 request 入面 generateMetadata + page 各 call 一次
// 只行一輪 DB query。

export type BioLinkTenant = NonNullable<
  Awaited<ReturnType<typeof loadBioLinkData>>
>["tenant"];

export const loadBioLinkData = cache(async (slug: string) => {
  let tenantRow;
  try {
    tenantRow = await prisma.tenant.findUnique({
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
    console.error(`[biolink-data/${slug}] tenant query failed:`, err);
    return null;
  }

  if (!tenantRow) return null;

  // Fetch hero banners for the biolink store（coverPhoto fallback）
  const heroBanners = await prisma.homepageBanner
    .findMany({
      where: { tenantId: tenantRow.id, active: true, position: "hero" },
      orderBy: { sortOrder: "asc" },
      take: 1,
    })
    .catch(() => []);

  const productRows = await prisma.product
    .findMany({
      where: {
        tenantId: tenantRow.id,
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
      console.error(`[biolink-data/${slug}] products query failed:`, err);
      return [];
    });

  // Serialize for client component (dates → strings via JSON, Json fields → typed)
  const products: ProductForBioLink[] = productRows.map((p) => ({
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
    tenantRow.coverPhoto || (heroBanner?.imageUrl ?? null);

  // Parse JSON checkout settings with defaults, resolve legacy template IDs
  const tenant = {
    ...tenantRow,
    coverPhoto: resolvedCoverPhoto,
    coverTemplate: resolveTemplateId(tenantRow.coverTemplate || tenantRow.template),
    currency: tenantRow.currency || "HKD",
    region: tenantRow.region || "HK",
    languages: tenantRow.languages || ["zh-HK", "en"],
    deliveryOptions:
      (tenantRow.deliveryOptions as DeliveryOption[] | null) ||
      DEFAULT_DELIVERY_OPTIONS,
    socialLinks:
      (tenantRow.socialLinks as Array<{ platform: string; url: string }>) || [],
    freeShippingThreshold: tenantRow.freeShippingThreshold,
    orderConfirmMessage:
      (tenantRow.orderConfirmMessage as OrderConfirmConfig | null) ||
      DEFAULT_ORDER_CONFIRM,
  };

  // 店嘅主 locale —— 商品 URL / JSON-LD / sitemap 全部用同一個 canonical locale
  const storeLocale = (tenant.languages && tenant.languages[0]) || "en";

  return { tenant, products, storeLocale };
});

// 商品 canonical URL 單一真相 —— 卡 href（相對形式）、JSON-LD、sitemap、
// product page canonical 全部由呢度生成。www 形式對齊 [slug] biolink 頁
// 現有 canonical（https://www.wowlix.com/{slug}）。
// ⚠️ 唔准用 {slug}.wowlix.com subdomain 形式 —— wildcard DNS 唔存在（見
// app/sitemap.ts 註釋）。
export const BIOLINK_BASE = "https://www.wowlix.com";

export function productPath(
  storeLocale: string,
  slug: string,
  productId: string,
): string {
  return `/${storeLocale}/${slug}/product/${productId}`;
}

export function productUrl(
  storeLocale: string,
  slug: string,
  productId: string,
): string {
  return `${BIOLINK_BASE}${productPath(storeLocale, slug, productId)}`;
}
