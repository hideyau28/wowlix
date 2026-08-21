import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import ProductCard from "@/components/ProductCard";
import type { Metadata } from "next";

type ResolvedBadge = {
  nameZh: string;
  nameEn: string;
  color: string;
};

function isCuid(value: string) {
  return value.startsWith("c") && value.length >= 25;
}

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

// Force dynamic rendering because we need headers() for tenant resolution
// （(customer)/layout.tsx 已經 set 咗，呢度重申係因為本頁自己讀 headers()——
// 第日 layout 嗰行俾人搬走，唔想呢頁靜靜雞變返 static。）
export const dynamic = "force-dynamic";

/**
 * 解析「呢個 request 屬於邊間店」，順手攞埋出 <title> 要嘅店名。
 *
 * ⚠️ 以前呢頁兩個 call site 都係 `await resolveTenant()` —— 冇傳 req。
 * lib/tenant.ts:59 冇 Request 就 skip 晒 host/header 解析，slug 永遠跌返
 * DEFAULT_SLUG（maysshop），即係人人間店嘅 /{locale}/categories/{slug} 都出
 * maysshop 嘅分類、產品同 badge。左手邊個 CategoryBrowseNav 行 /api/categories
 * （用 getTenantId(req)，本身啱），出啱嘅店嘅分類 → 撳落去出人哋間店，肉眼見到。
 *
 * Server Component 攞唔到 Request object，所以要行 next/headers 讀 middleware
 * set 嗰個 x-tenant-slug（middleware.ts:297-300 先剷走 inbound 同名 header 再
 * set 可信值，client 偽造唔到）。
 *
 * 特登唔用 getServerTenantId()：
 * 1. 佢淨係 return id，攞唔到 <title> 要嘅 tenant.name（要行多一 query）；
 * 2. 佢租戶唔存在／停用就 throw —— 而家有 loading.tsx 個 <Suspense> 頂住睇落
 *    冇事，但嗰個坑修好之後，stale __dev_tenant cookie / ?tenant=打錯 就會變真
 *    500。「呢間店唔存在」係 404 唔係 server 死咗，所以呢度 return null 由
 *    caller 決定出 404。
 * 3. DB 出事（timeout / pool 爆）照樣 throw 上去 → 真 500，唔會扮 404 呃走
 *    monitoring 同 Google。
 */
type CategoryTenant = { id: string; name: string };

async function resolveCategoryTenant(): Promise<CategoryTenant | null> {
  const tenantSlug = (await headers()).get("x-tenant-slug");
  // 冇 header = 呢個 request 冇經過 middleware（matcher 剔走含「.」嘅 path）。
  // 冇租戶 context 就唔好靠估跌落 default 店 —— 嗰個正正係要修嘅 bug。
  if (!tenantSlug) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, name: true, status: true },
  });

  if (!tenant || tenant.status !== "active") return null;

  return { id: tenant.id, name: tenant.name };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const isZh = locale === "zh-HK";

  try {
    const tenant = await resolveCategoryTenant();
    if (!tenant) {
      // metadata 唔可以 call notFound()（佢靠 throw 傳遞，會俾下面個 catch 食咗）。
      // 出個中性 title 算數 —— 同一個 request 個 body 會照出 404。
      return { title: "Category" };
    }

    const category = await prisma.category.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug } },
      select: { name: true },
    });

    if (!category) {
      return { title: "Category Not Found" };
    }

    const title = `${category.name} — ${tenant.name}`;
    const description = isZh
      ? `瀏覽 ${category.name} 系列產品`
      : `Browse ${category.name} products`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
      },
    };
  } catch {
    return { title: "Category" };
  }
}

export default async function CategoryPage({ params }: Props) {
  const { locale, slug } = await params;
  const l = locale as Locale;
  const isZh = l === "zh-HK";

  // 同 generateMetadata 行同一個 resolver，兩邊唔會各講各話。
  // 租戶認唔到（stale __dev_tenant cookie、?tenant= 打錯、店停用）→ 呢條 URL
  // 根本冇內容，出 404，唔好 500。
  const tenant = await resolveCategoryTenant();
  if (!tenant) {
    notFound();
  }

  // Fetch category by slug + tenantId
  const category = await prisma.category.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug } },
    include: {
      children: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!category || !category.active) {
    notFound();
  }

  // Collect category IDs (self + children) for product lookup
  const categoryIds = [
    category.id,
    ...category.children.map((c: { id: string }) => c.id),
  ];

  // Fetch active products in this category or its children
  const products = await prisma.product.findMany({
    where: {
      categoryId: { in: categoryIds },
      active: true,
      hidden: false,
      tenantId: tenant.id,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    include: {
      variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  // Resolve badge IDs to display names/colors
  const allBadges = await prisma.badge.findMany({ where: { tenantId: tenant.id } });
  const badgeMap = new Map(
    allBadges.map((b: { id: string; nameZh: string; nameEn: string; color: string }) => [b.id, b])
  );

  type ProductRow = (typeof products)[number];
  const productsWithBadges = products.map((product: ProductRow) => {
    const resolvedBadges: ResolvedBadge[] = [];
    if (Array.isArray(product.badges)) {
      for (const entry of product.badges) {
        if (typeof entry !== "string") continue;
        if (isCuid(entry)) {
          const badge = badgeMap.get(entry) as ResolvedBadge | undefined;
          if (badge) {
            resolvedBadges.push({ nameZh: badge.nameZh, nameEn: badge.nameEn, color: badge.color });
          }
        } else {
          resolvedBadges.push({ nameZh: entry, nameEn: entry, color: "" });
        }
      }
    }
    return { ...product, resolvedBadges };
  });

  type ProductWithBadges = (typeof productsWithBadges)[number];
  // Map to ProductCard format
  const productList = productsWithBadges.map((p: ProductWithBadges) => ({
    id: p.id,
    brand: p.brand || undefined,
    title: p.title,
    image: p.imageUrl || undefined,
    price: p.price,
    originalPrice: p.originalPrice,
    stock: p.stock ?? 0,
    resolvedBadges: p.resolvedBadges,
    promotionBadges: p.promotionBadges ?? undefined,
    sizes: (p.sizes as Record<string, number> | null) ?? undefined,
  }));

  // Find parent category for breadcrumb if this is a child category
  let parentCategory: { name: string; slug: string } | null = null;
  if (category.parentId) {
    // findFirst + tenantId，唔用 findUnique({ id })：bare-id lookup 冇租戶
    // filter。admin API 而家開/改分類會驗 parent 同店（app/api/admin/categories
    // /route.ts:67-73），但顯示層唔應該靠上游把關 —— 呢個 commit 就係修租戶
    // 隔離，唔好留返最後一句 unscoped query 喺同一個檔。
    // 正常資料行為完全一樣（id 本身已經唯一），純粹 defense in depth。
    const parent = await prisma.category.findFirst({
      where: { id: category.parentId, tenantId: tenant.id },
      select: { name: true, slug: true },
    });
    parentCategory = parent;
  }

  return (
    <div className="px-4 py-6 pb-28">
      <div className="mx-auto max-w-6xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-zinc-500 mb-4">
          <Link href={`/${locale}`} className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
            {isZh ? "主頁" : "Home"}
          </Link>
          <span>/</span>
          {parentCategory && (
            <>
              <Link
                href={`/${locale}/categories/${parentCategory.slug}`}
                className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                {parentCategory.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-zinc-900 dark:text-zinc-100 font-medium">{category.name}</span>
        </nav>

        {/* Category header */}
        {category.imageUrl ? (
          <div className="relative w-full h-40 md:h-56 rounded-xl overflow-hidden mb-6">
            <img
              src={category.imageUrl}
              alt={category.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <h1 className="absolute bottom-4 left-4 text-2xl font-bold text-white">
              {category.name}
            </h1>
          </div>
        ) : (
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            {category.name}
          </h1>
        )}

        {/* Sub-categories navigation */}
        {category.children.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 -mx-4 px-4">
            {category.children.map((child: { id: string; name: string; slug: string }) => (
              <Link
                key={child.id}
                href={`/${locale}/categories/${child.slug}`}
                className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: "var(--tmpl-accent, #2D6A4F)",
                  color: "white",
                  opacity: 0.85,
                }}
              >
                {child.name}
              </Link>
            ))}
          </div>
        )}

        {/* Product count */}
        <p className="text-sm text-gray-500 mb-4">
          {isZh
            ? `顯示 ${productList.length} 件產品`
            : `Showing ${productList.length} products`}
        </p>

        {/* Products grid */}
        {productList.length === 0 ? (
          <div className="mt-12 text-center">
            <div className="text-5xl mb-4">👟</div>
            <p className="text-zinc-500">
              {isZh ? "呢個分類暫時冇產品" : "No products in this category"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {productList.map((p: (typeof productList)[number]) => (
              <ProductCard key={p.id} locale={l} p={p} fillWidth />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
