"use client";

import { useState, useEffect, useRef } from "react";
import { X, Camera, Loader2, Trash2, Plus, Search, ChevronDown, ChevronRight } from "lucide-react";
import { VARIANT_PRESETS, EXTENDED_PRESETS, COLOR_PRESET_ID, type VariantPreset } from "@/lib/variant-presets";
import { compressImage, isAcceptedImageType } from "@/lib/compress-image";

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
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  product: Product | null;
  isNew: boolean;
  locale: string;
};

// --- Variant data types ---
type SingleVariantValue = { name: string; qty: number };
type DualVariantData = {
  dimensions: string[];
  options: Record<string, string[]>;
  combinations: Record<string, { qty: number; status: string }>;
};

// Wizard step state machine
type WizardStep =
  | "none"      // 初始，顯示 [+ 加尺碼 / 顏色選項]
  | "type"      // 揀 preset
  | "hasColor"  // 有冇顏色？
  | "colors"    // 揀顏色
  | "hasSize"   // (反轉) 有冇尺碼？
  | "sizeType"  // (反轉) 揀 size preset
  | "sizes"     // 揀 size
  | "stock"     // 填庫存
  | "done";     // summary

// localStorage key for variant memory
const VARIANT_MEMORY_KEY = "wowlix-variant-last";

type VariantMemory = {
  presetId: string;
  selectedValues: string[];
  label: string;
  hasColor?: boolean;
  selectedColors?: string[];
  colorHexOverrides?: Record<string, string>;
  secondPresetId?: string;
  secondSelectedValues?: string[];
};

function getVariantMemory(): VariantMemory | null {
  try {
    const raw = localStorage.getItem(VARIANT_MEMORY_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveVariantMemory(memory: VariantMemory) {
  try {
    localStorage.setItem(VARIANT_MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // ignore
  }
}

/** Parse existing sizes JSON into editor state */
function parseExistingSizes(sizes: Record<string, unknown> | null, sizeSystem: string | null) {
  if (!sizes || typeof sizes !== "object") {
    return { mode: "none" as const, optionName1: "", values1: [] as SingleVariantValue[], optionName2: "", values2: [] as string[], grid: {} as Record<string, number> };
  }

  // DualVariantData format
  if ("dimensions" in sizes && "combinations" in sizes) {
    const dual = sizes as unknown as DualVariantData;
    const dim1 = dual.dimensions[0] || "";
    const dim2 = dual.dimensions[1] || "";
    const opts1 = dual.options[dim1] || [];
    const opts2 = dual.options[dim2] || [];

    // 去重：避免從數據庫讀取到重複值
    const uniqueOpts1 = Array.from(new Set(opts1));
    const uniqueOpts2 = Array.from(new Set(opts2));

    const grid: Record<string, number> = {};
    for (const [key, combo] of Object.entries(dual.combinations)) {
      grid[key] = combo.qty;
    }
    return {
      mode: "dual" as const,
      optionName1: dim1,
      values1: uniqueOpts1.map((n) => ({ name: n, qty: 0 })),
      optionName2: dim2,
      values2: uniqueOpts2,
      grid,
    };
  }

  const entries = Object.entries(sizes);
  if (entries.length === 0) {
    return { mode: "none" as const, optionName1: "", values1: [] as SingleVariantValue[], optionName2: "", values2: [] as string[], grid: {} as Record<string, number> };
  }

  // New single format: {"S": {"qty": 5, "status": "available"}}
  const firstVal = entries[0][1];
  if (typeof firstVal === "object" && firstVal !== null && "qty" in (firstVal as Record<string, unknown>)) {
    const values1 = entries.map(([name, val]) => ({
      name,
      qty: (val as { qty: number }).qty,
    }));
    return {
      mode: "single" as const,
      optionName1: sizeSystem || "",
      values1,
      optionName2: "",
      values2: [] as string[],
      grid: {} as Record<string, number>,
    };
  }

  // Legacy format: {"S": 5}
  const values1 = entries.map(([name, val]) => ({
    name,
    qty: typeof val === "number" ? val : 0,
  }));
  return {
    mode: "single" as const,
    optionName1: sizeSystem || "",
    values1,
    optionName2: "",
    values2: [] as string[],
    grid: {} as Record<string, number>,
  };
}

// Find preset by matching values
function findPresetForValues(values: string[]): VariantPreset | null {
  const all = [...VARIANT_PRESETS, ...EXTENDED_PRESETS];
  for (const preset of all) {
    if (preset.values.length === 0) continue;
    const overlap = values.filter((v) => preset.values.includes(v));
    if (overlap.length >= Math.min(2, values.length)) return preset;
  }
  return null;
}

export default function ProductEditSheet({ isOpen, onClose, onSave, product, isNew, locale }: Props) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // --- Variant data state ---
  const [variantMode, setVariantMode] = useState<"none" | "single" | "dual">("none");
  const [optionName1, setOptionName1] = useState("");
  const [values1, setValues1] = useState<SingleVariantValue[]>([]);
  const [optionName2, setOptionName2] = useState("");
  const [values2, setValues2] = useState<string[]>([]);
  const [grid, setGrid] = useState<Record<string, number>>({});

  // --- Wizard state ---
  const [wizardStep, setWizardStep] = useState<WizardStep>("none");
  const [primaryPreset, setPrimaryPreset] = useState<VariantPreset | null>(null);
  const [sizePreset, setSizePreset] = useState<VariantPreset | null>(null);
  const [hasColor, setHasColor] = useState(false);
  const [hasSize, setHasSize] = useState(false);
  const [colorIsFirstDimension, setColorIsFirstDimension] = useState(false);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [customColorName, setCustomColorName] = useState("");
  const [customColorHex, setCustomColorHex] = useState("#888888");
  const [customColorOverrides, setCustomColorOverrides] = useState<Record<string, string>>({});

  // Shared UI state
  const [presetSearch, setPresetSearch] = useState("");
  const [newCustomValue, setNewCustomValue] = useState("");
  const [newCustomValue2, setNewCustomValue2] = useState("");
  const [bulkQty, setBulkQty] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [variantMemory, setVariantMemory] = useState<VariantMemory | null>(null);
  const [memoryDismissed, setMemoryDismissed] = useState(false);

  const isZh = locale === "zh-HK";

  useEffect(() => {
    if (isOpen) {
      if (product && !isNew) {
        setTitle(product.title);
        setPrice(String(product.price));
        setOriginalPrice(product.originalPrice ? String(product.originalPrice) : "");
        setImages(product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : []);
        setVideoUrl(product.videoUrl || "");

        // Load existing variant data
        const parsed = parseExistingSizes(product.sizes, product.sizeSystem);
        setVariantMode(parsed.mode);
        setOptionName1(parsed.optionName1);
        setValues1(parsed.values1);
        setOptionName2(parsed.optionName2);
        setValues2(parsed.values2);
        setGrid(parsed.grid);

        // Set wizard state for edit mode
        if (parsed.mode === "none") {
          setWizardStep("none");
          setPrimaryPreset(null);
          setSizePreset(null);
          setHasColor(false);
          setHasSize(false);
          setColorIsFirstDimension(false);
          setSelectedColors([]);
        } else {
          setWizardStep("done");
          const matched1 = findPresetForValues(parsed.values1.map((v) => v.name));
          setPrimaryPreset(matched1);

          // Detect color dimension
          const colorKeywords = ["顏色", "Color", "color"];
          const dim1IsColor = colorKeywords.some((k) => parsed.optionName1.includes(k));

          if (dim1IsColor) {
            setColorIsFirstDimension(true);
            setHasColor(true);
            setSelectedColors(parsed.values1.map((v) => v.name));
            const colorPresetDef = VARIANT_PRESETS.find((p) => p.id === COLOR_PRESET_ID);
            setPrimaryPreset(colorPresetDef || null);
            if (parsed.mode === "dual") {
              setHasSize(true);
              setSizePreset(findPresetForValues(parsed.values2));
            }
          } else {
            setColorIsFirstDimension(false);
            if (parsed.mode === "dual") {
              const dim2IsColor = colorKeywords.some((k) => parsed.optionName2.includes(k));
              if (dim2IsColor) {
                setHasColor(true);
                setSelectedColors(parsed.values2);
              }
            }
          }
        }
      } else {
        setTitle("");
        setPrice("");
        setOriginalPrice("");
        setImages([]);
        setVideoUrl("");
        setVariantMode("none");
        setOptionName1("");
        setValues1([]);
        setOptionName2("");
        setValues2([]);
        setGrid({});
        setWizardStep("none");
        setPrimaryPreset(null);
        setSizePreset(null);
        setHasColor(false);
        setHasSize(false);
        setColorIsFirstDimension(false);
        setSelectedColors([]);
        setCustomColorOverrides({});
      }
      setError("");
      setConfirmDelete(false);
      setPresetSearch("");
      setNewCustomValue("");
      setNewCustomValue2("");
      setBulkQty("");
      setCollapsedGroups(new Set());
      setMemoryDismissed(false);
      setCustomColorName("");
      setCustomColorHex("#888888");

      // Load variant memory for new products
      if (isNew) {
        setVariantMemory(getVariantMemory());
      } else {
        setVariantMemory(null);
      }
    }
  }, [isOpen, product, isNew]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError("");

    for (const file of Array.from(files)) {
      if (!isAcceptedImageType(file)) {
        setError(isZh ? "只接受 JPG、PNG、WebP 圖片" : "Only JPG, PNG, WebP accepted");
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(isZh ? "圖片唔可以大過 10MB" : "Image must be less than 10MB");
        continue;
      }

      try {
        // 壓縮到 500KB 以下
        const compressed = await compressImage(file);

        const formData = new FormData();
        formData.append("file", compressed);

        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (data.ok && data.data?.url) {
          setImages((prev) => [...prev, data.data.url]);
        } else {
          setError(data.error?.message || "Upload failed");
        }
      } catch {
        setError(isZh ? "上傳失敗" : "Upload failed");
      }
    }

    setUploading(false);
  };

  const handleRemoveImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  // --- Wizard navigation ---
  const finalizeVariantData = () => {
    if (colorIsFirstDimension) {
      const newValues1 = selectedColors.map((c) => {
        const existing = values1.find((v) => v.name === c);
        return { name: c, qty: existing?.qty || 0 };
      });
      setOptionName1(isZh ? "顏色" : "Color");
      setValues1(newValues1);
      if (hasSize && values2.length > 0) {
        setVariantMode("dual");
        const newGrid = { ...grid };
        for (const color of selectedColors) {
          for (const size of values2) {
            const key = `${color}|${size}`;
            if (!(key in newGrid)) newGrid[key] = 0;
          }
        }
        setGrid(newGrid);
      } else {
        setVariantMode("single");
      }
    } else {
      if (hasColor && selectedColors.length > 0) {
        setVariantMode("dual");
        setOptionName2(isZh ? "顏色" : "Color");
        setValues2(selectedColors);
        const newGrid = { ...grid };
        for (const v1 of values1) {
          for (const color of selectedColors) {
            const key = `${v1.name}|${color}`;
            if (!(key in newGrid)) newGrid[key] = 0;
          }
        }
        setGrid(newGrid);
      } else {
        setVariantMode("single");
      }
    }
  };

  const goToStep = (step: WizardStep) => {
    if (step === "stock") finalizeVariantData();
    setWizardStep(step);
  };

  const getBackStep = (): WizardStep | null => {
    if (colorIsFirstDimension) {
      switch (wizardStep) {
        case "type": return "none";
        case "colors": return "type";
        case "hasSize": return "colors";
        case "sizeType": return "hasSize";
        case "sizes": return "sizeType";
        case "stock": return hasSize ? "sizes" : "hasSize";
        default: return null;
      }
    } else {
      switch (wizardStep) {
        case "type": return "none";
        case "hasColor": return "type";
        case "colors": return "hasColor";
        case "sizes": return hasColor ? "colors" : "hasColor";
        case "stock": return "sizes";
        default: return null;
      }
    }
  };

  const handleWizardBack = () => {
    const prev = getBackStep();
    if (prev === "none") {
      handleResetVariants();
    } else if (prev) {
      setWizardStep(prev);
    }
  };

  const handleResetVariants = () => {
    setVariantMode("none");
    setOptionName1("");
    setValues1([]);
    setOptionName2("");
    setValues2([]);
    setGrid({});
    setPrimaryPreset(null);
    setSizePreset(null);
    setHasColor(false);
    setHasSize(false);
    setColorIsFirstDimension(false);
    setSelectedColors([]);
    setCustomColorOverrides({});
    setWizardStep("none");
  };

  // --- Wizard type handlers ---
  const handlePresetTypeSelect = (preset: VariantPreset) => {
    if (preset.id === COLOR_PRESET_ID) {
      setColorIsFirstDimension(true);
      setHasColor(true);
      setPrimaryPreset(preset);
      setWizardStep("colors");
    } else {
      setColorIsFirstDimension(false);
      setPrimaryPreset(preset);
      setOptionName1(preset.label);
      // Don't pre-select — let user pick sizes manually
      setValues1([]);
      setWizardStep("hasColor");
    }
    setPresetSearch("");
  };

  const handleCustomTypeSelect = () => {
    setColorIsFirstDimension(false);
    setPrimaryPreset(null);
    setOptionName1("");
    setValues1([]);
    setWizardStep("hasColor");
    setPresetSearch("");
  };

  // --- Color handlers ---
  const toggleColor = (colorName: string) => {
    setSelectedColors((prev) =>
      prev.includes(colorName) ? prev.filter((c) => c !== colorName) : [...prev, colorName]
    );
  };

  const handleAddCustomColor = () => {
    const name = customColorName.trim();
    if (!name || selectedColors.includes(name)) return;
    setSelectedColors((prev) => [...prev, name]);
    setCustomColorOverrides((prev) => ({ ...prev, [name]: customColorHex }));
    setCustomColorName("");
    setCustomColorHex("#888888");
  };

  // --- Size type handler (color-first flow) ---
  const handleSizeTypeSelect = (preset: VariantPreset) => {
    setSizePreset(preset);
    setOptionName2(preset.label);
    // Don't pre-select — let user pick sizes manually
    setValues2([]);
    setWizardStep("sizes");
    setPresetSearch("");
  };

  const handleCustomSizeTypeSelect = () => {
    setSizePreset(null);
    setOptionName2("");
    setValues2([]);
    setWizardStep("sizes");
    setPresetSearch("");
  };

  // --- Value toggles (kept) ---
  const handleToggleValue1 = (valueName: string) => {
    const exists = values1.some((v) => v.name === valueName);
    if (exists) {
      const removed = values1.find((v) => v.name === valueName);
      setValues1((prev) => prev.filter((v) => v.name !== valueName));
      if (variantMode === "dual" && removed) {
        setGrid((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(next)) {
            if (key.startsWith(`${removed.name}|`)) delete next[key];
          }
          return next;
        });
      }
    } else {
      setValues1((prev) => [...prev, { name: valueName, qty: 0 }]);
      if (variantMode === "dual") {
        setGrid((prev) => {
          const next = { ...prev };
          for (const v2 of values2) {
            next[`${valueName}|${v2}`] = 0;
          }
          return next;
        });
      }
    }
  };

  const handleToggleValue2 = (valueName: string) => {
    const exists = values2.includes(valueName);
    if (exists) {
      setValues2((prev) => prev.filter((v) => v !== valueName));
      setGrid((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (key.endsWith(`|${valueName}`)) delete next[key];
        }
        return next;
      });
    } else {
      setValues2((prev) => [...prev, valueName]);
      setGrid((prev) => {
        const next = { ...prev };
        for (const v1 of values1) {
          next[`${v1.name}|${valueName}`] = 0;
        }
        return next;
      });
    }
  };

  const handleAddCustomValue1 = () => {
    const name = newCustomValue.trim();
    if (!name || values1.some((v) => v.name === name)) return;
    setValues1((prev) => [...prev, { name, qty: 0 }]);
    setNewCustomValue("");
    if (variantMode === "dual") {
      setGrid((prev) => {
        const next = { ...prev };
        for (const v2 of values2) {
          next[`${name}|${v2}`] = 0;
        }
        return next;
      });
    }
  };

  const handleAddCustomValue2 = () => {
    const name = newCustomValue2.trim();
    if (!name || values2.includes(name)) return;
    setValues2((prev) => [...prev, name]);
    setNewCustomValue2("");
    setGrid((prev) => {
      const next = { ...prev };
      for (const v1 of values1) {
        next[`${v1.name}|${name}`] = 0;
      }
      return next;
    });
  };

  // --- Stock handlers (kept) ---
  const handleStockChange = (valueName: string, qty: string) => {
    setValues1((prev) => prev.map((v) => v.name === valueName ? { ...v, qty: parseInt(qty) || 0 } : v));
  };

  const handleGridChange = (key: string, value: string) => {
    setGrid((prev) => ({ ...prev, [key]: parseInt(value) || 0 }));
  };

  const handleBulkSetAll = () => {
    const qty = parseInt(bulkQty) || 0;
    if (variantMode === "single") {
      setValues1((prev) => prev.map((v) => ({ ...v, qty })));
    } else if (variantMode === "dual") {
      setGrid((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          next[key] = qty;
        }
        return next;
      });
    }
    setBulkQty("");
  };

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  // --- Apply variant memory (enhanced) ---
  const handleApplyMemory = () => {
    if (!variantMemory) return;
    const allPresets = [...VARIANT_PRESETS, ...EXTENDED_PRESETS];
    const preset = allPresets.find((p) => p.id === variantMemory.presetId);

    setPrimaryPreset(preset || null);
    setOptionName1(variantMemory.label);
    setValues1(variantMemory.selectedValues.map((v) => ({ name: v, qty: 0 })));

    if (variantMemory.hasColor && variantMemory.selectedColors?.length) {
      setHasColor(true);
      setSelectedColors(variantMemory.selectedColors);
      if (variantMemory.colorHexOverrides) {
        setCustomColorOverrides(variantMemory.colorHexOverrides);
      }
      // Set up dual mode directly
      setVariantMode("dual");
      setOptionName2(isZh ? "顏色" : "Color");
      setValues2(variantMemory.selectedColors);
      const newGrid: Record<string, number> = {};
      for (const v of variantMemory.selectedValues) {
        for (const c of variantMemory.selectedColors) {
          newGrid[`${v}|${c}`] = 0;
        }
      }
      setGrid(newGrid);
    } else {
      setVariantMode("single");
    }

    if (variantMemory.secondPresetId && variantMemory.secondSelectedValues?.length) {
      const secondPreset = allPresets.find((p) => p.id === variantMemory.secondPresetId);
      setSizePreset(secondPreset || null);
      setOptionName2(secondPreset?.label || "");
      setValues2(variantMemory.secondSelectedValues);
      setHasSize(true);
      setVariantMode("dual");
      const newGrid: Record<string, number> = {};
      for (const v of variantMemory.selectedValues) {
        for (const s of variantMemory.secondSelectedValues) {
          newGrid[`${v}|${s}`] = 0;
        }
      }
      setGrid(newGrid);
    }

    setWizardStep("stock");
    setMemoryDismissed(true);
  };

  // --- Build sizes data for API ---
  const buildSizesPayload = (): { sizes: Record<string, unknown> | null; sizeSystem: string | null } => {
    if (variantMode === "none" || values1.length === 0) {
      return { sizes: null, sizeSystem: null };
    }

    if (variantMode === "single") {
      const sizes: Record<string, { qty: number; status: string }> = {};
      for (const v of values1) {
        sizes[v.name] = { qty: v.qty, status: "available" };
      }
      return { sizes, sizeSystem: optionName1.trim() || null };
    }

    // Dual variant format
    // 去重：確保 options 數組冇重複值，避免前台顯示重複 chips
    const uniqueValues1 = Array.from(new Set(values1.map((v) => v.name)));
    const uniqueValues2 = Array.from(new Set(values2));

    const combinations: Record<string, { qty: number; status: string }> = {};
    for (const v1 of values1) {
      for (const v2 of values2) {
        const key = `${v1.name}|${v2}`;
        const qty = grid[key] || 0;
        combinations[key] = { qty, status: "available" };
      }
    }

    const dim1Name = optionName1.trim() || (isZh ? "選項1" : "Option 1");
    const dim2Name = optionName2.trim() || (isZh ? "選項2" : "Option 2");

    const dualData: DualVariantData = {
      dimensions: [dim1Name, dim2Name],
      options: {
        [dim1Name]: uniqueValues1,
        [dim2Name]: uniqueValues2,
      },
      combinations,
    };

    return { sizes: dualData as unknown as Record<string, unknown>, sizeSystem: null };
  };

  const handleSave = async () => {
    setError("");

    if (!title.trim()) {
      setError(isZh ? "請輸入商品名稱" : "Product name is required");
      return;
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      setError(isZh ? "請輸入有效價錢" : "Please enter a valid price");
      return;
    }

    setSaving(true);

    try {
      const { sizes, sizeSystem } = buildSizesPayload();

      // Save variant memory (enhanced)
      if (variantMode !== "none" && values1.length > 0) {
        saveVariantMemory({
          presetId: primaryPreset?.id || "custom",
          selectedValues: values1.map((v) => v.name),
          label: optionName1.trim() || "custom",
          hasColor,
          selectedColors: hasColor ? selectedColors : undefined,
          colorHexOverrides: Object.keys(customColorOverrides).length > 0 ? customColorOverrides : undefined,
          secondPresetId: sizePreset?.id,
          secondSelectedValues: values2.length > 0 ? values2 : undefined,
        });
      }

      const body: Record<string, unknown> = {
        title: title.trim(),
        price: Number(price),
        originalPrice: originalPrice ? Number(originalPrice) : null,
        imageUrl: images[0] || null,
        images,
        videoUrl: videoUrl || null,
        active: true,
      };

      if (isNew) {
        body.sortOrder = 0;
      }

      // 個 comment 本來寫「Always send sizes/sizeSystem so clearing variants
      // works」，但下面個 `if (sizes)` 令 buildSizesPayload 返 null 嗰陣（撳咗
      // 「重新設定」→ variantMode === "none"）成個 field 唔會出現喺 body，
      // PATCH route 見唔到就當冇改過 —— 商戶清咗款式，前台照舊出晒啲款。
      // 而家真係 always send：清空要明示 clearVariants，先過到 PATCH route 個
      // 結構化 blob 保護（嗰個 guard 係擋 /admin/products modal 靜音清零嘅）。
      if (sizes) {
        body.sizes = sizes;
        if (sizeSystem) body.sizeSystem = sizeSystem;
      } else if (!isNew) {
        body.sizes = null;
        body.sizeSystem = null;
        body.clearVariants = true;
      }

      const url = isNew
        ? "/api/admin/products"
        : `/api/admin/products/${product!.id}`;
      const method = isNew ? "POST" : "PATCH";

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isNew) {
        headers["x-idempotency-key"] = crypto.randomUUID();
      }

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error?.message || "Failed to save");
        setSaving(false);
        return;
      }

      onSave();
    } catch {
      setError(isZh ? "儲存失敗" : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!product || isNew) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);

    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onSave();
      } else {
        setError(isZh ? "刪除失敗" : "Failed to delete");
      }
    } catch {
      setError(isZh ? "刪除失敗" : "Failed to delete");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  // --- Rendering helpers ---
  const allPresets = [...VARIANT_PRESETS, ...EXTENDED_PRESETS];
  const filteredPresets = presetSearch
    ? allPresets.filter((p) => p.label.includes(presetSearch) || p.id.includes(presetSearch.toLowerCase()))
    : VARIANT_PRESETS;

  const getColorHex = (valueName: string): string | undefined => {
    if (customColorOverrides[valueName]) return customColorOverrides[valueName];
    const colorPreset = allPresets.find((p) => p.colorHex?.[valueName]);
    return colorPreset?.colorHex?.[valueName];
  };

  // Render checkbox chips for option values
  const renderValueChips = (
    presetValues: string[],
    selectedValues: string[],
    onToggle: (name: string) => void,
    colorHexMap?: Record<string, string>
  ) => (
    <div className="flex flex-wrap gap-2">
      {presetValues.map((val) => {
        const isSelected = selectedValues.includes(val);
        const hex = colorHexMap?.[val] || getColorHex(val);
        return (
          <button
            key={val}
            type="button"
            onClick={() => onToggle(val)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors border ${
              isSelected
                ? "bg-wlx-ink/10 border-wlx-ink text-wlx-ink font-medium"
                : "bg-white border-wlx-mist text-wlx-stone hover:border-wlx-mist"
            }`}
          >
            {hex && (
              <span
                className="w-4 h-4 rounded-full border border-wlx-mist flex-shrink-0"
                style={{ backgroundColor: hex }}
              />
            )}
            {val}
          </button>
        );
      })}
    </div>
  );

  // Render single variant stock list
  const renderSingleStockList = () => {
    const selectedValues = values1;
    if (selectedValues.length === 0) return null;

    return (
      <div className="space-y-3">
        <label className="block text-xs font-medium text-wlx-stone">
          {isZh ? "庫存" : "Stock"}
        </label>
        <div className="rounded-xl border border-wlx-mist divide-y divide-zinc-100 overflow-hidden">
          {selectedValues.map((v) => {
            const hex = getColorHex(v.name);
            return (
              <div key={v.name} className="flex items-center justify-between px-4 py-2.5 bg-white">
                <div className="flex items-center gap-2">
                  {hex && (
                    <span
                      className="w-4 h-4 rounded-full border border-wlx-mist flex-shrink-0"
                      style={{ backgroundColor: hex }}
                    />
                  )}
                  <span className="text-sm font-medium text-wlx-ink">{v.name}</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={v.qty}
                  onChange={(e) => handleStockChange(v.name, e.target.value)}
                  className="w-20 px-2 py-1.5 rounded-lg border border-wlx-mist text-center text-sm text-wlx-ink focus:outline-none focus:ring-1 focus:ring-wlx-ink/20 focus:border-wlx-ink"
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render dual variant collapsible stock groups
  const renderDualStockGroups = () => {
    if (values1.length === 0 || values2.length === 0) return null;

    return (
      <div className="space-y-3">
        <label className="block text-xs font-medium text-wlx-stone">
          {isZh ? "每個組合庫存" : "Stock per combination"}
        </label>
        <div className="space-y-2">
          {values1.map((v1) => {
            const isCollapsed = collapsedGroups.has(v1.name);
            const totalQty = values2.reduce((sum, v2) => sum + (grid[`${v1.name}|${v2}`] || 0), 0);
            const hex = getColorHex(v1.name);

            return (
              <div key={v1.name} className="rounded-xl border border-wlx-mist overflow-hidden">
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => toggleGroupCollapse(v1.name)}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-wlx-cream hover:bg-wlx-cream transition-colors text-left"
                >
                  {isCollapsed ? <ChevronRight size={14} className="text-wlx-stone" /> : <ChevronDown size={14} className="text-wlx-stone" />}
                  {hex && (
                    <span
                      className="w-4 h-4 rounded-full border border-wlx-mist flex-shrink-0"
                      style={{ backgroundColor: hex }}
                    />
                  )}
                  <span className="text-sm font-medium text-wlx-ink">{v1.name}</span>
                  <span className="text-xs text-wlx-stone ml-auto">
                    ({isZh ? `共${totalQty}件` : `${totalQty} total`})
                  </span>
                </button>

                {/* Group body */}
                {!isCollapsed && (
                  <div className="divide-y divide-zinc-100">
                    {values2.map((v2) => {
                      const key = `${v1.name}|${v2}`;
                      const hex2 = getColorHex(v2);
                      return (
                        <div key={key} className="flex items-center justify-between px-4 py-2 bg-white">
                          <div className="flex items-center gap-2">
                            {hex2 && (
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-wlx-mist flex-shrink-0"
                                style={{ backgroundColor: hex2 }}
                              />
                            )}
                            <span className="text-sm text-wlx-stone">{v2}</span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={grid[key] ?? 0}
                            onChange={(e) => handleGridChange(key, e.target.value)}
                            className="w-20 px-2 py-1.5 rounded-lg border border-wlx-mist text-center text-sm text-wlx-ink focus:outline-none focus:ring-1 focus:ring-wlx-ink/20 focus:border-wlx-ink"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-wlx-stone">
          {isZh ? "填 0 = 冇貨" : "0 = out of stock"}
        </p>
      </div>
    );
  };

  // --- Wizard step renders ---
  const getStepList = (): WizardStep[] => {
    if (colorIsFirstDimension) {
      const steps: WizardStep[] = ["type", "colors", "hasSize"];
      if (hasSize) { steps.push("sizeType", "sizes"); }
      steps.push("stock");
      return steps;
    }
    const steps: WizardStep[] = ["type", "hasColor"];
    if (hasColor) steps.push("colors");
    steps.push("sizes", "stock");
    return steps;
  };

  const renderStepIndicator = () => {
    const steps = getStepList();
    const currentIdx = steps.findIndex((s) => s === wizardStep);
    return (
      <div className="flex items-center gap-1.5 mb-3">
        {steps.map((step, idx) => (
          <div key={step} className="flex items-center gap-1.5">
            {idx > 0 && <div className="w-3 h-px bg-zinc-300" />}
            <div className={`w-2 h-2 rounded-full transition-colors ${
              idx < currentIdx ? "bg-wlx-ink"
              : idx === currentIdx ? "bg-wlx-ink ring-2 ring-wlx-ink/15"
              : "bg-zinc-300"
            }`} />
          </div>
        ))}
      </div>
    );
  };

  const renderStepNone = () => (
    <div className="space-y-3">
      {/* Variant memory suggestion */}
      {isNew && variantMemory && !memoryDismissed && (
        <div className="flex items-center gap-2 bg-wlx-cream border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex-1 min-w-0">
            <span className="text-sm text-amber-800">
              {isZh ? "上次設定：" : "Last config: "}
              {variantMemory.label} ({variantMemory.selectedValues.slice(0, 3).join("/")}{variantMemory.selectedValues.length > 3 ? "..." : ""})
              {variantMemory.hasColor && variantMemory.selectedColors?.length
                ? ` × ${isZh ? "顏色" : "Color"}(${variantMemory.selectedColors.slice(0, 2).join("/")}${variantMemory.selectedColors.length > 2 ? "..." : ""})`
                : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={handleApplyMemory}
            className="px-3 py-1 rounded-lg bg-wlx-ink text-white text-xs font-medium hover:bg-wlx-ink/90 transition-colors flex-shrink-0"
          >
            {isZh ? "套用" : "Apply"}
          </button>
          <button
            type="button"
            onClick={() => setMemoryDismissed(true)}
            className="text-amber-400 hover:text-amber-600 flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setWizardStep("type")}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-wlx-mist text-wlx-stone hover:border-wlx-ink hover:text-wlx-ink transition-colors text-sm font-medium w-full justify-center"
      >
        <Plus size={16} />
        {isZh ? "加尺碼 / 顏色選項" : "Add size / color options"}
      </button>
    </div>
  );

  const renderPresetGrid = (
    presets: VariantPreset[],
    onSelect: (preset: VariantPreset) => void,
    onCustom: () => void,
  ) => (
    <div className="space-y-3 bg-wlx-cream rounded-xl p-4">
      <div className="text-sm font-medium text-wlx-stone">
        {isZh ? "選擇選項類型" : "Select option type"}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset)}
            className="flex items-center gap-2.5 px-3 py-3 rounded-xl bg-white border border-wlx-mist hover:border-wlx-ink hover:bg-wlx-ink/5 transition-colors text-left"
          >
            <span className="text-xl">{preset.icon}</span>
            <span className="text-sm font-medium text-wlx-ink truncate">{preset.label}</span>
          </button>
        ))}
      </div>
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-wlx-stone" />
        <input
          type="text"
          value={presetSearch}
          onChange={(e) => setPresetSearch(e.target.value)}
          placeholder={isZh ? "搜尋更多..." : "Search more..."}
          className="w-full pl-8 pr-3 py-2 rounded-lg border border-wlx-mist text-sm focus:outline-none focus:ring-2 focus:ring-wlx-ink/20 focus:border-wlx-ink text-wlx-ink placeholder:text-wlx-stone"
        />
      </div>
      {/* Custom */}
      <button
        type="button"
        onClick={onCustom}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-wlx-mist hover:border-wlx-ink hover:bg-white transition-colors text-sm text-wlx-stone"
      >
        <span>✏️</span>
        <span>{isZh ? "自訂" : "Custom"}</span>
      </button>
      {/* Back */}
      <button
        type="button"
        onClick={handleWizardBack}
        className="w-full text-center text-xs text-wlx-stone hover:text-wlx-stone py-1"
      >
        {isZh ? "← 返回" : "← Back"}
      </button>
    </div>
  );

  const renderStepType = () => {
    const presets = presetSearch ? filteredPresets : VARIANT_PRESETS;
    return renderPresetGrid(presets, handlePresetTypeSelect, handleCustomTypeSelect);
  };

  const renderStepHasColor = () => (
    <div className="space-y-4 bg-wlx-cream rounded-xl p-4">
      <div className="text-sm font-medium text-wlx-stone text-center">
        {isZh ? "呢件商品有冇唔同顏色？" : "Does this product have different colors?"}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => { setHasColor(true); setWizardStep("colors"); }}
          className="py-4 rounded-xl border border-wlx-mist bg-white hover:border-wlx-ink hover:bg-wlx-ink/5 transition-colors text-sm font-medium text-wlx-ink"
        >
          {isZh ? "✅ 有" : "Yes"}
        </button>
        <button
          type="button"
          onClick={() => { setHasColor(false); setWizardStep("sizes"); }}
          className="py-4 rounded-xl border border-wlx-mist bg-white hover:border-zinc-400 transition-colors text-sm font-medium text-wlx-ink"
        >
          {isZh ? "冇（跳過）" : "No (skip)"}
        </button>
      </div>
      <button
        type="button"
        onClick={handleWizardBack}
        className="w-full text-center text-xs text-wlx-stone hover:text-wlx-stone py-1"
      >
        {isZh ? "← 返回" : "← Back"}
      </button>
    </div>
  );

  const renderStepColors = () => {
    const colorPresetDef = VARIANT_PRESETS.find((p) => p.id === COLOR_PRESET_ID);
    const colorValues = colorPresetDef?.values || [];
    const colorHexMap = colorPresetDef?.colorHex || {};

    return (
      <div className="space-y-4 bg-wlx-cream rounded-xl p-4">
        <div className="text-sm font-medium text-wlx-stone">
          {isZh ? "選擇顏色" : "Select colors"}
        </div>
        {/* 4-col color swatch grid */}
        <div className="grid grid-cols-4 gap-2.5">
          {colorValues.map((colorName) => {
            const hex = colorHexMap[colorName];
            const isSelected = selectedColors.includes(colorName);
            return (
              <button
                key={colorName}
                type="button"
                onClick={() => toggleColor(colorName)}
                className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-colors border ${
                  isSelected
                    ? "bg-wlx-ink/10 border-wlx-ink"
                    : "bg-white border-wlx-mist hover:border-wlx-mist"
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex-shrink-0 ${
                    isSelected ? "ring-2 ring-wlx-ink ring-offset-1" : "border-2 border-wlx-mist"
                  }`}
                  style={{ backgroundColor: hex }}
                />
                <span className={`text-xs ${isSelected ? "text-wlx-ink font-medium" : "text-wlx-stone"}`}>
                  {colorName}
                </span>
              </button>
            );
          })}
        </div>
        {/* Custom color */}
        <div className="flex items-center gap-2 pt-2 border-t border-wlx-mist">
          <input
            type="color"
            value={customColorHex}
            onChange={(e) => setCustomColorHex(e.target.value)}
            className="w-7 h-7 rounded-full border border-wlx-mist cursor-pointer p-0 overflow-hidden flex-shrink-0"
          />
          <input
            type="text"
            value={customColorName}
            onChange={(e) => setCustomColorName(e.target.value)}
            placeholder={isZh ? "自訂顏色名" : "Custom color name"}
            className="flex-1 px-3 py-2 rounded-xl border border-wlx-mist text-sm focus:outline-none focus:ring-2 focus:ring-wlx-ink/20 focus:border-wlx-ink text-wlx-ink placeholder:text-wlx-stone"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCustomColor())}
          />
          <button
            type="button"
            onClick={handleAddCustomColor}
            className="px-3 py-2 rounded-xl bg-wlx-cream text-wlx-stone hover:bg-wlx-mist transition-colors text-sm font-medium flex-shrink-0"
          >
            <Plus size={14} />
          </button>
        </div>
        {/* Custom color tags */}
        {selectedColors.filter((c) => !colorValues.includes(c)).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedColors.filter((c) => !colorValues.includes(c)).map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 bg-wlx-ink/10 border border-wlx-ink text-wlx-ink text-sm px-3 py-1.5 rounded-full font-medium"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border border-wlx-ink/30 flex-shrink-0"
                  style={{ backgroundColor: customColorOverrides[c] || "#888" }}
                />
                {c}
                <button type="button" onClick={() => toggleColor(c)} className="text-wlx-ink/60 hover:text-wlx-ink">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        {/* Selected count */}
        {selectedColors.length > 0 && (
          <div className="text-xs text-wlx-stone">
            {isZh ? `已選：${selectedColors.join("、")}` : `Selected: ${selectedColors.join(", ")}`}
          </div>
        )}
        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleWizardBack}
            className="px-4 py-2.5 rounded-xl border border-wlx-mist text-sm text-wlx-stone hover:bg-wlx-cream transition-colors"
          >
            {isZh ? "← 返回" : "← Back"}
          </button>
          <button
            type="button"
            onClick={() => setWizardStep(colorIsFirstDimension ? "hasSize" : "sizes")}
            disabled={selectedColors.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-wlx-ink text-white text-sm font-medium hover:bg-wlx-ink/90 disabled:opacity-40 transition-colors"
          >
            {isZh ? "下一步 →" : "Next →"}
          </button>
        </div>
      </div>
    );
  };

  const renderStepHasSize = () => (
    <div className="space-y-4 bg-wlx-cream rounded-xl p-4">
      <div className="text-sm font-medium text-wlx-stone text-center">
        {isZh ? "有冇唔同尺碼/規格？" : "Does it have different sizes/specs?"}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => { setHasSize(true); setWizardStep("sizeType"); }}
          className="py-4 rounded-xl border border-wlx-mist bg-white hover:border-wlx-ink hover:bg-wlx-ink/5 transition-colors text-sm font-medium text-wlx-ink"
        >
          {isZh ? "✅ 有" : "Yes"}
        </button>
        <button
          type="button"
          onClick={() => { setHasSize(false); goToStep("stock"); }}
          className="py-4 rounded-xl border border-wlx-mist bg-white hover:border-zinc-400 transition-colors text-sm font-medium text-wlx-ink"
        >
          {isZh ? "冇（跳過）" : "No (skip)"}
        </button>
      </div>
      <button
        type="button"
        onClick={handleWizardBack}
        className="w-full text-center text-xs text-wlx-stone hover:text-wlx-stone py-1"
      >
        {isZh ? "← 返回" : "← Back"}
      </button>
    </div>
  );

  const renderStepSizeType = () => {
    const sizePresets = presetSearch
      ? filteredPresets.filter((p) => p.id !== COLOR_PRESET_ID)
      : VARIANT_PRESETS.filter((p) => p.id !== COLOR_PRESET_ID);
    return renderPresetGrid(sizePresets, handleSizeTypeSelect, handleCustomSizeTypeSelect);
  };

  const renderStepSizes = () => {
    const isSecondDim = colorIsFirstDimension;
    const preset = isSecondDim ? sizePreset : primaryPreset;
    const presetValues = preset?.values || [];
    const currentSelected = isSecondDim ? values2 : values1.map((v) => v.name);
    const onToggle = isSecondDim ? handleToggleValue2 : handleToggleValue1;
    const customVal = isSecondDim ? newCustomValue2 : newCustomValue;
    const setCustomVal = isSecondDim ? setNewCustomValue2 : setNewCustomValue;
    const addCustom = isSecondDim ? handleAddCustomValue2 : handleAddCustomValue1;
    const optName = isSecondDim ? optionName2 : optionName1;
    const setOptName = isSecondDim ? setOptionName2 : setOptionName1;

    return (
      <div className="space-y-4 bg-wlx-cream rounded-xl p-4">
        <div className="text-sm font-medium text-wlx-stone">
          {preset?.icon && <span className="mr-1">{preset.icon}</span>}
          {isZh ? `揀${preset?.label || "選項"}` : `Select ${preset?.label || "options"}`}
        </div>
        {/* Option name input */}
        <input
          type="text"
          value={optName}
          onChange={(e) => setOptName(e.target.value)}
          placeholder={isZh ? "選項名稱" : "Option name"}
          className="w-full px-3 py-2.5 rounded-xl border border-wlx-mist focus:outline-none focus:ring-2 focus:ring-wlx-ink/20 focus:border-wlx-ink text-wlx-ink placeholder:text-wlx-stone text-sm"
        />
        {/* Preset chips */}
        {presetValues.length > 0 && renderValueChips(presetValues, currentSelected, onToggle, preset?.colorHex)}
        {/* Custom value input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={customVal}
            onChange={(e) => setCustomVal(e.target.value)}
            placeholder={isZh ? "自訂值" : "Custom value"}
            className="flex-1 px-3 py-2 rounded-xl border border-wlx-mist focus:outline-none focus:ring-2 focus:ring-wlx-ink/20 focus:border-wlx-ink text-wlx-ink placeholder:text-wlx-stone text-sm"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
          />
          <button
            type="button"
            onClick={addCustom}
            className="px-3 py-2 rounded-xl bg-wlx-cream text-wlx-stone hover:bg-wlx-mist transition-colors text-sm font-medium flex-shrink-0"
          >
            <Plus size={14} />
          </button>
        </div>
        {/* Non-preset selected values as removable tags */}
        {currentSelected.filter((v) => !presetValues.includes(v)).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {currentSelected.filter((v) => !presetValues.includes(v)).map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 bg-wlx-ink/10 border border-wlx-ink text-wlx-ink text-sm px-3 py-1.5 rounded-full font-medium"
              >
                {v}
                <button type="button" onClick={() => onToggle(v)} className="text-wlx-ink/60 hover:text-wlx-ink">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleWizardBack}
            className="px-4 py-2.5 rounded-xl border border-wlx-mist text-sm text-wlx-stone hover:bg-wlx-cream transition-colors"
          >
            {isZh ? "← 返回" : "← Back"}
          </button>
          <button
            type="button"
            onClick={() => goToStep("stock")}
            disabled={currentSelected.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-wlx-ink text-white text-sm font-medium hover:bg-wlx-ink/90 disabled:opacity-40 transition-colors"
          >
            {isZh ? "下一步 →" : "Next →"}
          </button>
        </div>
      </div>
    );
  };

  const renderStepStock = () => {
    const isDual = variantMode === "dual";
    return (
      <div className="space-y-4">
        <div className="text-sm font-medium text-wlx-stone">
          {isZh ? "設定庫存" : "Set stock"}
        </div>
        {/* Bulk set all */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-wlx-stone">{isZh ? "全部設為" : "Set all to"}</span>
          <input
            type="number"
            min="0"
            value={bulkQty}
            onChange={(e) => setBulkQty(e.target.value)}
            placeholder="0"
            className="w-20 px-2 py-1.5 rounded-lg border border-wlx-mist text-center text-sm text-wlx-ink focus:outline-none focus:ring-1 focus:ring-wlx-ink/20 focus:border-wlx-ink"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleBulkSetAll())}
          />
          <button
            type="button"
            onClick={handleBulkSetAll}
            className="px-3 py-1.5 rounded-lg bg-wlx-cream text-wlx-stone hover:bg-wlx-mist transition-colors text-xs font-medium"
          >
            {isZh ? "套用" : "Apply"}
          </button>
        </div>
        {/* Stock list or groups */}
        {isDual ? renderDualStockGroups() : renderSingleStockList()}
        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleWizardBack}
            className="px-4 py-2.5 rounded-xl border border-wlx-mist text-sm text-wlx-stone hover:bg-wlx-cream transition-colors"
          >
            {isZh ? "← 返回" : "← Back"}
          </button>
          <button
            type="button"
            onClick={() => setWizardStep("done")}
            className="flex-1 py-2.5 rounded-xl bg-wlx-ink text-white text-sm font-medium hover:bg-wlx-ink/90 transition-colors"
          >
            {isZh ? "完成 ✓" : "Done ✓"}
          </button>
        </div>
      </div>
    );
  };

  const renderStepDone = () => {
    const isDual = variantMode === "dual";
    const totalQty = isDual
      ? Object.values(grid).reduce((sum, q) => sum + q, 0)
      : values1.reduce((sum, v) => sum + v.qty, 0);

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-green-500">✅</span>
          <span className="text-sm font-medium text-wlx-stone">
            {isZh ? "選項設定" : "Variant settings"}
          </span>
        </div>
        <div className="rounded-xl border border-wlx-mist bg-wlx-cream p-4 space-y-3">
          <div className="text-sm font-medium text-wlx-stone">
            {isDual ? `${optionName1} × ${optionName2}` : optionName1}
          </div>
          {isDual ? (
            <div className="space-y-2">
              {values1.map((v1) => {
                const hex = getColorHex(v1.name);
                const items = values2.map((v2) => ({
                  name: v2,
                  qty: grid[`${v1.name}|${v2}`] || 0,
                }));
                return (
                  <div key={v1.name} className="text-xs text-wlx-stone">
                    <span className="inline-flex items-center gap-1">
                      {hex && <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: hex }} />}
                      <span className="font-medium">{v1.name}：</span>
                    </span>
                    {items.map((i) => `${i.name}(${i.qty})`).join(" ")}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-wlx-stone">
              {values1.map((v) => `${v.name}(${v.qty})`).join("  ")}
            </div>
          )}
          <div className="text-xs text-wlx-stone pt-1 border-t border-wlx-mist">
            {isZh ? `總庫存 ${totalQty} 件` : `Total stock: ${totalQty}`}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleResetVariants}
            className="flex-1 py-2.5 rounded-xl border border-wlx-mist text-sm text-wlx-stone hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            {isZh ? "重新設定" : "Reset"}
          </button>
          <button
            type="button"
            onClick={() => setWizardStep("stock")}
            className="flex-1 py-2.5 rounded-xl border border-wlx-ink text-sm text-wlx-ink hover:bg-wlx-ink/10 transition-colors font-medium"
          >
            {isZh ? "改庫存" : "Edit stock"}
          </button>
        </div>
      </div>
    );
  };

  const renderWizardSection = () => (
    <div>
      {wizardStep !== "none" && wizardStep !== "done" && renderStepIndicator()}
      {wizardStep === "none" && renderStepNone()}
      {wizardStep === "type" && renderStepType()}
      {wizardStep === "hasColor" && renderStepHasColor()}
      {wizardStep === "colors" && renderStepColors()}
      {wizardStep === "hasSize" && renderStepHasSize()}
      {wizardStep === "sizeType" && renderStepSizeType()}
      {wizardStep === "sizes" && renderStepSizes()}
      {wizardStep === "stock" && renderStepStock()}
      {wizardStep === "done" && renderStepDone()}
    </div>
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-zinc-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-wlx-mist">
          <h3 className="text-lg font-semibold text-wlx-ink">
            {isNew
              ? (isZh ? "新增商品" : "New Product")
              : (isZh ? "編輯商品" : "Edit Product")}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-wlx-cream transition-colors">
            <X size={20} className="text-wlx-stone" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-wlx-stone mb-2">
              {isZh ? "商品圖片" : "Product Images"}
            </label>
            <div className="flex gap-2 flex-wrap">
              {images.map((url, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-wlx-mist">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {uploading && (
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-wlx-mist flex items-center justify-center">
                  <Loader2 size={20} className="text-wlx-stone animate-spin" />
                </div>
              )}

              <div className="flex gap-2">
                {/* Camera button (mobile) */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-wlx-mist flex flex-col items-center justify-center hover:border-wlx-ink transition-colors"
                >
                  <Camera size={18} className="text-wlx-stone" />
                  <span className="text-[10px] text-wlx-stone mt-0.5">{isZh ? "影相" : "Camera"}</span>
                </button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                />

                {/* Upload button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-wlx-mist flex flex-col items-center justify-center hover:border-wlx-ink transition-colors"
                >
                  <Plus size={18} className="text-wlx-stone" />
                  <span className="text-[10px] text-wlx-stone mt-0.5">{isZh ? "上傳" : "Upload"}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                />
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-wlx-stone mb-1.5">
              {isZh ? "商品名稱 *" : "Product Name *"}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isZh ? "例如：棉麻襯衫" : "e.g. Cotton Shirt"}
              className="w-full px-3 py-2.5 rounded-xl border border-wlx-mist focus:outline-none focus:ring-2 focus:ring-wlx-ink/20 focus:border-wlx-ink text-wlx-ink placeholder:text-wlx-stone"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-wlx-stone mb-1.5">
              {isZh ? "價錢 ($) *" : "Price ($) *"}
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              min="0"
              step="1"
              className="w-full px-3 py-2.5 rounded-xl border border-wlx-mist focus:outline-none focus:ring-2 focus:ring-wlx-ink/20 focus:border-wlx-ink text-wlx-ink placeholder:text-wlx-stone"
            />
          </div>

          {/* Original Price */}
          <div>
            <label className="block text-sm font-medium text-wlx-stone mb-1.5">
              {isZh ? "原價（可選，劃線價）" : "Original Price (optional, strikethrough)"}
            </label>
            <input
              type="number"
              value={originalPrice}
              onChange={(e) => setOriginalPrice(e.target.value)}
              placeholder={isZh ? "留空表示冇折扣" : "Leave empty for no discount"}
              min="0"
              step="1"
              className="w-full px-3 py-2.5 rounded-xl border border-wlx-mist focus:outline-none focus:ring-2 focus:ring-wlx-ink/20 focus:border-wlx-ink text-wlx-ink placeholder:text-wlx-stone"
            />
          </div>

          {/* --- Variant Options Section (Wizard) --- */}
          {renderWizardSection()}

          {/* Video URL — 即將推出 */}
          <div className="opacity-50">
            <label className="block text-sm font-medium text-wlx-stone mb-1.5">
              {isZh ? "影片連結" : "Video URL"}
              <span className="ml-2 text-xs text-wlx-stone">{isZh ? "即將推出" : "Coming soon"}</span>
            </label>
            <input
              type="url"
              disabled
              value=""
              placeholder="https://..."
              className="w-full px-3 py-2.5 rounded-xl border border-wlx-mist bg-wlx-cream text-wlx-stone placeholder:text-zinc-300 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Footer buttons */}
        <div className="px-5 py-4 border-t border-wlx-mist flex gap-3">
          {!isNew && product && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                confirmDelete
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-wlx-cream text-wlx-stone hover:bg-red-50 hover:text-red-600"
              } disabled:opacity-50`}
            >
              {deleting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : confirmDelete ? (
                isZh ? "確定刪除？" : "Confirm Delete?"
              ) : (
                <Trash2 size={16} />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-wlx-ink text-white font-semibold hover:bg-wlx-ink/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {isZh ? "儲存" : "Save"}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
