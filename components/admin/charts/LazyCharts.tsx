"use client";

import dynamic from "next/dynamic";

/**
 * recharts 嘅 lazy 入口 —— consumer 一律由呢度攞圖，唔好直接 import
 * ./RechartsPrimitives，否則 recharts 會即刻返晒去初次載入嗰嚿。
 *
 * `ssr: false` 喺呢度合法係因為本檔係 Client Component（Next 16 唔准喺
 * Server Component 用 ssr:false）。圖本身唔需要 SSR：admin 成個 route group
 * 喺 auth 後面，唔關 SEO 事，而卡片標題／空狀態文案留咗喺 consumer 度照 SSR。
 *
 * loading 回 null 而唔係 skeleton：兩個 consumer 都已經用固定高度個盒
 *（h-64 / h-48）包住，回 null 零 layout shift；擺個 pulse 落去反而喺圖秒開
 * 嗰陣閃一下。
 */

export const TrendLine = dynamic(
  () => import("./RechartsPrimitives").then((m) => m.TrendLine),
  { ssr: false, loading: () => null },
);

export const TopBar = dynamic(
  () => import("./RechartsPrimitives").then((m) => m.TopBar),
  { ssr: false, loading: () => null },
);
