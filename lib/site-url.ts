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

/**
 * 商戶「攞出去用」嗰條店連結 —— copy-to-clipboard、WhatsApp 追單、
 * IG bio、QR。**呢個係人真係會撳嘅 URL，唔准出 redirect 或者死 host。**
 *
 * 有自訂域名就行自訂域名；否則 path biolink（唔係 subdomain —— wildcard
 * DNS 唔存在）。留意同**顯示文字**分開：畫面上寫短版 `wowlix.com/{slug}`
 * 冇問題（apex 307 得到），但複製／send 出去嗰條一定要用呢個。
 */
export function storeShareUrl(
  slug: string | null | undefined,
  customDomain?: string | null,
): string {
  if (customDomain) return `https://${customDomain}`;
  return slug ? biolinkUrl(slug) : SITE_URL;
}
