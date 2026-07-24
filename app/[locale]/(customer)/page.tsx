import { getDict, type Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getStoreName } from "@/lib/get-store-name";
import { getServerTenantId, isPlatformMode } from "@/lib/tenant";
import { getTenantInfo } from "@/lib/get-tenant-info";
import { getSEOContent } from "@/lib/tenant-content";
import {
  OG_DEFAULT_IMAGE,
  ORGANIZATION_ID,
  SITE_URL,
  biolinkUrl,
  platformUrl,
} from "@/lib/site-url";
import HeroCarouselCMS from "@/components/home/HeroCarouselCMS";
import RecommendedGrid from "@/components/home/RecommendedGrid";
import FeaturedSneakers from "@/components/home/FeaturedSneakers";
import SportsApparel from "@/components/home/SportsApparel";
import RecentlyViewed from "@/components/home/RecentlyViewed";
import SaleZone from "@/components/home/SaleZone";
import KidsSection from "@/components/home/KidsSection";
import { Metadata } from "next";
import TrustBar from "@/components/TrustBar";

// LandingPage 一律 lazy import：static import 會將 marketing fonts（Fraunces 等）
// 綁入成條 (customer) route graph，租戶店白食 preload/CSS（fonts.ts 註釋記低嘅
// 污染）。正常 platform 流量已由 middleware rewrite 去靜態 /[locale]/landing，
// 呢度兩個 branch 只係 middleware 冇捕到嘅 fallback（unknown tenant / 邊緣 case）。
const loadLandingPage = () =>
  import("@/components/marketing/WowlixLandingPage").then((m) => m.default);

// Force dynamic rendering because we need headers() for tenant resolution
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const platformMeta = {
    title: "WoWlix — Turn Followers into Customers",
    description:
      "Instagram 小店嘅最強武器。2 分鐘開店，一條連結搞掂所有嘢。免費開始。",
    alternates: {
      // Self-referencing canonical per locale（唔好指去會 redirect 嘅 apex ——
      // apex 全路徑 307 → www，見 lib/site-url.ts）+ 絕對 hreflang
      canonical: platformUrl(locale === "en" ? "en" : "zh-HK"),
      languages: {
        en: platformUrl("en"),
        "zh-HK": platformUrl("zh-HK"),
        "x-default": platformUrl("zh-HK"),
      },
    },
    openGraph: {
      title: "WoWlix — Turn Followers into Customers",
      description: "Instagram 小店嘅最強武器。2 分鐘開店，一條連結搞掂所有嘢。",
      url: SITE_URL,
      siteName: "WoWlix",
      locale: "zh_HK",
      type: "website" as const,
      images: [
        {
          url: OG_DEFAULT_IMAGE,
          width: 1200,
          height: 630,
          alt: "WoWlix",
        },
      ],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: "WoWlix — Turn Followers into Customers",
      description: "Instagram 小店嘅最強武器。2 分鐘開店，一條連結搞掂所有嘢。",
      images: [OG_DEFAULT_IMAGE],
    },
  };

  // Platform bare domain → landing page metadata
  if (await isPlatformMode()) {
    return platformMeta;
  }

  // Fallback: check if tenant exists
  try {
    await getServerTenantId();
  } catch (error) {
    return platformMeta;
  }

  const { headers } = await import("next/headers");
  const headersList = await headers();
  const tenantSlug = headersList.get("x-tenant-slug") || "maysshop";

  const storeName = await getStoreName();
  const seo = getSEOContent(tenantSlug);

  const title = seo.title.replace("{storeName}", storeName);
  const description = seo.description.replace("{storeName}", storeName);
  // ⚠️ 以前係 `https://{slug}.wowlix.com/{locale}` —— wildcard DNS 唔存在
  // （dig NXDOMAIN），即係 canonical 指住一個開唔到嘅 host。呢個 branch 唔係
  // 死 code：platform host 加 `?tenant={slug}`（demo 預覽）會令 tenantOverridden
  // = true → x-is-platform 冇 set → 跌落呢度 render，實測真係出咗死 canonical。
  // 併軌去 path biolink（同 [slug]/page.tsx self-canonical 同一個 URL），預覽
  // URL 嘅 signal 直接歸邊間店嘅正本頁。
  const canonicalUrl = biolinkUrl(tenantSlug);
  const ogImage = seo.ogImage;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      siteName: storeName,
      type: "website",
      locale: locale === "zh-HK" ? "zh_HK" : "en_US",
      images: ogImage
        ? [{ url: ogImage, width: 1200, height: 630, alt: storeName }]
        : undefined,
    },
  };
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function fetchSectionProducts(
  section: {
    title: string;
    filterType: string | null;
    filterValue: string | null;
    productIds: string[];
  },
  allProducts: any[],
) {
  const KIDS_SHOE_TYPES = ["grade_school", "preschool", "toddler"];
  const isKidsSection = section.title === "童裝專區";

  const filterByAgeGroup = (products: any[]) => {
    if (isKidsSection) {
      return products.filter((p) => KIDS_SHOE_TYPES.includes(p.shoeType || ""));
    }
    return products.filter((p) => !KIDS_SHOE_TYPES.includes(p.shoeType || ""));
  };

  if (section.productIds && section.productIds.length > 0) {
    const productMap = new Map(allProducts.map((p) => [p.id, p]));
    const selected = section.productIds
      .map((id) => productMap.get(id))
      .filter(Boolean);
    return filterByAgeGroup(selected).slice(0, 10);
  }

  if (section.filterType && section.filterValue) {
    let filtered: any[] = [];

    switch (section.filterType) {
      case "category":
        filtered = allProducts.filter(
          (p) => p.category === section.filterValue,
        );
        break;
      case "shoeType":
        if (section.filterValue === "kids") {
          filtered = allProducts.filter((p) =>
            KIDS_SHOE_TYPES.includes(p.shoeType || ""),
          );
          return shuffleArray(filtered).slice(0, 10);
        } else {
          filtered = allProducts.filter(
            (p) => p.shoeType === section.filterValue,
          );
        }
        break;
      case "featured":
        filtered = allProducts.filter((p) => p.featured);
        break;
      case "promotion":
        filtered = allProducts.filter((p) =>
          p.promotionBadges?.includes(section.filterValue!),
        );
        break;
      default:
        filtered = allProducts;
    }

    return shuffleArray(filterByAgeGroup(filtered)).slice(0, 10);
  }

  return [];
}

type HomepageItem =
  | { type: "section"; data: any; products: any[] }
  | { type: "banner"; data: any };

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = locale as Locale;
  const t = getDict(l);

  // Platform bare domain → landing page
  if (await isPlatformMode()) {
    // Organization + SoftwareApplication JSON-LD — 平台首頁結構化資料
    const platformJsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": ORGANIZATION_ID,
          name: "WoWlix",
          url: SITE_URL,
          logo: OG_DEFAULT_IMAGE,
        },
        {
          "@type": "SoftwareApplication",
          name: "WoWlix",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: SITE_URL,
          description:
            "Instagram 小店嘅最強武器。2 分鐘開店，一條連結搞掂所有嘢。免費開始。",
          offers: { "@type": "Offer", price: "0", priceCurrency: "HKD" },
        },
      ],
    };
    const LandingPage = await loadLandingPage();
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(platformJsonLd) }}
        />
        <LandingPage locale={l} />
      </>
    );
  }

  // Check if tenant exists; if not, show landing page
  let tenantId: string;
  try {
    tenantId = await getServerTenantId();
  } catch (error) {
    // Tenant not found
    const LandingPage = await loadLandingPage();
    return <LandingPage locale={l} />;
  }

  // Fetch tenant region for conditional UI (TrustBar etc.)
  const tenantRow = await prisma.tenant
    .findUnique({
      where: { id: tenantId },
      select: { region: true },
    })
    .catch(() => null);

  const PAID_STATUSES = ["PAID", "FULFILLING", "SHIPPED", "COMPLETED"] as const;
  const hpNow = new Date();
  const start30 = new Date(
    hpNow.getFullYear(),
    hpNow.getMonth(),
    hpNow.getDate() - 29,
  );

  const [sectionsRaw, bannersRaw, allProductsRaw, paidOrders] =
    await Promise.all([
      prisma.homepageSection.findMany({
        where: { active: true, tenantId },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.homepageBanner.findMany({
        where: { active: true, tenantId },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.product.findMany({
        where: { active: true, hidden: false, tenantId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.findMany({
        where: {
          tenantId,
          createdAt: { gte: start30 },
          status: { in: [...PAID_STATUSES] },
        },
        select: { items: true },
      }),
    ]);

  // Compute top 3 seller IDs for 🔥 badge
  const productSales = new Map<string, number>();
  for (const order of paidOrders) {
    const items = Array.isArray(order.items)
      ? (order.items as Record<string, unknown>[])
      : [];
    for (const item of items) {
      const productId =
        typeof item?.productId === "string" ? item.productId : null;
      if (!productId) continue;
      const qty = Number(item?.quantity ?? item?.qty ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      productSales.set(productId, (productSales.get(productId) || 0) + qty);
    }
  }
  const topSellerIds = Array.from(productSales.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  const allProducts = allProductsRaw.map((p) => ({
    id: p.id,
    brand: p.brand || "",
    title: p.title,
    price: p.price,
    originalPrice: p.originalPrice,
    category: p.category || "",
    image:
      p.imageUrl ||
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=60",
    sizes: p.sizes as Record<string, number> | null,
    stock: p.stock ?? 0,
    shoeType: p.shoeType || null,
    featured: p.featured || false,
    promotionBadges: (p.promotionBadges as string[]) || [],
  }));

  const unifiedItems: HomepageItem[] = [];

  for (const section of sectionsRaw) {
    const products = await fetchSectionProducts(section, allProducts);
    unifiedItems.push({ type: "section", data: section, products });
  }

  for (const banner of bannersRaw) {
    unifiedItems.push({ type: "banner", data: banner });
  }

  unifiedItems.sort((a, b) => a.data.sortOrder - b.data.sortOrder);

  // No need to group banners anymore - each banner can have multiple images
  type RenderItem =
    | { type: "section"; data: any; products: any[] }
    | { type: "banner"; data: any };

  const renderItems: RenderItem[] = unifiedItems;

  const saleProducts = allProducts
    .filter((p) => p.originalPrice && p.originalPrice > p.price)
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      brand: p.brand,
      title: p.title,
      price: p.price,
      originalPrice: p.originalPrice!,
      image: p.image,
      sizes: p.sizes,
      stock: p.stock,
    }));

  const fallbackProducts = shuffleArray(allProducts)
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      image: p.image,
      sizes: p.sizes,
      stock: p.stock,
    }));

  const firstBannerIndex = renderItems.findIndex((i) => i.type === "banner");

  // 店舖身份 JSON-LD — 反映租戶身份（之前 hardcode 做 WoWlix，錯標所有租戶店）
  const { headers: getStoreHeaders } = await import("next/headers");
  const storeHeaders = await getStoreHeaders();
  const storeSlug = storeHeaders.get("x-tenant-slug") || "maysshop";
  const storeDisplayName = await getStoreName();

  return (
    <div className="pb-16">
      {/* Store JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Store",
            name: storeDisplayName,
            // 同上面 canonical 一樣接返 path biolink —— subdomain host 開唔到，
            // JSON-LD 出個死 url 只會令 engine 對唔到 entity。
            url: biolinkUrl(storeSlug),
          }),
        }}
      />

      {renderItems.map((item, idx) => {
        if (item.type === "banner") {
          const banner = item.data;

          // Get slides from banner.images or fallback to old imageUrl field
          const slides =
            banner.images && banner.images.length > 0
              ? banner.images
              : [
                  {
                    imageUrl: banner.imageUrl,
                    linkUrl: banner.linkUrl,
                    title: banner.title,
                    subtitle: banner.subtitle,
                  },
                ];

          const carouselSlides = slides.map((slide: any, idx: number) => ({
            key: `${banner.id}-${idx}`,
            title: slide.title || "",
            subtitle: slide.subtitle || undefined,
            buttonLink: slide.linkUrl || undefined,
            imageUrl: slide.imageUrl || undefined,
          }));

          return (
            <div key={`banner-${banner.id}`}>
              <HeroCarouselCMS slides={carouselSlides} locale={l} />
              {idx === firstBannerIndex && (
                <TrustBar locale={l} region={tenantRow?.region} />
              )}
            </div>
          );
        }

        const section = item.data;
        const products = item.products;

        if (products.length === 0) return null;

        const isLarge = section.cardSize === "large";
        const isKidsSection =
          section.filterType === "shoeType" && section.filterValue === "kids";

        let viewAllHref = `/${locale}/products`;
        if (section.filterType === "category" && section.filterValue) {
          viewAllHref = `/${locale}/products?category=${encodeURIComponent(section.filterValue)}`;
        } else if (section.filterType === "shoeType") {
          if (section.filterValue === "kids") {
            viewAllHref = `/${locale}/products?shoeType=grade_school,preschool,toddler`;
          } else if (section.filterValue) {
            viewAllHref = `/${locale}/products?shoeType=${section.filterValue}`;
          }
        } else if (section.filterType === "featured") {
          viewAllHref = `/${locale}/products?featured=true`;
        }

        const SectionComponent = isKidsSection
          ? KidsSection
          : isLarge
            ? FeaturedSneakers
            : section.filterType === "featured"
              ? RecommendedGrid
              : SportsApparel;

        return (
          <SectionComponent
            key={section.id}
            locale={l}
            products={products}
            title={section.title}
            viewAllText={t.home.viewAll}
            viewAllHref={viewAllHref}
            topSellerIds={topSellerIds}
          />
        );
      })}

      <div id="home-search-sentinel" className="h-px w-full" />

      {saleProducts.length > 0 && (
        <SaleZone
          locale={l}
          products={saleProducts}
          title={t.home.onSale}
          viewAllText={t.home.viewAll}
        />
      )}

      <RecentlyViewed
        locale={l}
        fallbackProducts={fallbackProducts}
        recentTitle={t.home.recentlyViewed}
        fallbackTitle={t.home.youMightLike}
      />
    </div>
  );
}
