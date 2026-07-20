"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import type { Product } from "@prisma/client";
import type { Locale } from "@/lib/i18n";
import { createProduct, updateProduct, syncVariants } from "./actions";
import ImageUpload from "@/components/admin/ImageUpload";
import VariantMatrixEditor, {
  type VariantRow,
} from "@/components/admin/VariantMatrixEditor";
import {
  PRODUCT_TYPES,
  getProductTypePreset,
} from "@/lib/product-type-presets";
import { GripVertical, X, Plus } from "lucide-react";

// Legacy shoe size systems (kept for backward compatibility)
const SIZE_SYSTEMS: Record<string, { label: string; sizes: string[] }> = {
  mens_us: {
    label: "Men's US",
    sizes: [
      "US 7",
      "US 7.5",
      "US 8",
      "US 8.5",
      "US 9",
      "US 9.5",
      "US 10",
      "US 10.5",
      "US 11",
      "US 11.5",
      "US 12",
      "US 13",
      "US 14",
    ],
  },
  womens_us: {
    label: "Women's US",
    sizes: [
      "US 5",
      "US 5.5",
      "US 6",
      "US 6.5",
      "US 7",
      "US 7.5",
      "US 8",
      "US 8.5",
      "US 9",
      "US 9.5",
      "US 10",
      "US 10.5",
      "US 11",
    ],
  },
  gs_youth: {
    label: "GS Youth",
    sizes: ["3.5Y", "4Y", "4.5Y", "5Y", "5.5Y", "6Y", "6.5Y", "7Y"],
  },
  ps_kids: {
    label: "PS Kids",
    sizes: [
      "10.5C",
      "11C",
      "11.5C",
      "12C",
      "12.5C",
      "13C",
      "13.5C",
      "1Y",
      "1.5Y",
      "2Y",
      "2.5Y",
      "3Y",
    ],
  },
  td_toddler: {
    label: "TD Toddler",
    sizes: ["2C", "3C", "4C", "5C", "6C", "7C", "8C", "9C", "10C"],
  },
  eu: {
    label: "EU",
    sizes: [
      "EU 36",
      "EU 37",
      "EU 38",
      "EU 39",
      "EU 40",
      "EU 41",
      "EU 42",
      "EU 43",
      "EU 44",
      "EU 45",
      "EU 46",
      "EU 47",
    ],
  },
};

// Category options (for sneakers)
const CATEGORIES = [
  "Air Jordan",
  "Dunk/SB",
  "Air Max",
  "Air Force",
  "Running",
  "Basketball",
  "Lifestyle",
  "Training",
  "Sandals",
];

// Shoe type options (for sneakers)
const SHOE_TYPES = [
  { value: "adult", label: "男裝" },
  { value: "womens", label: "女裝" },
  { value: "grade_school", label: "GS 大童" },
  { value: "preschool", label: "PS 小童" },
  { value: "toddler", label: "TD 幼童" },
];

// Promotion badges
const PROMOTION_BADGES = [
  { value: "店長推介", label: "店長推介" },
  { value: "今期熱賣", label: "今期熱賣" },
  { value: "新品上架", label: "新品上架" },
  { value: "限時優惠", label: "限時優惠" },
  { value: "人氣之選", label: "人氣之選" },
];

type BadgeOption = {
  id: string;
  nameZh: string;
  nameEn: string;
  color: string;
};

function isCuid(value: string) {
  return value.startsWith("c") && value.length >= 25;
}

function extractBadgeIds(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter(
      (item): item is string => typeof item === "string" && isCuid(item),
    );
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item && isCuid(item));
  }
  return [];
}

// Auto-detect size system from existing keys
function detectSizeSystem(sizeInventory: Record<string, number>): string {
  const keys = Object.keys(sizeInventory);
  if (keys.length === 0) return "";
  if (keys.some((k) => k.startsWith("EU "))) return "eu";
  if (keys.some((k) => /^\d+C$/.test(k) || /^US \d+C$/.test(k)))
    return "td_toddler";
  if (keys.some((k) => /^(1|2|3)(\.5)?Y$/.test(k))) return "ps_kids";
  if (keys.some((k) => /^(3\.5|[4-7])(\.5)?Y$/.test(k))) return "gs_youth";
  if (keys.some((k) => k.match(/^US (5|5\.5|6|6\.5)$/))) return "womens_us";
  if (keys.some((k) => k.startsWith("US "))) return "mens_us";
  return "";
}

type ProductModalProps = {
  product: (Product & { variants?: any[] }) | null;
  onClose: (saved?: boolean) => void;
  locale: Locale;
};

export function ProductModal({ product, onClose, locale }: ProductModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<{ code: string; message: string } | null>(
    null,
  );
  const modalRef = useRef<HTMLDivElement>(null);

  // Parse existing sizeInventory (legacy)
  const existingSizeInventory = (() => {
    const sizes = (product as any)?.sizes;
    if (sizes && typeof sizes === "object" && !Array.isArray(sizes)) {
      return sizes as Record<string, number>;
    }
    return {};
  })();
  const detectedSizeSystem = detectSizeSystem(existingSizeInventory);

  // --- Core product fields ---
  const [brand, setBrand] = useState(product?.brand || "");
  const [title, setTitle] = useState(product?.title || "");
  const [sku, setSku] = useState((product as any)?.sku || "");
  const [price, setPrice] = useState(product?.price.toString() || "");
  const [originalPrice, setOriginalPrice] = useState(
    product?.originalPrice?.toString() || "",
  );
  const [description, setDescription] = useState(
    (product as any)?.description || "",
  );
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || "");
  const [images, setImages] = useState<string[]>(
    (product as any)?.images && Array.isArray((product as any).images)
      ? ((product as any).images as string[])
      : [],
  );
  const [videoUrl, setVideoUrl] = useState((product as any)?.videoUrl || "");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [category, setCategory] = useState(product?.category || "");
  const [active, setActive] = useState(product?.active ?? true);
  const [featured, setFeatured] = useState((product as any)?.featured ?? false);
  const [shoeType, setShoeType] = useState((product as any)?.shoeType || "");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // --- Promotion & product badges ---
  const [promotionBadges, setPromotionBadges] = useState<string[]>(
    (product as any)?.promotionBadges &&
      Array.isArray((product as any).promotionBadges)
      ? ((product as any).promotionBadges as string[])
      : [],
  );
  const [badgeOptions, setBadgeOptions] = useState<BadgeOption[]>([]);
  const [badgeLoading, setBadgeLoading] = useState(false);
  const [badgeError, setBadgeError] = useState<string | null>(null);
  const [selectedBadgeIds, setSelectedBadgeIds] = useState<string[]>(
    extractBadgeIds((product as any)?.badges),
  );
  const [isBadgeDropdownOpen, setIsBadgeDropdownOpen] = useState(false);

  // --- NEW: Product Type & Variant System ---
  const [productType, setProductType] = useState<string>(
    (product as any)?.productType || "",
  );
  const [inventoryMode, setInventoryMode] = useState<
    "limited" | "made_to_order"
  >(
    (product as any)?.inventoryMode === "made_to_order"
      ? "made_to_order"
      : "limited",
  );

  // Option dimensions
  const [option1Label, setOption1Label] = useState("尺碼");
  const [option1SizeSystem, setOption1SizeSystem] = useState("");
  const [option1Values, setOption1Values] = useState<string[]>([]);
  const [option2Label, setOption2Label] = useState("顏色");
  const [option2Values, setOption2Values] = useState<string[]>([]);
  const [newOption2Value, setNewOption2Value] = useState("");
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);

  // Legacy size system (for sneakers backward compat)
  const [sizeSystem, setSizeSystem] = useState(detectedSizeSystem);
  const [sizeInventory, setSizeInventory] = useState<Record<string, number>>(
    existingSizeInventory,
  );
  const [customSizes, setCustomSizes] = useState<string[]>(() => {
    if (!detectedSizeSystem) return [];
    const systemSizes = SIZE_SYSTEMS[detectedSizeSystem]?.sizes || [];
    return Object.keys(existingSizeInventory).filter(
      (k) => !systemSizes.includes(k),
    );
  });
  const [newCustomSize, setNewCustomSize] = useState("");

  // Determine if using new variant system or legacy size system
  const useVariantSystem = productType !== "" && productType !== "sneakers";
  const typePreset = productType
    ? getProductTypePreset(productType)
    : undefined;

  // Auto-set option1 label and size system when product type changes
  useEffect(() => {
    if (!typePreset) return;
    if (typePreset.noSize) {
      setOption1Label("");
      setOption1SizeSystem("");
      setOption1Values([]);
    } else if (typePreset.sizeSystems.length > 0) {
      setOption1Label("尺碼");
      const defaultSys =
        typePreset.defaultSizeSystem || typePreset.sizeSystems[0].id;
      setOption1SizeSystem(defaultSys);
      // Don't auto-select values; let user pick
    }
  }, [productType]);

  // Get preset sizes for option 1
  const option1PresetSizes = useMemo(() => {
    if (!typePreset || typePreset.noSize) return [];
    const sys = typePreset.sizeSystems.find((s) => s.id === option1SizeSystem);
    return sys?.sizes || [];
  }, [typePreset, option1SizeSystem]);

  // Load existing variants into the editor (from product object or API)
  useEffect(() => {
    if (!product) return;

    const loadVariants = (variants: any[]) => {
      const optKeys = new Set<string>();
      for (const v of variants) {
        if (v.options && typeof v.options === "object") {
          Object.keys(v.options).forEach((k) => optKeys.add(k));
        }
      }
      const keys = Array.from(optKeys);

      if (keys.length >= 1) {
        setOption1Label(keys[0]);
        const vals1 = new Set<string>();
        for (const v of variants) {
          if (v.options?.[keys[0]]) vals1.add(v.options[keys[0]]);
        }
        setOption1Values(Array.from(vals1));
      }
      if (keys.length >= 2) {
        setOption2Label(keys[1]);
        const vals2 = new Set<string>();
        for (const v of variants) {
          if (v.options?.[keys[1]]) vals2.add(v.options[keys[1]]);
        }
        setOption2Values(Array.from(vals2));
      }

      const rows: VariantRow[] = variants.map((v: any) => {
        const o1 = keys.length >= 1 ? v.options?.[keys[0]] || "" : "";
        const o2 = keys.length >= 2 ? v.options?.[keys[1]] || "" : undefined;
        return {
          key: o2 ? `${o1}|${o2}` : o1,
          option1Value: o1,
          option2Value: o2,
          price: v.price?.toString() || price,
          stock: v.stock?.toString() || "0",
          active: v.active ?? true,
        };
      });
      setVariantRows(rows);
    };

    // If variants are already in the product object, use them
    const existingVariants = (product as any).variants as any[] | undefined;
    if (existingVariants && existingVariants.length > 0) {
      loadVariants(existingVariants);
      return;
    }

    // Otherwise fetch from API
    const fetchVariants = async () => {
      try {
        const res = await fetch(`/api/admin/products/${product.id}/variants`);
        const json = await res.json();
        if (json.ok && json.data?.variants?.length > 0) {
          loadVariants(json.data.variants);
        }
      } catch {
        // Ignore fetch errors, just means no variants
      }
    };
    fetchVariants();
  }, [product?.id]);

  // Stock calculations
  const legacyTotalStock = Object.values(sizeInventory).reduce(
    (sum, qty) => sum + qty,
    0,
  );
  const variantTotalStock = variantRows
    .filter((v) => v.active)
    .reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);

  // --- Event handlers ---
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isPending) onClose();
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isPending, onClose]);

  useEffect(() => {
    setSelectedBadgeIds(extractBadgeIds((product as any)?.badges));
  }, [product?.id]);

  useEffect(() => {
    let isActive = true;
    const loadBadges = async () => {
      setBadgeLoading(true);
      setBadgeError(null);
      try {
        const res = await fetch("/api/admin/badges");
        const json = await res.json();
        if (!res.ok || !json.ok) {
          if (isActive)
            setBadgeError(json?.error?.message || "Failed to load badges.");
          return;
        }
        if (isActive) setBadgeOptions(json.badges || []);
      } catch (err) {
        console.error("Failed to load badges:", err);
        if (isActive) setBadgeError("Failed to load badges.");
      } finally {
        if (isActive) setBadgeLoading(false);
      }
    };
    loadBadges();
    return () => {
      isActive = false;
    };
  }, []);

  // Image handlers
  const handleAddImage = () => {
    if (newImageUrl.trim() && images.length < 10) {
      setImages([...images, newImageUrl.trim()]);
      setNewImageUrl("");
    }
  };
  const handleRemoveImage = (index: number) =>
    setImages(images.filter((_, i) => i !== index));
  const handleSetAsMainImage = (index: number) => {
    const newMain = images[index];
    const oldMain = imageUrl;
    setImageUrl(newMain);
    const newImages = images.filter((_, i) => i !== index);
    if (oldMain) newImages.unshift(oldMain);
    setImages(newImages);
  };
  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newImages = [...images];
    const [draggedItem] = newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedItem);
    setImages(newImages);
    setDraggedIndex(index);
  };
  const handleDragEnd = () => setDraggedIndex(null);

  // Badge handlers
  const togglePromotionBadge = (badge: string) => {
    setPromotionBadges((prev) =>
      prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge],
    );
  };
  const toggleProductBadge = (badgeId: string) => {
    setSelectedBadgeIds((prev) =>
      prev.includes(badgeId)
        ? prev.filter((id) => id !== badgeId)
        : [...prev, badgeId],
    );
  };

  // Legacy size handlers
  const handleSizeCheck = (size: string, checked: boolean) => {
    if (checked) {
      setSizeInventory((prev) => ({ ...prev, [size]: prev[size] || 0 }));
    } else {
      setSizeInventory((prev) => {
        const next = { ...prev };
        delete next[size];
        return next;
      });
    }
  };
  const handleSizeStockChange = (size: string, stock: number) => {
    setSizeInventory((prev) => ({ ...prev, [size]: Math.max(0, stock) }));
  };
  const handleAddCustomSize = () => {
    if (newCustomSize.trim() && !customSizes.includes(newCustomSize.trim())) {
      setCustomSizes([...customSizes, newCustomSize.trim()]);
      setNewCustomSize("");
    }
  };
  const handleRemoveCustomSize = (size: string) => {
    setCustomSizes(customSizes.filter((s) => s !== size));
    setSizeInventory((prev) => {
      const next = { ...prev };
      delete next[size];
      return next;
    });
  };

  // Option 1 (size) toggle
  const toggleOption1Value = (val: string) => {
    setOption1Values((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  };

  // Option 2 (color/flavor) handlers
  const addOption2Value = () => {
    const v = newOption2Value.trim();
    if (v && !option2Values.includes(v)) {
      setOption2Values([...option2Values, v]);
      setNewOption2Value("");
    }
  };
  const removeOption2Value = (val: string) => {
    setOption2Values(option2Values.filter((v) => v !== val));
  };

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setError({
        code: "VALIDATION_ERROR",
        message: "Price must be a non-negative number",
      });
      return;
    }

    let originalPriceNum: number | null = null;
    if (originalPrice.trim()) {
      originalPriceNum = parseFloat(originalPrice);
      if (isNaN(originalPriceNum) || originalPriceNum < 0) {
        setError({
          code: "VALIDATION_ERROR",
          message: "Original price must be a non-negative number",
        });
        return;
      }
    }

    if (!title.trim()) {
      setError({ code: "VALIDATION_ERROR", message: "Title is required" });
      return;
    }

    // Sneaker-specific validation
    if (productType === "sneakers" || productType === "") {
      if (!category) {
        setError({ code: "VALIDATION_ERROR", message: "Category is required" });
        return;
      }
      if (!shoeType) {
        setError({
          code: "VALIDATION_ERROR",
          message: "Shoe Type is required",
        });
        return;
      }
    }

    startTransition(async () => {
      // Build product data
      const filteredSizeInventory: Record<string, number> = {};
      Object.entries(sizeInventory).forEach(([size, stock]) => {
        if (stock > 0) filteredSizeInventory[size] = stock;
      });

      // Calculate total stock: from variants if using variant system, otherwise from legacy sizes
      const hasNewVariants = useVariantSystem && variantRows.length > 0;
      const totalStock = hasNewVariants ? variantTotalStock : legacyTotalStock;

      const productData: any = {
        brand: brand.trim() || null,
        title: title.trim(),
        sku: sku.trim() || undefined,
        price: priceNum,
        originalPrice: originalPriceNum,
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        images: images.length > 0 ? images : undefined,
        videoUrl: videoUrl.trim() || null,
        category: category || null,
        badges: selectedBadgeIds,
        active,
        featured,
        shoeType: shoeType || null,
        sizeSystem: sizeSystem || null,
        sizes:
          Object.keys(filteredSizeInventory).length > 0
            ? filteredSizeInventory
            : null,
        stock: totalStock,
        promotionBadges:
          promotionBadges.length > 0 ? promotionBadges : undefined,
        productType: productType || null,
        inventoryMode,
      };

      let result;
      if (product) {
        result = await updateProduct(product.id, productData, locale);
      } else {
        result = await createProduct(productData as any, locale);
      }

      if (!result.ok) {
        setError({ code: result.code, message: result.message });
        return;
      }

      // Sync variants if using variant system
      const savedProductId = product?.id || (result as any).data?.id;
      if (hasNewVariants && savedProductId) {
        const variantsPayload = variantRows
          .filter((v) => v.active)
          .map((v, idx) => {
            const options: Record<string, string> = {};
            if (option1Label && v.option1Value)
              options[option1Label] = v.option1Value;
            if (option2Label && v.option2Value)
              options[option2Label] = v.option2Value;
            const nameparts = [v.option1Value, v.option2Value].filter(Boolean);
            return {
              name: nameparts.join(" - "),
              price: parseFloat(v.price) || priceNum,
              stock:
                inventoryMode === "made_to_order"
                  ? 999
                  : parseInt(v.stock) || 0,
              options,
              active: true,
              sortOrder: idx,
            };
          });

        const syncResult = await syncVariants(
          savedProductId,
          variantsPayload,
          locale,
        );
        if (!syncResult.ok) {
          setError({ code: syncResult.code, message: syncResult.message });
          return;
        }
      }

      onClose(true);
    });
  };

  // Discount calculation
  const priceNum = parseFloat(price) || 0;
  const originalPriceNum = parseFloat(originalPrice) || 0;
  const isOnSale = originalPriceNum > priceNum && priceNum > 0;
  const discountPercent = isOnSale
    ? Math.round((1 - priceNum / originalPriceNum) * 100)
    : 0;

  // Legacy size system
  const systemSizes = sizeSystem ? SIZE_SYSTEMS[sizeSystem]?.sizes || [] : [];
  const allAvailableSizes = [...systemSizes, ...customSizes];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl border border-wlx-mist bg-white animate-in fade-in-0 slide-in-from-bottom-2 duration-200 ease-out motion-reduce:animate-none"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl border-b border-wlx-mist bg-white px-6 py-4">
          <h2 className="text-xl font-semibold text-wlx-ink">
            {product ? "Edit Product" : "Create Product"}
          </h2>
          <button
            onClick={() => onClose()}
            disabled={isPending}
            className="rounded-full p-2 text-wlx-stone hover:bg-wlx-cream hover:text-wlx-ink transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none">
              <div className="text-red-600 font-semibold text-sm">
                {error.code}
              </div>
              <div className="mt-1 text-red-600 text-sm">{error.message}</div>
            </div>
          )}

          <form id="product-form" onSubmit={handleSubmit}>
            {/* Product Type Selector */}
            <div className="mb-6 rounded-2xl border border-wlx-mist p-4">
              <label className="block text-wlx-stone text-sm font-medium mb-3">
                產品類型
              </label>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_TYPES.map((pt) => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => setProductType(pt.id)}
                    disabled={isPending}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors border disabled:opacity-50 ${
                      productType === pt.id
                        ? "bg-[#6B7A2F] text-white border-[#6B7A2F]"
                        : "bg-wlx-cream text-wlx-stone border-wlx-mist hover:bg-wlx-cream"
                    }`}
                  >
                    {pt.icon} {pt.label}
                  </button>
                ))}
              </div>
              {!productType && (
                <p className="mt-2 text-xs text-wlx-stone">
                  未選產品類型 = 使用舊版波鞋模式
                </p>
              )}
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT COLUMN - Images */}
              <div className="space-y-4">
                {/* Main Image */}
                <div className="rounded-2xl border border-wlx-mist p-4">
                  <label className="block text-wlx-stone text-sm font-medium mb-3">
                    主圖 (Main Image)
                  </label>
                  <ImageUpload
                    currentUrl={imageUrl}
                    onUpload={(url) => setImageUrl(url)}
                    disabled={isPending}
                  />
                  {imageUrl && (
                    <div className="mt-3 relative max-w-[80px]">
                      <img
                        src={imageUrl}
                        alt="Main"
                        className="w-full aspect-square object-cover rounded-lg border border-wlx-mist bg-wlx-cream"
                      />
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="absolute top-2 right-2 p-1 rounded-full bg-white/90 text-wlx-stone hover:text-red-500 hover:bg-white transition-colors shadow-sm"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    disabled={isPending}
                    className="mt-3 w-full rounded-xl border border-wlx-mist bg-white px-3 py-2 text-sm text-wlx-ink placeholder:text-wlx-stone focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-50"
                    placeholder="Or paste image URL here"
                  />
                </div>

                {/* Additional Images */}
                <div className="rounded-2xl border border-wlx-mist p-4">
                  <label className="block text-wlx-stone text-sm font-medium mb-3">
                    額外圖片{" "}
                    <span className="text-wlx-stone font-normal">
                      ({images.length}/10)
                    </span>
                  </label>
                  {images.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {images.map((img, index) => (
                        <div
                          key={index}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          className={`group relative aspect-square rounded-lg overflow-hidden border cursor-move transition-all ${
                            draggedIndex === index
                              ? "border-olive-500 ring-2 ring-olive-200"
                              : "border-wlx-mist"
                          }`}
                        >
                          <img
                            src={img}
                            alt={`Image ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                          <button
                            type="button"
                            onClick={() => handleSetAsMainImage(index)}
                            disabled={isPending}
                            className="absolute inset-x-1 bottom-6 py-1 px-1 text-[10px] font-medium text-white bg-[#6B7A2F]/90 hover:bg-[#6B7A2F] rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                          >
                            設為主圖
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            disabled={isPending}
                            className="absolute top-1 right-1 p-1 rounded-full bg-white/90 text-wlx-stone hover:text-red-500 hover:bg-white transition-colors shadow-sm disabled:opacity-50"
                          >
                            <X size={12} />
                          </button>
                          <div className="absolute bottom-1 left-1 p-0.5 rounded bg-white/80">
                            <GripVertical size={10} className="text-wlx-stone" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {images.length < 10 && (
                    <div className="space-y-2">
                      <ImageUpload
                        currentUrl=""
                        onUpload={(url) => {
                          if (url && images.length < 10) {
                            setImages([...images, url]);
                          }
                        }}
                        disabled={isPending}
                      />
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          disabled={isPending}
                          className="flex-1 rounded-xl border border-wlx-mist bg-white px-3 py-2 text-sm text-wlx-ink placeholder:text-wlx-stone focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-50"
                          placeholder="Or paste image URL"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddImage();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleAddImage}
                          disabled={isPending || !newImageUrl.trim()}
                          className="rounded-xl bg-wlx-cream px-3 py-2 text-wlx-stone hover:bg-wlx-mist transition-colors disabled:opacity-50"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Video URL — 即將推出 */}
                <div className="rounded-2xl border border-wlx-mist p-4 opacity-50">
                  <label className="block text-wlx-stone text-sm font-medium mb-3">
                    影片連結
                    <span className="ml-2 text-xs text-wlx-stone">即將推出</span>
                  </label>
                  <input
                    type="url"
                    disabled
                    value=""
                    className="w-full rounded-xl border border-wlx-mist bg-wlx-cream px-3 py-2 text-sm text-wlx-stone placeholder:text-zinc-300 cursor-not-allowed"
                    placeholder="貼 IG Reel 或 YouTube 連結"
                  />
                </div>
              </div>

              {/* RIGHT COLUMN - Form Fields */}
              <div className="space-y-4">
                {/* Brand */}
                <div>
                  <label className="block text-wlx-stone text-sm font-medium mb-2">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-xl border border-wlx-mist bg-white px-3 py-2.5 text-sm text-wlx-ink placeholder:text-wlx-stone focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-50"
                    placeholder="品牌名"
                  />
                </div>

                {/* Title */}
                <div>
                  <label className="block text-wlx-stone text-sm font-medium mb-2">
                    產品名稱 *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-xl border border-wlx-mist bg-white px-3 py-2.5 text-sm text-wlx-ink placeholder:text-wlx-stone focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-50"
                    placeholder="產品名稱"
                    required
                  />
                </div>

                {/* SKU */}
                <div>
                  <label className="block text-wlx-stone text-sm font-medium mb-2">
                    SKU / Model Number
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-xl border border-wlx-mist bg-white px-3 py-2.5 text-sm text-wlx-ink placeholder:text-wlx-stone focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-50"
                    placeholder="553558-067"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-wlx-stone text-sm font-medium mb-2">
                    商品描述
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isPending}
                    rows={4}
                    className="w-full rounded-xl border border-wlx-mist bg-white px-3 py-2.5 text-sm text-wlx-ink placeholder:text-wlx-stone focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-50 resize-y"
                    placeholder="產品描述（會顯示喺產品詳情頁）"
                  />
                  <p className="mt-1 text-xs text-wlx-stone">
                    支持換行，會原樣顯示
                  </p>
                </div>

                {/* Price */}
                <div className="rounded-xl border border-wlx-mist p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-wlx-stone text-sm font-medium mb-2">
                        售價 ($) *
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        disabled={isPending}
                        className="w-full rounded-xl border border-wlx-mist bg-white px-3 py-2.5 text-sm text-wlx-ink placeholder:text-wlx-stone focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-50"
                        placeholder="899"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-wlx-stone text-sm font-medium mb-2">
                        原價 ($)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={originalPrice}
                        onChange={(e) => setOriginalPrice(e.target.value)}
                        disabled={isPending}
                        className="w-full rounded-xl border border-wlx-mist bg-white px-3 py-2.5 text-sm text-wlx-ink placeholder:text-wlx-stone focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-50"
                        placeholder="1299"
                      />
                    </div>
                  </div>
                  {isOnSale ? (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-wlx-stone line-through text-sm">
                          ${Math.round(originalPriceNum)}
                        </span>
                        <span className="text-lg font-bold text-red-600">
                          ${Math.round(priceNum)}
                        </span>
                        <span className="bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                          -{discountPercent}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-wlx-stone text-xs">
                      設定原價高於售價，會顯示為減價產品
                    </p>
                  )}
                </div>

                {/* Sneaker-specific fields: Category + Shoe Type */}
                {(productType === "sneakers" || productType === "") && (
                  <>
                    <div>
                      <label className="block text-wlx-stone text-sm font-medium mb-2">
                        Category *
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        disabled={isPending}
                        required
                        className="w-full rounded-xl border border-wlx-mist bg-white px-3 py-2.5 text-sm text-wlx-ink focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-50"
                      >
                        <option value="">-- 選擇類別 --</option>
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-wlx-stone text-sm font-medium mb-2">
                        鞋類 / Shoe Type *
                      </label>
                      <select
                        value={shoeType}
                        onChange={(e) => setShoeType(e.target.value)}
                        disabled={isPending}
                        required
                        className="w-full rounded-xl border border-wlx-mist bg-white px-3 py-2.5 text-sm text-wlx-ink focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-50"
                      >
                        <option value="">-- 選擇鞋類 --</option>
                        {SHOE_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Inventory Mode Toggle */}
                <div className="rounded-xl border border-wlx-mist p-4">
                  <label className="block text-wlx-stone text-sm font-medium mb-3">
                    庫存模式
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setInventoryMode("limited")}
                      disabled={isPending}
                      className={`flex-1 rounded-xl py-2.5 text-sm font-medium border transition-colors disabled:opacity-50 ${
                        inventoryMode === "limited"
                          ? "bg-[#6B7A2F] text-white border-[#6B7A2F]"
                          : "bg-wlx-cream text-wlx-stone border-wlx-mist hover:bg-wlx-cream"
                      }`}
                    >
                      有限庫存
                    </button>
                    <button
                      type="button"
                      onClick={() => setInventoryMode("made_to_order")}
                      disabled={isPending}
                      className={`flex-1 rounded-xl py-2.5 text-sm font-medium border transition-colors disabled:opacity-50 ${
                        inventoryMode === "made_to_order"
                          ? "bg-[#6B7A2F] text-white border-[#6B7A2F]"
                          : "bg-wlx-cream text-wlx-stone border-wlx-mist hover:bg-wlx-cream"
                      }`}
                    >
                      接單製作
                    </button>
                  </div>
                  {inventoryMode === "made_to_order" && (
                    <p className="mt-2 text-xs text-wlx-stone">
                      接單製作：無限量，庫存自動設為 999
                    </p>
                  )}
                </div>

                {/* Product Badges */}
                <div>
                  <label className="block text-wlx-stone text-sm font-medium mb-2">
                    產品標籤
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsBadgeDropdownOpen((prev) => !prev)}
                      className="w-full rounded-xl border border-wlx-mist bg-white px-3 py-2.5 text-left text-sm text-wlx-ink flex items-center justify-between"
                    >
                      <span>
                        {selectedBadgeIds.length > 0
                          ? `${selectedBadgeIds.length} badges selected`
                          : "Select badges"}
                      </span>
                      <span className="text-xs text-wlx-stone">▼</span>
                    </button>
                    {isBadgeDropdownOpen && (
                      <div className="absolute z-20 mt-2 w-full max-h-64 overflow-y-auto rounded-xl border border-wlx-mist bg-white shadow-lg animate-in fade-in-0 slide-in-from-top-1 duration-150 motion-reduce:animate-none">
                        {badgeLoading ? (
                          <div className="px-3 py-3 text-sm text-wlx-stone">
                            Loading badges...
                          </div>
                        ) : badgeOptions.length === 0 ? (
                          <div className="px-3 py-3 text-sm text-wlx-stone">
                            No badges available
                          </div>
                        ) : (
                          badgeOptions.map((badge) => {
                            const isSelected = selectedBadgeIds.includes(
                              badge.id,
                            );
                            return (
                              <button
                                key={badge.id}
                                type="button"
                                onClick={() => toggleProductBadge(badge.id)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-wlx-cream transition-colors ${isSelected ? "bg-olive-50" : ""}`}
                              >
                                <span
                                  className="h-3 w-3 rounded-full"
                                  style={{ backgroundColor: badge.color }}
                                />
                                <span className="text-wlx-ink">
                                  {badge.nameZh} / {badge.nameEn}
                                </span>
                                {isSelected && (
                                  <span className="ml-auto text-olive-600">
                                    ✓
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                  {badgeError && (
                    <p className="mt-2 text-xs text-red-600">{badgeError}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedBadgeIds.map((id) => {
                      const badge = badgeOptions.find((o) => o.id === id);
                      const label = badge
                        ? `${badge.nameZh} / ${badge.nameEn}`
                        : id;
                      const color = badge?.color || "#6B7A2F";
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleProductBadge(id)}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-white"
                          style={{ backgroundColor: color }}
                        >
                          <span>{label}</span>
                          <span className="text-white/80">✕</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Promotion Badges */}
                <div>
                  <label className="block text-wlx-stone text-sm font-medium mb-2">
                    推廣標籤
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PROMOTION_BADGES.map((badge) => {
                      const isSelected = promotionBadges.includes(badge.value);
                      return (
                        <button
                          key={badge.value}
                          type="button"
                          onClick={() => togglePromotionBadge(badge.value)}
                          disabled={isPending}
                          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors border disabled:opacity-50 ${
                            isSelected
                              ? "bg-[#6B7A2F] text-white border-[#6B7A2F]"
                              : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                          }`}
                        >
                          {badge.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active & Featured */}
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="active"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                      disabled={isPending}
                      className="h-4 w-4 accent-[#6B7A2F] disabled:opacity-50"
                    />
                    <label htmlFor="active" className="text-wlx-stone text-sm">
                      Active
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="featured"
                      checked={featured}
                      onChange={(e) => setFeatured(e.target.checked)}
                      disabled={isPending}
                      className="h-4 w-4 accent-yellow-500 disabled:opacity-50"
                    />
                    <label htmlFor="featured" className="text-wlx-stone text-sm">
                      Featured
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* FULL WIDTH — Variant System (new types) */}
            {useVariantSystem && typePreset && (
              <div className="mt-6 space-y-4">
                {/* Option 1: Size (from preset) */}
                {!typePreset.noSize && (
                  <div className="rounded-2xl border border-wlx-mist p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-wlx-stone text-sm font-medium">
                        選項 1：{option1Label}
                      </label>
                      {typePreset.sizeSystems.length > 1 && (
                        <select
                          value={option1SizeSystem}
                          onChange={(e) => setOption1SizeSystem(e.target.value)}
                          disabled={isPending}
                          className="rounded-xl border border-wlx-mist bg-white px-3 py-1.5 text-sm text-wlx-ink focus:outline-none focus:ring-1 focus:ring-[#6B7A2F] disabled:opacity-50"
                        >
                          {typePreset.sizeSystems.map((sys) => (
                            <option key={sys.id} value={sys.id}>
                              {sys.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {option1PresetSizes.map((size) => {
                        const selected = option1Values.includes(size);
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => toggleOption1Value(size)}
                            disabled={isPending}
                            className={`rounded-lg px-3 py-1.5 text-sm border transition-colors disabled:opacity-50 ${
                              selected
                                ? "bg-[#6B7A2F] text-white border-[#6B7A2F]"
                                : "bg-white text-wlx-stone border-wlx-mist hover:bg-wlx-cream"
                            }`}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-wlx-stone">
                      已選 {option1Values.length} 個
                    </p>
                  </div>
                )}

                {/* Option 2: Color / Flavor / etc. */}
                <div className="rounded-2xl border border-wlx-mist p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-wlx-stone text-sm font-medium">
                      選項 2：
                    </label>
                    <input
                      type="text"
                      value={option2Label}
                      onChange={(e) => setOption2Label(e.target.value)}
                      disabled={isPending}
                      className="rounded-lg border border-wlx-mist px-2 py-1 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-[#6B7A2F] disabled:opacity-50"
                      placeholder="顏色"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {option2Values.map((val) => (
                      <span
                        key={val}
                        className="inline-flex items-center gap-1 rounded-full bg-wlx-cream px-3 py-1 text-sm text-wlx-stone"
                      >
                        {val}
                        <button
                          type="button"
                          onClick={() => removeOption2Value(val)}
                          disabled={isPending}
                          className="text-wlx-stone hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newOption2Value}
                      onChange={(e) => setNewOption2Value(e.target.value)}
                      disabled={isPending}
                      className="flex-1 rounded-xl border border-wlx-mist bg-white px-3 py-2 text-sm text-wlx-ink placeholder:text-wlx-stone focus:outline-none focus:ring-1 focus:ring-[#6B7A2F] disabled:opacity-50"
                      placeholder={`輸入${option2Label}值（例如：黑色）`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addOption2Value();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={addOption2Value}
                      disabled={isPending || !newOption2Value.trim()}
                      className="rounded-xl bg-wlx-cream px-3 py-2 text-sm text-wlx-stone hover:bg-wlx-mist transition-colors disabled:opacity-50"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                {/* Variant Matrix */}
                {(option1Values.length > 0 || option2Values.length > 0) && (
                  <div className="rounded-2xl border border-wlx-mist p-4">
                    <label className="block text-wlx-stone text-sm font-medium mb-3">
                      Variant Matrix
                    </label>
                    <VariantMatrixEditor
                      option1Label={option1Label}
                      option1Values={option1Values}
                      option2Label={option2Label}
                      option2Values={option2Values}
                      basePrice={price}
                      inventoryMode={inventoryMode}
                      variants={variantRows}
                      onVariantsChange={setVariantRows}
                      disabled={isPending}
                    />
                  </div>
                )}
              </div>
            )}

            {/* FULL WIDTH — Legacy Size System (sneakers / no type) */}
            {!useVariantSystem && (
              <div className="mt-6 rounded-2xl border border-wlx-mist p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-wlx-stone text-sm font-medium">
                    尺碼系統
                  </label>
                  <div className="flex items-center gap-3">
                    <select
                      value={sizeSystem}
                      onChange={(e) => setSizeSystem(e.target.value)}
                      disabled={isPending}
                      className="rounded-xl border border-wlx-mist bg-white px-3 py-2 text-sm text-wlx-ink focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-50"
                    >
                      <option value="">No sizes</option>
                      {Object.entries(SIZE_SYSTEMS).map(([key, val]) => (
                        <option key={key} value={key}>
                          {val.label}
                        </option>
                      ))}
                    </select>
                    <div className="text-sm text-wlx-stone">
                      總庫存:{" "}
                      <span className="font-semibold text-wlx-ink">
                        {legacyTotalStock}
                      </span>
                    </div>
                  </div>
                </div>

                {sizeSystem && (
                  <>
                    <div className="overflow-x-auto max-h-[250px] overflow-y-auto border border-wlx-mist rounded-xl">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-wlx-cream">
                          <tr className="text-wlx-stone border-b border-wlx-mist">
                            <th className="py-2 px-3 text-center font-medium w-12">
                              ✓
                            </th>
                            <th className="py-2 px-3 text-left font-medium">
                              Size
                            </th>
                            <th className="py-2 px-3 text-right font-medium w-24">
                              Stock
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {allAvailableSizes.map((size) => {
                            const isChecked = size in sizeInventory;
                            const stock = sizeInventory[size] || 0;
                            const isCustom = customSizes.includes(size);
                            return (
                              <tr
                                key={size}
                                className="border-b border-wlx-mist hover:bg-wlx-cream transition-colors"
                              >
                                <td className="py-2 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) =>
                                      handleSizeCheck(size, e.target.checked)
                                    }
                                    disabled={isPending}
                                    className="h-4 w-4 accent-[#6B7A2F] disabled:opacity-50"
                                  />
                                </td>
                                <td className="py-2 px-3 text-wlx-ink">
                                  <div className="flex items-center gap-2">
                                    {size}
                                    {isCustom && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoveCustomSize(size)
                                        }
                                        className="text-wlx-stone hover:text-red-500 transition-colors"
                                      >
                                        <X size={12} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    value={isChecked ? stock : ""}
                                    onChange={(e) =>
                                      handleSizeStockChange(
                                        size,
                                        parseInt(e.target.value) || 0,
                                      )
                                    }
                                    disabled={isPending || !isChecked}
                                    className="w-20 rounded-lg border border-wlx-mist px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#6B7A2F] disabled:opacity-50 disabled:bg-wlx-cream"
                                    placeholder="0"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <input
                        type="text"
                        value={newCustomSize}
                        onChange={(e) => setNewCustomSize(e.target.value)}
                        disabled={isPending}
                        className="flex-1 rounded-xl border border-wlx-mist bg-white px-3 py-2 text-sm text-wlx-ink placeholder:text-wlx-stone focus:outline-none focus:ring-1 focus:ring-[#6B7A2F] disabled:opacity-50"
                        placeholder="自訂尺碼 (e.g. US 14)"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomSize();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomSize}
                        disabled={isPending || !newCustomSize.trim()}
                        className="rounded-xl bg-wlx-cream px-3 py-2 text-sm text-wlx-stone hover:bg-wlx-mist transition-colors disabled:opacity-50"
                      >
                        + 自訂尺碼
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 rounded-b-3xl border-t border-wlx-mist bg-white px-6 py-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onClose()}
              disabled={isPending}
              className="flex-1 rounded-xl border border-wlx-mist bg-wlx-cream px-4 py-3 text-sm text-wlx-stone hover:bg-wlx-mist transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="product-form"
              disabled={isPending}
              className="flex-1 rounded-xl bg-[#6B7A2F] px-4 py-3 text-sm text-white font-semibold hover:bg-[#5a6827] transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving..." : product ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
