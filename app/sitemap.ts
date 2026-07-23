import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://wowlix.com";

  // Platform pages
  const platformPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/en`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/zh-HK`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/en/collections`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/en/cart`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/en/orders`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  // Fetch active tenants for tenant-specific sitemaps
  let tenantPages: MetadataRoute.Sitemap = [];
  try {
    // 只出真實已啟用商戶 —— 排除 e2e/test/phase 測試店同自我指向 slug，
    // 否則 sitemap 會塞滿 test.*/e2e-*/wowlix.wowlix.com 污染 crawl budget。
    const tenants = await prisma.tenant.findMany({
      where: {
        status: "active",
        NOT: [
          { slug: { startsWith: "e2e-" } },
          { slug: { startsWith: "test" } },
          { slug: { startsWith: "phase-" } },
          { slug: { in: ["wowlix", "www", "demo"] } },
        ],
      },
      select: { slug: true },
    });

    // ⚠️ 唔准 emit `{slug}.wowlix.com` subdomain URL —— `*.wowlix.com` wildcard
    // DNS 根本唔存在（2026-07-23 dig @1.1.1.1 實測 NXDOMAIN；Namecheap DNS 冇
    // wildcard record，Vercel project 冇 wildcard domain）。之前 971/977 條
    // sitemap URL（店頁/info 頁/商品頁）全部係 subdomain 形式 = 條條死鏈，
    // Search Console 狂報 fetch error 燒 crawl trust。
    //
    // 而家只出今日真可達嘅面：path biolink `wowlix.com/{slug}`（[slug] route，
    // live 實測 200 + self-canonical）。商品/info 頁暫時冇任何可達 URL 形式
    //（(customer) route 靠 host 解析 tenant，喺 www 上永遠係 default 店 context）
    // —— 所以唔出住，出咗都係 404。
    //
    // 加返嘅條件（Yau 決定，二選一）：
    // (a) 補 wildcard DNS + Vercel wildcard domain（要 NS 遷去 Vercel，會斷
    //     Namecheap email forwarding，要配套搬）→ revert 呢個 commit 就得；
    // (b) 起 path-based 商品 route（[slug]/product/[id]）→ 依 path 形式加返。
    for (const tenant of tenants) {
      tenantPages.push({
        url: `${baseUrl}/${tenant.slug}`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.9,
      });
    }
  } catch {
    // DB unavailable at build time — return platform pages only
  }

  return [...platformPages, ...tenantPages];
}
