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
      select: { slug: true, languages: true },
    });

    const infoPages = [
      "about",
      "contact",
      "faq",
      "shipping",
      "returns",
      "terms",
      "privacy",
    ];

    for (const tenant of tenants) {
      const tenantBase = `https://${tenant.slug}.wowlix.com`;
      const locales = tenant.languages.length > 0 ? tenant.languages : ["en"];

      for (const locale of locales) {
        // Home
        tenantPages.push({
          url: `${tenantBase}/${locale}`,
          lastModified: new Date(),
          changeFrequency: "daily",
          priority: 0.9,
        });

        // Info pages
        for (const page of infoPages) {
          tenantPages.push({
            url: `${tenantBase}/${locale}/${page}`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.5,
          });
        }
      }
    }
  } catch {
    // DB unavailable at build time — return platform pages only
  }

  return [...platformPages, ...tenantPages];
}
