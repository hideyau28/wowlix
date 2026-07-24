"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Plus, Eye, Copy, Check, Star, Edit, GripVertical, Loader2, ChevronRight, X } from "lucide-react";
import { compressImage, isAcceptedImageType } from "@/lib/compress-image";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ProductEditSheet from "./ProductEditSheet";
import { getCoverTemplate } from "@/lib/cover-templates";
import { storeShareUrl } from "@/lib/site-url";

type Product = {
  id: string;
  title: string;
  price: number;
  originalPrice: number | null;
  imageUrl: string | null;
  images: string[];
  videoUrl?: string | null;
  sizes: Record<string, unknown> | null;
  sizeSystem: string | null;
  hidden?: boolean;
  featured?: boolean;
  sortOrder?: number;
  createdAt?: string;
};

type Tenant = {
  name: string;
  slug: string;
  coverPhoto: string | null;
  coverTemplate: string | null;
  logoUrl: string | null;
  brandColor: string | null;
};

type Props = {
  locale: string;
  tenant: Tenant;
  products: Product[];
  pendingOrders: number;
};

type QuickSort = "manual" | "newest" | "price-asc" | "price-desc";

// --- Sortable product card ---
function SortableProductCard({
  product,
  isEditMode,
  isSelected,
  onToggleSelect,
  onTap,
}: {
  product: Product;
  isEditMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onTap: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto" as const,
  };

  const isOnSale = product.originalPrice != null && product.originalPrice > product.price;
  const discountPct = isOnSale
    ? Math.round((1 - product.price / product.originalPrice!) * 100)
    : 0;
  const isNewProduct = product.createdAt
    ? Date.now() - new Date(product.createdAt).getTime() < 48 * 60 * 60 * 1000
    : false;

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative">
      <div
        onClick={() => {
          if (isEditMode) return;
          onTap();
        }}
        className={`rounded-xl overflow-hidden border ${
          isSelected ? "border-wlx-ink ring-2 ring-wlx-ink/20" : "border-wlx-mist"
        } bg-white ${product.hidden ? "opacity-50" : ""} ${isEditMode ? "" : "cursor-pointer"}`}
      >
        {/* Image — 1:1 aspect ratio to match storefront */}
        <div className="relative aspect-square w-full bg-wlx-cream">
          {product.imageUrl || product.images?.[0] ? (
            <Image
              src={product.imageUrl || product.images[0]}
              alt={product.title}
              fill
              className="object-cover"
              sizes="(max-width: 480px) 50vw, 240px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-300">
              <Camera size={24} />
            </div>
          )}

          {/* Drag handle — edit mode only */}
          {isEditMode && (
            <button
              ref={setActivatorNodeRef}
              {...listeners}
              aria-label={`拖動 ${product.title}`}
              className="absolute top-1.5 left-1.5 w-7 h-7 bg-white/90 rounded-lg flex items-center justify-center shadow-sm touch-none cursor-grab active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={14} className="text-wlx-stone" />
            </button>
          )}

          {/* Hidden badge */}
          {product.hidden && !isEditMode && (
            <div className="absolute top-1.5 left-1.5 bg-wlx-ink/80 text-white text-xs px-2 py-0.5 rounded-full">
              已隱藏
            </div>
          )}

          {/* Badges — top-left 垂直排列：discount → NEW → 精選，同 storefront 一致 */}
          {!product.hidden && !isEditMode && (isOnSale || isNewProduct || product.featured) && (
            <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1">
              {isOnSale && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white bg-red-500">
                  -{discountPct}%
                </span>
              )}
              {isNewProduct && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-green-500 text-white">
                  NEW
                </span>
              )}
              {product.featured && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-wlx-cream0 text-white flex items-center gap-0.5">
                  <Star size={8} fill="white" />
                  精選
                </span>
              )}
            </div>
          )}
        </div>

        {/* Info — p-3 padding matches BioProductCard */}
        <div className="p-3">
          <p className="text-sm font-semibold leading-snug text-wlx-ink mb-1 truncate">{product.title}</p>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base text-wlx-ink">${product.price}</span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-xs text-wlx-stone line-through">${product.originalPrice}</span>
            )}
          </div>
        </div>
      </div>

      {/* Checkbox — edit mode only */}
      {isEditMode && (
        <div className="flex justify-center mt-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            aria-label={isSelected ? `取消選擇 ${product.title}` : `選擇 ${product.title}`}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isSelected
                ? "bg-wlx-ink border-wlx-ink text-white"
                : "border-wlx-mist bg-white hover:border-zinc-400"
            }`}
            style={{ touchAction: 'auto' }}
          >
            {isSelected && <Check size={12} strokeWidth={3} />}
          </button>
        </div>
      )}
    </div>
  );
}

export default function BioLinkDashboard({ locale, tenant, products: initialProducts, pendingOrders }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quickSort, setQuickSort] = useState<QuickSort>("manual");
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);

  const [bannerUrl, setBannerUrl] = useState(tenant.coverPhoto);
  const [avatarUrl, setAvatarUrl] = useState(tenant.logoUrl);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isZh = locale === "zh-HK";
  // 顯示用短版（畫面窄，apex 撳得到）；複製出去用 storeShareUrl —— 商戶
  // 貼落 IG bio 嗰條唔應該經 apex 307。
  const storeUrlLabel = `wowlix.com/${tenant.slug}`;
  const brandColor = tenant.brandColor || "#1A1A1A";
  const tmpl = getCoverTemplate(tenant.coverTemplate);
  // Admin header banner：自訂 cover → template default banner
  const headerBanner = bannerUrl || tmpl.defaultBanner;

  // 上傳圖片 → save to tenant-settings
  const handleInlineUpload = async (
    file: File,
    field: "coverPhoto" | "logo",
    setUploading: (v: boolean) => void,
    setUrl: (url: string) => void,
  ) => {
    if (!isAcceptedImageType(file) || file.size > 10 * 1024 * 1024) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("file", compressed);
      const uploadRes = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.ok) throw new Error("Upload failed");
      const url: string = uploadData.data.url;

      // Persist to tenant settings
      await fetch("/api/admin/tenant-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [field]: url }),
      });

      setUrl(url);
    } catch (err) {
      console.error(`[BioLinkDashboard] ${field} upload failed:`, err);
    } finally {
      setUploading(false);
    }
  };

  // dnd-kit sensors — activationConstraint prevents accidental drags
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 150, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(storeShareUrl(tenant.slug));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  };

  const handlePreview = () => {
    window.open(`/${locale}/${tenant.slug}`, "_blank");
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsNewProduct(false);
    setIsSheetOpen(true);
  };

  const handleNewProduct = () => {
    setEditingProduct(null);
    setIsNewProduct(true);
    setIsSheetOpen(true);
  };

  const handleSheetClose = () => {
    setIsSheetOpen(false);
    setEditingProduct(null);
    setIsNewProduct(false);
  };

  const handleSheetSave = () => {
    handleSheetClose();
    router.refresh();
  };

  const enterEditMode = () => {
    setIsEditMode(true);
    setSelectedIds(new Set());
    setQuickSort("manual");
    setConfirmBatchDelete(false);
  };

  const exitEditMode = () => {
    setIsEditMode(false);
    setSelectedIds(new Set());
    setConfirmBatchDelete(false);
  };

  // --- Selection ---
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmBatchDelete(false);
  }, []);

  // --- Drag end → reorder + save ---
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = products.findIndex((p) => p.id === active.id);
    const newIndex = products.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...products];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    setProducts(reordered);
    setQuickSort("manual");

    await fetch("/api/admin/products/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productIds: reordered.map((p) => p.id) }),
    });
  };

  // --- Quick sort ---
  const applyQuickSort = async (mode: QuickSort) => {
    setQuickSort(mode);
    let sorted: Product[];
    switch (mode) {
      case "newest":
        sorted = [...products].sort((a, b) => {
          const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return db - da;
        });
        break;
      case "price-asc":
        sorted = [...products].sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        sorted = [...products].sort((a, b) => b.price - a.price);
        break;
      default:
        return; // manual — no-op
    }
    setProducts(sorted);

    // Persist new order
    await fetch("/api/admin/products/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productIds: sorted.map((p) => p.id) }),
    });
  };

  // --- Batch actions ---
  const handleBatchHide = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    // Optimistic update — toggle: if all selected are hidden → show, else hide
    const allHidden = ids.every((id) => products.find((p) => p.id === id)?.hidden);
    const newHidden = !allHidden;

    setProducts((prev) =>
      prev.map((p) => (selectedIds.has(p.id) ? { ...p, hidden: newHidden } : p))
    );
    setSelectedIds(new Set());

    await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/products/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ hidden: newHidden }),
        })
      )
    );
  };

  const handleBatchDelete = async () => {
    if (!confirmBatchDelete) {
      setConfirmBatchDelete(true);
      return;
    }

    const ids = Array.from(selectedIds);
    setProducts((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
    setConfirmBatchDelete(false);

    await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/products/${id}`, { method: "DELETE" })
      )
    );
  };

  const isEmpty = products.length === 0;
  const selectedCount = selectedIds.size;

  const quickSortButtons: { key: QuickSort; label: string }[] = [
    { key: "manual", label: isZh ? "手動" : "Manual" },
    { key: "newest", label: isZh ? "最新" : "Newest" },
    { key: "price-asc", label: isZh ? "平→貴" : "Low→High" },
    { key: "price-desc", label: isZh ? "貴→平" : "High→Low" },
  ];

  return (
    <div className={`px-4 ${isEditMode && selectedCount > 0 ? "pb-[70px]" : "pb-4"}`}>
      {/* Hidden file inputs for banner / avatar upload */}
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleInlineUpload(f, "coverPhoto", setUploadingBanner, setBannerUrl);
          e.target.value = "";
        }}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleInlineUpload(f, "logo", setUploadingAvatar, setAvatarUrl);
          e.target.value = "";
        }}
      />

      {/* Cover / Header */}
      <div className="relative rounded-2xl overflow-hidden mb-6 -mx-4 -mt-0">
        <Image
          src={headerBanner}
          alt="Store banner"
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 480px"
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative px-6 py-8 text-center text-white z-[2]">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3 text-2xl font-bold overflow-hidden relative">
            {uploadingAvatar ? (
              <Loader2 size={24} className="text-white animate-spin" />
            ) : avatarUrl ? (
              <Image src={avatarUrl} alt={tenant.name} fill className="object-cover" sizes="64px" />
            ) : (
              tenant.name.charAt(0).toUpperCase()
            )}
          </div>
          <h2 className="text-xl font-bold">{tenant.name}</h2>
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 mt-2 text-sm text-white/80 hover:text-white transition-colors"
          >
            <span>{storeUrlLabel}</span>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>

          {!isEmpty && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={handlePreview}
                className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors"
              >
                <Eye size={14} />
                {isZh ? "預覽" : "Preview"}
              </button>

              <button
                onClick={() => setEditMenuOpen(true)}
                className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors"
              >
                <Edit size={14} />
                {isZh ? "編輯" : "Edit"}
              </button>

              <button
                onClick={handleNewProduct}
                className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors"
              >
                <Plus size={14} />
                {isZh ? "新增商品" : "Add"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit bottom sheet */}
      {editMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          onClick={() => setEditMenuOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-white rounded-t-2xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <span className="text-base font-semibold text-wlx-ink">
                {isZh ? "編輯" : "Edit"}
              </span>
              <button
                onClick={() => setEditMenuOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-wlx-cream text-wlx-stone hover:bg-wlx-mist transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="divide-y divide-zinc-100 pb-6">
              <button
                onClick={() => { setEditMenuOpen(false); avatarInputRef.current?.click(); }}
                className="flex items-center justify-between w-full px-5 py-4 text-left text-wlx-ink hover:bg-wlx-cream transition-colors min-h-[56px]"
              >
                <span className="text-sm font-medium">{isZh ? "編輯頭像" : "Edit Avatar"}</span>
                <ChevronRight size={16} className="text-wlx-stone" />
              </button>
              <button
                onClick={() => { setEditMenuOpen(false); bannerInputRef.current?.click(); }}
                className="flex items-center justify-between w-full px-5 py-4 text-left text-wlx-ink hover:bg-wlx-cream transition-colors min-h-[56px]"
              >
                <span className="text-sm font-medium">{isZh ? "編輯 Banner" : "Edit Banner"}</span>
                {uploadingBanner ? (
                  <Loader2 size={16} className="text-wlx-stone animate-spin" />
                ) : (
                  <ChevronRight size={16} className="text-wlx-stone" />
                )}
              </button>
              <button
                onClick={() => { setEditMenuOpen(false); setIsEditMode(true); }}
                className="flex items-center justify-between w-full px-5 py-4 text-left text-wlx-ink hover:bg-wlx-cream transition-colors min-h-[56px]"
              >
                <span className="text-sm font-medium">{isZh ? "編輯商品" : "Edit Products"}</span>
                <ChevronRight size={16} className="text-wlx-stone" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick sort bar — edit mode only */}
      {isEditMode && !isEmpty && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {quickSortButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => applyQuickSort(btn.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                quickSort === btn.key
                  ? "bg-wlx-ink text-white"
                  : "bg-wlx-cream text-wlx-stone hover:bg-wlx-mist"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <button
          onClick={handleNewProduct}
          className="w-full border-2 border-dashed border-wlx-mist rounded-2xl p-8 text-center hover:border-wlx-ink hover:bg-wlx-cream transition-colors group"
        >
          <div className="w-16 h-16 rounded-full bg-wlx-cream group-hover:bg-wlx-ink/10 flex items-center justify-center mx-auto mb-4 transition-colors">
            <Camera size={28} className="text-wlx-stone group-hover:text-wlx-ink transition-colors" />
          </div>
          <p className="text-lg font-semibold text-wlx-stone group-hover:text-wlx-ink transition-colors">
            {isZh ? "加你第一件商品" : "Add your first product"}
          </p>
          <p className="text-sm text-wlx-stone mt-1">
            {isZh ? "影相或上傳就搞掂" : "Take a photo or upload an image"}
          </p>
        </button>
      )}

      {/* Product grid */}
      {!isEmpty && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={products.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3">
              {products.map((product) => (
                <SortableProductCard
                  key={product.id}
                  product={product}
                  isEditMode={isEditMode}
                  isSelected={selectedIds.has(product.id)}
                  onToggleSelect={() => toggleSelect(product.id)}
                  onTap={() => handleEditProduct(product)}
                />
              ))}

            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Bottom action bar — visible when items selected */}
      {isEditMode && selectedCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-wlx-mist shadow-lg px-4 py-3 flex items-center gap-3 safe-area-pb">
          <span className="text-sm font-medium text-wlx-stone mr-auto">
            {isZh ? `已選 ${selectedCount} 件` : `${selectedCount} selected`}
          </span>
          <button
            onClick={handleBatchHide}
            className="px-4 py-2 rounded-lg bg-wlx-cream text-sm font-medium text-wlx-stone hover:bg-wlx-mist transition-colors"
          >
            {isZh ? "隱藏" : "Hide"}
          </button>
          <button
            onClick={handleBatchDelete}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              confirmBatchDelete
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-red-50 text-red-700 hover:bg-red-100"
            }`}
          >
            {confirmBatchDelete
              ? (isZh ? "確定刪除？" : "Confirm?")
              : (isZh ? "刪除" : "Delete")}
          </button>
          <button
            onClick={() => { setSelectedIds(new Set()); setConfirmBatchDelete(false); }}
            className="px-4 py-2 rounded-lg bg-wlx-cream text-sm font-medium text-wlx-stone hover:bg-wlx-mist transition-colors"
          >
            {isZh ? "取消" : "Cancel"}
          </button>
        </div>
      )}

      {/* Product Edit Sheet */}
      <ProductEditSheet
        isOpen={isSheetOpen}
        onClose={handleSheetClose}
        onSave={handleSheetSave}
        product={editingProduct}
        isNew={isNewProduct}
        locale={locale}
      />
    </div>
  );
}
