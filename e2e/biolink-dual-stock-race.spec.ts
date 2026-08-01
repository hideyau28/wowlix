// API-only spec → 直接用 @playwright/test（同 variant-tenant-isolation.spec.ts
// 一樣）。./fixtures 個 consoleGuard 係 auto fixture 兼依賴 `page`，用咗每條
// test 都會開多個冇用嘅 browser page。
import { test, expect, request as apiRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { APP, uid } from "./helpers";

/**
 * 雙維（色 × 碼）JSONB 庫存 lost update —— 同一格可以賣多過佢有嘅數。
 *
 * 真 bug（修之前）：app/api/biolink/orders/route.ts 個扣庫存 loop 攞嘅
 * `product.sizes` 係 **transaction 外面**嗰個 findMany 讀返嚟嘅 snapshot，
 * 喺 tx 入面 in-place mutate（`combo.qty -= item.qty`）再將成舊 blob 寫返。
 * 兩張同時入嚟嘅單各自喺自己嘅 request 讀到 qty 1，兩邊都通過
 * `combo.qty < item.qty` 呢個 check，兩邊都寫 0 —— 一件貨賣咗兩次。
 * 個 update 個 where 亦都淨係有 `id`，冇 tenantId。
 *
 * 修法：喺 tx 入面 `SELECT "sizes" ... FOR UPDATE` 重讀，行鎖 hold 到 commit；
 * immutable 砌新 blob 再 `updateMany({ where: { id, tenantId } })`。
 * 落鎖次序按 productId 排，避免兩張單交叉鎖出死鎖。
 *
 * ⚠️ 呢條 test 靠真併發。GREEN 方向係確定性嘅（行鎖會 serialize，一定得一張
 * 單入到）；RED 方向係機率性 —— 舊 code 用 6 條並行請求先夠穩定咁重現。
 */

type Store = {
  ctx: APIRequestContext;
  slug: string;
  tenantId: string;
};

const COMBO = "黑|M";
const PRICE = 128;
const CONCURRENCY = 6;

/** 得一格、得一件貨 —— 併發之下最多只可以有一張單入到。 */
const DUAL_ONE_LEFT = {
  dimensions: ["顏色", "尺碼"],
  options: { 顏色: ["黑"], 尺碼: ["M"] },
  combinations: {
    [COMBO]: { qty: 1, status: "available" },
  },
};

async function registerStore(run: string): Promise<Store> {
  const slug = `e2e-dsr-${run}`;
  const ctx = await apiRequest.newContext();
  const reg = await ctx.post(`${APP}/api/tenant/register`, {
    data: {
      name: `E2E DSR ${run}`,
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
  const tenantId = (await reg.json()).data?.tenantId as string;
  expect(tenantId, "register 應該回 tenantId").toBeTruthy();
  return { ctx, slug, tenantId };
}

async function createDualProduct(store: Store): Promise<string> {
  const res = await store.ctx.post(`${APP}/api/admin/products`, {
    headers: { "x-idempotency-key": `${store.slug}-dual-${uid()}` },
    data: { title: "DSR Dual", price: PRICE, stock: 0 },
  });
  expect(res.status(), "開產品應該 200").toBe(200);
  const id = (await res.json()).data?.id as string;

  const seed = await store.ctx.patch(`${APP}/api/admin/products/${id}`, {
    data: { sizes: DUAL_ONE_LEFT },
  });
  expect(seed.status(), "寫入 dual sizes 應該 200").toBe(200);
  return id;
}

/** 攞返件貨而家真正存住嘅 combinations —— 用一個無害 PATCH 嘅 response body 讀。 */
async function readCombos(
  store: Store,
  productId: string,
): Promise<Record<string, { qty: number; status: string }>> {
  const res = await store.ctx.patch(`${APP}/api/admin/products/${productId}`, {
    data: { active: true },
  });
  expect(res.status(), "無害 PATCH 應該 200").toBe(200);
  const sizes = (await res.json()).data?.sizes as {
    combinations: Record<string, { qty: number; status: string }>;
  };
  return sizes?.combinations ?? {};
}

/** biolink 落單（tenantId 喺 payload）→ 匿名 context 就係真客人。 */
async function placeOrder(
  tenantId: string,
  productId: string,
): Promise<number> {
  const ctx = await apiRequest.newContext();
  try {
    const res = await ctx.post(`${APP}/api/biolink/orders`, {
      headers: { "x-idempotency-key": `dsr-${uid()}` },
      data: {
        tenantId,
        items: [
          {
            productId,
            productName: "DSR Dual",
            variant: COMBO,
            qty: 1,
            price: PRICE,
          },
        ],
        customer: { name: "E2E DSR", phone: "61110002" },
        delivery: { method: "meetup", address: null },
        payment: { method: "fps" },
        total: PRICE,
      },
      failOnStatusCode: false,
    });
    return res.status();
  } finally {
    await ctx.dispose();
  }
}

test.describe("雙維 JSONB 庫存唔准超賣", () => {
  // Serial：第二條 test 讀嘅係第一條併發跑完之後嘅狀態。
  test.describe.configure({ mode: "serial" });

  let store: Store;
  let productId: string;

  test.beforeAll(async () => {
    store = await registerStore(uid());
    productId = await createDualProduct(store);
  });

  test.afterAll(async () => {
    await store?.ctx.dispose();
  });

  test(`得 1 件貨、${CONCURRENCY} 張單同時入 → 只可以有 1 張成功`, async () => {
    const statuses = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        placeOrder(store.tenantId, productId),
      ),
    );

    const ok = statuses.filter((s) => s === 200).length;
    expect(
      ok,
      `得 1 件貨就只可以賣出 1 張單（舊 code 會有多過一張入到）：${JSON.stringify(statuses)}`,
    ).toBe(1);

    const rejected = statuses.filter((s) => s === 400).length;
    expect(rejected, "其餘全部要係 400 庫存不足").toBe(CONCURRENCY - 1);
  });

  test("賣剩 0 之後個格要收埋（qty 0 + hidden）", async () => {
    const combos = await readCombos(store, productId);
    expect(combos[COMBO]?.qty, "扣完之後應該剩 0").toBe(0);
    expect(combos[COMBO]?.status, "扣到 0 就要 hidden").toBe("hidden");
  });
});
