// API-only spec → 直接用 @playwright/test（同 payment-proof-ownership.spec.ts
// 一樣）。./fixtures 個 consoleGuard 係 auto fixture 兼依賴 `page`，用咗每條
// test 都會開多個冇用嘅 browser page。
import { test, expect, request as apiRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { APP, uid } from "./helpers";

/**
 * 跨租戶扣庫存：variantId 一定要屬返 tenantId + 落單嗰件 productId。
 *
 * 真 bug（修之前）：兩條公開落單 route 嘅單一 variant 扣庫存都淨係用
 *   updateMany({ where: { id: item.variantId, stock: { gte } } })
 * ——只驗 productId 屬目前 tenant（repricing 嗰度），但 variantId 完全冇 scope。
 * 攻擊者用 A 店真 productId 夾帶 B 店（或 A 店另一件貨）嘅 variantId：
 *   • app/api/biolink/orders/route.ts ~383（tenantId 喺 payload）
 *   • app/api/orders/route.ts ~631（tenantId 靠 JWT/host）
 * 舊 code 會照 decrement 嗰個外店／外貨嘅 variant，仲會喺 stock<=0 時
 * 幫佢 flip active:false —— 跨租戶篡改庫存 + 上架狀態。
 *
 * 修法：扣庫存同 deactivate 嘅 updateMany where 加 tenantId + productId，
 * 令個原子 guard 自己 enforce ownership（唔使多一個 read 造成 TOCTOU）。
 * 任何 mismatch 就 count===0 → 統一 400，同「庫存不足」同一句，唔做
 * 跨租戶存在性 oracle。
 *
 * ⚠️ 呢條 spec 全部行 API：
 *   • biolink route 個 tenantId 喺 payload，用匿名 context 就攻擊得到。
 *   • /api/orders 個 tenantId 靠 getTenantId(req)。CI webServer 係
 *     `next start`（NODE_ENV=production），resolveTenant 個 `?tenant=` dev
 *     fallback 熄咗，所以特登用 A 店 register 個 auto-login JWT cookie
 *     （getTenantId 個 JWT path）嚟穩定鎖定 tenant = A，local / CI 都行到。
 */

type Store = {
  ctx: APIRequestContext;
  slug: string;
  tenantId: string;
};

async function registerStore(tag: string, run: string): Promise<Store> {
  const slug = `e2e-vti-${tag}-${run}`;
  const ctx = await apiRequest.newContext();
  const reg = await ctx.post(`${APP}/api/tenant/register`, {
    data: {
      name: `E2E VTI ${tag.toUpperCase()} ${run}`,
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
  expect(
    regJson.data?.autoLogin,
    "admin GET / /api/orders JWT path 靠 register 個 auto-login cookie",
  ).toBe(true);
  return { ctx, slug, tenantId };
}

async function createProduct(
  store: Store,
  title: string,
  price: number,
): Promise<string> {
  const res = await store.ctx.post(`${APP}/api/admin/products`, {
    headers: { "x-idempotency-key": `${store.slug}-${title}-${uid()}` },
    data: { title, price, stock: 0 },
  });
  expect(res.status(), `${store.slug} 開產品 ${title} 應該 200`).toBe(200);
  return (await res.json()).data?.id as string;
}

async function createVariant(
  store: Store,
  productId: string,
  name: string,
  stock: number,
): Promise<string> {
  const res = await store.ctx.post(
    `${APP}/api/admin/products/${productId}/variants`,
    { data: { name, stock, active: true } },
  );
  expect(res.status(), `${store.slug} 開 variant ${name} 應該 200`).toBe(200);
  return (await res.json()).data?.id as string;
}

async function readVariant(
  store: Store,
  productId: string,
  variantId: string,
): Promise<{ stock: number; active: boolean }> {
  const res = await store.ctx.get(
    `${APP}/api/admin/products/${productId}/variants`,
  );
  expect(res.status(), "admin GET variants 應該 200").toBe(200);
  const variants = (await res.json()).data?.variants as Array<{
    id: string;
    stock: number;
    active: boolean;
  }>;
  const v = variants?.find((x) => x.id === variantId);
  expect(v, `搵唔返 variant ${variantId}`).toBeTruthy();
  return { stock: v!.stock, active: v!.active };
}

const CUSTOMER = { name: "E2E VTI", phone: "61110001" };

/** biolink 落單（tenantId 喺 payload）→ 匿名 context 已經足夠模擬攻擊者。 */
async function biolinkOrder(
  tenantId: string,
  item: {
    productId: string;
    variantId: string;
    price: number;
    qty: number;
  },
): Promise<{ status: number; text: string }> {
  const ctx = await apiRequest.newContext();
  try {
    const res = await ctx.post(`${APP}/api/biolink/orders`, {
      headers: { "x-idempotency-key": `vti-biolink-${uid()}` },
      data: {
        tenantId,
        items: [
          {
            productId: item.productId,
            variantId: item.variantId,
            productName: "VTI Item",
            qty: item.qty,
            price: item.price,
          },
        ],
        customer: CUSTOMER,
        delivery: { method: "meetup", address: null },
        payment: { method: "fps" },
        total: item.price * item.qty,
      },
      failOnStatusCode: false,
    });
    return { status: res.status(), text: await res.text() };
  } finally {
    await ctx.dispose();
  }
}

/** /api/orders 落單 —— 用 store 個 admin JWT cookie 鎖定 tenant（見檔頭）。 */
async function apiOrder(
  store: Store,
  item: {
    productId: string;
    variantId: string;
    unitPrice: number;
    quantity: number;
  },
): Promise<{ status: number; text: string }> {
  const subtotal = item.unitPrice * item.quantity;
  const res = await store.ctx.post(`${APP}/api/orders`, {
    headers: { "x-idempotency-key": `vti-orders-${uid()}` },
    data: {
      customerName: CUSTOMER.name,
      phone: CUSTOMER.phone,
      items: [
        {
          productId: item.productId,
          variantId: item.variantId,
          name: "VTI Item",
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        },
      ],
      amounts: { subtotal, total: subtotal, currency: "HKD" },
      fulfillment: { type: "pickup" },
    },
    failOnStatusCode: false,
  });
  return { status: res.status(), text: await res.text() };
}

test.describe("跨租戶 / 跨產品 variant 扣庫存隔離", () => {
  // Serial：control（合法單）會真扣庫存，攻擊 test 要驗「完全冇郁」，
  // 每個 mutating test 各用一個獨立 variant，順序固定令 fail 可重現。
  test.describe.configure({ mode: "serial" });

  const PRICE_A = 128;

  let storeA: Store;
  let storeB: Store;

  // Store A
  let prodA: string; // carrier product（攻擊者用嘅「真 productId」）
  let varBiolinkLegit: string; // biolink 合法單 target
  let varOrdersLegit: string; // /api/orders 合法單 target
  let prodA2: string;
  let varA2: string; // 同 tenant、屬另一件貨（biolink mismatch）
  let prodA3: string;
  let varA3: string; // 同 tenant、屬另一件貨（/api/orders mismatch）

  // Store B
  let prodB: string;
  let varB: string; // 跨租戶受害 variant

  test.beforeAll(async () => {
    const run = uid();
    storeA = await registerStore("a", run);
    storeB = await registerStore("b", run);

    prodA = await createProduct(storeA, "Carrier A", PRICE_A);
    varBiolinkLegit = await createVariant(storeA, prodA, "biolink-legit", 5);
    varOrdersLegit = await createVariant(storeA, prodA, "orders-legit", 5);

    prodA2 = await createProduct(storeA, "Second A", 90);
    varA2 = await createVariant(storeA, prodA2, "foreign-biolink", 4);

    prodA3 = await createProduct(storeA, "Third A", 90);
    varA3 = await createVariant(storeA, prodA3, "foreign-orders", 4);

    prodB = await createProduct(storeB, "Victim B", 200);
    varB = await createVariant(storeB, prodB, "cross-tenant-victim", 7);
  });

  test.afterAll(async () => {
    await storeA?.ctx.dispose();
    await storeB?.ctx.dispose();
  });

  // ---- biolink route ----

  test("biolink：A productId + B variantId → 400，B variant 完全不變", async () => {
    const res = await biolinkOrder(storeA.tenantId, {
      productId: prodA,
      variantId: varB,
      price: PRICE_A,
      qty: 1,
    });
    expect(
      res.status,
      `跨租戶扣庫存必須拒單（舊 code 會 200 兼扣咗 B）：${res.text}`,
    ).toBe(400);

    const v = await readVariant(storeB, prodB, varB);
    expect(v.stock, "B 店 variant 庫存唔准俾人跨租戶扣").toBe(7);
    expect(v.active, "B 店 variant active 唔准俾人跨租戶 flip").toBe(true);
  });

  test("biolink：A productId + A 另一件貨 variantId → 400，該 variant 不變", async () => {
    const res = await biolinkOrder(storeA.tenantId, {
      productId: prodA,
      variantId: varA2,
      price: PRICE_A,
      qty: 1,
    });
    expect(
      res.status,
      `product/variant mismatch 必須拒單（舊 code 會扣咗另一件貨）：${res.text}`,
    ).toBe(400);

    const v = await readVariant(storeA, prodA2, varA2);
    expect(v.stock, "屬另一件貨嘅 variant 庫存唔准俾人扣").toBe(4);
  });

  test("biolink：A productId + A 自己 variantId → 200，正常扣庫存（control）", async () => {
    const res = await biolinkOrder(storeA.tenantId, {
      productId: prodA,
      variantId: varBiolinkLegit,
      price: PRICE_A,
      qty: 1,
    });
    expect(
      res.status,
      `合法單一定要入到，否則 fix 係矯枉過正：${res.text}`,
    ).toBe(200);

    const v = await readVariant(storeA, prodA, varBiolinkLegit);
    expect(v.stock, "合法單應該由 5 扣到 4").toBe(4);
  });

  // ---- /api/orders route ----

  test("/api/orders：A productId + B variantId → 400，B variant 完全不變", async () => {
    const res = await apiOrder(storeA, {
      productId: prodA,
      variantId: varB,
      unitPrice: PRICE_A,
      quantity: 1,
    });
    expect(
      res.status,
      `跨租戶扣庫存必須拒單（舊 code 會 200 兼扣咗 B）：${res.text}`,
    ).toBe(400);

    const v = await readVariant(storeB, prodB, varB);
    expect(v.stock, "B 店 variant 庫存唔准俾人跨租戶扣").toBe(7);
    expect(v.active, "B 店 variant active 唔准俾人跨租戶 flip").toBe(true);
  });

  test("/api/orders：A productId + A 另一件貨 variantId → 400，該 variant 不變", async () => {
    const res = await apiOrder(storeA, {
      productId: prodA,
      variantId: varA3,
      unitPrice: PRICE_A,
      quantity: 1,
    });
    expect(
      res.status,
      `product/variant mismatch 必須拒單（舊 code 會扣咗另一件貨）：${res.text}`,
    ).toBe(400);

    const v = await readVariant(storeA, prodA3, varA3);
    expect(v.stock, "屬另一件貨嘅 variant 庫存唔准俾人扣").toBe(4);
  });

  test("/api/orders：A productId + A 自己 variantId → 200，正常扣庫存（control）", async () => {
    const res = await apiOrder(storeA, {
      productId: prodA,
      variantId: varOrdersLegit,
      unitPrice: PRICE_A,
      quantity: 1,
    });
    expect(
      res.status,
      `合法單一定要入到，否則 fix 係矯枉過正：${res.text}`,
    ).toBe(200);

    const v = await readVariant(storeA, prodA, varOrdersLegit);
    expect(v.stock, "合法單應該由 5 扣到 4").toBe(4);
  });
});
