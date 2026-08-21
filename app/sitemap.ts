import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-url";

/**
 * 每個鐘重新產生一次。
 *
 * 以前完全冇 revalidate —— `.next/prerender-manifest.json` 個
 * `initialRevalidateSeconds` 係 false，即係 sitemap.xml 個 body 係 **build 果刻
 * 凍死**嘅。新開嘅店、新加嘅商品全部唔會入到份 sitemap，除非啱啱撞正有人
 * deploy。只有 toggleFeatured / toggleHidden / updatePrice 嗰幾個 action 因為
 * 順手 `revalidatePath("/", "layout")` 先會 purge 到，createProduct 同租戶
 * 註冊都唔會。
 *
 * 3600 秒係「新店最遲一個鐘入到索引」同「唔好每次 crawler 嚟都掃全表」之間
 * 嘅平衡；cold miss 會打一次 DB，query 本身已經有 try/catch。
 */
export const revalidate = 3600;

// 單次 sitemap 最多出幾多條商品 URL —— 唔封頂嘅話商品一多，
// 呢一 request 就會掃全表兼撐爆 response（sitemap 上限係 50,000 條）。
const MAX_PRODUCT_URLS = 20000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // www = 真 host（apex 全路徑 307 → www；Vercel domains 兩個都掛喺 project）。
  // 全份 sitemap 統一一個 host —— 混 host 會踩 sitemap cross-host rule，
  // 商品 URL 嗰家族隨時俾 search engine 當 cross-host 掉咗（Bing 直情硬性
  // 同 host）。platform 頁 canonical 以前仲係 apex 形式（sitemap 講 www、
  // canonical 講 apex，自己同自己嘈）—— 已經一齊掃埋去 www，全站共用
  // lib/site-url.ts 個 SITE_URL。
  const baseUrl = SITE_URL;

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
    // ⚠️ 以前呢度仲有 /en/collections /en/cart /en/orders —— 三條都係
    // **租戶客人個人化頁**（心願單／購物車／我嘅訂單），喺平台 host 上會
    // 解做 default 店，live 實測 /en/collections 個 title 直情係
    // 「My Wishlist - B」（B = 另一間店個名）。呢類頁本身就唔應該入 sitemap
    // （個人化、空、對搜尋者零價值），仲要係主動叫 Google 去 index 人哋
    // 間店嘅嘢。剷咗。真正嘅平台面 = 首頁兩個 locale + /pricing。
    {
      url: `${baseUrl}/en/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/zh-HK/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    // 平台內容頁（WoWlix 自己版本，both locale）—— 呢啲 host 上一定係 WoWlix
    // 內容（唔會 leak default 店），可以放心 index。about/faq 冇內部連結，
    // 唔入 sitemap 就淨靠 footer discover。
    ...["about", "faq", "contact"].flatMap((p) => [
      {
        url: `${baseUrl}/en/${p}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      },
      {
        url: `${baseUrl}/zh-HK/${p}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      },
    ]),
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
      orderBy: { updatedAt: "desc" },
      take: MAX_PRODUCT_URLS,
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
