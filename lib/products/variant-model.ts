/**
 * `Product.sizes` 呢條 JSON column 歷史上有四種 shape，兩個編輯器各自用唔同
 * assumption 讀寫佢。呢個 module 係呢條 column 嘅唯一 owner —— 邊個 shape 由
 * 邊個編輯器揸旗、幾時准清空，全部喺呢度講一次。
 *
 *   none    null / {}                                  冇款式
 *   legacy  {"US 9": 3}                                /admin/products modal（波鞋碼格）
 *   single  {"S": {qty, status}}                       dashboard ProductEditSheet
 *   dual    {dimensions, options, combinations}        dashboard ProductEditSheet（色 × 碼）
 *
 * legacy 係 modal 自己砌嘅嘢，佢清得。single / dual 係 dashboard 砌嘅結構，
 * modal 唔識渲染亦都重砌唔返 —— 佢唯一安全嘅做法係完全唔掂條 column。
 *
 * 呢個唔係理論：modal 以前盲 cast 做 Record<string, number> 再 filter
 * `stock > 0`，object value 永遠 falsy，於是商戶喺 dashboard 砌好色 × 碼格、
 * 返 /admin/products 改個價撳 Save，成盤庫存就靜靜變 null。
 */

/** DualVariantData 個 runtime shape 由 lib/biolink-helpers.ts 定義（前台用）。 */
export type SizesShape = "none" | "legacy" | "single" | "dual";

/** modal 揸旗嗰種：size → 件數。 */
export type LegacySizes = Record<string, number>;

function asPlainObject(sizes: unknown): Record<string, unknown> | null {
  if (!sizes || typeof sizes !== "object" || Array.isArray(sizes)) return null;
  return sizes as Record<string, unknown>;
}

/**
 * 認 shape。次序要緊：dual 個 marker key 一定要喺 entry 掃描之前驗，
 * 否則 `dimensions` / `combinations` 會當咗係兩個 size 名。
 */
export function detectSizesShape(sizes: unknown): SizesShape {
  const obj = asPlainObject(sizes);
  if (!obj) return "none";

  // 同 app/api/admin/products/route.ts parseSizes 同埋
  // components/admin/ProductEditSheet.tsx parseExistingSizes 用同一個 marker。
  if ("dimensions" in obj && "combinations" in obj) return "dual";

  const entries = Object.entries(obj);
  if (entries.length === 0) return "none";

  const firstVal = entries[0][1];
  if (
    typeof firstVal === "object" &&
    firstVal !== null &&
    "qty" in (firstVal as Record<string, unknown>)
  ) {
    return "single";
  }

  return "legacy";
}

/**
 * dashboard 砌嘅結構化款式（single / dual）。呢兩種唔准俾一個渲染唔到佢哋嘅
 * client 用 `sizes: null` 靜靜清走。
 */
export function isStructuredSizes(sizes: unknown): boolean {
  const shape = detectSizesShape(sizes);
  return shape === "single" || shape === "dual";
}

/**
 * /admin/products modal 揸得住呢件貨嘅款式資料先返 true。
 * 返 false 就即係「dashboard 揸旗」—— modal 唔好送 sizes / sizeSystem / stock。
 */
export function isLegacyEditableShape(sizes: unknown): boolean {
  const shape = detectSizesShape(sizes);
  return shape === "none" || shape === "legacy";
}

/**
 * 淨係喺 legacy shape 先返實質內容。single / dual 一律返 {}，
 * 令舊嗰個「blob 當 size 表」嘅盲 cast 冇可能再發生。
 */
export function parseLegacySizes(sizes: unknown): LegacySizes {
  if (detectSizesShape(sizes) !== "legacy") return {};
  const obj = asPlainObject(sizes);
  if (!obj) return {};

  const result: LegacySizes = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === "number" && Number.isFinite(val) && val >= 0) {
      result[key] = val;
    }
  }
  return result;
}
