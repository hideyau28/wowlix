"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Pencil,
  X,
  Image as ImageIcon,
  LayoutGrid,
  ImageIcon as BannerIcon,
  Search,
} from "lucide-react";

type Section = {
  id: string;
  title: string;
  type: string;
  cardSize: string;
  sortOrder: number;
  active: boolean;
  productIds: string[];
  filterType: string | null;
  filterValue: string | null;
};

type BannerSlide = {
  imageUrl: string;
  linkUrl?: string;
  title?: string;
  subtitle?: string;
};

type Banner = {
  id: string;
  imageUrl: string; // fallback for backward compatibility
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
  images?: BannerSlide[]; // new: array of slides for carousel
  sortOrder: number;
  active: boolean;
  position: string;
};

type Product = {
  id: string;
  title: string;
  imageUrl: string | null;
  category: string | null;
  shoeType: string | null;
  sku: string | null;
};

type HomepageItem =
  | { type: "section"; data: Section }
  | { type: "banner"; data: Banner };

type Props = {
  initialSections: Section[];
  initialBanners: Banner[];
  products: Product[];
  locale: string;
};

export default function HomepageCMS({
  initialSections,
  initialBanners,
  products,
}: Props) {
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [banners, setBanners] = useState(initialBanners);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [isCreatingSection, setIsCreatingSection] = useState(false);
  const [isCreatingBanner, setIsCreatingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Haptic feedback helper
  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  // Sensors for drag-and-drop (ONLY active in edit mode)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Desktop: click and drag with 5px movement
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300, // Mobile: long-press 300ms (shorter since already in edit mode)
        tolerance: 5,
      },
    })
  );

  // Combine sections and banners into unified list sorted by sortOrder
  const unifiedList = useMemo(() => {
    const items: HomepageItem[] = [
      ...sections.map((s) => ({ type: "section" as const, data: s })),
      ...banners.map((b) => ({ type: "banner" as const, data: b })),
    ];
    return items.sort((a, b) => a.data.sortOrder - b.data.sortOrder);
  }, [sections, banners]);

  // Normalize sortOrder on mount (fix gaps and duplicates)
  useEffect(() => {
    const normalizeSortOrder = async () => {
      const items = [...unifiedList];
      let needsUpdate = false;

      // Check if sortOrders are sequential (1, 2, 3, ...)
      items.forEach((item, index) => {
        const expectedOrder = index + 1;
        if (item.data.sortOrder !== expectedOrder) {
          needsUpdate = true;
        }
      });

      if (!needsUpdate) return;

      // Re-assign sequential sortOrder
      const updates: Promise<Response>[] = [];
      items.forEach((item, index) => {
        const newOrder = index + 1;
        if (item.type === "section") {
          setSections((prev) =>
            prev.map((s) =>
              s.id === item.data.id ? { ...s, sortOrder: newOrder } : s
            )
          );
          updates.push(
            fetch(`/api/homepage/sections/${item.data.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sortOrder: newOrder }),
            })
          );
        } else {
          setBanners((prev) =>
            prev.map((b) =>
              b.id === item.data.id ? { ...b, sortOrder: newOrder } : b
            )
          );
          updates.push(
            fetch(`/api/homepage/banners/${item.data.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sortOrder: newOrder }),
            })
          );
        }
      });

      await Promise.all(updates);
    };

    normalizeSortOrder();
  }, []); // Only run once on mount

  // Get next available sortOrder
  const getNextSortOrder = () => {
    const maxSection = Math.max(0, ...sections.map((s) => s.sortOrder));
    const maxBanner = Math.max(0, ...banners.map((b) => b.sortOrder));
    return Math.max(maxSection, maxBanner) + 1;
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    vibrate(50);
  };

  // SECTION CRUD
  const saveSection = async (section: Partial<Section>, isNew: boolean) => {
    setSaving(true);
    try {
      const url = isNew
        ? "/api/homepage/sections"
        : `/api/homepage/sections/${section.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(section),
      });
      if (!res.ok) throw new Error("Failed to save section");
      router.refresh();
      setEditingSection(null);
      setIsCreatingSection(false);
      const sectionsRes = await fetch("/api/homepage/sections");
      const sectionsData = await sectionsRes.json();
      if (sectionsData.ok) setSections(sectionsData.data.sections);
    } catch {
      alert("儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const deleteSection = async (id: string, title: string) => {
    if (!confirm(`確定刪除「${title || "未命名 Section"}」？`)) return;
    vibrate(100);
    try {
      const res = await fetch(`/api/homepage/sections/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setSections((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert("刪除失敗");
    }
  };

  const toggleSectionActive = async (section: Section) => {
    const newActive = !section.active;
    setSections((prev) =>
      prev.map((s) => (s.id === section.id ? { ...s, active: newActive } : s))
    );
    await fetch(`/api/homepage/sections/${section.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: newActive }),
    });
  };

  // BANNER CRUD
  const saveBanner = async (banner: Partial<Banner>, isNew: boolean) => {
    setSaving(true);
    try {
      const url = isNew
        ? "/api/homepage/banners"
        : `/api/homepage/banners/${banner.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(banner),
      });
      if (!res.ok) throw new Error("Failed to save banner");
      router.refresh();
      setEditingBanner(null);
      setIsCreatingBanner(false);
      const bannersRes = await fetch("/api/homepage/banners");
      const bannersData = await bannersRes.json();
      if (bannersData.ok) setBanners(bannersData.data.banners);
    } catch {
      alert("儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const deleteBanner = async (id: string, title: string) => {
    if (!confirm(`確定刪除「${title || "未命名 Banner"}」？`)) return;
    vibrate(100);
    try {
      const res = await fetch(`/api/homepage/banners/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setBanners((prev) => prev.filter((b) => b.id !== id));
    } catch {
      alert("刪除失敗");
    }
  };

  const toggleBannerActive = async (banner: Banner) => {
    const newActive = !banner.active;
    setBanners((prev) =>
      prev.map((b) => (b.id === banner.id ? { ...b, active: newActive } : b))
    );
    await fetch(`/api/homepage/banners/${banner.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: newActive }),
    });
  };

  // Handle drag and drop (ONLY in edit mode)
  const handleDragStart = () => {
    vibrate(30);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    vibrate([30, 50, 30]);

    const oldIndex = unifiedList.findIndex((item) => `${item.type}-${item.data.id}` === active.id);
    const newIndex = unifiedList.findIndex((item) => `${item.type}-${item.data.id}` === over.id);

    const reorderedList = arrayMove(unifiedList, oldIndex, newIndex);

    // Update sortOrder for all affected items
    const updates: Promise<Response>[] = [];
    reorderedList.forEach((item, index) => {
      const newOrder = index + 1;
      if (item.type === "section") {
        setSections((prev) =>
          prev.map((s) =>
            s.id === item.data.id ? { ...s, sortOrder: newOrder } : s
          )
        );
        updates.push(
          fetch(`/api/homepage/sections/${item.data.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: newOrder }),
          })
        );
      } else {
        setBanners((prev) =>
          prev.map((b) =>
            b.id === item.data.id ? { ...b, sortOrder: newOrder } : b
          )
        );
        updates.push(
          fetch(`/api/homepage/banners/${item.data.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: newOrder }),
          })
        );
      }
    });

    await Promise.all(updates);
  };

  const getSectionProductInfo = (section: Section) => {
    if (section.productIds && section.productIds.length > 0) {
      return `${section.productIds.length} products`;
    }
    if (section.filterType) {
      return section.filterValue || section.filterType;
    }
    return "0 products";
  };

  const getBannerInfo = (banner: Banner) => {
    const slides = banner.images || [
      {
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl || undefined,
        title: banner.title || undefined,
        subtitle: banner.subtitle || undefined,
      },
    ];
    return {
      slides,
      count: slides.length,
      title: banner.title || slides[0]?.title || "未命名 Banner",
    };
  };

  // Sortable item component
  const SortableItem = ({ item, index }: { item: HomepageItem; index: number }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: `${item.type}-${item.data.id}`, disabled: !isEditMode });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      touchAction: isEditMode ? ("none" as const) : ("auto" as const), userSelect: isEditMode ? ("none" as const) : ("auto" as const),
    };

    const bannerInfo = item.type === "banner" ? getBannerInfo(item.data as Banner) : null;
    const itemTitle = item.type === "section"
      ? (item.data as Section).title || "未命名 Section"
      : bannerInfo!.title;

    // Color coding: green for Section, purple for Banner
    const borderColor = item.type === "section" ? "border-green-400" : "border-purple-400";
    const rowBg = item.type === "section" ? "bg-white" : "bg-purple-50";
    const rowHover = item.type === "section" ? "hover:bg-wlx-cream" : "hover:bg-purple-100";
    const badgeBg = item.type === "section" ? "bg-[#6B7A2F]/10" : "bg-purple-100";
    const badgeText = item.type === "section" ? "text-[#6B7A2F]" : "text-purple-700";

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`
          border-l-4 ${borderColor} border-b border-wlx-mist last:border-b-0
          ${rowBg}
          ${!isEditMode ? rowHover : ""}
          ${isDragging ? "shadow-lg scale-105 z-10 rounded-xl !border-l-4" : ""}
        `}
      >
        <div
          className={`
            flex items-center gap-2 md:gap-3 p-3 md:p-4 min-h-[44px]
            
          `}
        >
          {/* Edit mode: Drag handle on left */}
          {isEditMode && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing flex-shrink-0"
            >
              <GripVertical size={20} className="text-wlx-stone" />
            </div>
          )}

          {/* Normal mode: Type badge */}
          {!isEditMode && (
            <div className={`flex items-center gap-1.5 px-2 py-1 ${badgeBg} ${badgeText} rounded text-xs font-medium flex-shrink-0`}>
              {item.type === "section" ? (
                <>
                  <LayoutGrid size={14} />
                  <span className="hidden md:inline">Section</span>
                </>
              ) : (
                <>
                  <BannerIcon size={14} />
                  <span className="hidden md:inline">Banner</span>
                </>
              )}
            </div>
          )}

          {/* Title + subtitle */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-wlx-ink truncate">
              {itemTitle}
            </div>
            <div className="text-xs text-wlx-stone">
              {item.type === "section" ? (
                <>
                  {(item.data as Section).cardSize === "large" ? "大卡" : "細卡"} ·{" "}
                  {(item.data as Section).filterType === "featured"
                    ? "featured: true"
                    : (item.data as Section).filterType
                      ? `${(item.data as Section).filterType}: ${(item.data as Section).filterValue || "all"}`
                      : getSectionProductInfo(item.data as Section)}
                </>
              ) : (
                `${bannerInfo!.count} 張圖片`
              )}
            </div>
          </div>

          {/* Normal mode: 啟用 + ✏️ */}
          {!isEditMode && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() =>
                  item.type === "section"
                    ? toggleSectionActive(item.data as Section)
                    : toggleBannerActive(item.data as Banner)
                }
                className={`px-2 py-1 rounded text-xs font-medium ${
                  item.data.active
                    ? "bg-green-100 text-green-700"
                    : "bg-wlx-cream text-wlx-stone"
                }`}
              >
                {item.data.active ? "啟用" : "停用"}
              </button>

              <button
                onClick={() => {
                  if (item.type === "section") {
                    setEditingSection(item.data as Section);
                    setIsCreatingSection(false);
                  } else {
                    setEditingBanner(item.data as Banner);
                    setIsCreatingBanner(false);
                  }
                }}
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-wlx-stone hover:text-wlx-stone rounded"
                title="編輯"
              >
                <Pencil size={16} className="md:hidden" />
                <Pencil size={18} className="hidden md:block" />
              </button>
            </div>
          )}

          {/* Edit mode: ✕ delete button */}
          {isEditMode && (
            <button
              onClick={() =>
                item.type === "section"
                  ? deleteSection(item.data.id, (item.data as Section).title)
                  : deleteBanner(item.data.id, bannerInfo!.title)
              }
              className="w-6 h-6 flex items-center justify-center text-white bg-red-500 hover:bg-red-600 rounded-full flex-shrink-0"
              title="刪除"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Wiggle animation CSS */}
      <style jsx global>{`
        /* wiggle removed */
        @keyframes wiggle-disabled {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(-1deg); }
          50% { transform: rotate(0deg); }
          75% { transform: rotate(1deg); }
          100% { transform: rotate(0deg); }
        }

        .wiggle-disabled {
          /* animation removed */
        }
      `}</style>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => {
            setIsCreatingSection(true);
            setEditingSection({
              id: "",
              title: "",
              type: "product_grid",
              cardSize: "small",
              sortOrder: getNextSortOrder(),
              active: true,
              productIds: [],
              filterType: "category",
              filterValue: "",
            });
          }}
          className="flex items-center gap-1 px-4 py-2 bg-olive-600 text-white rounded-xl text-sm hover:bg-olive-700"
        >
          <Plus size={16} /> 新增 Section
        </button>
        <button
          onClick={() => {
            setIsCreatingBanner(true);
            setEditingBanner({
              id: "",
              imageUrl: "",
              title: "",
              subtitle: "",
              linkUrl: "",
              sortOrder: getNextSortOrder(),
              active: true,
              position: "hero",
            });
          }}
          className="flex items-center gap-1 px-4 py-2 bg-zinc-800 text-white rounded-xl text-sm hover:bg-wlx-ink"
        >
          <Plus size={16} /> 新增 Banner
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-wlx-mist overflow-hidden">
        <div className="p-4 border-b border-wlx-mist flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-wlx-ink">首頁內容排序</h2>
            <p className="text-sm text-wlx-stone mt-1">
              {isEditMode ? "拖拉排序，順序即係首頁顯示嘅順序" : "點擊 [編輯排序] 開始調整順序"}
            </p>
          </div>
          <button
            onClick={toggleEditMode}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              isEditMode
                ? "bg-[#6B7A2F] text-white hover:bg-[#5a6527]"
                : "border border-wlx-mist text-wlx-stone hover:bg-wlx-cream"
            }`}
          >
            {isEditMode ? "完成" : "編輯排序"}
          </button>
        </div>

        {unifiedList.length === 0 ? (
          <div className="p-8 text-center text-wlx-stone">
            未有任何內容，請新增 Section 或 Banner
          </div>
        ) : isEditMode ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={unifiedList.map((item) => `${item.type}-${item.data.id}`)}
              strategy={verticalListSortingStrategy}
            >
              {unifiedList.map((item, index) => (
                <SortableItem key={`${item.type}-${item.data.id}`} item={item} index={index} />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          unifiedList.map((item, index) => (
            <SortableItem key={`${item.type}-${item.data.id}`} item={item} index={index} />
          ))
        )}
      </div>

      {(editingSection || isCreatingSection) && editingSection && (
        <SectionModal
          section={editingSection}
          products={products}
          isNew={isCreatingSection}
          saving={saving}
          onSave={(s) => saveSection(s, isCreatingSection)}
          onClose={() => {
            setEditingSection(null);
            setIsCreatingSection(false);
          }}
        />
      )}

      {(editingBanner || isCreatingBanner) && editingBanner && (
        <BannerModal
          banner={editingBanner}
          isNew={isCreatingBanner}
          saving={saving}
          onSave={(b) => saveBanner(b, isCreatingBanner)}
          onClose={() => {
            setEditingBanner(null);
            setIsCreatingBanner(false);
          }}
        />
      )}
    </div>
  );
}

function SectionModal({
  section,
  products,
  isNew,
  saving,
  onSave,
  onClose,
}: {
  section: Section;
  products: Product[];
  isNew: boolean;
  saving: boolean;
  onSave: (s: Partial<Section>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(section.title);
  const [cardSize, setCardSize] = useState(section.cardSize);
  const [selectionMode, setSelectionMode] = useState<"auto" | "manual">(
    section.filterType ? "auto" : "manual"
  );
  const [filterType, setFilterType] = useState(section.filterType || "category");
  const [filterValue, setFilterValue] = useState(section.filterValue || "");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    section.productIds || []
  );
  const [active, setActive] = useState(section.active);
  const [searchQuery, setSearchQuery] = useState("");
  const [shoeTypeFilter, setShoeTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(query);
        const matchesSku = p.sku?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesSku) return false;
      }

      if (shoeTypeFilter !== "all") {
        const KIDS_TYPES = ["grade_school", "preschool", "toddler"];
        if (shoeTypeFilter === "kids") {
          if (!KIDS_TYPES.includes(p.shoeType || "")) return false;
        } else if (shoeTypeFilter === "mens") {
          if (p.shoeType !== "adult") return false;
        } else if (shoeTypeFilter === "womens") {
          if (p.shoeType !== "womens") return false;
        }
      }

      if (categoryFilter !== "all") {
        if (p.category !== categoryFilter) return false;
      }

      return true;
    });
  }, [products, searchQuery, shoeTypeFilter, categoryFilter]);

  const selectedProducts = useMemo(() => {
    return products.filter((p) => selectedProductIds.includes(p.id));
  }, [products, selectedProductIds]);

  const handleSave = () => {
    onSave({
      id: section.id || undefined,
      title,
      type: "product_grid",
      cardSize,
      active,
      filterType: selectionMode === "auto" ? filterType : null,
      filterValue: selectionMode === "auto" ? filterValue : null,
      productIds: selectionMode === "manual" ? selectedProductIds : [],
    });
  };

  const toggleProduct = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      setSelectedProductIds((prev) => prev.filter((id) => id !== productId));
    } else {
      setSelectedProductIds((prev) => [...prev, productId]);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [products]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-wlx-mist flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-lg">
            {isNew ? "新增 Section" : "編輯 Section"}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-wlx-cream rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-wlx-stone mb-1">標題</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-wlx-mist rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500"
              placeholder="例如：Air Jordan 系列"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-wlx-stone mb-1">卡片大小</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCardSize("small")}
                className={`flex-1 px-4 py-2 rounded-xl border ${
                  cardSize === "small"
                    ? "border-olive-600 bg-olive-50 text-olive-700"
                    : "border-wlx-mist text-wlx-stone"
                }`}
              >
                細卡 (160px)
              </button>
              <button
                type="button"
                onClick={() => setCardSize("large")}
                className={`flex-1 px-4 py-2 rounded-xl border ${
                  cardSize === "large"
                    ? "border-olive-600 bg-olive-50 text-olive-700"
                    : "border-wlx-mist text-wlx-stone"
                }`}
              >
                大卡 (280px)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-wlx-stone mb-1">產品選擇方式</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectionMode("auto")}
                className={`flex-1 px-4 py-2 rounded-xl border ${
                  selectionMode === "auto"
                    ? "border-olive-600 bg-olive-50 text-olive-700"
                    : "border-wlx-mist text-wlx-stone"
                }`}
              >
                自動篩選
              </button>
              <button
                type="button"
                onClick={() => setSelectionMode("manual")}
                className={`flex-1 px-4 py-2 rounded-xl border ${
                  selectionMode === "manual"
                    ? "border-olive-600 bg-olive-50 text-olive-700"
                    : "border-wlx-mist text-wlx-stone"
                }`}
              >
                手動選擇
              </button>
            </div>
          </div>

          {selectionMode === "auto" && (
            <div className="space-y-3 bg-wlx-cream p-4 rounded-xl">
              <div>
                <label className="block text-sm font-medium text-wlx-stone mb-1">篩選類型</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 border border-wlx-mist rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500"
                >
                  <option value="category">類別 (Category)</option>
                  <option value="shoeType">對象 (ShoeType)</option>
                  <option value="featured">精選 (Featured)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-wlx-stone mb-1">篩選值</label>
                {filterType === "category" && (
                  <select
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="w-full px-3 py-2 border border-wlx-mist rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500"
                  >
                    <option value="">-- 選擇類別 --</option>
                    <option value="Air Jordan">Air Jordan</option>
                    <option value="Dunk / SB">Dunk / SB</option>
                    <option value="Air Max">Air Max</option>
                    <option value="Air Force">Air Force</option>
                    <option value="Running">Running</option>
                    <option value="Basketball">Basketball</option>
                    <option value="Lifestyle">Lifestyle</option>
                    <option value="Training">Training</option>
                    <option value="Sandals">Sandals</option>
                  </select>
                )}
                {filterType === "shoeType" && (
                  <select
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="w-full px-3 py-2 border border-wlx-mist rounded-xl focus:outline-none focus:ring-2 focus:ring-olive-500"
                  >
                    <option value="">-- 選擇對象 --</option>
                    <option value="adult">男裝 (Adult)</option>
                    <option value="womens">女裝 (Womens)</option>
                    <option value="kids">童裝 (Kids)</option>
                  </select>
                )}
                {filterType === "featured" && (
                  <input
                    type="text"
                    value="true"
                    disabled
                    className="w-full px-3 py-2 border border-wlx-mist rounded-xl bg-wlx-cream"
                  />
                )}
              </div>
            </div>
          )}

          {selectionMode === "manual" && (
            <div className="bg-wlx-cream p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-wlx-stone">
                  已選擇 {selectedProductIds.length} 件產品
                </span>
                {selectedProductIds.length > 0 && (
                  <button
                    onClick={() => setSelectedProductIds([])}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    清除全部
                  </button>
                )}
              </div>

              {selectedProducts.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 bg-white rounded-lg border border-wlx-mist">
                  {selectedProducts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 bg-olive-50 pl-1 pr-2 py-1 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded overflow-hidden bg-wlx-cream">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon size={12} className="text-wlx-stone" />
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-wlx-stone max-w-[100px] truncate">{p.title}</span>
                      <button onClick={() => toggleProduct(p.id)} className="text-wlx-stone hover:text-red-600">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "全部" },
                  { value: "mens", label: "男裝" },
                  { value: "womens", label: "女裝" },
                  { value: "kids", label: "童裝" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setShoeTypeFilter(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      shoeTypeFilter === opt.value
                        ? "bg-olive-600 text-white"
                        : "bg-white text-wlx-stone border border-wlx-mist hover:border-wlx-mist"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="flex-1 px-3 py-2 border border-wlx-mist rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-olive-500"
                >
                  <option value="all">所有類別</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-wlx-stone" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜尋產品名或 SKU..."
                    className="w-full pl-9 pr-3 py-2 border border-wlx-mist rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-olive-500"
                  />
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1 bg-white rounded-lg border border-wlx-mist">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-wlx-stone text-sm">搵唔到符合條件嘅產品</div>
                ) : (
                  filteredProducts.slice(0, 100).map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 p-2 hover:bg-wlx-cream cursor-pointer border-b border-wlx-mist last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        className="rounded border-wlx-mist text-olive-600 focus:ring-olive-500"
                      />
                      <div className="w-10 h-10 rounded overflow-hidden bg-wlx-cream flex-shrink-0">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon size={16} className="text-wlx-stone" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-wlx-ink truncate">{p.title}</div>
                        <div className="text-xs text-wlx-stone">
                          {p.sku && <span>{p.sku} · </span>}
                          {p.category}
                        </div>
                      </div>
                      <span className="text-xs text-wlx-stone flex-shrink-0">
                        {p.shoeType === "adult"
                          ? "男裝"
                          : p.shoeType === "womens"
                            ? "女裝"
                            : ["grade_school", "preschool", "toddler"].includes(p.shoeType || "")
                              ? "童裝"
                              : ""}
                      </span>
                    </label>
                  ))
                )}
              </div>
              {filteredProducts.length > 100 && (
                <p className="text-xs text-wlx-stone text-center">
                  顯示首 100 件產品，請使用篩選或搜尋縮窄範圍
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-wlx-stone">啟用</span>
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`w-12 h-6 rounded-full transition-colors ${active ? "bg-olive-600" : "bg-zinc-300"}`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                  active ? "translate-x-6" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-wlx-mist flex gap-2 justify-end sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-wlx-stone hover:bg-wlx-cream rounded-xl">取消</button>
          <button
            onClick={handleSave}
            disabled={saving || !title}
            className="px-4 py-2 bg-olive-600 text-white rounded-xl hover:bg-olive-700 disabled:opacity-50"
          >
            {saving ? "儲存中..." : "儲存"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BannerModal({
  banner,
  isNew,
  saving,
  onSave,
  onClose,
}: {
  banner: Banner;
  isNew: boolean;
  saving: boolean;
  onSave: (b: Partial<Banner>) => void;
  onClose: () => void;
}) {
  // Initialize slides from banner.images or fallback to old imageUrl field
  const initialSlides: BannerSlide[] =
    banner.images && banner.images.length > 0
      ? (banner.images as BannerSlide[])
      : [
          {
            imageUrl: banner.imageUrl || "",
            linkUrl: banner.linkUrl || undefined,
            title: banner.title || undefined,
            subtitle: banner.subtitle || undefined,
          },
        ];

  const [slides, setSlides] = useState<BannerSlide[]>(initialSlides);
  const [active, setActive] = useState(banner.active);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingIndex(index);
    const formData = new FormData();
    formData.append("file", file);
    // folder 由 server 按 intent 決定；admin intent 綁登入商戶自己個 tenantId。
    formData.append("intent", "admin");

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.ok && data.data?.url) {
        const newSlides = [...slides];
        newSlides[index] = { ...newSlides[index], imageUrl: data.data.url };
        setSlides(newSlides);
      } else {
        alert("上傳失敗");
      }
    } catch {
      alert("上傳失敗");
    } finally {
      setUploadingIndex(null);
    }
  };

  const updateSlide = (index: number, field: keyof BannerSlide, value: string) => {
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], [field]: value };
    setSlides(newSlides);
  };

  const addSlide = () => {
    setSlides([...slides, { imageUrl: "" }]);
  };

  const removeSlide = (index: number) => {
    if (slides.length === 1) {
      alert("至少需要 1 張圖片");
      return;
    }
    setSlides(slides.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    // Validate: all slides must have imageUrl
    const hasEmptyImage = slides.some((s) => !s.imageUrl);
    if (hasEmptyImage) {
      alert("所有 slides 必須有圖片");
      return;
    }

    // For backward compatibility, set first slide as main fields
    const firstSlide = slides[0];
    onSave({
      id: banner.id || undefined,
      imageUrl: firstSlide.imageUrl,
      title: firstSlide.title || null,
      subtitle: firstSlide.subtitle || null,
      linkUrl: firstSlide.linkUrl || null,
      images: slides,
      active,
      position: "hero",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-wlx-mist flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-lg">
            {isNew ? "新增 Banner" : "編輯 Banner"}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-wlx-cream rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Slides */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-wlx-stone">
                Slides ({slides.length})
              </label>
              <button
                onClick={addSlide}
                className="flex items-center gap-1 px-3 py-1.5 bg-olive-600 text-white rounded-lg text-sm hover:bg-olive-700"
              >
                <Plus size={14} /> 新增 Slide
              </button>
            </div>

            {slides.map((slide, index) => (
              <div
                key={index}
                className="border border-wlx-mist rounded-xl p-4 space-y-3 bg-wlx-cream"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-wlx-stone">
                    Slide {index + 1}
                  </span>
                  {slides.length > 1 && (
                    <button
                      onClick={() => removeSlide(index)}
                      className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                    >
                      <X size={14} />
                      刪除
                    </button>
                  )}
                </div>

                {/* Image upload */}
                <div>
                  <label className="block text-xs text-wlx-stone mb-1">圖片 *</label>
                  <div className="border-2 border-dashed border-wlx-mist rounded-xl p-3">
                    {slide.imageUrl ? (
                      <div className="relative">
                        <img
                          src={slide.imageUrl}
                          alt=""
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => updateSlide(index, "imageUrl", "")}
                          className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-24 cursor-pointer hover:bg-wlx-cream rounded-lg">
                        <ImageIcon size={24} className="text-wlx-stone mb-1" />
                        <span className="text-xs text-wlx-stone">
                          {uploadingIndex === index ? "上傳中..." : "點擊上傳"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, index)}
                          className="hidden"
                          disabled={uploadingIndex === index}
                        />
                      </label>
                    )}
                  </div>
                  <input
                    type="text"
                    value={slide.imageUrl}
                    onChange={(e) => updateSlide(index, "imageUrl", e.target.value)}
                    placeholder="或貼上圖片 URL"
                    className="w-full mt-2 px-2 py-1.5 border border-wlx-mist rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-olive-500"
                  />
                </div>

                {/* Link URL */}
                <div>
                  <label className="block text-xs text-wlx-stone mb-1">
                    連結 URL (選填)
                  </label>
                  <input
                    type="text"
                    value={slide.linkUrl || ""}
                    onChange={(e) => updateSlide(index, "linkUrl", e.target.value)}
                    placeholder="例如：/products?category=Air+Jordan"
                    className="w-full px-2 py-1.5 border border-wlx-mist rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-olive-500"
                  />
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs text-wlx-stone mb-1">
                    標題 (選填)
                  </label>
                  <input
                    type="text"
                    value={slide.title || ""}
                    onChange={(e) => updateSlide(index, "title", e.target.value)}
                    placeholder="例如：Air Jordan 系列"
                    className="w-full px-2 py-1.5 border border-wlx-mist rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-olive-500"
                  />
                </div>

                {/* Subtitle */}
                <div>
                  <label className="block text-xs text-wlx-stone mb-1">
                    副標題 (選填)
                  </label>
                  <input
                    type="text"
                    value={slide.subtitle || ""}
                    onChange={(e) => updateSlide(index, "subtitle", e.target.value)}
                    placeholder="例如：新品上架"
                    className="w-full px-2 py-1.5 border border-wlx-mist rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-olive-500"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between pt-4 border-t border-wlx-mist">
            <span className="text-sm font-medium text-wlx-stone">啟用</span>
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`w-12 h-6 rounded-full transition-colors ${
                active ? "bg-olive-600" : "bg-zinc-300"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                  active ? "translate-x-6" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-wlx-mist flex gap-2 justify-end sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 text-wlx-stone hover:bg-wlx-cream rounded-xl"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-olive-600 text-white rounded-xl hover:bg-olive-700 disabled:opacity-50"
          >
            {saving ? "儲存中..." : "儲存"}
          </button>
        </div>
      </div>
    </div>
  );
}
