import type { Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getServerTenantIdOrNull } from "@/lib/tenant";
import StoreNotFoundScreen from "@/components/StoreNotFoundScreen";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";

// Disable caching to ensure filters always show fresh results
export const dynamic = "force-dynamic";

// Quick suggestion chips (static)
const suggestions = {
  "zh-HK": ["Air Jordan", "Dunk", "Air Max", "New Balance", "Yeezy"],
  en: ["Air Jordan", "Dunk", "Air Max", "New Balance", "Yeezy"],
};

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    category?: string;
    shoeType?: string;
    minPrice?: string;
    maxPrice?: string;
    sizes?: string;
    badge?: string;
    sale?: string;
  }>;
}) {
  const { locale } = await params;
  const { q, category, shoeType, minPrice, maxPrice, sizes, badge, sale } = await searchParams;
  const l = locale as Locale;
  const query = q?.trim() || "";

  // 租戶認唔到（`?tenant=` 打錯、stale `__dev_tenant` cookie、店停用）。
  // (customer)/loading.tsx 個 <Suspense> 刪走之後，本來俾佢食走嘅 throw 會變
  // 真 500 —— 出返同首頁一模一樣嘅「呢間店唔存在」畫面（同一個 component）。
  // ⚠️ 用 getServerTenantIdOrNull() 而唔係 try/catch：DB 撲街照掟上去出真 500。
  const tenantId = await getServerTenantIdOrNull();
  if (!tenantId) {
    return <StoreNotFoundScreen />;
  }

  // Build base filter
  const where: any = { active: true, hidden: false, tenantId, deletedAt: null };

  // Text search filter
  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { brand: { contains: query, mode: "insensitive" } },
    ];
  }

  // Category filter
  if (category) {
    const categories = category.split(",").map((c) => c.trim()).filter(Boolean);
    if (categories.length > 1) {
      where.category = { in: categories };
    } else {
      where.category = category;
    }
  }

  // ShoeType filter
  if (shoeType) {
    const types = shoeType.split(",").map((t) => t.trim()).filter(Boolean);
    if (types.length > 1) {
      where.shoeType = { in: types };
    } else if (shoeType === "kids") {
      where.shoeType = { in: ["grade_school", "preschool", "toddler"] };
    } else {
      where.shoeType = shoeType;
    }
  }

  // Price range filter
  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) {
      where.price.gte = parseFloat(minPrice);
    }
    if (maxPrice) {
      where.price.lte = parseFloat(maxPrice);
    }
  }

  // Badge filter (e.g., 今期熱賣)
  if (badge) {
    where.promotionBadges = { has: badge };
  }

  // Fetch products
  let products: any[] = [];
  const hasFilters = query || category || shoeType || minPrice || maxPrice || sizes || badge || sale;

  if (hasFilters) {
    let dbProducts = await prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Sale filter (originalPrice > price) - must be done in memory
    if (sale === "true") {
      dbProducts = dbProducts.filter((p) => {
        if (!p.originalPrice) return false;
        return p.originalPrice > p.price;
      });
    }

    // Size filter (in memory since sizes is JSON)
    if (sizes) {
      const sizeList = sizes.split(",").map((s) => s.trim()).filter(Boolean);
      if (sizeList.length > 0) {
        dbProducts = dbProducts.filter((p) => {
          if (!p.sizes || typeof p.sizes !== "object") return false;
          const productSizes = Object.keys(p.sizes as Record<string, number>);
          return sizeList.some((size) => productSizes.includes(size));
        });
      }
    }

    products = dbProducts.map((p) => ({
      id: p.id,
      brand: p.brand || "",
      title: p.title,
      price: p.price,
      stock: (p as any).stock ?? 0,
      image: p.imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=60",
      badges: Array.isArray(p.badges) ? (p.badges as any[]) : [],
      sizes: (p as any).sizes || null,
    }));
  }

  const texts = {
    placeholder: l === "zh-HK" ? "搜尋商品..." : "Search products...",
    emptyState: l === "zh-HK" ? "輸入關鍵字搜尋商品" : "Enter keywords to search",
    quickSearch: l === "zh-HK" ? "快速搜尋" : "Quick search",
    noResults: l === "zh-HK" ? "找不到相關商品" : "No products found",
    tryAnother: l === "zh-HK" ? "試試其他關鍵字" : "Try different keywords",
    results: (n: number) => (l === "zh-HK" ? `找到 ${n} 件商品` : `${n} products found`),
  };

  return (
    <div className="min-h-screen pb-[calc(96px+env(safe-area-inset-bottom))]">
      <div className="px-4 pt-6">
        {/* No query: show empty state with suggestions */}
        {!query && (
          <div className="flex flex-col items-center pt-12">
            <div className="text-zinc-300 mb-6">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <p className="text-zinc-500 text-center mb-8">{texts.emptyState}</p>

            {/* Quick suggestion chips */}
            <div className="w-full max-w-sm">
              <p className="text-xs text-zinc-400 uppercase tracking-wide mb-3 text-center">
                {texts.quickSearch}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions[l].map((s) => (
                  <Link
                    key={s}
                    href={`/${l}/search?q=${encodeURIComponent(s)}`}
                    className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 transition-colors"
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Has query but no results */}
        {query && products.length === 0 && (
          <div className="flex flex-col items-center pt-12">
            <div className="text-zinc-300 mb-6">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 9.172a4 4 0 015.656 0M9 9l6 6m-6 0l6-6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-zinc-700 font-medium text-center">{texts.noResults}</p>
            <p className="text-zinc-400 text-sm mt-1 text-center">&ldquo;{query}&rdquo;</p>
            <p className="text-zinc-500 text-sm mt-4">{texts.tryAnother}</p>
          </div>
        )}

        {/* Has results */}
        {query && products.length > 0 && (
          <>
            <p className="text-sm text-zinc-500 mb-4">{texts.results(products.length)}</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} locale={l} p={p} fillWidth />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
