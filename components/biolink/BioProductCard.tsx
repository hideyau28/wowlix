"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  type ProductForBioLink,
  getAllImages,
  getVisibleVariants,
  isSoldOut,
  isNew,
  getLowStockCount,
  formatPrice,
} from "@/lib/biolink-helpers";
import { useTemplate } from "@/lib/template-context";
import { useStoreLocale } from "./use-store-locale";
import SoldOutOverlay from "./SoldOutOverlay";
import NewBadge from "./NewBadge";
import LowStockBadge from "./LowStockBadge";

type Props = {
  product: ProductForBioLink;
  currency?: string;
  onAdd: (product: ProductForBioLink) => void;
  onTap?: (product: ProductForBioLink) => void;
  priority?: boolean;
  wishlisted?: boolean;
  onToggleWishlist?: () => void;
};

export default function BioProductCard({
  product,
  currency = "HKD",
  onAdd,
  onTap,
  priority = false,
  wishlisted = false,
  onToggleWishlist,
}: Props) {
  const tmpl = useTemplate();
  const storeLocale = useStoreLocale();
  const images = getAllImages(product);
  const heroImage = images[0] || null;
  const variants = getVisibleVariants(product);
  const soldOut = isSoldOut(product);
  const isNewProduct = isNew(product);
  const lowStock = variants ? getLowStockCount(variants) : null;
  const hasMultipleImages = images.length > 1;
  const hasVideo = !!product.videoUrl;

  const [current, setCurrent] = useState(0);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const [bouncing, setBouncing] = useState(false);
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

  const isOnSale =
    product.originalPrice != null && product.originalPrice > product.price;
  const discountPct = isOnSale
    ? Math.round((1 - product.price / product.originalPrice!) * 100)
    : 0;

  // Badge priority: discount > low stock > NEW. Max 2 badges per card.
  // If all 3 active, drop NEW (lowest priority) to avoid visual noise.
  const showNewBadge = isNewProduct && !(isOnSale && !!lowStock);

  return (
    <div
      className="overflow-hidden"
      style={{
        backgroundColor: tmpl.card,
        borderRadius: tmpl.borderRadius.card,
        boxShadow: tmpl.shadow === "none" ? undefined : tmpl.shadow,
        border: `1px solid ${tmpl.subtext}15`,
      }}
    >
      {/* Image 1:1 with carousel — tap opens product detail sheet */}
      <div
        className="relative aspect-square overflow-hidden cursor-pointer"
        style={{
          borderRadius: `${tmpl.borderRadius.image}px ${tmpl.borderRadius.image}px 0 0`,
        }}
        onClick={() => onTap?.(product)}
      >
        {heroImage && !brokenImages.has(heroImage) ? (
          <div
            className="relative w-full h-full"
            style={{ backgroundColor: `${tmpl.subtext}10` }}
          >
            {/* 所有圖片疊喺一齊，用 opacity 切換 */}
            {images.map((src, i) => (
              <Image
                key={src}
                src={src}
                alt={`${product.title} ${i + 1}`}
                fill
                className={`object-cover object-center transition-opacity duration-500 ${
                  i === current ? "opacity-100" : "opacity-0"
                }`}
                sizes="(max-width: 480px) 50vw, 240px"
                priority={priority && i === 0}
                loading={i === 0 ? undefined : "lazy"}
                onError={() =>
                  setBrokenImages((prev) => new Set(prev).add(src))
                }
              />
            ))}
          </div>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: `${tmpl.subtext}15` }}
          >
            <svg
              className="w-12 h-12"
              fill="none"
              stroke={tmpl.subtext}
              strokeWidth={1.5}
              viewBox="0 0 24 24"
              opacity={0.4}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
              />
            </svg>
          </div>
        )}

        {soldOut && <SoldOutOverlay />}

        {/* Badges — 左上角垂直排列，唔會同右上角 heart 撞 */}
        {!soldOut && (showNewBadge || lowStock || isOnSale) && (
          <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1">
            {isOnSale && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white bg-red-500">
                -{discountPct}%
              </span>
            )}
            {showNewBadge && <NewBadge accentColor={tmpl.accent} />}
            {lowStock && (
              <LowStockBadge count={lowStock} accentColor={tmpl.accent} />
            )}
          </div>
        )}

        {/* Wishlist heart */}
        {onToggleWishlist && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist();
            }}
            aria-label={wishlisted ? "取消收藏" : "加入收藏"}
            className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-90"
            style={{ backgroundColor: "rgba(255,255,255,0.85)" }}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill={wishlisted ? "#ef4444" : "none"}
              stroke={wishlisted ? "#ef4444" : "#71717a"}
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          </button>
        )}

        {/* Video icon */}
        {hasVideo && (
          <div className="absolute bottom-2 right-2 z-10">
            <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-white">
              <svg
                width="12"
                height="12"
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

      {/* Content — 點擊標題/價格開 product sheet */}
      <div className="p-3 relative">
        {/* 真 <a href> — crawler/分享有得入獨立商品頁；點擊有 onTap 就攔截開 sheet */}
        <a
          href={`/${storeLocale}/product/${product.id}`}
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
                  className="font-bold text-base"
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
              </>
            ) : (
              <span
                className="font-bold text-base"
                style={{ color: tmpl.text }}
              >
                {formatPrice(product.price, currency)}
              </span>
            )}
          </div>
        </a>

        {/* + 圓形按鈕 — 右下角（已售完時隱藏） */}
        {!soldOut && (
          <button
            onClick={() => {
              setBouncing(true);
              onAdd(product);
            }}
            onAnimationEnd={() => setBouncing(false)}
            aria-label={`加入購物車 ${product.title}`}
            className="absolute bottom-2 right-2 w-11 h-11 rounded-full flex items-center justify-center shadow-md text-white"
            style={{
              backgroundColor: tmpl.accent,
              animation: bouncing
                ? "addBounce 0.42s cubic-bezier(0.36,0.07,0.19,0.97) forwards"
                : undefined,
            }}
          >
            <svg
              className="w-5 h-5"
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

        <style jsx>{`
          @keyframes addBounce {
            0% {
              transform: scale(1);
            }
            18% {
              transform: scale(0.78);
            }
            48% {
              transform: scale(1.22);
            }
            68% {
              transform: scale(0.92);
            }
            84% {
              transform: scale(1.06);
            }
            100% {
              transform: scale(1);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
