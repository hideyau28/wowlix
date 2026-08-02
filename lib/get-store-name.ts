import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getServerTenantId } from "@/lib/tenant";

const DEFAULT_STORE_NAME = "WoWlix";

/**
 * 一個 render pass 入面同一間店只查一次 storeSettings。
 * getStoreName() 喺 (customer)/layout、page 個 generateMetadata、商品頁
 * 各叫一次，以前每次都真係打一轉 DB。
 * cache key = tenantId，跨租戶攞唔到對方嘅 settings。
 */
export const loadStoreSettings = cache(async (tenantId: string) =>
  prisma.storeSettings.findFirst({ where: { tenantId } }),
);

/**
 * Fetch store name from database with fallback.
 * Resolves tenantId from request headers (server component context).
 */
export async function getStoreName(): Promise<string> {
  try {
    const tenantId = await getServerTenantId();
    const settings = await loadStoreSettings(tenantId);
    return settings?.storeName || DEFAULT_STORE_NAME;
  } catch (error) {
    console.error("Failed to fetch store name:", error);
    return DEFAULT_STORE_NAME;
  }
}

/**
 * Fetch store settings including name, tagline, etc.
 */
export async function getStoreSettings() {
  try {
    const tenantId = await getServerTenantId();
    const settings = await loadStoreSettings(tenantId);
    return {
      storeName: settings?.storeName || DEFAULT_STORE_NAME,
      tagline: settings?.tagline || "",
    };
  } catch (error) {
    console.error("Failed to fetch store settings:", error);
    return {
      storeName: DEFAULT_STORE_NAME,
      tagline: "",
    };
  }
}
