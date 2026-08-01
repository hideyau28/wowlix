// API-only spec → 直接用 @playwright/test（同 variant-tenant-isolation.spec.ts
// 一樣）。./fixtures 個 consoleGuard 係 auto fixture 兼依賴 `page`，用咗每條
// test 都會開多個冇用嘅 browser page。
import { test, expect, request as apiRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { APP, uid } from "./helpers";

/**
 * Server 重算同客人畫面對唔對數 —— 對唔上就直接 400，張單落唔到。
 *
 * 三條真 bug（修之前）：
 *
 * 1. 順豐智能櫃運費：client 讀 StoreSettings.sfLockerFee（$35，register 就係
 *    咁 seed，register/route.ts:288），但 checkout payload 由頭到尾冇送
 *    `deliveryMethod`，server 個 resolveDeliveryFee 第一步就跳過，跌落
 *    StoreSettings 個 home-delivery branch 收 $40 → "deliveryFee mismatch"
 *    400。subtotal 未夠免運門檻嘅順豐櫃單 100% 埋唔到單。
 *
 * 2. 離島附加費：client 個 district 跟 locale 出（DISTRICTS_ZH / DISTRICTS_EN），
 *    英文版送 "Outlying Islands"，server 淨係認 `region === "離島"` → 少收
 *    $20，client 60 / server 40 → 一樣 400。
 *
 * 3. 變體價：repriceOrder 個 select 冇攞 variants，unitPrice 齋用
 *    product.price。商戶標 $200 嘅碼，客人畫面見 $200
 *    （ProductDetailClient.tsx displayPrice）但 server 重算 $128 →
 *    "subtotal mismatch (repriced)" 400。biolink 嗰邊冇 400 —— 佢 client 都係
 *    送 base price，即係實收少咗，靜靜蝕錢。
 *
 * ⚠️ 全部行 API。/api/orders 個 tenantId 靠 getTenantId(req)，CI webServer 係
 * `next start`（NODE_ENV=production），`?tenant=` dev fallback 熄咗，所以用
 * register 個 auto-login JWT cookie 鎖定 tenant。
 */

type Store = {
  ctx: APIRequestContext;
  slug: string;
  tenantId: string;
};

const BASE_PRICE = 128;
const VARIANT_PRICE = 200;
// register 個 StoreSettings seed：sfLockerFee 35 / homeDeliveryFee 40 /
// homeDeliveryIslandExtra 20 / free above 600。全部要 < 600 先驗到運費。
const SF_LOCKER_FEE = 35;
const HOME_DELIVERY_FEE = 40;
const ISLAND_EXTRA = 20;

async function registerStore(run: string): Promise<Store> {
  const slug = `e2e-rep-${run}`;
  const ctx = await apiRequest.newContext();
  const reg = await ctx.post(`${APP}/api/tenant/register`, {
    data: {
      name: `E2E REP ${run}`,
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
    "/api/orders 個 JWT path 靠 register 個 auto-login cookie",
  ).toBe(true);
  return { ctx, slug, tenantId };
}

async function createProduct(store: Store, title: string): Promise<string> {
  const res = await store.ctx.post(`${APP}/api/admin/products`, {
    headers: { "x-idempotency-key": `${store.slug}-${title}-${uid()}` },
    data: { title, price: BASE_PRICE, stock: 50 },
  });
  expect(res.status(), `開產品 ${title} 應該 200`).toBe(200);
  return (await res.json()).data?.id as string;
}

async function createVariant(
  store: Store,
  productId: string,
  name: string,
  price: number | null,
): Promise<string> {
  const res = await store.ctx.post(
    `${APP}/api/admin/products/${productId}/variants`,
    { data: { name, stock: 20, active: true, price } },
  );
  expect(res.status(), `開 variant ${name} 應該 200`).toBe(200);
  return (await res.json()).data?.id as string;
}

type OrderResult = { status: number; text: string; body: any };

async function postOrder(
  store: Store,
  body: Record<string, unknown>,
): Promise<OrderResult> {
  const res = await store.ctx.post(`${APP}/api/orders`, {
    headers: { "x-idempotency-key": `rep-${uid()}` },
    data: body,
    failOnStatusCode: false,
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* 非 JSON 就靠 text 睇 */
  }
  return { status: res.status(), text, body: parsed };
}

const CUSTOMER = { customerName: "E2E REP", phone: "61110003" };

test.describe("checkout 重算對齊", () => {
  let store: Store;
  let plainProduct: string;
  let variantProduct: string;
  let pricedVariant: string;
  let freeVariant: string;

  test.beforeAll(async () => {
    store = await registerStore(uid());
    plainProduct = await createProduct(store, "Plain");
    variantProduct = await createProduct(store, "Variant Priced");
    pricedVariant = await createVariant(store, variantProduct, "L", VARIANT_PRICE);
    // price null = 冇獨立價，一定要繼續跌返 base price（backward compat）
    freeVariant = await createVariant(store, variantProduct, "M", null);
  });

  test.afterAll(async () => {
    await store?.ctx.dispose();
  });

  test("順豐智能櫃收 sfLockerFee($35)，唔係上門價($40)", async () => {
    const res = await postOrder(store, {
      ...CUSTOMER,
      items: [
        {
          productId: plainProduct,
          name: "Plain",
          unitPrice: BASE_PRICE,
          quantity: 1,
        },
      ],
      amounts: {
        subtotal: BASE_PRICE,
        deliveryFee: SF_LOCKER_FEE,
        total: BASE_PRICE + SF_LOCKER_FEE,
        currency: "HKD",
      },
      fulfillment: {
        type: "delivery",
        deliveryMethod: "sf-locker",
        address: { line1: "SF Locker: H123456", district: "順豐智能櫃" },
      },
    });
    expect(
      res.status,
      `順豐櫃單一定要落到（舊 code 收 $40 → deliveryFee mismatch 400）：${res.text}`,
    ).toBe(200);
  });

  test("英文版離島要收得返 $20 附加費", async () => {
    const res = await postOrder(store, {
      ...CUSTOMER,
      items: [
        {
          productId: plainProduct,
          name: "Plain",
          unitPrice: BASE_PRICE,
          quantity: 1,
        },
      ],
      amounts: {
        subtotal: BASE_PRICE,
        deliveryFee: HOME_DELIVERY_FEE + ISLAND_EXTRA,
        total: BASE_PRICE + HOME_DELIVERY_FEE + ISLAND_EXTRA,
        currency: "HKD",
      },
      fulfillment: {
        type: "delivery",
        deliveryMethod: "home-delivery",
        address: { line1: "1 Test Road", district: "Outlying Islands" },
      },
    });
    expect(
      res.status,
      `英文版離島單一定要落到（舊 code 只認「離島」→ 少收 $20 → 400）：${res.text}`,
    ).toBe(200);
  });

  test("中文版離島照舊收得返（backward compat control）", async () => {
    const res = await postOrder(store, {
      ...CUSTOMER,
      items: [
        {
          productId: plainProduct,
          name: "Plain",
          unitPrice: BASE_PRICE,
          quantity: 1,
        },
      ],
      amounts: {
        subtotal: BASE_PRICE,
        deliveryFee: HOME_DELIVERY_FEE + ISLAND_EXTRA,
        total: BASE_PRICE + HOME_DELIVERY_FEE + ISLAND_EXTRA,
        currency: "HKD",
      },
      fulfillment: {
        type: "delivery",
        deliveryMethod: "home-delivery",
        address: { line1: "1 測試路", district: "離島" },
      },
    });
    expect(res.status, `中文離島唔可以行返轉頭：${res.text}`).toBe(200);
  });

  test("/api/orders：variant 有自己個價就收嗰個價", async () => {
    const res = await postOrder(store, {
      ...CUSTOMER,
      items: [
        {
          productId: variantProduct,
          variantId: pricedVariant,
          name: "Variant Priced · L",
          unitPrice: VARIANT_PRICE,
          quantity: 1,
        },
      ],
      amounts: {
        subtotal: VARIANT_PRICE,
        total: VARIANT_PRICE,
        currency: "HKD",
      },
      fulfillment: { type: "pickup" },
    });
    expect(
      res.status,
      `變體價單一定要落到（舊 code 重算做 $${BASE_PRICE} → subtotal mismatch 400）：${res.text}`,
    ).toBe(200);
  });

  test("/api/orders：variant price 係 null 就跌返 base price（control）", async () => {
    const res = await postOrder(store, {
      ...CUSTOMER,
      items: [
        {
          productId: variantProduct,
          variantId: freeVariant,
          name: "Variant Priced · M",
          unitPrice: BASE_PRICE,
          quantity: 1,
        },
      ],
      amounts: {
        subtotal: BASE_PRICE,
        total: BASE_PRICE,
        currency: "HKD",
      },
      fulfillment: { type: "pickup" },
    });
    expect(
      res.status,
      `冇獨立價嘅 variant 一定要照收 base price，唔可以變咗第二個數：${res.text}`,
    ).toBe(200);
  });

  test("biolink：variant 有自己個價就收嗰個價，唔再靜靜收少", async () => {
    const ctx = await apiRequest.newContext();
    try {
      const res = await ctx.post(`${APP}/api/biolink/orders`, {
        headers: { "x-idempotency-key": `rep-biolink-${uid()}` },
        data: {
          tenantId: store.tenantId,
          items: [
            {
              productId: variantProduct,
              variantId: pricedVariant,
              productName: "Variant Priced",
              variant: "L",
              qty: 1,
              price: VARIANT_PRICE,
            },
          ],
          customer: { name: "E2E REP", phone: "61110003" },
          delivery: { method: "meetup", address: null },
          payment: { method: "fps" },
          total: VARIANT_PRICE,
        },
        failOnStatusCode: false,
      });
      const text = await res.text();
      expect(
        res.status(),
        `biolink 變體價單要落到（舊 code 重算做 $${BASE_PRICE} → total mismatch 400）：${text}`,
      ).toBe(200);
      expect(
        JSON.parse(text).data?.total,
        "收返嘅總數要係變體價，唔係 base price",
      ).toBe(VARIANT_PRICE);
    } finally {
      await ctx.dispose();
    }
  });
});
