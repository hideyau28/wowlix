/**
 * 平台 canonical host 單一真相。
 *
 * ⚠️ www 先係最終落地 host —— apex（wowlix.com）喺 Vercel domain 層全路徑
 * 307 → www（實測：/、/pricing、/en/pricing 全部 307）。canonical / hreflang /
 * OG url / JSON-LD url 一律要指最終 URL，指住 apex = 每個 signal 都要 engine
 * 行多一個 redirect hop 先 resolve 到，兼夾硬同 sitemap（一早統一 www）打交。
 *
 * ⚠️ 唔准用 {slug}.wowlix.com subdomain 形式 —— wildcard DNS 唔存在
 * （dig NXDOMAIN，見 app/sitemap.ts 註釋）。租戶面一律 path biolink 形式。
 */
export const SITE_URL = "https://www.wowlix.com";

/** 預設 OG / JSON-LD 分享圖（絕對 URL —— crawler 唔一定有 metadataBase）。 */
export const OG_DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;

/** Organization JSON-LD node 嘅穩定 @id（publisher ref 要用同一個值）。 */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

/** 平台頁絕對 URL，例：platformUrl("en") / platformUrl("en", "/pricing")。 */
export function platformUrl(locale: string, path = ""): string {
  return `${SITE_URL}/${locale}${path}`;
}

/** 租戶 biolink 絕對 URL（bare path 形式，同 [slug] 頁 self-canonical 一致）。 */
export function biolinkUrl(slug: string): string {
  return `${SITE_URL}/${slug}`;
}
