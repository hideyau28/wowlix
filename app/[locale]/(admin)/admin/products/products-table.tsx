"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import { type Locale } from "@/lib/i18n";
import type { Product } from "@prisma/client";
import { ProductModal } from "./product-modal";
import CsvUpload from "@/components/admin/CsvUpload";
import {
  Search,
  Check,
  X,
  Pencil,
  Eye,
  EyeOff,
  Package,
  LayoutGrid,
  List,
} from "lucide-react";
import {
  fetchProducts,
  toggleFeatured,
  toggleHidden,
  toggleHotSelling,
  updatePrice,
  updateProduct,
} from "./actions";

const ITEMS_PER_PAGE = 50;

// Extended Product type to include promotionBadges and featured fields
type ProductWithBadges = Product & {
  promotionBadges?: string[];
  featured?: boolean;
  images?: string[];
};

type ProductsTableProps = {
  products: ProductWithBadges[];
  locale: Locale;
  currentActive?: string;
  showAddButton?: boolean;
};

type Badge = {
  id: string;
  nameZh: string;
  nameEn: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

const BADGE_PRESETS = [
  { key: "red", color: "#EF4444", label: "限量/熱賣" },
  { key: "green", color: "#22C55E", label: "現貨/新品" },
  { key: "black", color: "#18181B", label: "經典" },
  { key: "blue", color: "#3B82F6", label: "推薦" },
  { key: "orange", color: "#F97316", label: "優惠" },
];

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function exportProductsToCsv(products: ProductWithBadges[]): void {
  const headers = [
    "SKU",
    "Brand",
    "Title",
    "Category",
    "shoeType",
    "Price",
    "originalPrice",
    "imageUrl",
    "images",
    "sizeInventory",
    "Stock",
    "promotionBadges",
    "featured",
    "active",
    "updatedAt",
  ];

  const rows = products.map((product) => {
    const sizesJson = product.sizes ? JSON.stringify(product.sizes) : "";
    const imagesStr = Array.isArray(product.images)
      ? product.images.join("|")
      : "";
    const promotionBadges = Array.isArray(product.promotionBadges)
      ? product.promotionBadges.join(",")
      : "";

    return [
      product.sku || "",
      product.brand || "",
      product.title,
      product.category || "",
      product.shoeType || "",
      String(product.price),
      product.originalPrice != null ? String(product.originalPrice) : "",
      product.imageUrl || "",
      imagesStr,
      sizesJson,
      String(product.stock ?? 0),
      promotionBadges,
      String(product.featured ?? false),
      String(product.active),
      new Date(product.updatedAt).toISOString(),
    ].map(escapeCsvField);
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const today = new Date().toISOString().slice(0, 10);
  const filename = `hk-market-products-${today}.csv`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ProductsTable({
  products: initialProducts,
  locale,
  showAddButton,
}: ProductsTableProps) {
  const isZh = locale === "zh-HK";
  // 本地 products state — 初始值來自 SSR，mutation 後 client-side re-fetch 更新
  const [localProducts, setLocalProducts] =
    useState<ProductWithBadges[]>(initialProducts);
  const isEmpty = localProducts.length === 0;
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCsvOpen, setIsCsvOpen] = useState(false);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [badgeLoading, setBadgeLoading] = useState(false);
  const [badgeError, setBadgeError] = useState<string | null>(null);
  const [badgeFormError, setBadgeFormError] = useState<string | null>(null);
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [badgeNameZh, setBadgeNameZh] = useState("");
  const [badgeNameEn, setBadgeNameEn] = useState("");
  const [badgeColor, setBadgeColor] = useState(
    BADGE_PRESETS[0]?.color || "#EF4444",
  );
  const [badgeSaving, setBadgeSaving] = useState(false);
  const [togglingFeatured, setTogglingFeatured] = useState<string | null>(null);
  const [togglingHotSelling, setTogglingHotSelling] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");
  const [openFilter, setOpenFilter] = useState<
    "category" | "status" | "stock" | null
  >(null);
  const [sortKey, setSortKey] = useState<"originalPrice" | "price" | null>(
    null,
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
    null,
  );
  const [showHidden, setShowHidden] = useState(false);
  const [togglingActive, setTogglingActive] = useState<string | null>(null);
  const [togglingHidden, setTogglingHidden] = useState<string | null>(null);
  // Inline price editing
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editOriginalPrice, setEditOriginalPrice] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // View mode
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  // Client-side re-fetch — 直接用 server action 拎最新 data，唔依賴 cache
  const refreshProducts = useCallback(async () => {
    const result = await fetchProducts();
    if (result.ok) {
      setLocalProducts(result.data as ProductWithBadges[]);
    }
  }, []);

  const CATEGORY_OPTIONS = [
    "All",
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

  const STATUS_OPTIONS = ["All", "Active", "Inactive"];
  const STOCK_OPTIONS = ["All", "In Stock", "Out of Stock"];

  const badgeMap = useMemo(
    () => new Map(badges.map((badge) => [badge.id, badge])),
    [badges],
  );

  const hasStock = (product: ProductWithBadges) => {
    const sizes = (product as { sizes?: Record<string, number> | null }).sizes;
    if (sizes && typeof sizes === "object" && !Array.isArray(sizes)) {
      return Object.values(sizes).some(
        (value) => typeof value === "number" && value > 0,
      );
    }
    return (product.stock ?? 0) > 0;
  };

  const getBadgeStyles = (badge: string) => {
    if (badge === "今期熱賣" || badge.toLowerCase() === "hot") {
      return "bg-wlx-cream text-orange-700";
    }
    if (badge === "新品上架" || badge.toLowerCase() === "new") {
      return "bg-blue-100 text-blue-700";
    }
    if (badge === "快將售罄" || badge.toLowerCase() === "low") {
      return "bg-red-100 text-red-700";
    }
    if (badge === "店長推介" || badge.toLowerCase() === "featured") {
      return "bg-olive-100 text-olive-700";
    }
    return "bg-wlx-cream text-wlx-stone";
  };

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = localProducts.filter((p) => {
      // When showHidden is off and status filter is "All", hide inactive products
      if (!showHidden && statusFilter === "All" && !p.active) return false;

      const matchesSearch =
        !query ||
        p.title.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.brand && p.brand.toLowerCase().includes(query));

      const matchesCategory =
        categoryFilter === "All" || (p.category || "") === categoryFilter;
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active" ? p.active : !p.active);
      const matchesStock =
        stockFilter === "All" ||
        (stockFilter === "In Stock" ? hasStock(p) : !hasStock(p));

      return matchesSearch && matchesCategory && matchesStatus && matchesStock;
    });

    if (sortKey && sortDirection) {
      result = [...result].sort((a, b) => {
        const aValue =
          sortKey === "originalPrice" ? (a.originalPrice ?? 0) : a.price;
        const bValue =
          sortKey === "originalPrice" ? (b.originalPrice ?? 0) : b.price;
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      });
    }

    return result;
  }, [
    localProducts,
    searchQuery,
    categoryFilter,
    statusFilter,
    stockFilter,
    sortKey,
    sortDirection,
    showHidden,
  ]);

  // Paginate filtered products
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleToggleFeatured = async (
    productId: string,
    currentFeatured: boolean,
  ) => {
    setTogglingFeatured(productId);
    try {
      await toggleFeatured(productId, !currentFeatured);
      refreshProducts();
    } catch (error) {
      console.error("Failed to toggle featured:", error);
    } finally {
      setTogglingFeatured(null);
    }
  };

  const handleToggleHotSelling = async (
    productId: string,
    currentBadges: string[],
    isHot: boolean,
  ) => {
    setTogglingHotSelling(productId);
    try {
      await toggleHotSelling(productId, currentBadges, !isHot);
      refreshProducts();
    } catch (error) {
      console.error("Failed to toggle hot selling:", error);
    } finally {
      setTogglingHotSelling(null);
    }
  };

  const startEditingPrice = (product: ProductWithBadges) => {
    setEditingPriceId(product.id);
    setEditPrice(Math.round(product.price).toString());
    setEditOriginalPrice(
      product.originalPrice != null
        ? Math.round(product.originalPrice).toString()
        : "",
    );
  };

  const cancelEditingPrice = () => {
    setEditingPriceId(null);
    setEditPrice("");
    setEditOriginalPrice("");
  };

  const savePrice = async (productId: string) => {
    const priceNum = parseFloat(editPrice);
    if (isNaN(priceNum) || priceNum < 0) return;

    const originalPriceNum = editOriginalPrice.trim()
      ? parseFloat(editOriginalPrice)
      : null;
    if (
      editOriginalPrice.trim() &&
      (isNaN(originalPriceNum!) || originalPriceNum! < 0)
    )
      return;

    setSavingPrice(true);
    try {
      await updatePrice(productId, priceNum, originalPriceNum);
      refreshProducts();
      cancelEditingPrice();
    } catch (error) {
      console.error("Failed to update price:", error);
    } finally {
      setSavingPrice(false);
    }
  };

  const handleToggleActive = async (productId: string, newActive: boolean) => {
    setTogglingActive(productId);
    try {
      await updateProduct(productId, { active: newActive }, locale);
      refreshProducts();
    } catch (error) {
      console.error("Failed to toggle active:", error);
    } finally {
      setTogglingActive(null);
    }
  };

  const handleToggleHidden = async (
    productId: string,
    currentHidden: boolean,
  ) => {
    setTogglingHidden(productId);
    try {
      await toggleHidden(productId, !currentHidden);
      refreshProducts();
    } catch (error) {
      console.error("Failed to toggle hidden:", error);
    } finally {
      setTogglingHidden(null);
    }
  };

  const resetBadgeForm = () => {
    setEditingBadgeId(null);
    setBadgeNameZh("");
    setBadgeNameEn("");
    setBadgeColor(BADGE_PRESETS[0]?.color || "#EF4444");
    setBadgeFormError(null);
  };

  const loadBadges = async () => {
    setBadgeLoading(true);
    setBadgeError(null);
    try {
      const res = await fetch("/api/admin/badges");
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setBadgeError(json?.error?.message || "Failed to load badges.");
        return;
      }
      setBadges(json.data?.badges || []);
    } catch (error) {
      console.error("Failed to load badges:", error);
      setBadgeError("Failed to load badges.");
    } finally {
      setBadgeLoading(false);
    }
  };

  const handleEditBadge = (badge: Badge) => {
    setEditingBadgeId(badge.id);
    setBadgeNameZh(badge.nameZh);
    setBadgeNameEn(badge.nameEn);
    setBadgeColor(badge.color);
    setBadgeFormError(null);
  };

  const handleDeleteBadge = async (badge: Badge) => {
    const confirmed = window.confirm(`Delete badge "${badge.nameZh}"?`);
    if (!confirmed) return;
    const res = await fetch(`/api/admin/badges/${badge.id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      alert(json?.error?.message || "Failed to delete badge.");
      return;
    }
    if (editingBadgeId === badge.id) {
      resetBadgeForm();
    }
    await loadBadges();
  };

  const handleSaveBadge = async () => {
    setBadgeFormError(null);
    if (!badgeNameZh.trim() || !badgeNameEn.trim()) {
      setBadgeFormError("Please provide both Chinese and English names.");
      return;
    }
    if (!badgeColor.trim()) {
      setBadgeFormError("Please provide a color.");
      return;
    }
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(badgeColor.trim())) {
      setBadgeFormError("Color must be a valid hex value (e.g. #EF4444).");
      return;
    }

    setBadgeSaving(true);
    try {
      const payload = {
        nameZh: badgeNameZh.trim(),
        nameEn: badgeNameEn.trim(),
        color: badgeColor.trim(),
      };
      const res = await fetch(
        editingBadgeId
          ? `/api/admin/badges/${editingBadgeId}`
          : "/api/admin/badges",
        {
          method: editingBadgeId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setBadgeFormError(json?.error?.message || "Failed to save badge.");
        return;
      }
      await loadBadges();
      resetBadgeForm();
    } catch (error) {
      console.error("Failed to save badge:", error);
      setBadgeFormError("Failed to save badge.");
    } finally {
      setBadgeSaving(false);
    }
  };

  useEffect(() => {
    loadBadges();
  }, []);

  useEffect(() => {
    if (isBadgeModalOpen && badges.length === 0) {
      loadBadges();
    }
  }, [isBadgeModalOpen, badges.length]);

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleCreateProduct = () => {
    setIsCreating(true);
  };

  const handleCloseModal = (saved?: boolean) => {
    setSelectedProduct(null);
    setIsCreating(false);
    if (saved) {
      // 直接 re-fetch products，唔靠 router.refresh 或 window.reload
      refreshProducts();
    }
  };

  const toggleSort = (key: "originalPrice" | "price") => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection("asc");
      setCurrentPage(1);
      return;
    }
    if (sortDirection === "asc") {
      setSortDirection("desc");
      setCurrentPage(1);
      return;
    }
    if (sortDirection === "desc") {
      setSortKey(null);
      setSortDirection(null);
      setCurrentPage(1);
    }
  };

  const getSortIndicator = (key: "originalPrice" | "price") => {
    if (sortKey !== key) return "↕";
    if (sortDirection === "asc") return "↑";
    if (sortDirection === "desc") return "↓";
    return "↕";
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedProducts.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBatchHide = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(
      `Hide ${selectedIds.size} selected products?`,
    );
    if (!confirmed) return;

    for (const id of selectedIds) {
      await updateProduct(id, { active: false }, locale);
    }
    setSelectedIds(new Set());
    refreshProducts();
  };

  if (isEmpty) {
    return (
      <>
        <div className="mt-12 flex flex-col items-center justify-center rounded-3xl border border-dashed border-wlx-mist bg-white px-6 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-olive-50">
            <Package size={32} className="text-olive-600" />
          </div>
          <h3 className="text-lg font-semibold text-wlx-ink">
            {isZh ? "未有商品" : "No products yet"}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-wlx-stone">
            {isZh
              ? "加入你第一件商品，開始喺網店銷售。"
              : "Add your first product to start selling in your store."}
          </p>
          <button
            onClick={handleCreateProduct}
            className="mt-6 rounded-xl bg-olive-600 px-6 py-3 text-sm font-semibold text-white hover:bg-olive-700 transition-colors"
          >
            + {isZh ? "新增商品" : "Add Product"}
          </button>
        </div>

        {(selectedProduct || isCreating) && (
          <ProductModal
            product={selectedProduct}
            onClose={handleCloseModal}
            locale={locale}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-wlx-stone w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name, SKU, brand..."
            className="w-full rounded-2xl border border-wlx-mist bg-white pl-12 pr-4 py-3 text-sm text-wlx-ink placeholder:text-wlx-stone focus:outline-none focus:ring-2 focus:ring-zinc-300"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {/* View mode toggle */}
          <div className="inline-flex rounded-xl border border-wlx-mist bg-white overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-semibold transition-colors ${
                viewMode === "table"
                  ? "bg-olive-600 text-white"
                  : "text-wlx-stone hover:bg-wlx-cream"
              }`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-semibold transition-colors ${
                viewMode === "grid"
                  ? "bg-olive-600 text-white"
                  : "text-wlx-stone hover:bg-wlx-cream"
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowHidden((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
              showHidden
                ? "border-olive-300 bg-olive-50 text-olive-700"
                : "border-wlx-mist bg-white text-wlx-stone hover:bg-wlx-cream"
            }`}
          >
            {showHidden ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
            {showHidden ? "Showing hidden" : "Show hidden"}
          </button>
          <button
            onClick={() => setIsBadgeModalOpen(true)}
            className="rounded-xl bg-olive-600 px-4 py-3 text-sm text-white font-semibold hover:bg-olive-700 transition-colors"
          >
            Manage Badges
          </button>
          <button
            onClick={() => exportProductsToCsv(localProducts)}
            className="rounded-xl bg-olive-600 px-4 py-3 text-sm text-white font-semibold hover:bg-olive-700 transition-colors"
          >
            Export CSV
          </button>
          <a
            href="/api/admin/products/csv-template"
            className="rounded-xl bg-olive-600 px-4 py-3 text-sm text-white font-semibold hover:bg-olive-700 transition-colors"
          >
            Download Template
          </a>
          <button
            onClick={() => setIsCsvOpen(true)}
            className="rounded-xl bg-olive-600 px-4 py-3 text-sm text-white font-semibold hover:bg-olive-700 transition-colors"
          >
            Import CSV
          </button>
          {showAddButton && (
            <button
              onClick={handleCreateProduct}
              className="rounded-xl bg-olive-600 px-4 py-3 text-sm text-white font-semibold hover:bg-olive-700 transition-colors whitespace-nowrap"
            >
              + Add Product
            </button>
          )}
        </div>
      </div>
      {selectedIds.size > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-wlx-mist bg-white px-4 py-3 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
          <span className="text-sm text-wlx-stone">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBatchHide}
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100 transition-colors"
          >
            Hide Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="rounded-xl border border-wlx-mist bg-white px-3 py-1.5 text-sm text-wlx-stone hover:bg-wlx-cream transition-colors"
          >
            Clear
          </button>
        </div>
      )}
      {/* ── Grid view ── */}
      {viewMode === "grid" && (
        <div className="mt-6">
          {paginatedProducts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-wlx-mist bg-white px-6 py-16 text-center text-wlx-stone">
              {searchQuery
                ? "No products match your search."
                : "No data available."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {paginatedProducts.map((product) => {
                const isOnSale =
                  product.originalPrice != null &&
                  product.originalPrice > product.price;
                const discountPercent = isOnSale
                  ? Math.round(
                      (1 - product.price / product.originalPrice!) * 100,
                    )
                  : 0;
                const promotionBadges = Array.isArray(product.promotionBadges)
                  ? product.promotionBadges
                  : [];
                const isNew = promotionBadges.includes("新品上架");

                return (
                  <div
                    key={product.id}
                    className={`group flex flex-col rounded-2xl border border-wlx-mist bg-white overflow-hidden ${
                      !product.active ? "opacity-50" : ""
                    } ${product.hidden ? "opacity-60" : ""}`}
                  >
                    {/* Image */}
                    <div className="relative aspect-square bg-wlx-cream overflow-hidden">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="50vw"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-zinc-300">
                          <Package size={32} />
                        </div>
                      )}

                      {/* Badges — 左上角垂直排列，discount 優先，NEW 次之 */}
                      {(isOnSale || isNew) && (
                        <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1">
                          {isOnSale && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white bg-red-500">
                              -{discountPercent}%
                            </span>
                          )}
                          {isNew && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white bg-green-500">
                              NEW
                            </span>
                          )}
                        </div>
                      )}

                      {/* Hidden overlay badge */}
                      {product.hidden && (
                        <span className="absolute bottom-2 left-2 rounded-full bg-zinc-700/80 px-2 py-0.5 text-[10px] font-medium text-white">
                          已隱藏
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex flex-col flex-1 p-2.5 gap-1">
                      {product.brand && (
                        <div className="text-[10px] font-medium text-wlx-stone truncate uppercase tracking-wide">
                          {product.brand}
                        </div>
                      )}
                      <div className="text-xs font-semibold text-wlx-ink line-clamp-2 leading-tight min-h-[2rem]">
                        {product.title}
                      </div>
                      <div className="flex items-center gap-1.5 mt-auto pt-1">
                        {isOnSale ? (
                          <>
                            <span className="text-[10px] text-wlx-stone line-through">
                              ${Math.round(product.originalPrice!)}
                            </span>
                            <span className="text-sm font-bold text-red-600">
                              ${Math.round(product.price)}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm font-bold text-wlx-ink">
                            ${Math.round(product.price)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 px-2.5 pb-2.5">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="flex-1 rounded-xl border border-wlx-mist bg-white px-2 py-1.5 text-xs font-semibold text-wlx-stone hover:bg-wlx-cream transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          handleToggleHidden(product.id, product.hidden)
                        }
                        disabled={togglingHidden === product.id}
                        className={`rounded-xl border p-1.5 disabled:opacity-50 transition-colors ${
                          product.hidden
                            ? "border-amber-200 bg-wlx-cream text-amber-600 hover:bg-wlx-cream"
                            : "border-wlx-mist bg-white text-wlx-stone hover:bg-wlx-cream hover:text-wlx-stone"
                        }`}
                        title={product.hidden ? "取消隱藏" : "隱藏產品"}
                      >
                        {product.hidden ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Grid pagination */}
          <div className="flex flex-col md:flex-row items-center justify-between mt-4 text-wlx-stone text-sm gap-3">
            <div>
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)}{" "}
              of {filteredProducts.length} products
              {searchQuery && " (filtered)"}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-wlx-mist text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-wlx-cream"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium ${
                        currentPage === pageNum
                          ? "bg-[#6B7A2F] text-white"
                          : "border border-wlx-mist hover:bg-wlx-cream"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <span className="px-1">...</span>
                )}
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-wlx-mist text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-wlx-cream"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── Table view ── */}
      {viewMode === "table" && (
        <div className="mt-6 overflow-hidden rounded-3xl border border-wlx-mist bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full text-sm">
              <thead>
                <tr className="text-wlx-stone border-b border-wlx-mist">
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={
                        paginatedProducts.length > 0 &&
                        selectedIds.size === paginatedProducts.length
                      }
                      onChange={toggleSelectAll}
                      className="h-5 w-5 rounded border-2 border-zinc-400 accent-olive-600 focus:ring-olive-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-2 py-1 text-left min-w-[220px]">Product</th>
                  <th className="px-2 py-1 text-left">Style</th>
                  <th className="px-2 py-1 text-left relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenFilter(
                          openFilter === "category" ? null : "category",
                        )
                      }
                      className="inline-flex items-center gap-1 hover:text-wlx-stone"
                    >
                      Category <span className="text-xs">▼</span>
                    </button>
                    {openFilter === "category" && (
                      <div className="absolute left-0 mt-2 w-48 rounded-lg border border-wlx-mist bg-white shadow-lg z-10">
                        {CATEGORY_OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setCategoryFilter(option);
                              setOpenFilter(null);
                              setCurrentPage(1);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-wlx-cream ${
                              categoryFilter === option
                                ? "text-olive-700 font-semibold"
                                : "text-wlx-stone"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </th>
                  <th className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("originalPrice")}
                      className="inline-flex items-center gap-1 hover:text-wlx-stone"
                    >
                      Orig. Price{" "}
                      <span className="text-xs">
                        {getSortIndicator("originalPrice")}
                      </span>
                    </button>
                  </th>
                  <th className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("price")}
                      className="inline-flex items-center gap-1 hover:text-wlx-stone ml-auto"
                    >
                      Net Price{" "}
                      <span className="text-xs">
                        {getSortIndicator("price")}
                      </span>
                    </button>
                  </th>
                  <th className="px-2 py-1 text-center">Discount</th>
                  <th className="px-2 py-1 text-right relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenFilter(openFilter === "stock" ? null : "stock")
                      }
                      className="inline-flex items-center gap-1 hover:text-wlx-stone"
                    >
                      Stock <span className="text-xs">▼</span>
                    </button>
                    {openFilter === "stock" && (
                      <div className="absolute left-0 mt-2 w-40 rounded-lg border border-wlx-mist bg-white shadow-lg z-10">
                        {STOCK_OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setStockFilter(option);
                              setOpenFilter(null);
                              setCurrentPage(1);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-wlx-cream ${
                              stockFilter === option
                                ? "text-olive-700 font-semibold"
                                : "text-wlx-stone"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </th>
                  <th className="px-2 py-1 text-left">Badges</th>
                  <th className="px-2 py-1 text-left relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenFilter(openFilter === "status" ? null : "status")
                      }
                      className="inline-flex items-center gap-1 hover:text-wlx-stone"
                    >
                      Status <span className="text-xs">▼</span>
                    </button>
                    {openFilter === "status" && (
                      <div className="absolute left-0 mt-2 w-36 rounded-lg border border-wlx-mist bg-white shadow-lg z-10">
                        {STATUS_OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setStatusFilter(option);
                              setOpenFilter(null);
                              setCurrentPage(1);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-wlx-cream ${
                              statusFilter === option
                                ? "text-olive-700 font-semibold"
                                : "text-wlx-stone"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </th>
                  <th className="px-2 py-1 text-left">Updated</th>
                </tr>
              </thead>

              <tbody>
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center text-wlx-stone"
                    >
                      {searchQuery
                        ? "No products match your search."
                        : "No data available."}
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product) => {
                    const isOnSale =
                      product.originalPrice != null &&
                      product.originalPrice > product.price;
                    const discountPercent = isOnSale
                      ? Math.round(
                          (1 - product.price / product.originalPrice!) * 100,
                        )
                      : 0;
                    const productBadges = Array.isArray(
                      (product as { badges?: string[] }).badges,
                    )
                      ? (product as { badges: string[] }).badges
                      : [];
                    const badgeDisplay = productBadges.map((badge) => {
                      const mapped = badgeMap.get(badge);
                      if (mapped) {
                        return {
                          key: mapped.id,
                          label: `${mapped.nameZh} / ${mapped.nameEn}`,
                          color: mapped.color,
                        };
                      }
                      return { key: badge, label: badge, color: null };
                    });
                    return (
                      <tr
                        key={product.id}
                        className={`border-t border-wlx-mist hover:bg-wlx-cream transition-colors ${!product.active ? "opacity-50" : ""} ${product.hidden ? "opacity-60" : ""}`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(product.id)}
                            onChange={() => toggleSelect(product.id)}
                            className="h-5 w-5 rounded border-2 border-zinc-400 accent-olive-600 focus:ring-olive-500 cursor-pointer"
                          />
                        </td>
                        {/* Product: thumbnail + title + brand */}
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-3">
                            {product.imageUrl ? (
                              <div className="relative h-[48px] w-[48px] flex-shrink-0 overflow-hidden rounded-lg border border-wlx-mist bg-wlx-cream">
                                <Image
                                  src={product.imageUrl}
                                  alt={product.title}
                                  fill
                                  className="object-cover"
                                  sizes="48px"
                                />
                                {isOnSale && (
                                  <span className="absolute top-0 right-0 rounded-bl bg-red-500 px-1 py-px text-[8px] font-bold text-white leading-tight">
                                    -{discountPercent}%
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="h-[48px] w-[48px] flex-shrink-0 rounded-lg border border-dashed border-wlx-mist bg-wlx-cream" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-wlx-ink truncate">
                                  {product.title}
                                </span>
                                {product.hidden && (
                                  <span className="shrink-0 rounded-full bg-wlx-mist px-1.5 py-0.5 text-[10px] font-medium text-wlx-stone">
                                    已隱藏
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-wlx-stone truncate">
                                {product.brand || "—"}
                              </div>
                            </div>
                          </div>
                        </td>
                        {/* Style */}
                        <td className="px-2 py-1 text-wlx-stone text-sm">
                          {product.sku || "—"}
                        </td>
                        {/* Category */}
                        <td className="px-2 py-1 text-wlx-stone text-sm">
                          {product.category || "—"}
                        </td>
                        {/* Orig. Price */}
                        <td className="px-2 py-1 text-right text-sm">
                          {product.originalPrice != null ? (
                            <span className="text-wlx-stone">
                              ${Math.round(product.originalPrice)}
                            </span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>
                        {/* Price (editable on click) */}
                        <td className="px-2 py-1 text-right">
                          {editingPriceId === product.id ? (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={editOriginalPrice}
                                  onChange={(e) =>
                                    setEditOriginalPrice(e.target.value)
                                  }
                                  className="w-20 rounded-lg border border-wlx-mist px-2 py-1 text-sm text-right text-wlx-stone focus:outline-none focus:ring-1 focus:ring-olive-500"
                                  placeholder="Orig."
                                />
                                <input
                                  type="number"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  className="w-20 rounded-lg border border-wlx-mist px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-olive-500"
                                  placeholder="Price"
                                  autoFocus
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => savePrice(product.id)}
                                  disabled={savingPrice}
                                  className="p-1 rounded-lg text-olive-600 hover:bg-olive-50 disabled:opacity-50"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={cancelEditingPrice}
                                  disabled={savingPrice}
                                  className="p-1 rounded-lg text-wlx-stone hover:bg-wlx-cream"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className="group cursor-pointer inline-flex items-center gap-1"
                              onClick={() => startEditingPrice(product)}
                            >
                              <span className="text-wlx-ink font-medium">
                                ${Math.round(product.price)}
                              </span>
                              <Pencil
                                size={12}
                                className="text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
                              />
                            </div>
                          )}
                        </td>
                        {/* Discount */}
                        <td className="px-2 py-1 text-center text-sm text-wlx-stone">
                          {isOnSale ? `-${discountPercent}%` : ""}
                        </td>
                        {/* Stock */}
                        <td className="px-2 py-1 text-right text-wlx-stone text-sm">
                          {product.stock ?? 0}
                        </td>
                        {/* Badges */}
                        <td className="px-2 py-1">
                          {badgeDisplay.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {badgeDisplay.map((badge) => (
                                <span
                                  key={badge.key}
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    badge.color
                                      ? "text-white"
                                      : getBadgeStyles(badge.label)
                                  }`}
                                  style={
                                    badge.color
                                      ? { backgroundColor: badge.color }
                                      : undefined
                                  }
                                >
                                  {badge.label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>
                        {/* Status */}
                        <td className="px-2 py-1">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${
                              product.active
                                ? "bg-olive-100 text-olive-700 border-olive-200"
                                : "bg-red-50 text-red-600 border-red-200"
                            }`}
                          >
                            {product.active ? "Active" : "Hidden"}
                          </span>
                        </td>
                        {/* Updated */}
                        <td className="px-2 py-1 text-wlx-stone text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <span>
                              {new Date(product.updatedAt)
                                .toISOString()
                                .slice(0, 10)}
                            </span>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() =>
                                  handleToggleHidden(product.id, product.hidden)
                                }
                                disabled={togglingHidden === product.id}
                                className={`rounded-lg border p-1.5 disabled:opacity-50 ${
                                  product.hidden
                                    ? "border-amber-200 bg-wlx-cream text-amber-600 hover:bg-wlx-cream"
                                    : "border-wlx-mist bg-white text-wlx-stone hover:bg-wlx-cream hover:text-wlx-stone"
                                }`}
                                title={product.hidden ? "取消隱藏" : "隱藏產品"}
                              >
                                {product.hidden ? (
                                  <EyeOff size={14} />
                                ) : (
                                  <Eye size={14} />
                                )}
                              </button>
                              {!product.active && (
                                <button
                                  onClick={() =>
                                    handleToggleActive(product.id, true)
                                  }
                                  disabled={togglingActive === product.id}
                                  className="rounded-lg border border-olive-200 bg-olive-50 px-2.5 py-1.5 text-xs text-olive-700 hover:bg-olive-100 disabled:opacity-50"
                                >
                                  {togglingActive === product.id
                                    ? "..."
                                    : "Show"}
                                </button>
                              )}
                              <button
                                onClick={() => handleEditProduct(product)}
                                className="rounded-lg border border-wlx-mist bg-white px-2.5 py-1.5 text-xs text-wlx-stone hover:bg-wlx-cream transition-colors"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between border-t border-wlx-mist px-4 py-3 text-wlx-stone text-sm gap-3">
            <div>
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)}{" "}
              of {filteredProducts.length} products
              {searchQuery && " (filtered)"}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-wlx-mist text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-wlx-cream"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium ${
                        currentPage === pageNum
                          ? "bg-[#6B7A2F] text-white"
                          : "border border-wlx-mist hover:bg-wlx-cream"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <span className="px-1">...</span>
                )}
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-wlx-mist text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-wlx-cream"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}{" "}
      {/* end viewMode === "table" */}
      {isBadgeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsBadgeModalOpen(false);
            }
          }}
        >
          <div className="w-full max-w-4xl rounded-3xl border border-wlx-mist bg-white p-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-200 ease-out motion-reduce:animate-none">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-wlx-ink">
                  Manage Badges
                </h2>
                <p className="mt-1 text-sm text-wlx-stone">
                  Create, edit, and organize product badges.
                </p>
              </div>
              <button
                onClick={() => setIsBadgeModalOpen(false)}
                className="text-wlx-stone hover:text-wlx-ink transition-colors"
              >
                ✕
              </button>
            </div>

            {badgeError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {badgeError}
              </div>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-wlx-mist bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-wlx-ink">
                    Badge List
                  </h3>
                  <button
                    onClick={loadBadges}
                    disabled={badgeLoading}
                    className="text-xs text-wlx-stone hover:text-wlx-ink transition-colors disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>
                {badgeLoading ? (
                  <div className="py-8 text-center text-sm text-wlx-stone">
                    Loading badges...
                  </div>
                ) : badges.length === 0 ? (
                  <div className="py-8 text-center text-sm text-wlx-stone">
                    No badges yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {badges.map((badge) => (
                      <div
                        key={badge.id}
                        className="flex items-center justify-between rounded-xl border border-wlx-mist bg-wlx-cream px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: badge.color }}
                          />
                          <div>
                            <div className="text-sm font-medium text-wlx-ink">
                              {badge.nameZh} / {badge.nameEn}
                            </div>
                            <div className="text-xs text-wlx-stone">
                              {badge.color}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditBadge(badge)}
                            className="rounded-lg border border-wlx-mist bg-white px-2 py-1 text-xs text-wlx-stone hover:bg-wlx-cream transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteBadge(badge)}
                            className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-wlx-mist bg-white p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-wlx-ink">
                    {editingBadgeId ? "Edit Badge" : "Add Badge"}
                  </h3>
                  {editingBadgeId && (
                    <button
                      onClick={resetBadgeForm}
                      className="text-xs text-wlx-stone hover:text-wlx-ink transition-colors"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                {badgeFormError && (
                  <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                    {badgeFormError}
                  </div>
                )}

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-wlx-stone mb-2">
                      Name (Chinese)
                    </label>
                    <input
                      value={badgeNameZh}
                      onChange={(e) => setBadgeNameZh(e.target.value)}
                      className="w-full rounded-2xl border border-wlx-mist bg-white px-4 py-3 text-sm text-wlx-ink placeholder:text-wlx-stone focus:outline-none focus:ring-2 focus:ring-zinc-300"
                      placeholder="店長推介"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-wlx-stone mb-2">
                      Name (English)
                    </label>
                    <input
                      value={badgeNameEn}
                      onChange={(e) => setBadgeNameEn(e.target.value)}
                      className="w-full rounded-2xl border border-wlx-mist bg-white px-4 py-3 text-sm text-wlx-ink placeholder:text-wlx-stone focus:outline-none focus:ring-2 focus:ring-zinc-300"
                      placeholder="Staff Pick"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-wlx-stone mb-2">
                      Color Presets
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {BADGE_PRESETS.map((preset) => {
                        const isSelected =
                          badgeColor.toUpperCase() ===
                          preset.color.toUpperCase();
                        return (
                          <button
                            key={preset.key}
                            type="button"
                            onClick={() => setBadgeColor(preset.color)}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                              isSelected
                                ? "border-olive-500 bg-olive-50 text-olive-700"
                                : "border-wlx-mist bg-white text-wlx-stone"
                            }`}
                          >
                            <span
                              className="h-4 w-4 rounded-full"
                              style={{ backgroundColor: preset.color }}
                            />
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-wlx-stone mb-2">
                      Custom Hex
                    </label>
                    <input
                      value={badgeColor}
                      onChange={(e) => setBadgeColor(e.target.value)}
                      className="w-full rounded-2xl border border-wlx-mist bg-white px-4 py-3 text-sm text-wlx-ink placeholder:text-wlx-stone focus:outline-none focus:ring-2 focus:ring-zinc-300"
                      placeholder="#EF4444"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-wlx-stone mb-2">
                      Live Preview
                    </label>
                    <div className="h-20 w-20 rounded-xl bg-wlx-mist relative overflow-hidden">
                      <span
                        className="absolute top-1 left-1 px-2 py-0.5 text-[10px] font-semibold text-white rounded"
                        style={{ backgroundColor: badgeColor || "#6B7A2F" }}
                      >
                        {(badgeNameZh || badgeNameEn || "Badge").slice(0, 6)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleSaveBadge}
                      disabled={badgeSaving}
                      className="rounded-xl bg-olive-600 px-4 py-2 text-sm text-white font-semibold hover:bg-olive-700 transition-colors disabled:opacity-50"
                    >
                      {editingBadgeId ? "Save Changes" : "Add Badge"}
                    </button>
                    <button
                      onClick={resetBadgeForm}
                      type="button"
                      className="rounded-xl border border-wlx-mist bg-white px-4 py-2 text-sm text-wlx-stone hover:bg-wlx-cream transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {(selectedProduct || isCreating) && (
        <ProductModal
          product={selectedProduct}
          onClose={handleCloseModal}
          locale={locale}
        />
      )}
      {isCsvOpen && (
        <CsvUpload
          open={isCsvOpen}
          onClose={() => setIsCsvOpen(false)}
          onImported={() => refreshProducts()}
        />
      )}
    </>
  );
}
