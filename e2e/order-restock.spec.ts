// API-only spec → 直接用 @playwright/test（同 variant-tenant-isolation.spec.ts
// 一樣）。./fixtures 個 consoleGuard 係 auto fixture 兼依賴 `page`，用咗每條
// test 都會開多個冇用嘅 browser page。
import { test, expect, request as apiRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { APP, uid } from "./helpers";

/**
 * 訂單死咗要還庫存（WS4）。
 *
 * 真 bug（修之前）：落單會扣庫存，但**冇任何一條路**會還返 —— 客人落完單唔俾錢、
 * 商戶撳「取消」，嗰幾件貨就永遠鎖死喺一張死單度。賣得越耐，帳面庫存同倉底
 * 差得越遠，最後商戶要自己逐件貨手動加返。
 *
 * 修法（三個唔可以行返轉頭嘅決定）：
 *
 * 1. **還貨嘅 trigger 係「張單入咗死狀態」，唔係「付款俾人拒絕」。**
 *    死狀態 = CANCELLED / PAYMENT_REJECTED（兩個都係 terminal，冇 outgoing
 *    transition）。付款拒絕（`PATCH /api/orders/:id/payment` action=reject）
 *    **特登唔還貨** —— 撳完之後張單仲係 PENDING_CONFIRMATION，admin 個
 *    「確認收款」掣照樣喺度撳得（payment-actions.tsx:181-192）。客人影錯螢幕
 *    截圖、商戶拒一拒等佢重發，係真實流程；喺嗰刻放貨返上架 = 同一張單之後
 *    一撳確認就要出一件冇咗嘅貨（超賣）。庫存喺張單仲生存嘅時候一定要鎖住。
 *
 * 2. **防雙重還貨唔使加 column** —— 靠 status CAS：`updateMany` 個 where 帶住
 *    「而家係邊個 status」，贏咗（count===1）先還貨。CANCELLED / PAYMENT_REJECTED
 *    係 terminal，所以一張單一世只入得一次死狀態 → 最多還一次。
 *
 * 3. **舊單唔還貨** —— 還幾多、還去邊，係讀返落單嗰陣寫落 `items` 嘅
 *    `stockSource` marker（variant / product / combination）。冇 marker 嘅舊單
 *    一律跳過：寧願少還（商戶自己加返）都唔可以憑估亂加（憑空變出貨 = 超賣）。
 *
 * 另外驗埋 idempotency 原子性：`idempotencyKey.create` 以前喺 transaction
 * **外面**，同一條 key 並發入嚟兩張都過得 findFirst → 扣兩次庫存、開兩張單，
 * 輸嗰個仲會食 P2002 500。而家搬咗入 tx，輸嗰個成個 tx rollback 再回讀贏家
 * 嗰份 responseJson。
 */

type Store = {
  ctx: APIRequestContext;
  slug: string;
  tenantId: string;
};

const CUSTOMER = { name: "E2E RSK", phone: "61110003" };
const PRICE = 128;
const COMBO = "黑|M";

async function registerStore(run: string): Promise<Store> {
  const slug = `e2e-rsk-${run}`;
  const ctx = await apiRequest.newContext();
  const reg = await ctx.post(`${APP}/api/tenant/register`, {
    data: {
      name: `E2E RSK ${run}`,
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
    "admin PATCH / /api/orders JWT path 靠 register 個 auto-login cookie",
  ).toBe(true);
  return { ctx, slug, tenantId };
}

async function createProduct(store: Store, title: string): Promise<string> {
  const res = await store.ctx.post(`${APP}/api/admin/products`, {
    headers: { "x-idempotency-key": `${store.slug}-${title}-${uid()}` },
    data: { title, price: PRICE, stock: 0 },
  });
  expect(res.status(), `開產品 ${title} 應該 200`).toBe(200);
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
  expect(res.status(), `開 variant ${name} 應該 200`).toBe(200);
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

/** /api/orders 落單 —— 用 store 個 admin JWT cookie 鎖定 tenant。 */
async function apiOrder(
  store: Store,
  item: { productId: string; variantId?: string; quantity: number },
  opts: { paymentProof?: string; idempotencyKey?: string } = {},
): Promise<{ status: number; orderId: string | null; text: string }> {
  const subtotal = PRICE * item.quantity;
  const res = await store.ctx.post(`${APP}/api/orders`, {
    headers: {
      "x-idempotency-key": opts.idempotencyKey || `rsk-orders-${uid()}`,
    },
    data: {
      customerName: CUSTOMER.name,
      phone: CUSTOMER.phone,
      items: [
        {
          productId: item.productId,
          ...(item.variantId ? { variantId: item.variantId } : {}),
          name: "RSK Item",
          unitPrice: PRICE,
          quantity: item.quantity,
        },
      ],
      amounts: { subtotal, total: subtotal, currency: "HKD" },
      fulfillment: { type: "pickup" },
      ...(opts.paymentProof ? { paymentProof: opts.paymentProof } : {}),
    },
    failOnStatusCode: false,
  });
  const text = await res.text();
  let orderId: string | null = null;
  try {
    orderId = JSON.parse(text)?.data?.id ?? null;
  } catch {
    /* 非 JSON（例如 500 HTML）就當冇 id */
  }
  return { status: res.status(), orderId, text };
}

/** biolink 落單（tenantId 喺 payload）→ 匿名 context 就係真客人。 */
async function biolinkOrder(item: {
  tenantId: string;
  productId: string;
  variantId?: string;
  variant?: string;
  qty: number;
}): Promise<{ status: number; orderId: string | null; text: string }> {
  const ctx = await apiRequest.newContext();
  try {
    const res = await ctx.post(`${APP}/api/biolink/orders`, {
      headers: { "x-idempotency-key": `rsk-biolink-${uid()}` },
      data: {
        tenantId: item.tenantId,
        items: [
          {
            productId: item.productId,
            ...(item.variantId ? { variantId: item.variantId } : {}),
            ...(item.variant ? { variant: item.variant } : {}),
            productName: "RSK Item",
            qty: item.qty,
            price: PRICE,
          },
        ],
        customer: CUSTOMER,
        delivery: { method: "meetup", address: null },
        payment: { method: "fps" },
        total: PRICE * item.qty,
      },
      failOnStatusCode: false,
    });
    const text = await res.text();
    let orderId: string | null = null;
    try {
      orderId = JSON.parse(text)?.data?.orderId ?? null;
    } catch {
      /* 同上 */
    }
    return { status: res.status(), orderId, text };
  } finally {
    await ctx.dispose();
  }
}

async function patchStatus(
  store: Store,
  orderId: string,
  status: string,
): Promise<{ status: number; text: string }> {
  const res = await store.ctx.patch(`${APP}/api/orders/${orderId}`, {
    data: { status },
    failOnStatusCode: false,
  });
  return { status: res.status(), text: await res.text() };
}

test.describe("訂單死咗要還庫存", () => {
  // Serial：每條 test 都真扣／真還庫存，順序固定令 fail 可重現。
  test.describe.configure({ mode: "serial" });

  let store: Store;

  test.beforeAll(async () => {
    store = await registerStore(uid());
  });

  test.afterAll(async () => {
    await store?.ctx.dispose();
  });

  test("/api/orders 變體單 → 取消 → 庫存還返", async () => {
    const productId = await createProduct(store, "Cancel Variant");
    const variantId = await createVariant(store, productId, "cancel-v", 5);

    const order = await apiOrder(store, { productId, variantId, quantity: 2 });
    expect(order.status, `落單應該 200：${order.text}`).toBe(200);
    expect(order.orderId, "落單應該回 order id").toBeTruthy();

    const afterOrder = await readVariant(store, productId, variantId);
    expect(afterOrder.stock, "落完單應該扣咗 2").toBe(3);

    const cancelled = await patchStatus(store, order.orderId!, "CANCELLED");
    expect(cancelled.status, `取消應該 200：${cancelled.text}`).toBe(200);

    const afterCancel = await readVariant(store, productId, variantId);
    expect(
      afterCancel.stock,
      "取消咗張單就要還返嗰 2 件（舊 code 會永遠停喺 3）",
    ).toBe(5);
  });

  test("取消完再取消 → 唔會還多一次", async () => {
    const productId = await createProduct(store, "Double Cancel");
    const variantId = await createVariant(store, productId, "double-v", 5);

    const order = await apiOrder(store, { productId, variantId, quantity: 2 });
    expect(order.status, `落單應該 200：${order.text}`).toBe(200);

    const first = await patchStatus(store, order.orderId!, "CANCELLED");
    expect(first.status, `第一次取消應該 200：${first.text}`).toBe(200);

    // 再撳一次「取消」（refresh 慢咗、兩個 tab、重複 request 都會出現）。
    await patchStatus(store, order.orderId!, "CANCELLED");

    const after = await readVariant(store, productId, variantId);
    expect(
      after.stock,
      "還一次就夠 —— 5，唔可以變 7（憑空多咗 2 件貨 = 超賣）",
    ).toBe(5);
  });

  test("PAYMENT_REJECTED 一樣要還貨（都係 terminal 死狀態）", async () => {
    const productId = await createProduct(store, "Payment Rejected");
    const variantId = await createVariant(store, productId, "payrej-v", 4);

    const order = await apiOrder(
      store,
      { productId, variantId, quantity: 1 },
      { paymentProof: "https://example.com/proof.jpg" },
    );
    expect(order.status, `落單應該 200：${order.text}`).toBe(200);
    expect((await readVariant(store, productId, variantId)).stock).toBe(3);

    const rejected = await patchStatus(
      store,
      order.orderId!,
      "PAYMENT_REJECTED",
    );
    expect(rejected.status, `轉 PAYMENT_REJECTED 應該 200：${rejected.text}`).toBe(
      200,
    );

    const after = await readVariant(store, productId, variantId);
    expect(after.stock, "PAYMENT_REJECTED 係 terminal 死狀態，要還返").toBe(4);
  });

  // ⚠️ Control —— 呢條喺舊 code 都係綠嘅（舊 code 邊度都唔還貨）。佢守嘅唔係
  // 「修好咗」，係「將來有人手多多喺 reject 度加還貨」嗰下要即刻紅。
  test("拒絕付款唔還貨 —— 張單仲生存，一撳「確認收款」就要出到貨", async () => {
    const productId = await createProduct(store, "Reject Keeps Stock");
    const variantId = await createVariant(store, productId, "reject-v", 4);

    const order = await apiOrder(
      store,
      { productId, variantId, quantity: 1 },
      { paymentProof: "https://example.com/proof.jpg" },
    );
    expect(order.status, `落單應該 200：${order.text}`).toBe(200);

    const reject = await store.ctx.patch(
      `${APP}/api/orders/${order.orderId}/payment`,
      { data: { action: "reject", note: "screenshot 影錯" }, failOnStatusCode: false },
    );
    expect(reject.status(), "拒絕付款應該 200").toBe(200);

    const after = await readVariant(store, productId, variantId);
    expect(
      after.stock,
      "拒絕付款唔等於張單死咗 —— 貨要繼續鎖住，唔可以放返上架",
    ).toBe(3);

    // 個「確認收款」掣喺 admin 面照樣撳得（payment-actions.tsx:181-192）——
    // 即係呢張單真係仲可以出貨，證明上面嗰句「唔可以放返上架」唔係空講。
    const confirm = await store.ctx.post(
      `${APP}/api/admin/orders/${order.orderId}/confirm-payment`,
      { failOnStatusCode: false },
    );
    expect(
      confirm.status(),
      "拒絕付款之後張單仲確認得 —— 呢個就係唔准喺嗰刻還貨嘅原因",
    ).toBe(200);
  });

  test("biolink 變體單 → 取消 → 還貨兼重新上架", async () => {
    const productId = await createProduct(store, "Biolink Variant");
    // 得 1 件：賣完會俾落單 route 自動落架（active:false），還貨要一齊救返。
    const variantId = await createVariant(store, productId, "biolink-v", 1);

    const order = await biolinkOrder({
      tenantId: store.tenantId,
      productId,
      variantId,
      qty: 1,
    });
    expect(order.status, `biolink 落單應該 200：${order.text}`).toBe(200);
    expect(order.orderId, "biolink 落單應該回 orderId").toBeTruthy();

    const sold = await readVariant(store, productId, variantId);
    expect(sold.stock, "賣晒應該剩 0").toBe(0);
    expect(sold.active, "賣到 0 就會自動落架").toBe(false);

    const cancelled = await patchStatus(store, order.orderId!, "CANCELLED");
    expect(cancelled.status, `取消應該 200：${cancelled.text}`).toBe(200);

    const after = await readVariant(store, productId, variantId);
    expect(after.stock, "還返嗰件貨").toBe(1);
    expect(
      after.active,
      "有返貨就要重新上架 —— 淨係加返個數但仍然落架 = 客人一樣買唔到",
    ).toBe(true);
  });

  test("biolink 雙維（色 × 碼）單 → 取消 → 格返數兼重新開賣", async () => {
    const productId = await createProduct(store, "Biolink Dual");
    const seed = await store.ctx.patch(`${APP}/api/admin/products/${productId}`, {
      data: {
        sizes: {
          dimensions: ["顏色", "尺碼"],
          options: { 顏色: ["黑"], 尺碼: ["M"] },
          combinations: { [COMBO]: { qty: 1, status: "available" } },
        },
      },
    });
    expect(seed.status(), "寫入 dual sizes 應該 200").toBe(200);

    const order = await biolinkOrder({
      tenantId: store.tenantId,
      productId,
      variant: COMBO,
      qty: 1,
    });
    expect(order.status, `biolink 雙維落單應該 200：${order.text}`).toBe(200);

    const sold = await readCombos(store, productId);
    expect(sold[COMBO]?.qty, "賣晒應該剩 0").toBe(0);
    expect(sold[COMBO]?.status, "扣到 0 就會 hidden").toBe("hidden");

    const cancelled = await patchStatus(store, order.orderId!, "CANCELLED");
    expect(cancelled.status, `取消應該 200：${cancelled.text}`).toBe(200);

    const after = await readCombos(store, productId);
    expect(after[COMBO]?.qty, "格要還返 1").toBe(1);
    expect(
      after[COMBO]?.status,
      "有返貨就要開返個格 —— 一直 hidden 嘅話還咗都冇人買到",
    ).toBe("available");
  });

  test("同一條 idempotency key 並發落單 → 得一張單、庫存只扣一次", async () => {
    const productId = await createProduct(store, "Idempotent Concurrent");
    const variantId = await createVariant(store, productId, "idem-v", 10);
    const key = `rsk-idem-${uid()}`;

    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        apiOrder(
          store,
          { productId, variantId, quantity: 1 },
          { idempotencyKey: key },
        ),
      ),
    );

    const statuses = results.map((r) => r.status);
    expect(
      statuses.every((s) => s === 200),
      `同一條 key 全部都要 200（舊 code 輸嗰個食 P2002 → 500）：${JSON.stringify(statuses)}`,
    ).toBe(true);

    const ids = new Set(results.map((r) => r.orderId));
    expect(
      ids.size,
      `4 個 request 同一條 key 只可以得一張單：${JSON.stringify([...ids])}`,
    ).toBe(1);

    const after = await readVariant(store, productId, variantId);
    expect(
      after.stock,
      "庫存只可以扣一次（舊 code 個 idempotencyKey.create 喺 tx 外面，每個入到嘅 request 都扣一次）",
    ).toBe(9);
  });
});
