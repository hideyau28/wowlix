import { ReactNode } from "react";
import type { Metadata } from "next";
import { marketingBrandVars } from "@/components/marketing/theme";
import { fraunces, notoSerifHK } from "@/components/marketing/fonts";
import MarketingTypeStyles from "@/components/marketing/TypeStyles";

export const metadata: Metadata = {
  title: "開店 | WoWlix",
  description: "2 分鐘開店，一條連結搞掂所有嘢。免費開始。",
};

// /start 係 marketing surface（開店 funnel），同 landing / pricing 食同一套
// Ink & Bone 皮：subtree 級 override，唔郁 app/globals.css 嘅 base :root，
// 租戶店一個 byte 都唔變（DESIGN.md §2 scoping）。
export default function StartLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={marketingBrandVars}
      className={`${fraunces.variable} ${notoSerifHK.variable}`}
    >
      <MarketingTypeStyles />
      {children}
    </div>
  );
}
