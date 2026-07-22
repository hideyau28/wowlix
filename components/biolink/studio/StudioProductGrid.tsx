"use client";

import type { ProductForBioLink } from "@/lib/biolink-helpers";
import StudioProductCard from "./StudioProductCard";

type Props = {
  products: ProductForBioLink[];
  currency: string;
  onTap: (product: ProductForBioLink) => void;
  searchQuery?: string;
};

export default function StudioProductGrid({
  products,
  currency,
  onTap,
  searchQuery,
}: Props) {
  const filtered = searchQuery
    ? products.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : products;

  if (filtered.length === 0) {
    return (
      <div className="px-5 py-24 text-center">
        <p className="text-[13px] uppercase tracking-[0.18em] text-wlx-stone">
          {searchQuery ? "No matches" : "Inventory restocking soon"}
        </p>
      </div>
    );
  }

  // First 4 cards are above-the-fold on lg (4-col), 6 on sm (3-col), 4 on mobile (2-col).
  // Marking them priority lets Next.js eagerly load + signals LCP candidate to the browser.
  const PRIORITY_COUNT = 4;

  return (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-8 py-10 sm:py-14">
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-14 lg:grid-cols-4 lg:gap-x-8">
        {filtered.map((product, idx) => (
          // content-visibility: 離屏卡 skip layout/paint（大量商品時慳好多）。
          // priority 卡（above-the-fold）唔包，保住 LCP 候選即時 paint。
          <div
            key={product.id}
            style={
              idx < PRIORITY_COUNT
                ? undefined
                : { contentVisibility: "auto", containIntrinsicSize: "0 380px" }
            }
          >
            <StudioProductCard
              product={product}
              currency={currency}
              onTap={onTap}
              priority={idx < PRIORITY_COUNT}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
