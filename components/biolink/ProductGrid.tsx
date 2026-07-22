"use client";

import { useState, useRef } from "react";
import type { ProductForBioLink } from "@/lib/biolink-helpers";
import BioProductCard from "./BioProductCard";
import { useTemplate } from "@/lib/template-context";

type Props = {
  products: ProductForBioLink[];
  /** All grid products (before search filter) — used to derive categories */
  allProducts?: ProductForBioLink[];
  currency?: string;
  onAdd: (product: ProductForBioLink) => void;
  onTap?: (product: ProductForBioLink) => void;
  searchQuery?: string;
  wishlist?: string[];
  onToggleWishlist?: (productId: string) => void;
};

export default function ProductGrid({
  products,
  allProducts,
  currency,
  onAdd,
  onTap,
  searchQuery,
  wishlist,
  onToggleWishlist,
}: Props) {
  const tmpl = useTemplate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Derive unique categories from allProducts (full list before search filter)
  const sourceForCategories = allProducts ?? products;
  const categories: string[] = Array.from(
    new Set(
      sourceForCategories
        .map((p) => p.category)
        .filter((c): c is string => !!c && c.trim() !== ""),
    ),
  );

  // Show tabs when total store products > 6 and at least 2 categories exist
  const showTabs = sourceForCategories.length > 6 && categories.length >= 2;

  // Filter displayed products by selected category
  const displayProducts = selectedCategory
    ? products.filter((p) => p.category === selectedCategory)
    : products;

  if (displayProducts.length === 0 && !showTabs) {
    const emptyMessage = searchQuery
      ? "搵唔到商品"
      : "仲未有商品，快啲加第一件啦！";
    return (
      <section className="px-4 py-12" style={{ backgroundColor: tmpl.bg }}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: `${tmpl.subtext}20` }}
          >
            <svg
              className="w-8 h-8"
              style={{ color: tmpl.subtext }}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: tmpl.subtext }}>
            {emptyMessage}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6" style={{ backgroundColor: tmpl.bg }}>
      {/* Category tabs — horizontal scroll */}
      {showTabs && (
        <div
          ref={scrollRef}
          className="flex gap-2 px-4 mb-4 overflow-x-auto"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <style>{`.cat-scroll::-webkit-scrollbar { display: none; }`}</style>
          {/* 全部 tab */}
          <button
            onClick={() => setSelectedCategory(null)}
            className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={{
              backgroundColor:
                selectedCategory === null ? tmpl.accent : `${tmpl.subtext}18`,
              color: selectedCategory === null ? "#fff" : tmpl.subtext,
              border: `1.5px solid ${selectedCategory === null ? tmpl.accent : "transparent"}`,
            }}
          >
            全部
          </button>
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(active ? null : cat)}
                className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
                style={{
                  backgroundColor: active ? tmpl.accent : `${tmpl.subtext}18`,
                  color: active ? "#fff" : tmpl.subtext,
                  border: `1.5px solid ${active ? tmpl.accent : "transparent"}`,
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      <div className="px-4">
        <h2
          className="text-base font-bold mb-4"
          style={{
            color: tmpl.text,
            fontFamily: `'${tmpl.headingFont}', sans-serif`,
          }}
        >
          {selectedCategory ?? "全部商品"}
        </h2>

        {displayProducts.length === 0 ? (
          <p
            className="text-sm py-8 text-center"
            style={{ color: tmpl.subtext }}
          >
            {searchQuery ? "搵唔到商品" : "呢個分類暫時冇商品"}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {displayProducts.map((p, i) => (
              // content-visibility: 離屏卡 skip layout/paint（大量商品時慳好多）。
              // 第一張（priority/LCP 候選）唔包，保住即時 paint。
              <div
                key={p.id}
                style={
                  i === 0
                    ? undefined
                    : { contentVisibility: "auto", containIntrinsicSize: "0 320px" }
                }
              >
                <BioProductCard
                  product={p}
                  currency={currency}
                  onAdd={onAdd}
                  onTap={onTap}
                  priority={i === 0}
                  wishlisted={wishlist?.includes(p.id)}
                  onToggleWishlist={
                    onToggleWishlist ? () => onToggleWishlist(p.id) : undefined
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
