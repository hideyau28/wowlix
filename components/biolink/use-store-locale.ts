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
