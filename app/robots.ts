import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  // www = 真 host（apex 307 → www）—— sitemap 全份統一 www，robots 都要指同一 host
  const baseUrl = 'https://www.wowlix.com'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
