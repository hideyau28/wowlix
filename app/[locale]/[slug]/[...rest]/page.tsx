import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// Deep-path catch-all（3+ segment，例如 /zh-HK/foo/bar、/zh-HK/products/x/y）。
//
// 背景：root shell 搬入 [locale]（靜態化 landing 嘅前提）令 app/not-found.tsx
// 冇得留低 —— root 級 /_not-found 冇 locale param，起唔到新 root layout，深層
// unmatched URL 會跌落 Next 內建無品牌 404（<html> 連 lang 都冇）。
//
// 點解擺喺 [slug] 下面而唔係 [locale]/[...rest]：Next 16 實測（dev + prod build
// 兩邊，2026-07-23）notFound() 由直屬 root layout segment 嘅 page 掟出嚟唔會俾
// [locale]/not-found 或 sibling not-found 接住，一律跌落 default；但 [slug]
// segment 嘅 boundary（[slug]/not-found.tsx）今日經 e2e 證實接得穩。喺呢度掟，
// deep path 就會 render branded「呢間店唔存在」404（同 2-seg unknown-slug 同一
// class）。真 route（[slug]/order/[id]、(customer)/(admin) static segment）
// 優先序高過 catch-all，唔受影響。
export default function DeepPathNotFound() {
  notFound();
}
