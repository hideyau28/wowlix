"use client";

import { usePathname } from "next/navigation";
import { locales } from "@/lib/i18n";

/**
 * 由 pathname 抽店舖 locale（subdomain 店 path = /{locale}/...）。
 * 首段唔係有效 locale（理論上 middleware 會補 prefix）就 fallback "en"。
 */
export function useStoreLocale(): string {
  const pathname = usePathname() || "/";
  const seg = pathname.split("/").filter(Boolean)[0] || "";
  return (locales as readonly string[]).includes(seg) ? seg : "en";
}

/**
 * 由 pathname 抽店舖 slug —— biolink route 形態：
 *   /{locale}/{slug}[/product/{id}]  → slug = 第二段
 *   /{slug}[/...]（bare，middleware 內部 rewrite，browser URL 冇 locale）
 *                                    → slug = 第一段
 * 商品卡 href 要砌 /{locale}/{slug}/product/{id}（path biolink 形式 ——
 * subdomain 冇 wildcard DNS，舊 host-relative /product/{id} 喺 www 上會
 * 解做 default 店 context → 404，見 lib/biolink-data.ts）。
 */
export function useStoreSlug(): string {
  const pathname = usePathname() || "/";
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return "";
  return (locales as readonly string[]).includes(segs[0])
    ? segs[1] || ""
    : segs[0];
}
