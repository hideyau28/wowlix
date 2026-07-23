"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type Locale, locales } from "@/lib/i18n";
import type {
  ProductForBioLink,
  TenantForBioLink,
  DeliveryOption,
  OrderConfirmConfig,
} from "@/lib/biolink-helpers";
import {
  splitProducts,
  getVisibleVariants,
  isDualVariant,
  formatPrice,
  DEFAULT_DELIVERY_OPTIONS,
  DEFAULT_ORDER_CONFIRM,
} from "@/lib/biolink-helpers";
import {
  loadCart,
  addToCart as bioAddToCart,
  updateQty as bioUpdateQty,
  removeFromCart as bioRemoveFromCart,
  clearCart as bioClearCart,
  getCartCount,
  getCartTotal,
  type BioCart,
  type BioCartItem,
} from "@/lib/biolink-cart";
import {
  loadWishlist,
  toggleWishlist,
  isWishlisted,
} from "@/lib/biolink-wishlist";
import { getCoverTemplate } from "@/lib/cover-templates";
import { TemplateProvider } from "@/lib/template-context";
import { getFontVar } from "@/lib/fonts";
import StickyHeader from "./StickyHeader";
import CoverPhoto from "./CoverPhoto";
import ProfileSection from "./ProfileSection";
import SearchBar from "./SearchBar";
import FeaturedSection from "./FeaturedSection";
import BioProductCard from "./BioProductCard";
import ProductGrid from "./ProductGrid";
import CartBar from "./CartBar";
import WhatsAppFAB from "./WhatsAppFAB";
import CartSheet from "./CartSheet";
import CheckoutPage from "./CheckoutPage";
import StudioHero from "./studio/StudioHero";
import StudioProductGrid from "./studio/StudioProductGrid";
import StudioCartBar from "./studio/StudioCartBar";
import StudioCartSheet from "./studio/StudioCartSheet";
import StudioProductSheet from "./studio/StudioProductSheet";
import type { OrderResult } from "./CheckoutPage";
import OrderConfirmation from "./OrderConfirmation";
import ProductSheet from "./ProductSheet";
import ImageLightbox from "./ImageLightbox";
import ScrollToTopFAB from "./ScrollToTopFAB";

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
  products: ProductForBioLink[];
  /** 商品獨立頁（[slug]/product/[id]）用：落地自動開咗個 product sheet */
  initialProductId?: string;
};

export default function BioLinkPage({ tenant, products, initialProductId }: Props) {
  const tmpl = useMemo(
    () => getCoverTemplate(tenant.coverTemplate),
    [tenant.coverTemplate],
  );
  const isStudio = tmpl.id === "studio";
  const pathname = usePathname() || "/en";
  const locale = (pathname.split("/").filter(Boolean)[0] || "en") as Locale;

  const [cart, setCart] = useState<BioCart>({ tenantId: tenant.id, items: [] });
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [sheetProduct, setSheetProduct] = useState<ProductForBioLink | null>(
    // 商品獨立頁 share link 落地即開 sheet（SSR 都 render 埋，crawler 見到內容）
    () => products.find((p) => p.id === initialProductId) ?? null,
  );
  const [lightbox, setLightbox] = useState<{
    images: string[];
    startIndex: number;
    videoUrl?: string | null;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [showWishlist, setShowWishlist] = useState(false);

  const currency = tenant.currency || "HKD";
  const deliveryOptions: DeliveryOption[] =
    tenant.deliveryOptions || DEFAULT_DELIVERY_OPTIONS;
  const orderConfirmMessage: OrderConfirmConfig =
    tenant.orderConfirmMessage || DEFAULT_ORDER_CONFIRM;

  // Filter products by search query
  const filteredProducts = searchQuery
    ? products.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : products;

  const { grid: allGrid } = splitProducts(products);
  const { featured, grid } = splitProducts(filteredProducts);

  // Load cart from localStorage on mount
  useEffect(() => {
    setCart(loadCart(tenant.id));
  }, [tenant.id]);

  // Load wishlist from localStorage on mount
  useEffect(() => {
    setWishlist(loadWishlist(tenant.slug));
  }, [tenant.slug]);

  const handleToggleWishlist = useCallback(
    (productId: string) => {
      const next = toggleWishlist(tenant.slug, productId);
      setWishlist(next);
    },
    [tenant.slug],
  );

  const wishlistCount = wishlist.length;
  const wishlistProducts = useMemo(
    () => products.filter((p) => wishlist.includes(p.id)),
    [products, wishlist],
  );

  // Toast 自動消失
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const cartCount = getCartCount(cart);
  const cartTotal = getCartTotal(cart);

  // Auto-close cart sheet when empty
  useEffect(() => {
    if (showCart && cart.items.length === 0) {
      setShowCart(false);
    }
  }, [cart.items.length, showCart]);

  const handleAddToCart = useCallback(
    (product: ProductForBioLink, variant: string | null, qty: number = 1) => {
      let variantId: string | undefined;
      if (variant && product.variants) {
        const match = product.variants.find((v) => v.name === variant);
        if (match) variantId = match.id;
      }

      const item: BioCartItem = {
        productId: product.id,
        name: product.title,
        price: product.price,
        image: product.imageUrl,
        variant: variant || undefined,
        variantLabel: variant ? variant.replace(/\|/g, " · ") : undefined,
        variantId,
        qty,
      };

      setCart((prev) => bioAddToCart(prev, item));
    },
    [],
  );

  const handleUpdateQty = useCallback(
    (productId: string, variant: string | undefined, delta: number) => {
      setCart((prev) => bioUpdateQty(prev, productId, variant, delta));
    },
    [],
  );

  const handleRemoveItem = useCallback(
    (productId: string, variant: string | undefined) => {
      setCart((prev) => bioRemoveFromCart(prev, productId, variant));
    },
    [],
  );

  const handleClearCart = useCallback(() => {
    setCart(bioClearCart(tenant.id));
  }, [tenant.id]);

  const handleOrderComplete = (result: OrderResult) => {
    setShowCheckout(false);
    setShowCart(false);
    setOrderResult(result);
    setCart(bioClearCart(tenant.id));
  };

  const handleConfirmationClose = () => {
    setOrderResult(null);
  };

  // Card「+」按鈕 — 冇 variant 直接加入，有 variant 開 sheet
  const handleCardAdd = useCallback(
    (product: ProductForBioLink) => {
      const hasVariants = (() => {
        if (isDualVariant(product.sizes)) return true;
        const variants = getVisibleVariants(product);
        return variants !== null && variants.length > 0;
      })();

      if (!hasVariants) {
        handleAddToCart(product, null);
        setToast("已加入購物車");
      } else {
        setSheetProduct(product);
      }
    },
    [handleAddToCart],
  );

  // ProductSheet 加入購物車
  const handleSheetAdd = useCallback(
    (product: ProductForBioLink, variant: string | null, qty: number) => {
      handleAddToCart(product, variant, qty);
      setSheetProduct(null);
      setToast("已加入購物車");
    },
    [handleAddToCart],
  );

  // Tap 產品卡 → 開 product sheet
  const handleProductTap = useCallback((product: ProductForBioLink) => {
    setSheetProduct(product);
  }, []);

  // Tap 圖片 → 開 lightbox
  const handleImageTap = useCallback(
    (images: string[], startIndex: number, videoUrl?: string | null) => {
      setLightbox({ images, startIndex, videoUrl });
    },
    [],
  );

  return (
    <TemplateProvider value={tmpl}>
      <div
        className={`min-h-screen mx-auto relative overflow-x-hidden ${
          isStudio ? "max-w-none" : "max-w-[480px]"
        }`}
        style={{
          backgroundColor: tmpl.bg,
          fontFamily: `${getFontVar(tmpl.bodyFont)}, sans-serif`,
        }}
      >
        <StickyHeader
          tenant={tenant}
          cartCount={cartCount}
          onCartClick={() => cartCount > 0 && setShowCart(true)}
        />

        {/* Language toggle — hidden when tenant has only 1 language */}
        {(!tenant.languages || tenant.languages.length > 1) && (
          <Link
            href={swapLocale(pathname, locale === "zh-HK" ? "en" : "zh-HK")}
            className="absolute top-3 right-3 z-40 text-xs px-2 py-0.5 rounded-full backdrop-blur-sm transition-colors"
            style={{ color: tmpl.subtext, backgroundColor: `${tmpl.bg}80` }}
          >
            {locale === "zh-HK" ? "EN" : "繁"}
          </Link>
        )}

        {isStudio ? (
          <StudioHero tenant={tenant} />
        ) : (
          <>
            <CoverPhoto url={tenant.coverPhoto} />
            <ProfileSection tenant={tenant} />

            {/* Wishlist button */}
            <div className="flex justify-center -mt-1 mb-3">
              <button
                onClick={() => setShowWishlist(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95"
                style={{
                  backgroundColor: `${tmpl.subtext}12`,
                  color: tmpl.text,
                }}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill={wishlistCount > 0 ? "#ef4444" : "none"}
                  stroke={wishlistCount > 0 ? "#ef4444" : "currentColor"}
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                  />
                </svg>
                我的收藏
                {wishlistCount > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: "#ef4444" }}
                  >
                    {wishlistCount}
                  </span>
                )}
              </button>
            </div>
          </>
        )}

        {/* Search bar — only show when store has 10+ products */}
        {products.length >= 10 && !isStudio && (
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        )}

        {/* Featured loot cards (skipped on Studio template) */}
        {!isStudio && featured.length > 0 && (
          <FeaturedSection
            products={featured}
            currency={currency}
            onAdd={handleCardAdd}
            onTap={handleProductTap}
            onImageTap={handleImageTap}
          />
        )}

        {/* Spacer */}
        {!isStudio && featured.length > 0 && <div className="h-6" />}

        {isStudio ? (
          <StudioProductGrid
            products={products}
            currency={currency}
            onTap={handleProductTap}
            searchQuery={searchQuery}
          />
        ) : (
          <ProductGrid
            products={grid}
            allProducts={allGrid}
            currency={currency}
            onAdd={handleCardAdd}
            onTap={handleProductTap}
            searchQuery={searchQuery}
            wishlist={wishlist}
            onToggleWishlist={handleToggleWishlist}
          />
        )}

        {/* Cart bar or WhatsApp FAB */}
        {cartCount > 0 ? (
          isStudio ? (
            <StudioCartBar
              count={cartCount}
              total={cartTotal}
              currency={currency}
              whatsapp={tenant.whatsapp}
              onCheckout={() => setShowCart(true)}
            />
          ) : (
            <CartBar
              count={cartCount}
              total={cartTotal}
              currency={currency}
              whatsapp={tenant.whatsapp}
              onCheckout={() => setShowCart(true)}
            />
          )
        ) : (
          <WhatsAppFAB whatsapp={tenant.whatsapp} cart={cart.items} />
        )}

        {/* Cart sheet (bottom sheet) */}
        {isStudio ? (
          <StudioCartSheet
            open={showCart}
            onClose={() => setShowCart(false)}
            items={cart.items}
            currency={currency}
            languages={tenant.languages}
            freeShippingThreshold={tenant.freeShippingThreshold}
            onUpdateQty={handleUpdateQty}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            onCheckout={() => {
              setShowCart(false);
              setShowCheckout(true);
            }}
          />
        ) : (
          <CartSheet
            open={showCart}
            onClose={() => setShowCart(false)}
            items={cart.items}
            currency={currency}
            languages={tenant.languages}
            freeShippingThreshold={tenant.freeShippingThreshold}
            onUpdateQty={handleUpdateQty}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            onCheckout={() => {
              setShowCart(false);
              setShowCheckout(true);
            }}
          />
        )}

        {/* Checkout page (full screen) */}
        <CheckoutPage
          open={showCheckout}
          onClose={() => setShowCheckout(false)}
          cart={cart.items}
          tenant={tenant}
          onOrderComplete={handleOrderComplete}
        />

        {/* Order confirmation */}
        {orderResult && (
          <OrderConfirmation
            order={orderResult}
            onClose={handleConfirmationClose}
            orderConfirmMessage={orderConfirmMessage}
            languages={tenant.languages}
          />
        )}

        {/* Product bottom sheet (variant selection) */}
        {sheetProduct &&
          (isStudio ? (
            <StudioProductSheet
              product={sheetProduct}
              currency={currency}
              onClose={() => setSheetProduct(null)}
              onAddToCart={handleSheetAdd}
              wishlisted={isWishlisted(wishlist, sheetProduct.id)}
              onToggleWishlist={() => handleToggleWishlist(sheetProduct.id)}
            />
          ) : (
            <ProductSheet
              product={sheetProduct}
              currency={currency}
              onClose={() => setSheetProduct(null)}
              onAddToCart={handleSheetAdd}
              allProducts={products}
              onSwitchProduct={setSheetProduct}
              wishlisted={isWishlisted(wishlist, sheetProduct.id)}
              onToggleWishlist={() => handleToggleWishlist(sheetProduct.id)}
            />
          ))}

        {/* Wishlist sheet */}
        {showWishlist && (
          <div
            className="fixed inset-0 z-50"
            style={{ backgroundColor: tmpl.bg }}
          >
            <div className="h-full flex flex-col max-w-[480px] mx-auto">
              {/* Header */}
              <div
                className="flex items-center justify-between px-4 py-4 border-b"
                style={{ borderColor: `${tmpl.subtext}20` }}
              >
                <h2 className="text-lg font-bold" style={{ color: tmpl.text }}>
                  我的收藏
                </h2>
                <button
                  onClick={() => setShowWishlist(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${tmpl.subtext}12` }}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke={tmpl.text}
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {wishlistProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <svg
                      className="w-16 h-16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={`${tmpl.subtext}40`}
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                      />
                    </svg>
                    <p className="text-sm" style={{ color: tmpl.subtext }}>
                      未有收藏商品
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {wishlistProducts.map((p) => (
                      <BioProductCard
                        key={p.id}
                        product={p}
                        currency={currency}
                        onAdd={handleCardAdd}
                        onTap={(product) => {
                          setShowWishlist(false);
                          setSheetProduct(product);
                        }}
                        wishlisted={true}
                        onToggleWishlist={() => handleToggleWishlist(p.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scroll to top FAB */}
        <ScrollToTopFAB />

        {/* Image lightbox */}
        {lightbox && (
          <ImageLightbox
            images={lightbox.images}
            startIndex={lightbox.startIndex}
            videoUrl={lightbox.videoUrl}
            onClose={() => setLightbox(null)}
          />
        )}

        {/* Toast */}
        {toast && (
          <div
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] px-5 py-2.5 rounded-full text-sm font-medium shadow-lg animate-slide-up"
            style={{ backgroundColor: tmpl.card, color: tmpl.text }}
          >
            {toast}
          </div>
        )}

        {/* Footer — growth CTA */}
        <footer
          className="py-5 pb-20 text-center border-t"
          style={{ backgroundColor: tmpl.bg, borderColor: `${tmpl.subtext}20` }}
        >
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold transition-opacity hover:opacity-80 active:opacity-60"
            style={{ color: tmpl.accent }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9,22 9,12 15,12 15,22" />
            </svg>
            用 WoWlix 免費開店 →
          </a>
        </footer>
      </div>
    </TemplateProvider>
  );
}
