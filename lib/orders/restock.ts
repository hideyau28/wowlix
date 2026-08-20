/**
 * 還庫存 —— 張單死咗，就將落單嗰陣扣走嘅貨照原路放返上架。
 *
 * 三個設計決定（改之前睇清楚）：
 *
 * 1. **還幾多、還去邊，唔准估。** 落單嗰陣寫低咗個 `stockSource` marker 落
 *    `Order.items`，還貨純粹係照住個 marker 行返轉頭。兩條落單 route 扣貨嘅
 *    形狀唔同（/api/orders 冇 variant 就扣 `Product.stock`；biolink 冇 variant
 *    就乜都唔扣），淨係睇 `variantId` 在唔在係分唔開嘅 —— 估錯嗰邊就係憑空
 *    變出貨，即係超賣。
 *
 * 2. **舊單（冇 marker）一律跳過。** 寧願少還（商戶自己加返，睇得見）都好過
 *    亂加（睇唔見，直到出唔到貨）。
 *
 * 3. **落鎖次序同扣貨嗰邊一致**（雙維格按 productId 排）—— 兩條 tx 交叉鎖唔同
 *    次序嘅行就會死鎖。
 */

import type { OrderStatus, Prisma } from "@prisma/client";

/** 落單嗰陣扣咗邊度嘅貨。`none` = 特登乜都冇扣（唔係「唔知」）。 */
export type StockSource = "variant" | "product" | "combination" | "none";

/** 寫落 `Order.items` 嗰個 snapshot 入面同庫存有關嗰幾個 field。 */
export type StockTaggedItem = {
  stockSource?: StockSource;
  productId?: string;
  variantId?: string | null;
  /** 雙維（色 × 碼）嗰個 combinations key，例如 `"黑|M"`。 */
  variantKey?: string | null;
  quantity?: number;
};

type SizesBlob = {
  combinations?: Record<string, { qty: number; status: string }>;
};

/**
 * 入咗就冇得返轉頭嘅「張單死咗」狀態 —— 亦即係唯一可以還貨嘅時機。
 *
 * ⚠️ 加狀態落呢個 list 之前，確認佢喺 `status-transitions.ts` 係 terminal
 * （outgoing transition 係空）。防雙重還貨全靠「一張單一世只入得一次死狀態」：
 * 有出路嘅狀態入得返出得返，就會還兩次。
 *
 * REFUNDED 特登唔喺度：退款嗰陣件貨已經去咗客人手上，加返庫存 = 賣一件冇嘅貨。
 */
export const DEAD_ORDER_STATUSES: readonly OrderStatus[] = [
  "CANCELLED",
  "PAYMENT_REJECTED",
];

export function isDeadOrderStatus(status: string): boolean {
  return DEAD_ORDER_STATUSES.includes(status as OrderStatus);
}

/** `Order.items` 係 Json，乜都可以係 —— 逐件過濾到剩返真係還得嘅先。 */
function parseStockItems(rawItems: unknown): StockTaggedItem[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as StockTaggedItem;

    if (typeof item.productId !== "string" || !item.productId) return [];
    if (typeof item.quantity !== "number" || !Number.isFinite(item.quantity))
      return [];
    if (item.quantity <= 0) return [];

    switch (item.stockSource) {
      case "variant":
        return typeof item.variantId === "string" && item.variantId
          ? [item]
          : [];
      case "combination":
        return typeof item.variantKey === "string" && item.variantKey
          ? [item]
          : [];
      case "product":
        return [item];
      // "none"（特登冇扣）同 undefined（marker 之前落嘅舊單）一律唔郁。
      default:
        return [];
    }
  });
}

/**
 * 將一張單扣走咗嘅貨還返。**一定要喺同一個 transaction 入面叫**，而且要喺
 * 「贏咗 status CAS」之後先叫 —— 個 CAS 就係防雙重還貨嗰道閘。
 */
export async function restockOrderItems(
  tx: Prisma.TransactionClient,
  tenantId: string,
  rawItems: unknown,
): Promise<void> {
  const items = parseStockItems(rawItems);
  if (items.length === 0) return;

  for (const item of items) {
    if (item.stockSource === "variant") {
      // 次序唔可以倒轉：先救返「賣到 0 自動落架」個 flag，再加返數。
      // 加完數之後 stock 唔再係 0，就分唔到邊個係賣斷貨自動落架、邊個係商戶
      // 自己落架 —— 淨係加返個數但仍然落架，客人一樣買唔到，等於冇還過。
      await tx.productVariant.updateMany({
        where: {
          id: item.variantId!,
          tenantId,
          productId: item.productId!,
          stock: { lte: 0 },
          active: false,
        },
        data: { active: true },
      });
      await tx.productVariant.updateMany({
        where: { id: item.variantId!, tenantId, productId: item.productId! },
        data: { stock: { increment: item.quantity! } },
      });
      continue;
    }

    if (item.stockSource === "product") {
      await tx.product.updateMany({
        where: { id: item.productId!, tenantId },
        data: { stock: { increment: item.quantity! } },
      });
    }
  }

  // 雙維（色 × 碼）JSONB 格 —— 同扣貨嗰邊一樣按 productId 排住落鎖。
  const dualItems = items
    .filter((item) => item.stockSource === "combination")
    .slice()
    .sort((a, b) => a.productId!.localeCompare(b.productId!));

  for (const item of dualItems) {
    const locked = (await tx.$queryRaw`
      SELECT "sizes" FROM "Product"
      WHERE "id" = ${item.productId!} AND "tenantId" = ${tenantId}
      FOR UPDATE
    `) as Array<{ sizes: unknown }>;

    const sizes = locked[0]?.sizes as SizesBlob | null;
    const combinations = sizes?.combinations;
    if (!combinations) continue;

    const combo = combinations[item.variantKey!];
    // 個格俾商戶改走／刪咗就唔好憑空起返一個 —— 商戶改咗版就係佢話事。
    if (!combo) continue;

    const nextQty = combo.qty + item.quantity!;
    const nextSizes = {
      ...sizes,
      combinations: {
        ...combinations,
        [item.variantKey!]: {
          ...combo,
          qty: nextQty,
          // 賣到 0 嗰陣扣貨嗰邊會 flip 做 hidden；有返貨就開返個格（同上面
          // variant 個 active flag 同一個道理）。商戶自己收埋（qty > 0 但
          // hidden）嗰啲照留 hidden。
          status: combo.qty <= 0 && combo.status === "hidden"
            ? "available"
            : combo.status,
        },
      },
    };

    await tx.product.updateMany({
      where: { id: item.productId!, tenantId },
      data: { sizes: nextSizes as object },
    });
  }
}
