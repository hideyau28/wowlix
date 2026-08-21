"use client";

import Image from "next/image";
import type { TenantForBioLink } from "@/lib/biolink-helpers";
import { getAvatarFallback } from "@/lib/biolink-helpers";

/**
 * `demoteHeading`：同 ProfileSection 一樣 —— 商品深連落地時店名讓返 `<h1>`
 * 俾 StudioProductSheet 個商品標題。舊 code 兩邊各自寫死一個 `<h1>`，
 * 深連落地會出**兩個 h1**。
 */
type Props = {
  tenant: TenantForBioLink;
  demoteHeading?: boolean;
};

type SocialLink = { platform: string; url: string };

const SOCIAL_LABEL: Record<string, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  threads: "Threads",
  telegram: "Telegram",
  wechat: "WeChat",
  x: "X",
  xiaohongshu: "小紅書",
};

function resolveSocialLinks(tenant: TenantForBioLink): SocialLink[] {
  if (tenant.socialLinks?.length) return tenant.socialLinks.slice(0, 4);
  const fallback: SocialLink[] = [];
  if (tenant.instagram) fallback.push({ platform: "instagram", url: tenant.instagram });
  if (tenant.whatsapp) fallback.push({ platform: "whatsapp", url: `https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}` });
  return fallback;
}

export default function StudioHero({ tenant, demoteHeading = false }: Props) {
  const StoreNameHeading = demoteHeading ? "h2" : "h1";
  const cover = tenant.coverPhoto;
  const social = resolveSocialLinks(tenant);
  const fallback = getAvatarFallback(tenant);

  return (
    <section className="relative w-full">
      {/* Full-bleed cover photo with bottom gradient for text legibility */}
      <div className="relative w-full aspect-[4/5] sm:aspect-[16/9] bg-wlx-cream overflow-hidden">
        {cover ? (
          <Image
            src={cover}
            alt={tenant.name}
            fill
            priority
            sizes="(min-width: 640px) 100vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-wlx-cream">
            <span className="font-wlx-serif italic text-wlx-stone text-3xl sm:text-5xl tracking-wide">
              {tenant.name}
            </span>
          </div>
        )}
        {/* Bottom shadow gradient — only when cover exists */}
        {cover && (
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[60%] pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(26,26,26,0) 0%, rgba(26,26,26,0.55) 100%)",
            }}
          />
        )}

        {/* Tenant identity overlay (bottom-left on mobile, bottom-center on desktop) */}
        <div className="absolute inset-x-0 bottom-0 px-5 py-7 sm:px-10 sm:py-10">
          <div className="flex items-end gap-4 sm:flex-col sm:items-center sm:gap-3 sm:text-center">
            {/* Logo */}
            <div className="shrink-0 size-16 sm:size-20 rounded-full overflow-hidden ring-2 ring-white/80 bg-wlx-paper grid place-items-center">
              {tenant.logoUrl ? (
                <Image
                  src={tenant.logoUrl}
                  alt={`${tenant.name} logo`}
                  width={80}
                  height={80}
                  className="size-full object-cover"
                />
              ) : (
                <span className="font-wlx-sans text-wlx-ink text-xl font-semibold">
                  {fallback}
                </span>
              )}
            </div>

            {/* Name + tagline */}
            <div className="min-w-0">
              <StoreNameHeading
                className={`font-wlx-display tracking-tight text-2xl sm:text-4xl leading-tight ${
                  cover ? "text-white" : "text-wlx-ink"
                }`}
              >
                {tenant.name}
              </StoreNameHeading>
              {tenant.description && (
                <p
                  className={`mt-1.5 text-sm sm:text-base leading-relaxed line-clamp-2 sm:line-clamp-1 max-w-[28ch] sm:max-w-[44ch] ${
                    cover ? "text-white/85" : "text-wlx-stone"
                  }`}
                >
                  {tenant.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Social row — directly under cover, full-width with hairline divider */}
      {social.length > 0 && (
        <div className="border-b border-wlx-mist">
          <ul className="mx-auto flex max-w-[640px] items-center justify-center gap-6 px-5 py-4">
            {social.map((s) => (
              <li key={s.platform}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] uppercase tracking-[0.18em] text-wlx-stone hover:text-wlx-ink transition-colors duration-200"
                  style={{ transitionTimingFunction: "var(--wlx-ease)" }}
                >
                  {SOCIAL_LABEL[s.platform] ?? s.platform}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
