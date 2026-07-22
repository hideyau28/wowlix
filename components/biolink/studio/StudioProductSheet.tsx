"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  type ProductForBioLink,
  getAllImages,
  getVisibleVariants,
  getDualVariantData,
  getVariantLabel,
  formatPrice,
} from "@/lib/biolink-helpers";
import { useDialogA11y } from "../use-dialog-a11y";

type Props = {
  product: ProductForBioLink;
  currency?: string;
  onClose: () => void;
  onAddToCart: (
    product: ProductForBioLink,
    variant: string | null,
    qty: number,
  ) => void;
  wishlisted?: boolean;
  onToggleWishlist?: () => void;
};

export default function StudioProductSheet({
  product,
  currency = "HKD",
  onClose,
  onAddToCart,
  wishlisted = false,
  onToggleWishlist,
}: Props) {
  // Dialog a11y — focus 入 sheet / Tab trap / Escape 閂 / 閂咗 focus 還原
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, onClose);

  const images = getAllImages(product);
  const dual = getDualVariantData(product);
  const singleVariants = getVisibleVariants(product) ?? [];
  const variantLabel = getVariantLabel(product);

  const isDual = dual !== null;

  // Determine which dim is colour vs size for dual variant
  let colorDimIdx = -1;
  let sizeDimIdx = -1;
  if (isDual && dual) {
    const isColor = (n: string) => {
      const l = n.toLowerCase();
      return l.includes("color") || l.includes("顏色") || l === "色";
    };
    if (isColor(dual.dimensions[0])) {
      colorDimIdx = 0;
      sizeDimIdx = 1;
    } else {
      colorDimIdx = 1;
      sizeDimIdx = 0;
    }
  }

  const [carouselIdx, setCarouselIdx] = useState(0);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [qty, setQty] = useState(1);
  const [showError, setShowError] = useState(false);

  // Lock body scroll while sheet is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onSale = product.originalPrice && product.originalPrice > product.price;

  // Build the variant string passed to cart
  const buildVariantKey = (): string | null => {
    if (isDual && dual) {
      if (!selectedColor || !selectedSize) return null;
      return colorDimIdx === 0
        ? `${selectedColor}|${selectedSize}`
        : `${selectedSize}|${selectedColor}`;
    }
    if (singleVariants.length > 0) {
      return selectedSize || null;
    }
    return null;
  };

  const handleAdd = () => {
    if (isDual && (!selectedColor || !selectedSize)) {
      setShowError(true);
      return;
    }
    if (!isDual && singleVariants.length > 0 && !selectedSize) {
      setShowError(true);
      return;
    }
    setShowError(false);
    onAddToCart(product, buildVariantKey(), qty);
    onClose();
  };

  // Touch swipe for image gallery
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) < 50) return;
    if (dx < 0 && carouselIdx < images.length - 1) {
      setCarouselIdx((i) => i + 1);
    } else if (dx > 0 && carouselIdx > 0) {
      setCarouselIdx((i) => i - 1);
    }
  };

  // Stock check for dual variants
  const variantStock = (() => {
    if (!isDual || !dual || !selectedColor || !selectedSize) return null;
    const key =
      colorDimIdx === 0
        ? `${selectedColor}|${selectedSize}`
        : `${selectedSize}|${selectedColor}`;
    return dual.combinations[key]?.qty ?? 0;
  })();

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-product-sheet-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-wlx-paper text-wlx-ink overflow-y-auto focus:outline-none"
    >
      {/* Top bar — close + wishlist */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-wlx-paper/95 backdrop-blur-sm border-b border-wlx-mist px-5 py-3 sm:px-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="min-h-[44px] inline-flex items-center text-[11px] uppercase tracking-[0.18em] text-wlx-stone hover:text-wlx-ink transition-colors duration-200"
          style={{ transitionTimingFunction: "var(--wlx-ease)" }}
        >
          Close
        </button>
        {onToggleWishlist && (
          <button
            type="button"
            onClick={onToggleWishlist}
            aria-label={wishlisted ? "Remove from saved" : "Save"}
            className="min-h-[44px] inline-flex items-center text-[11px] uppercase tracking-[0.18em] text-wlx-stone hover:text-wlx-ink transition-colors duration-200"
            style={{ transitionTimingFunction: "var(--wlx-ease)" }}
          >
            {wishlisted ? "Saved" : "Save"}
          </button>
        )}
      </div>

      <div className="mx-auto max-w-[640px] pb-32">
        {/* Image gallery — full-bleed 4:5 portrait carousel */}
        <div
          className="relative w-full aspect-[4/5] bg-wlx-cream overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {images.length > 0 ? (
            images.map((src, i) => (
              <Image
                key={src + i}
                src={src}
                alt={`${product.title} image ${i + 1}`}
                fill
                priority={i === 0}
                sizes="(min-width: 640px) 640px, 100vw"
                className={`object-cover transition-opacity duration-[400ms] ${
                  carouselIdx === i ? "opacity-100" : "opacity-0"
                }`}
                style={{ transitionTimingFunction: "var(--wlx-ease)" }}
              />
            ))
          ) : (
            <div className="absolute inset-0 grid place-items-center text-[11px] uppercase tracking-[0.2em] text-wlx-stone">
              No image
            </div>
          )}

          {/* Dot indicators */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCarouselIdx(i)}
                  aria-label={`Image ${i + 1}`}
                  className={`h-[2px] transition-all duration-300 ${
                    carouselIdx === i ? "bg-wlx-ink w-6" : "bg-wlx-ink/30 w-3"
                  }`}
                  style={{ transitionTimingFunction: "var(--wlx-ease)" }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Title + price */}
        <div className="px-5 pt-7 sm:px-8 sm:pt-10">
          <h1 id="studio-product-sheet-title" className="font-wlx-display text-2xl sm:text-3xl tracking-tight leading-tight text-wlx-ink">
            {product.title}
          </h1>
          <p className="mt-3 text-base tabular-nums">
            {onSale && product.originalPrice && (
              <span className="mr-3 text-wlx-stone line-through">
                {formatPrice(product.originalPrice, currency)}
              </span>
            )}
            <span className="text-wlx-ink">
              {formatPrice(product.price, currency)}
            </span>
          </p>
        </div>

        {/* Color picker (dual variant only) */}
        {isDual && dual && colorDimIdx >= 0 && (
          <div className="mt-9 px-5 sm:px-8">
            <p className="text-[11px] uppercase tracking-[0.22em] text-wlx-stone">
              {dual.dimensions[colorDimIdx]}
              {selectedColor && (
                <span className="ml-3 text-wlx-ink normal-case tracking-normal">
                  {selectedColor}
                </span>
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {dual.options[dual.dimensions[colorDimIdx]]?.map((opt) => {
                const active = opt === selectedColor;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setSelectedColor(opt);
                      setShowError(false);
                    }}
                    className={`px-4 py-2 text-[12px] tracking-tight border transition-colors duration-200 ${
                      active
                        ? "border-wlx-ink bg-wlx-ink text-wlx-paper"
                        : "border-wlx-mist text-wlx-ink hover:border-wlx-ink"
                    }`}
                    style={{ transitionTimingFunction: "var(--wlx-ease)" }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Size picker */}
        {((isDual && dual && sizeDimIdx >= 0) || singleVariants.length > 0) && (
          <div className="mt-9 px-5 sm:px-8">
            <p className="text-[11px] uppercase tracking-[0.22em] text-wlx-stone">
              {isDual && dual ? dual.dimensions[sizeDimIdx] : variantLabel || "Size"}
              {selectedSize && (
                <span className="ml-3 text-wlx-ink normal-case tracking-normal">
                  {selectedSize}
                </span>
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(isDual && dual
                ? (dual.options[dual.dimensions[sizeDimIdx]] ?? [])
                : singleVariants.map((v) => v.name)
              ).map((name) => {
                // Stock per option
                let stock = 0;
                if (isDual && dual) {
                  if (selectedColor) {
                    const key =
                      colorDimIdx === 0
                        ? `${selectedColor}|${name}`
                        : `${name}|${selectedColor}`;
                    stock = dual.combinations[key]?.qty ?? 0;
                  } else {
                    // No colour selected: aggregate
                    stock = Object.entries(dual.combinations)
                      .filter(([k]) => k.includes(name))
                      .reduce((sum, [, v]) => sum + (v.qty ?? 0), 0);
                  }
                } else {
                  const v = singleVariants.find((sv) => sv.name === name);
                  stock = v?.stock ?? 0;
                }
                const out = stock <= 0;
                const active = selectedSize === name;
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={out}
                    onClick={() => {
                      setSelectedSize(name);
                      setShowError(false);
                    }}
                    className={`min-w-[3rem] px-4 py-2 text-[12px] tracking-tight border transition-colors duration-200 ${
                      active
                        ? "border-wlx-ink bg-wlx-ink text-wlx-paper"
                        : out
                          ? "border-wlx-mist text-wlx-stone line-through cursor-not-allowed"
                          : "border-wlx-mist text-wlx-ink hover:border-wlx-ink"
                    }`}
                    style={{ transitionTimingFunction: "var(--wlx-ease)" }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="mt-10 border-t border-wlx-mist mx-5 sm:mx-8 pt-7">
            <p className="text-[11px] uppercase tracking-[0.22em] text-wlx-stone">
              Details
            </p>
            <p className="mt-3 text-sm leading-relaxed text-wlx-ink whitespace-pre-line">
              {product.description}
            </p>
          </div>
        )}

        {/* Stock note */}
        {variantStock !== null && variantStock > 0 && variantStock <= 3 && (
          <p className="mt-6 px-5 sm:px-8 text-[11px] uppercase tracking-[0.18em] text-wlx-stone">
            Only {variantStock} left
          </p>
        )}

        {showError && (
          <p className="mt-6 px-5 sm:px-8 text-[11px] uppercase tracking-[0.18em] text-wlx-ink">
            Please select{" "}
            {isDual
              ? "colour and size"
              : variantLabel?.toLowerCase() || "an option"}
          </p>
        )}
      </div>

      {/* Sticky bottom — qty stepper + Add to cart */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-wlx-mist bg-wlx-paper px-5 py-4 sm:px-8">
        <div className="mx-auto max-w-[640px] flex items-stretch gap-3">
          <div className="inline-flex items-stretch border border-wlx-mist">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              className="px-3 text-sm text-wlx-stone hover:text-wlx-ink hover:bg-wlx-cream transition-colors duration-200"
              style={{ transitionTimingFunction: "var(--wlx-ease)" }}
            >
              −
            </button>
            <span className="px-3 py-3 text-sm tabular-nums text-wlx-ink min-w-[2.5rem] text-center border-x border-wlx-mist">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              aria-label="Increase quantity"
              className="px-3 text-sm text-wlx-stone hover:text-wlx-ink hover:bg-wlx-cream transition-colors duration-200"
              style={{ transitionTimingFunction: "var(--wlx-ease)" }}
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 bg-wlx-ink py-4 text-[12px] uppercase tracking-[0.22em] text-wlx-paper hover:bg-wlx-ink/90 transition-colors duration-200"
            style={{ transitionTimingFunction: "var(--wlx-ease)" }}
          >
            Add to cart · {formatPrice(product.price * qty, currency)}
          </button>
        </div>
      </div>
    </div>
  );
}
