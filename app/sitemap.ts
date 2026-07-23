import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // www = 真 host（apex 全路徑 307 → www；Vercel domains 兩個都掛喺 project）。
  // 全份 sitemap 統一一個 host —— 混 host 會踩 sitemap cross-host rule，
  // 商品 URL 嗰家族隨時俾 search engine 當 cross-host 掉咗（Bing 直情硬性
  // 同 host）。留意 platform 頁 canonical 仲係 apex 形式（歷史遺留），
  // 唔喺呢度郁 —— apex 307 會令 engine 自己 resolve 落 www。
  const baseUrl = "https://www.wowlix.com";

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
      select: { id: true, slug: true, languages: true },
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
    // 商品 URL 已依 (b) 路線加返：path biolink route [slug]/product/[id]
    //（2026-07-23 起，tenant 由 path slug 解析，咩 host 都可達）。
    // 如果第日行 (a)（補 wildcard DNS）想轉返 subdomain canonical，要連
    // [slug]/product/[id] canonical、biolink 卡 href、lib/biolink-data.ts
    // 一齊轉，唔好淨改呢度。
    for (const tenant of tenants) {
      tenantPages.push({
        url: `${baseUrl}/${tenant.slug}`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.9,
      });
    }

    // 商品獨立 URL —— canonical 形式同 [slug]/product/[id] 頁自身 canonical
    // 一致（lib/biolink-data.ts productUrl；store 主 locale 一條，唔逐 locale 炒
    // duplicate）。
    const { productUrl } = await import("@/lib/biolink-data");
    const tenantById = new Map(tenants.map((t) => [t.id, t]));
    const products = await prisma.product.findMany({
      where: {
        tenantId: { in: tenants.map((t) => t.id) },
        active: true,
        hidden: false,
        deletedAt: null,
      },
      select: { id: true, tenantId: true },
    });
    for (const product of products) {
      const tenant = tenantById.get(product.tenantId);
      if (!tenant) continue;
      const storeLocale = tenant.languages[0] || "en";
      tenantPages.push({
        url: productUrl(storeLocale, tenant.slug, product.id),
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    // DB unavailable at build time — return platform pages only
  }

  return [...platformPages, ...tenantPages];
}
