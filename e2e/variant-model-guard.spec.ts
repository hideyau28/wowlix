// API-only spec → 直接用 @playwright/test（同 variant-tenant-isolation.spec.ts
// 一樣）。./fixtures 個 consoleGuard 係 auto fixture 兼依賴 `page`，用咗每條
// test 都會開多個冇用嘅 browser page。
import { test, expect, request as apiRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { APP, uid } from "./helpers";

/**
 * `Product.sizes` 兩個編輯器打架 —— 靜音清零。
 *
 * 真 bug（修之前）：
 *   • dashboard ProductEditSheet 寫入 single `{"S":{qty,status}}` 或者
 *     dual `{dimensions,options,combinations}`。
 *   • /admin/products 個 ProductModal 盲 cast 做 Record<string, number>
 *     （product-modal.tsx 舊 :186），跟住 handleSubmit filter `stock > 0`
 *     —— object value 永遠 falsy，成個 blob 被 filter 走。
 *   • 於是佢送 `sizes: null` + `stock: 0`，而 PATCH route 舊 :57 係
 *     `if (body.sizes !== undefined) updateData.sizes = body.sizes;`
 *     照單全收 → 商戶喺 dashboard 砌好嘅色 × 碼庫存格，返 /admin/products
 *     改個價撳 Save 就永久冇咗，畫面連提示都冇。
 *
 * 修法兩層：
 *   1. client：modal 用 lib/products/variant-model 認 shape，唔屬於自己嗰種
 *      就完全唔送 sizes / sizeSystem / stock（呢條 spec 驗唔到 client，
 *      靠下面 server 層兜底）。
 *   2. server：PATCH 收到 `sizes: null` 而現存係結構化 blob 就 409，
 *      除非明示 `clearVariants: true`。
 *
 * ⚠️ legacy shape（`{"US 9": 3}`）一定要繼續清得走 —— 嗰個係 modal 自己揸旗
 * 嘅資料，商戶 uncheck 晒所有碼就係要清。最後一條 test 專門守住呢個唔好矯枉過正。
 */

type Store = {
  ctx: APIRequestContext;
  slug: string;
  tenantId: string;
};

const DUAL_SIZES = {
  dimensions: ["顏色", "尺碼"],
  options: { 顏色: ["黑", "白"], 尺碼: ["M", "L"] },
  combinations: {
    "黑|M": { qty: 3, status: "available" },
    "黑|L": { qty: 2, status: "available" },
    "白|M": { qty: 1, status: "available" },
    "白|L": { qty: 4, status: "available" },
  },
};

const SINGLE_SIZES = {
  S: { qty: 2, status: "available" },
  M: { qty: 5, status: "available" },
};

const LEGACY_SIZES = { "US 9": 3, "US 10": 2 };

async function registerStore(run: string): Promise<Store> {
  const slug = `e2e-vmg-${run}`;
  const ctx = await apiRequest.newContext();
  const reg = await ctx.post(`${APP}/api/tenant/register`, {
    data: {
      name: `E2E VMG ${run}`,
      slug,
      email: `${slug}@example.com`,
      password: "E2e-passw0rd-1234",
      whatsapp: "+85291234567",
      paymentMethods: ["fps"],
      fpsId: "91234567",
      templateId: "matcha",
    },
  });
  expect(reg.status(), `register ${slug} 應該 200`).toBe(200);
  const regJson = await reg.json();
  const tenantId = regJson.data?.tenantId as string;
  expect(tenantId, "register 應該回 tenantId").toBeTruthy();
  return { ctx, slug, tenantId };
}

/** 開一件貨，再 PATCH 入指定 sizes blob（模擬 dashboard 編輯器寫入）。 */
async function createProductWithSizes(
  store: Store,
  title: string,
  sizes: unknown,
): Promise<string> {
  const res = await store.ctx.post(`${APP}/api/admin/products`, {
    headers: { "x-idempotency-key": `${store.slug}-${title}-${uid()}` },
    data: { title, price: 128, stock: 0 },
  });
  expect(res.status(), `開產品 ${title} 應該 200`).toBe(200);
  const id = (await res.json()).data?.id as string;

  const seed = await store.ctx.patch(`${APP}/api/admin/products/${id}`, {
    data: { sizes },
  });
  expect(seed.status(), `寫入 ${title} 嘅 sizes 應該 200`).toBe(200);
  return id;
}

/** 攞返件貨而家真正存住嘅 sizes —— 用一個無害 PATCH 嘅 response body 讀。 */
async function readSizes(store: Store, productId: string): Promise<unknown> {
  const res = await store.ctx.patch(`${APP}/api/admin/products/${productId}`, {
    data: { active: true },
  });
  expect(res.status(), "無害 PATCH 應該 200").toBe(200);
  return (await res.json()).data?.sizes;
}

test.describe("Product.sizes 唔准俾第二個編輯器靜音清零", () => {
  let store: Store;

  test.beforeAll(async () => {
    store = await registerStore(uid());
  });

  test.afterAll(async () => {
    await store?.ctx.dispose();
  });

  test("dual 色×碼 blob：modal 式 sizes:null → 409，庫存格完全不變", async () => {
    const id = await createProductWithSizes(store, "Dual Guard", DUAL_SIZES);

    const res = await store.ctx.patch(`${APP}/api/admin/products/${id}`, {
      data: { price: 168, sizes: null, stock: 0 },
      failOnStatusCode: false,
    });
    expect(
      res.status(),
      `結構化款式唔准俾 sizes:null 清走（舊 code 會 200 兼清空）：${await res.text()}`,
    ).toBe(409);

    const sizes = await readSizes(store, id);
    expect(
      sizes,
      "dual blob 一定要原封不動 —— 呢個係商戶砌咗成日嘅色 × 碼庫存",
    ).toEqual(DUAL_SIZES);
  });

  test("single {qty,status} blob：modal 式 sizes:null → 409，款式不變", async () => {
    const id = await createProductWithSizes(store, "Single Guard", SINGLE_SIZES);

    const res = await store.ctx.patch(`${APP}/api/admin/products/${id}`, {
      data: { price: 168, sizes: null, stock: 0 },
      failOnStatusCode: false,
    });
    expect(
      res.status(),
      `single 款式一樣唔准俾 sizes:null 清走：${await res.text()}`,
    ).toBe(409);

    const sizes = await readSizes(store, id);
    expect(sizes, "single blob 一定要原封不動").toEqual(SINGLE_SIZES);
  });

  test("明示 clearVariants:true → 200，真係清得走（逃生門要通）", async () => {
    const id = await createProductWithSizes(store, "Clear Escape", DUAL_SIZES);

    const res = await store.ctx.patch(`${APP}/api/admin/products/${id}`, {
      data: { sizes: null, clearVariants: true },
      failOnStatusCode: false,
    });
    expect(
      res.status(),
      `明示清空一定要通，否則商戶永遠改唔返款式：${await res.text()}`,
    ).toBe(200);

    const sizes = await readSizes(store, id);
    expect(sizes, "明示清空之後應該係 null").toBeNull();
  });

  test("legacy {\"US 9\": 3}：sizes:null 照樣清得走（唔准矯枉過正）", async () => {
    const id = await createProductWithSizes(store, "Legacy Clear", LEGACY_SIZES);

    const res = await store.ctx.patch(`${APP}/api/admin/products/${id}`, {
      data: { sizes: null, stock: 0 },
      failOnStatusCode: false,
    });
    expect(
      res.status(),
      `legacy 碼表係 modal 自己揸旗，uncheck 晒就要清得走：${await res.text()}`,
    ).toBe(200);

    const sizes = await readSizes(store, id);
    expect(sizes, "legacy 清空之後應該係 null").toBeNull();
  });
});
