"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductForBioLink } from "@/lib/biolink-helpers";
import { formatPrice, getAllImages, isSoldOut } from "@/lib/biolink-helpers";
import { useStoreLocale, useStoreSlug } from "../use-store-locale";

type Props = {
  product: ProductForBioLink;
  currency: string;
  onTap: (product: ProductForBioLink) => void;
  /** First N cards above the fold should set this so Image renders eagerly + as LCP candidate. */
  priority?: boolean;
};

export default function StudioProductCard({ product, currency, onTap, priority = false }: Props) {
  const images = getAllImages(product);
  const primary = images[0];
  const secondary = images[1];
  const soldOut = isSoldOut(product);
  const onSale = product.originalPrice && product.originalPrice > product.price;

  const [hoverImage, setHoverImage] = useState(false);
  const storeLocale = useStoreLocale();
  const storeSlug = useStoreSlug();

  return (
    // 真 <a href> — crawler/分享有得入獨立商品頁；點擊攔截開 sheet
    <a
      href={`/${storeLocale}/${storeSlug}/product/${product.id}`}
      onClick={(e) => {
        e.preventDefault();
        onTap(product);
      }}
      onMouseEnter={() => secondary && setHoverImage(true)}
      onMouseLeave={() => setHoverImage(false)}
      className="group flex flex-col text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-wlx-ink/30"
    >
      {/* Image — 4:5 portrait, full bleed within card */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-wlx-cream">
        {primary ? (
          <>
            <Image
              src={primary}
              alt={product.title}
              fill
              priority={priority}
              loading={priority ? "eager" : "lazy"}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className={`object-cover transition-opacity duration-[400ms] ${
                hoverImage && secondary ? "opacity-0" : "opacity-100"
              }`}
              style={{ transitionTimingFunction: "var(--wlx-ease)" }}
            />
            {secondary && (
              <Image
                src={secondary}
                alt={`${product.title} alternate`}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                aria-hidden
                className={`object-cover transition-opacity duration-[400ms] ${
                  hoverImage ? "opacity-100" : "opacity-0"
                }`}
                style={{ transitionTimingFunction: "var(--wlx-ease)" }}
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-wlx-stone text-xs uppercase tracking-widest">
            No image
          </div>
        )}

        {/* Sold out — restrained corner label, NOT a SALE-style badge */}
        {soldOut && (
          <div className="absolute inset-0 grid place-items-center bg-wlx-paper/80">
            <span className="text-[11px] uppercase tracking-[0.2em] text-wlx-ink">
              Sold out
            </span>
          </div>
        )}
      </div>

      {/* Title + price — small, breathing room */}
      <div className="mt-3 px-0.5">
        <p className="text-[13px] sm:text-sm leading-snug text-wlx-ink line-clamp-2">
          {product.title}
        </p>
        <p className="mt-1 text-[13px] sm:text-sm text-wlx-stone tabular-nums">
          {onSale && product.originalPrice && (
            <span className="mr-2 line-through opacity-70">
              {formatPrice(product.originalPrice, currency)}
            </span>
          )}
          <span className={onSale ? "text-wlx-ink" : ""}>
            {formatPrice(product.price, currency)}
          </span>
        </p>
      </div>
    </a>
  );
}
