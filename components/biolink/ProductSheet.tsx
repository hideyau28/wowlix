"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  type ProductForBioLink,
  getAllImages,
  getVisibleVariants,
  getDualVariantData,
  getVariantLabel,
  formatPrice,
} from "@/lib/biolink-helpers";
import { getColorHex } from "@/lib/color-map";
import { getEmbedUrl } from "@/lib/video-embed";
import { useTemplate } from "@/lib/template-context";
import { useDialogA11y } from "./use-dialog-a11y";
import SizeChartModal from "@/components/SizeChartModal";

type Props = {
  product: ProductForBioLink;
  currency?: string;
  onClose: () => void;
  onAddToCart: (
    product: ProductForBioLink,
    variant: string | null,
    qty: number,
  ) => void;
  allProducts?: ProductForBioLink[];
  onSwitchProduct?: (product: ProductForBioLink) => void;
  wishlisted?: boolean;
  onToggleWishlist?: () => void;
};

export default function ProductSheet({
  product,
  currency = "HKD",
  onClose,
  onAddToCart,
  allProducts,
  onSwitchProduct,
  wishlisted = false,
  onToggleWishlist,
}: Props) {
  const tmpl = useTemplate();
  // Dialog a11y — focus 入 sheet / Tab trap / Escape 閂 / 閂咗 focus 還原
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, onClose);
  const images = getAllImages(product);
  const dualVariant = getDualVariantData(product);
  const singleVariants = getVisibleVariants(product);
  const variantLabel = getVariantLabel(product);
  const videoEmbedUrl = product.videoUrl ? getEmbedUrl(product.videoUrl) : null;

  const isDual = dualVariant !== null;

  // 判斷係咪鞋碼產品 — sizes key 符合 "US X" 格式先顯示尺碼表
  const isShoeSize = (() => {
    if (isDual) {
      const dims = dualVariant!.dimensions.map((d) => d.toLowerCase());
      return dims.some(
        (d) => d.includes("size") || d.includes("尺碼") || d.includes("us"),
      );
    }
    if (!product.sizes || typeof product.sizes !== "object") return false;
    const keys = Object.keys(product.sizes);
    return keys.some((k) => /^US\s/i.test(k));
  })();

  // 檢測邊個 dimension 係顏色
  const isColorDimension = (dimName: string) => {
    const lower = dimName.toLowerCase();
    return lower.includes("color") || lower.includes("顏色") || lower === "色";
  };

  // 決定顏色同尺碼嘅 dimension index
  let colorDimIndex = -1;
  let sizeDimIndex = -1;
  if (isDual && dualVariant) {
    if (isColorDimension(dualVariant.dimensions[0])) {
      colorDimIndex = 0;
      sizeDimIndex = 1;
    } else {
      colorDimIndex = 1;
      sizeDimIndex = 0;
    }
  }

  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [qty, setQty] = useState(1);
  const [showError, setShowError] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [showDescription, setShowDescription] = useState(false);
  const [showSizeChart, setShowSizeChart] = useState(false);

  // Swipe / zoom state
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [swipeDelta, setSwipeDelta] = useState(0);

  const touchStartX = useRef(0);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(
    null,
  );
  const panRef = useRef<{
    startX: number;
    startY: number;
    initPanX: number;
    initPanY: number;
  } | null>(null);
  const lastTapRef = useRef(0);

  // 建立 carousel slides：圖片 + video (如果有)
  const carouselSlides = [...images];
  if (videoEmbedUrl) {
    carouselSlides.push("__VIDEO__");
  }
  const totalSlides = carouselSlides.length;

  // Body scroll lock
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // 換 slide 時重設 zoom
  useEffect(() => {
    setScale(1);
    setPanX(0);
    setPanY(0);
  }, [carouselIndex]);

  // 預設選第一個有貨組合
  useEffect(() => {
    if (isDual && dualVariant && colorDimIndex >= 0 && sizeDimIndex >= 0) {
      const colorOptions =
        dualVariant.options[dualVariant.dimensions[colorDimIndex]] || [];
      const sizeOptions =
        dualVariant.options[dualVariant.dimensions[sizeDimIndex]] || [];
      for (const c of colorOptions) {
        for (const s of sizeOptions) {
          // 組合 key 要按照原本 dimensions 嘅順序
          const key = colorDimIndex === 0 ? `${c}|${s}` : `${s}|${c}`;
          const combo = dualVariant.combinations[key];
          if (combo && combo.status !== "hidden" && combo.qty > 0) {
            setSelectedColor(c);
            setSelectedSize(s);
            const imgIdx = dualVariant.optionImages?.[c] ?? 0;
            setCarouselIndex(imgIdx);
            return;
          }
        }
      }
    } else if (singleVariants && singleVariants.length > 0) {
      const first = singleVariants.find((v) => v.stock > 0);
      if (first) setSelectedSize(first.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  // 計算目前選中組合嘅庫存
  const getSelectedStock = (): number => {
    if (
      isDual &&
      dualVariant &&
      selectedColor &&
      selectedSize &&
      colorDimIndex >= 0
    ) {
      // 組合 key 要按照原本 dimensions 嘅順序
      const key =
        colorDimIndex === 0
          ? `${selectedColor}|${selectedSize}`
          : `${selectedSize}|${selectedColor}`;
      return dualVariant.combinations[key]?.qty ?? 0;
    }
    if (singleVariants && selectedSize) {
      const v = singleVariants.find((sv) => sv.name === selectedSize);
      return v?.stock ?? 0;
    }
    return 0;
  };

  const selectedStock = getSelectedStock();

  // 切換顏色
  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    setSelectedSize("");
    setQty(1);
    setShowError(false);
    if (dualVariant && sizeDimIndex >= 0 && colorDimIndex >= 0) {
      const imgIdx = dualVariant.optionImages?.[color] ?? 0;
      setCarouselIndex(imgIdx);
      // 自動選第一個有貨尺碼
      const sizeOptions =
        dualVariant.options[dualVariant.dimensions[sizeDimIndex]] || [];
      for (const s of sizeOptions) {
        const key = colorDimIndex === 0 ? `${color}|${s}` : `${s}|${color}`;
        const combo = dualVariant.combinations[key];
        if (combo && combo.status !== "hidden" && combo.qty > 0) {
          setSelectedSize(s);
          break;
        }
      }
    }
  };

  // 切換尺碼
  const handleSizeChange = (size: string) => {
    setSelectedSize(size);
    setQty(1);
    setShowError(false);
  };

  // 加入購物車
  const handleAdd = () => {
    if (isDual) {
      if (!selectedColor || !selectedSize) {
        setShowError(true);
        return;
      }
      const variantKey =
        colorDimIndex === 0
          ? `${selectedColor}|${selectedSize}`
          : `${selectedSize}|${selectedColor}`;
      onAddToCart(product, variantKey, qty);
    } else {
      if (!selectedSize) {
        setShowError(true);
        return;
      }
      onAddToCart(product, selectedSize, qty);
    }
  };

  // 取得尺碼列表（含庫存）
  const getSizeOptions = () => {
    if (isDual && dualVariant && sizeDimIndex >= 0 && colorDimIndex >= 0) {
      const sizeDim = dualVariant.dimensions[sizeDimIndex];
      const sizeOptions = dualVariant.options[sizeDim] || [];
      return sizeOptions.map((opt) => {
        const key =
          colorDimIndex === 0
            ? `${selectedColor}|${opt}`
            : `${opt}|${selectedColor}`;
        const combo = dualVariant.combinations[key];
        return {
          name: opt,
          stock: combo ? combo.qty : 0,
          available: combo ? combo.status !== "hidden" && combo.qty > 0 : false,
        };
      });
    }
    if (singleVariants) {
      return singleVariants.map((v) => ({
        name: v.name,
        stock: v.stock,
        available: v.stock > 0,
      }));
    }
    return [];
  };

  const sizes = getSizeOptions();
  const isOnSale =
    product.originalPrice != null && product.originalPrice > product.price;
  const discountPct = isOnSale
    ? Math.round((1 - product.price / product.originalPrice!) * 100)
    : 0;
  const canAdd = isDual
    ? !!(selectedColor && selectedSize && selectedStock > 0)
    : !!(selectedSize && selectedStock > 0);

  // 你可能鍾意 — 同 category 或隨機推薦，最多 4 件
  const relatedProducts = (() => {
    if (!allProducts || allProducts.length <= 1) return [];
    const others = allProducts.filter((p) => p.id !== product.id);
    // 優先同 category
    const sameCategory = product.category
      ? others.filter((p) => p.category === product.category)
      : [];
    if (sameCategory.length >= 4) return sameCategory.slice(0, 4);
    // 不夠就補其他產品
    const rest = others.filter(
      (p) => !sameCategory.some((sc) => sc.id === p.id),
    );
    return [...sameCategory, ...rest].slice(0, 4);
  })();

  // ─── Touch: pinch-to-zoom + swipe ───

  const getDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { startDist: getDist(e.touches), startScale: scale };
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        // 雙擊切換 zoom
        if (scale > 1) {
          setScale(1);
          setPanX(0);
          setPanY(0);
        } else {
          setScale(2.5);
        }
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;
      touchStartX.current = t.clientX;
      if (scale > 1) {
        panRef.current = {
          startX: t.clientX,
          startY: t.clientY,
          initPanX: panX,
          initPanY: panY,
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const newScale = Math.min(
        4,
        Math.max(
          1,
          pinchRef.current.startScale *
            (getDist(e.touches) / pinchRef.current.startDist),
        ),
      );
      setScale(newScale);
      if (newScale <= 1.05) {
        setPanX(0);
        setPanY(0);
      }
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (scale > 1 && panRef.current) {
        setPanX(panRef.current.initPanX + t.clientX - panRef.current.startX);
        setPanY(panRef.current.initPanY + t.clientY - panRef.current.startY);
      } else if (scale <= 1) {
        setSwipeDelta(t.clientX - touchStartX.current);
      }
    }
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
    panRef.current = null;
    if (scale < 1.1) {
      setScale(1);
      setPanX(0);
      setPanY(0);
    }
    const delta = swipeDelta;
    if (Math.abs(delta) > 0) {
      setSwipeDelta(0);
      if (delta < -50)
        setCarouselIndex((prev) => Math.min(totalSlides - 1, prev + 1));
      else if (delta > 50) setCarouselIndex((prev) => Math.max(0, prev - 1));
    }
  };

  // Derived border color
  const sectionBorder = `${tmpl.subtext}25`;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-sheet-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 focus:outline-none"
      style={{ backgroundColor: tmpl.bg }}
    >
      {/* Fullscreen modal */}
      <div className="h-full flex flex-col max-w-[480px] mx-auto animate-slide-up">
        {/* Image Carousel Section - 全寬 1:1 */}
        <div
          className="relative w-full aspect-square overflow-hidden"
          style={{ backgroundColor: `${tmpl.card}` }}
        >
          {/* Top buttons - 收藏 + 關閉 */}
          {onToggleWishlist && (
            <button
              onClick={onToggleWishlist}
              aria-label={wishlisted ? "取消收藏" : "加入收藏"}
              className="absolute top-4 right-16 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center active:scale-95 transition-all"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill={wishlisted ? "#ef4444" : "none"}
                stroke={wishlisted ? "#ef4444" : "#52525b"}
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
          <button
            onClick={onClose}
            aria-label="關閉"
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center text-zinc-600 hover:text-zinc-900 active:scale-95 transition-all"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
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

          {/* Carousel slides */}
          <div
            className="w-full h-full"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              transform:
                scale <= 1 && swipeDelta !== 0
                  ? `translateX(${swipeDelta}px)`
                  : undefined,
              transition:
                swipeDelta === 0 && scale <= 1
                  ? "transform 0.22s ease-out"
                  : "none",
              cursor: scale > 1 ? "grab" : "default",
            }}
          >
            {carouselSlides.map((slide, idx) => (
              <div
                key={idx}
                className={`absolute inset-0 transition-opacity duration-300 ${
                  idx === carouselIndex
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                {slide === "__VIDEO__" ? (
                  <iframe
                    src={videoEmbedUrl!}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div
                    className="w-full h-full"
                    style={
                      idx === carouselIndex && scale > 1
                        ? {
                            transform: `scale(${scale}) translate(${panX / scale}px, ${panY / scale}px)`,
                            transformOrigin: "center",
                            transition: "none",
                          }
                        : undefined
                    }
                  >
                    <Image
                      src={slide}
                      alt={product.title}
                      fill
                      className="object-cover"
                      sizes="480px"
                      priority={idx === 0}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Dots indicator */}
          {totalSlides > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
              {carouselSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCarouselIndex(idx)}
                  aria-label={`查看圖片 ${idx + 1}`}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    idx === carouselIndex ? "bg-white w-4" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* 商品名稱 + 價格 */}
          <div>
            <h3 id="product-sheet-title" className="text-xl font-bold mb-2" style={{ color: tmpl.text }}>
              {product.title}
            </h3>
            <div className="flex items-center gap-2">
              <span className="font-bold text-2xl" style={{ color: tmpl.text }}>
                {formatPrice(product.price, currency)}
              </span>
              {isOnSale && (
                <>
                  <span
                    className="text-base line-through"
                    style={{ color: tmpl.subtext }}
                  >
                    {formatPrice(product.originalPrice!, currency)}
                  </span>
                  <span
                    className="px-2 py-0.5 text-xs font-bold rounded text-white"
                    style={{ backgroundColor: tmpl.accent }}
                  >
                    -{discountPct}%
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 顏色（雙維 only，永遠顯示喺先） */}
          {isDual && dualVariant && colorDimIndex >= 0 && (
            <div>
              <p
                className="text-sm font-semibold mb-3 pb-2"
                style={{
                  color: tmpl.text,
                  borderBottom: `1px solid ${sectionBorder}`,
                }}
              >
                顏色
                {showError && !selectedColor && (
                  <span className="text-red-500 ml-1 font-normal">請選擇</span>
                )}
              </p>
              <div className="flex gap-3 flex-wrap">
                {(
                  dualVariant.options[dualVariant.dimensions[colorDimIndex]] ||
                  []
                ).map((opt) => {
                  const colorHex = getColorHex(opt);
                  const isWhite =
                    colorHex.toLowerCase() === "#fafafa" ||
                    opt.toLowerCase().includes("white") ||
                    opt.includes("白");
                  return (
                    <button
                      key={opt}
                      onClick={() => handleColorChange(opt)}
                      aria-label={`選擇顏色 ${opt}`}
                      className={`w-10 h-10 rounded-full transition-all flex-shrink-0 border-2 ${
                        selectedColor === opt ? "scale-110" : ""
                      }`}
                      style={{
                        backgroundColor: colorHex,
                        borderColor:
                          selectedColor === opt
                            ? tmpl.accent
                            : isWhite
                              ? "#d4d4d8"
                              : "#e4e4e7",
                        boxShadow:
                          selectedColor === opt
                            ? `0 0 0 3px ${tmpl.accent}4D`
                            : undefined,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* 尺碼（用文字顯示） */}
          <div>
            <div
              className="flex items-center justify-between mb-3 pb-2"
              style={{ borderBottom: `1px solid ${sectionBorder}` }}
            >
              <p className="text-sm font-semibold" style={{ color: tmpl.text }}>
                {isDual && sizeDimIndex >= 0
                  ? dualVariant!.dimensions[sizeDimIndex]
                  : variantLabel}
                {showError && !selectedSize && (
                  <span className="text-red-500 ml-1 font-normal">請選擇</span>
                )}
              </p>
              {isShoeSize && (
                <button
                  onClick={() => setShowSizeChart(true)}
                  className="text-xs font-medium flex items-center gap-1"
                  style={{ color: tmpl.accent }}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  尺碼表
                </button>
              )}
            </div>
            <div
              className={`flex gap-2 ${
                sizes.length > 8
                  ? "overflow-x-auto pb-1 scrollbar-hide"
                  : "flex-wrap"
              }`}
            >
              {sizes.map((s) => (
                <button
                  key={s.name}
                  onClick={() => s.available && handleSizeChange(s.name)}
                  disabled={!s.available}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium border transition-all flex-shrink-0"
                  style={
                    selectedSize === s.name
                      ? {
                          borderColor: tmpl.accent,
                          backgroundColor: `${tmpl.accent}18`,
                          color: tmpl.accent,
                        }
                      : s.available
                        ? { borderColor: sectionBorder, color: tmpl.text }
                        : {
                            borderColor: `${tmpl.subtext}15`,
                            color: `${tmpl.subtext}60`,
                            backgroundColor: `${tmpl.subtext}08`,
                            textDecoration: "line-through",
                            cursor: "not-allowed",
                          }
                  }
                >
                  {s.name}
                  {!s.available && (
                    <span className="text-[10px] ml-1">冇貨</span>
                  )}
                  {s.available && s.stock > 0 && s.stock <= 3 && (
                    <span className="text-[10px] text-red-500 ml-1">
                      剩{s.stock}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 商品描述（可摺疊） */}
          {product.description && (
            <div>
              <button
                onClick={() => setShowDescription(!showDescription)}
                aria-label={showDescription ? "隱藏商品描述" : "展開商品描述"}
                className="w-full flex items-center justify-between text-sm font-semibold pb-2"
                style={{
                  color: tmpl.text,
                  borderBottom: `1px solid ${sectionBorder}`,
                }}
              >
                <span>商品描述</span>
                <svg
                  className={`w-4 h-4 transition-transform ${showDescription ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {showDescription && (
                <div
                  className="mt-3 text-sm whitespace-pre-wrap"
                  style={{ color: tmpl.subtext }}
                >
                  {product.description}
                </div>
              )}
            </div>
          )}

          {/* 數量 stepper */}
          <div>
            <p
              className="text-sm font-semibold mb-3 pb-2"
              style={{
                color: tmpl.text,
                borderBottom: `1px solid ${sectionBorder}`,
              }}
            >
              數量
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                aria-label="減少數量"
                className="w-10 h-10 rounded-xl border flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ borderColor: sectionBorder, color: tmpl.text }}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 12h-15"
                  />
                </svg>
              </button>
              <span
                className="text-lg font-semibold w-10 text-center"
                style={{ color: tmpl.text }}
              >
                {qty}
              </span>
              <button
                onClick={() =>
                  setQty((q) => Math.min(selectedStock || 99, q + 1))
                }
                disabled={qty >= selectedStock}
                aria-label="增加數量"
                className="w-10 h-10 rounded-xl border flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ borderColor: sectionBorder, color: tmpl.text }}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* 你可能鍾意 */}
          {relatedProducts.length > 0 && onSwitchProduct && (
            <div>
              <p
                className="text-sm font-semibold mb-3 pb-2"
                style={{
                  color: tmpl.text,
                  borderBottom: `1px solid ${sectionBorder}`,
                }}
              >
                你可能鍾意
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {relatedProducts.map((rp) => {
                  const rpImages = getAllImages(rp);
                  const rpHero = rpImages[0] || null;
                  const rpOnSale =
                    rp.originalPrice != null && rp.originalPrice > rp.price;
                  return (
                    <button
                      key={rp.id}
                      onClick={() => onSwitchProduct(rp)}
                      className="flex-shrink-0 w-28 text-left"
                    >
                      <div
                        className="relative aspect-square rounded-lg overflow-hidden mb-1.5"
                        style={{ backgroundColor: `${tmpl.subtext}10` }}
                      >
                        {rpHero ? (
                          <Image
                            src={rpHero}
                            alt={rp.title}
                            fill
                            className="object-cover"
                            sizes="112px"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{ backgroundColor: `${tmpl.subtext}15` }}
                          >
                            <svg
                              className="w-6 h-6"
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
                      </div>
                      <p
                        className="text-xs font-medium leading-tight mb-0.5"
                        style={{
                          color: tmpl.text,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {rp.title}
                      </p>
                      <div className="flex items-center gap-1">
                        <span
                          className="text-xs font-bold"
                          style={{ color: tmpl.text }}
                        >
                          {formatPrice(rp.price, currency)}
                        </span>
                        {rpOnSale && (
                          <span
                            className="text-[10px] line-through"
                            style={{ color: tmpl.subtext }}
                          >
                            {formatPrice(rp.originalPrice!, currency)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom padding for CTA */}
          <div className="h-20" />
        </div>

        {/* 固定底部 CTA */}
        <div
          className="absolute bottom-0 left-0 right-0 max-w-[480px] mx-auto px-4 py-4"
          style={{
            backgroundColor: tmpl.bg,
            borderTop: `1px solid ${sectionBorder}`,
          }}
        >
          <button
            onClick={handleAdd}
            className="w-full py-4 rounded-xl text-base font-semibold transition-all active:scale-[0.98]"
            style={
              canAdd
                ? {
                    backgroundColor: tmpl.accent,
                    color: "#FFFFFF",
                    boxShadow: `0 10px 15px -3px ${tmpl.accent}4D`,
                  }
                : { backgroundColor: `${tmpl.subtext}30`, color: tmpl.subtext }
            }
          >
            加入購物車
            {canAdd ? ` ${formatPrice(product.price * qty, currency)}` : ""}
          </button>
        </div>
      </div>

      {/* 尺碼表 modal */}
      <SizeChartModal
        isOpen={showSizeChart}
        onClose={() => setShowSizeChart(false)}
        isKids={sizes.some((s) => /\d+[CY]$/i.test(s.name))}
        locale="zh-HK"
      />
    </div>
  );
}
