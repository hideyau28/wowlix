import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BioLinkPage from "@/components/biolink/BioLinkPage";
import type { Metadata } from "next";
import {
  loadBioLinkData,
  productUrl,
  BIOLINK_BASE,
} from "@/lib/biolink-data";
import { biolinkUrl } from "@/lib/site-url";

// Force dynamic rendering — tenant slug pages need DB access per request
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string; locale: string }>;
};

export default async function SlugPage({ params }: PageProps) {
  const { slug } = await params;

  const data = await loadBioLinkData(slug);
  if (!data) notFound();
  const { tenant, products, storeLocale } = data;

  // Store + ItemList JSON-LD（ItemList cap 100 控制 HTML 重量；商品 URL 用
  // path biolink 形式 —— subdomain 冇 wildcard DNS，係死鏈，見 lib/biolink-data.ts）
  const storeJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Store",
        name: tenant.name,
        url: `${BIOLINK_BASE}/${slug}`,
        ...(tenant.description ? { description: tenant.description } : {}),
      },
      {
        "@type": "ItemList",
        itemListElement: products.slice(0, 100).map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: p.title,
          url: productUrl(storeLocale, slug, p.id),
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
      <BioLinkPage tenant={tenant} products={products} />
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
    const pageUrl = biolinkUrl(slug);

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
