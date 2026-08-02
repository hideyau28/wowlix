"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

/**
 * 全 repo 唯一 import recharts 嘅檔。
 *
 * 點解要抽出嚟：recharts 打包出嚟係 384 KB（gzip 112 KB）一大嚿，以前由
 * DashboardCharts / AnalyticsDashboard 直接 static import，於是佢哋兩條 admin
 * route 嘅初次載入一定食足呢嚿 —— 連 Free plan 商戶都食，但 Free plan 個
 * `analyticsEnabled` gate 令佢一世都唔會 render 到一張圖。
 *
 * 而家兩個 consumer 一律經 ./LazyCharts 嘅 next/dynamic 攞呢度啲 primitive，
 * recharts 就落咗獨立 chunk，撳到有圖嗰頁先至下載。
 *
 * 呢度只放「畫圖」嘅嘢：卡片外框、標題、空狀態文案全部留喺 consumer，
 * 所以 SSR 照樣出得晒文字，lazy 嘅淨係個圖身。
 */

type TrendPoint = Record<string, string | number>;

type TrendLineProps = {
  data: TrendPoint[];
  /** X 軸讀邊個 key（而家全部係 "date"） */
  xKey: string;
  yKey: string;
  stroke: string;
  /** false = 唔畫點；物件 = 逐點畫（瀏覽量嗰張用） */
  dot?: false | { fill: string; r: number };
  allowDecimals?: boolean;
};

export function TrendLine({
  data,
  xKey,
  yKey,
  stroke,
  dot = false,
  allowDecimals,
}: TrendLineProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={allowDecimals} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke={stroke}
          strokeWidth={2}
          dot={dot}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

type TopBarProps = {
  data: TrendPoint[];
  xKey: string;
  yKey: string;
  fill: string;
};

export function TopBar({ data, xKey, yKey, fill }: TopBarProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey={yKey} fill={fill} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
