import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BioLinkPage from "@/components/biolink/BioLinkPage";
import { loadBioLinkData, productUrl } from "@/lib/biolink-data";
import { OG_DEFAULT_IMAGE } from "@/lib/site-url";

// 商品獨立 URL（path biolink 形式）—— audit 線「商品 URL 出街」嘅可達版本。
//
// 背景：(customer)/product/[id] 靠 host header 解析 tenant，但 *.wowlix.com
// wildcard DNS 唔存在，非 default 租戶嘅商品喺嗰條 route 上根本冇可達 URL
//（www 上會解做 default 店 context → 404）。呢條 route 由 path slug 解析
// tenant（同 [slug]/page、[slug]/order/[id] 一致），咩 host 都得。
//
// 體驗設計：render 成個 biolink 店 + 自動開咗個 product sheet —— share link
// 落地即刻見到商品、可以直接買（cart/checkout 機器全部係 biolink 現成嘅）。
// SEO：product metadata + Product JSON-LD 喺 server 出，sheet 內容 SSR 埋。
//
// 商品歸屬檢查：products 係 tenant-scoped query 嘅結果，搵唔到 id = 唔係
// 呢間店嘅商品（或者已落架）→ 404，冇跨租戶 IDOR 面。
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string; locale: string; id: string }>;
};

export default async function BiolinkProductPage({ params }: PageProps) {
  const { slug, id } = await params;

  const data = await loadBioLinkData(slug);
  if (!data) notFound();
  const { tenant, products, storeLocale } = data;

  const product = products.find((p) => p.id === id);
  if (!product) notFound();

  // Product JSON-LD — offers 用店 currency；url = canonical 自身
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    ...(product.imageUrl ? { image: product.imageUrl } : {}),
    url: productUrl(storeLocale, slug, id),
    offers: {
      "@type": "Offer",
      price: String(product.price),
      priceCurrency: tenant.currency || "HKD",
      url: productUrl(storeLocale, slug, id),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <BioLinkPage
        tenant={tenant}
        products={products}
        initialProductId={id}
      />
    </>
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, id } = await params;

  const data = await loadBioLinkData(slug);
  if (!data) return {};
  const { tenant, products, storeLocale } = data;

  const product = products.find((p) => p.id === id);
  if (!product) return {};

  const title = `${product.title} | ${tenant.name}`;
  const description =
    tenant.description || `${product.title} — ${tenant.name} on WoWlix`;
  const pageUrl = productUrl(storeLocale, slug, id);

  // 商品頁特登 override 咗 [slug] 級 opengraph-image（og 圖要係件商品）。
  // ⚠️ leaf 設咗 openGraph 就會成嚿取代 parent resolved openGraph —— 冇圖
  // 商品唔 fallback 嘅話會變成完全冇 og:image（review 抓住），所以一定要有
  // fallback chain：商品圖 → 店 cover → 店 logo → 平台 default。
  const ogImage =
    product.imageUrl ||
    tenant.coverPhoto ||
    tenant.logoUrl ||
    OG_DEFAULT_IMAGE;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      type: "website",
      url: pageUrl,
      siteName: "WoWlix",
      images: [{ url: ogImage, width: 1200, height: 630, alt: product.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}
