"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { TenantForBioLink } from "@/lib/biolink-helpers";
import { getAvatarFallback } from "@/lib/biolink-helpers";
import { useTemplate } from "@/lib/template-context";
import { type Locale, locales } from "@/lib/i18n";

function swapLocale(pathname: string, nextLocale: Locale) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return `/${nextLocale}`;
  if ((locales as readonly string[]).includes(parts[0])) {
    parts[0] = nextLocale;
    return "/" + parts.join("/");
  }
  // Path-based route without locale prefix (e.g. /maysshop) — prepend locale
  return "/" + nextLocale + "/" + parts.join("/");
}

type Props = {
  tenant: TenantForBioLink;
  cartCount: number;
  onCartClick?: () => void;
};

export default function StickyHeader({ tenant, cartCount, onCartClick }: Props) {
  const [visible, setVisible] = useState(false);
  const tmpl = useTemplate();
  const pathname = usePathname() || "/en";
  const locale = (pathname.split("/").filter(Boolean)[0] || "en") as Locale;

  useEffect(() => {
    const handler = () => {
      setVisible(window.scrollY > 200);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const fallback = getAvatarFallback(tenant);
  const color = tenant.brandColor || tmpl.accent;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 max-w-[480px] mx-auto transition-all duration-300 ${
        visible
          ? "translate-y-0 opacity-100"
          : "-translate-y-full opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-2 backdrop-blur-md border-b border-white/5" style={{ backgroundColor: `${tmpl.bg}E6` }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full overflow-hidden">
            {tenant.logoUrl ? (
              <Image
                src={tenant.logoUrl}
                alt={tenant.name}
                width={28}
                height={28}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {fallback}
              </div>
            )}
          </div>
          <span className="text-sm font-semibold" style={{ color: tmpl.text }}>{tenant.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={swapLocale(pathname, locale === "zh-HK" ? "en" : "zh-HK")}
            className="text-[11px] transition-colors"
            style={{ color: tmpl.subtext }}
          >
            {locale === "zh-HK" ? "EN" : "繁"}
          </Link>
          {tenant.whatsapp && (
            <a
              href={`https://wa.me/${tenant.whatsapp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={locale === "zh-HK" ? "WhatsApp 聯絡商戶" : "Contact store on WhatsApp"}
              className="w-7 h-7 rounded-full bg-[#25D366]/10 flex items-center justify-center"
            >
              <svg className="w-3.5 h-3.5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </a>
          )}
          {cartCount > 0 && (
            <button onClick={onCartClick} className="relative w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: tmpl.accent }}>
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
