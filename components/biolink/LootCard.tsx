"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import {
  type ProductForBioLink,
  getRarity,
  rarityConfig,
  getBadgeText,
  getAllImages,
  isSoldOut,
  formatPrice,
} from "@/lib/biolink-helpers";
import { useTemplate } from "@/lib/template-context";
import { useStoreLocale, useStoreSlug } from "./use-store-locale";
import SoldOutOverlay from "./SoldOutOverlay";

type Props = {
  product: ProductForBioLink;
  index: number;
  currency?: string;
  onAdd: (product: ProductForBioLink) => void;
  onTap?: (product: ProductForBioLink) => void;
  onImageTap?: (
    images: string[],
    startIndex: number,
    videoUrl?: string | null,
  ) => void;
};

export default function LootCard({
  product,
  index,
  currency = "HKD",
  onAdd,
  onTap,
  onImageTap,
}: Props) {
  const tmpl = useTemplate();
  const storeLocale = useStoreLocale();
  const storeSlug = useStoreSlug();
  const rarity = getRarity(product);
  const config = rarity ? rarityConfig[rarity] : rarityConfig.common;
  const badge = getBadgeText(product);
  const images = getAllImages(product);
  const heroImage = images[0] || null;
  const soldOut = isSoldOut(product);
  const hasVideo = !!product.videoUrl;
  const hasMultipleImages = images.length > 1;

  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 自動輪播 — 多張圖每 3 秒切換
  useEffect(() => {
    if (!hasMultipleImages) return;
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasMultipleImages, images.length]);

  const handleImageTap = useCallback(() => {
    if (images.length > 0 && onImageTap) {
      onImageTap(images, current, product.videoUrl);
    }
  }, [images, current, onImageTap, product.videoUrl]);

  const isOnSale =
    product.originalPrice != null && product.originalPrice > product.price;
  const discountPct = isOnSale
    ? Math.round((1 - product.price / product.originalPrice!) * 100)
    : 0;

  return (
    <div
      className="biolink-float-bob flex-shrink-0 w-[200px]"
      style={{ animationDelay: `${index * 0.3}s` }}
    >
      <div
        className={`relative rounded-2xl overflow-hidden border shadow-lg ${config.glow}`}
        style={{
          backgroundColor: tmpl.card,
          borderColor: tmpl.subtext + "20",
          boxShadow: `0 8px 32px ${config.color}30, 0 0 0 1px ${config.color}20`,
        }}
      >
        {/* Rarity ribbon */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 z-10"
          style={{ backgroundColor: config.color }}
        />

        {/* Image 1:1 with carousel */}
        <div
          className="relative aspect-square overflow-hidden cursor-pointer"
          onClick={handleImageTap}
        >
          {heroImage ? (
            <div className="relative w-full h-full">
              {images.map((src, i) => (
                <Image
                  key={src}
                  src={src}
                  alt={`${product.title} ${i + 1}`}
                  fill
                  className={`object-cover transition-opacity duration-500 ${
                    i === current ? "opacity-100" : "opacity-0"
                  }`}
                  sizes="200px"
                  priority={index < 3 && i === 0}
                  loading={i === 0 ? undefined : "lazy"}
                />
              ))}
            </div>
          ) : (
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
              <span className="text-zinc-600 text-3xl font-bold">
                {product.title.charAt(0)}
              </span>
            </div>
          )}

          {soldOut && <SoldOutOverlay />}

          {/* Badge */}
          {badge && !soldOut && (
            <div className="absolute top-2 left-2 z-10">
              <span
                className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded text-white"
                style={{ backgroundColor: config.color }}
              >
                {badge}
              </span>
            </div>
          )}

          {/* Rarity label */}
          {rarity && (
            <div className="absolute bottom-2 right-2 z-10">
              <span
                className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.15em] rounded text-white/80"
                style={{ backgroundColor: `${config.color}60` }}
              >
                {config.label}
              </span>
            </div>
          )}

          {/* Video icon */}
          {hasVideo && (
            <div className="absolute bottom-2 left-2 z-10">
              <span className="flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className="inline-block"
                >
                  <path d="M2 1.5v7l6-3.5-6-3.5z" fill="currentColor" />
                </svg>
              </span>
            </div>
          )}

          {/* Dots 指示器 — 只有多張圖先顯示 */}
          {hasMultipleImages && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-10">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`block rounded-full transition-all ${
                    i === current
                      ? "w-3 h-1.5 bg-white"
                      : "w-1.5 h-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Info — 點擊標題/價格開 product sheet */}
        <div className="p-3 relative">
          {/* 真 <a href> — crawler/分享有得入獨立商品頁；點擊有 onTap 就攔截開 sheet */}
          <a
            href={`/${storeLocale}/${storeSlug}/product/${product.id}`}
            className="block"
            onClick={(e) => {
              if (onTap) {
                e.preventDefault();
                onTap(product);
              }
            }}
          >
            <h3
              className="text-sm font-semibold leading-snug mb-1 pr-10"
              style={{
                color: tmpl.text,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {product.title}
            </h3>

            <div className="flex items-center gap-2">
              {isOnSale ? (
                <>
                  <span
                    className="font-bold text-sm"
                    style={{ color: tmpl.text }}
                  >
                    {formatPrice(product.price, currency)}
                  </span>
                  <span
                    className="text-xs line-through"
                    style={{ color: tmpl.subtext }}
                  >
                    {formatPrice(product.originalPrice!, currency)}
                  </span>
                  <span
                    className="px-1 py-0.5 text-[9px] font-bold rounded text-white"
                    style={{ backgroundColor: tmpl.accent }}
                  >
                    -{discountPct}%
                  </span>
                </>
              ) : (
                <span
                  className="font-bold text-sm"
                  style={{ color: tmpl.text }}
                >
                  {formatPrice(product.price, currency)}
                </span>
              )}
            </div>
          </a>

          {/* + 圓形按鈕 — 右下角 */}
          {!soldOut && (
            <button
              onClick={() => onAdd(product)}
              aria-label={`加入購物車 ${product.title}`}
              className="absolute bottom-3 right-3 w-8 h-8 rounded-full text-white flex items-center justify-center shadow-md active:scale-95 transition-transform"
              style={{ backgroundColor: tmpl.accent }}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
