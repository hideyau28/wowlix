import { ReactNode } from "react";
import type { Metadata } from "next";
import { getStoreName } from "@/lib/get-store-name";
import { isPlatformMode } from "@/lib/tenant";

// storeName branding title —— 以前由 root layout generateMetadata 供應（見
// (customer)/layout.tsx 同款註釋）。admin 全部 route 都係 dynamic（auth/DB），
// 呢度讀 headers 冇成本。admin/login layout 有自己 title 照 override。
export async function generateMetadata(): Promise<Metadata> {
  const base: Metadata = { robots: { index: false, follow: false } };
  if (await isPlatformMode()) {
    return { ...base, title: "WoWlix — Turn Followers into Customers" };
  }
  const storeName = await getStoreName();
  return { ...base, title: `${storeName} — WoWlix` };
}

export default function AdminGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-wlx-cream">
      {children}
    </div>
  );
}
