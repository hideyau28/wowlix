// API-only spec → 直接用 @playwright/test（同 slug-policy.spec.ts 一樣）。
// ./fixtures 個 consoleGuard 係 auto fixture 兼依賴 `page`，用咗每條 test 都會
// 開多個冇用嘅 browser page。
import { test, expect, request as apiRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { APP, uid } from "./helpers";

/**
 * 收據租戶隔離：`GET /api/admin/orders/[id]/receipt`。
 *
 * 真 bug（修之前）：route 第 9 行係 `await authenticateAdmin(req);` —— 個
 * AdminContext（入面有 tenantId，lib/auth/admin-auth.ts:5-11）**掉咗唔要**，
 * 跟住直接 `path.join("/tmp/receipts", `${id}.html`)` 讀檔。即係成條 route 只
 * 答到「你係唔係某間店嘅 admin」，從來冇答「呢張單係唔係你間店嘅」。
 *
 * 張收據入面有客人姓名／電話／email／買咗乜／幾錢（lib/email.ts renderReceiptHtml），
 * 所以任何一間店嘅 admin 揸住條 order id 就讀到第二間店嘅客人資料。
 *
 * 第二個窿（同一條 route）：Next 會 decodeURIComponent 個 dynamic param 先落到
 * handler，所以 `..%2f` 會變成真 `../` 再入 path.join —— 爬得出 /tmp/receipts。
 *
 * ⚠️ 點解呢條 spec 喺 e2e 行到但 prod 個 endpoint 本身近乎死咗：
 *    收據寫入 `/tmp/receipts`（lib/email.ts saveReceiptHtml，由 POST /api/orders
 *    叫），而 Vercel 每個 serverless function 有自己嘅 /tmp —— 寫嘅同讀嘅係兩個
 *    function，所以 prod 幾乎一定 404。e2e harness 得一個 next process，兩邊共用
 *    同一個 /tmp，所以呢度驗到真正嘅授權邏輯。**呢條 spec 守嘅係邏輯，唔係
 *    endpoint 嘅可用性。**
 */

type SeededStore = {
  slug: string;
  ctx: APIRequestContext;
  orderId: string;
  customerName: string;
};

/**
 * 開一間店 + 落一件貨 + 落一張真單（POST /api/orders 會順手寫 /tmp/receipts）。
 *
 * 每間店自己一個 APIRequestContext：register 會 auto-login（set
 * tenant-admin-token cookie），兩間店共用一個 context 嘅話第二間會蓋咗第一間
 * 張飛，張單就會落錯店。caller 記得 dispose。
 */
async function seedStoreWithOrder(
  tag: string,
  run: string,
): Promise<SeededStore> {
  const slug = `e2e-rcpt-${tag}-${run}`;
  const customerName = `Rcpt Customer ${tag.toUpperCase()} ${run}`;
  const ctx = await apiRequest.newContext();

  const reg = await ctx.post(`${APP}/api/tenant/register`, {
    data: {
      name: `E2E Rcpt ${tag.toUpperCase()} ${run}`,
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

  const prod = await ctx.post(`${APP}/api/admin/products`, {
    headers: { "x-idempotency-key": `${slug}-prod` },
    data: { title: `Rcpt Item ${run}`, price: 128, stock: 5 },
  });
  expect(prod.status(), `${slug} 開產品應該 200`).toBe(200);
  const productId = (await prod.json()).data?.id as string;
  expect(productId, "產品應該有 id").toBeTruthy();

  // POST /api/orders（唔係 biolink 條）—— 得呢條會叫 saveReceiptHtml
  // （app/api/orders/route.ts:705）。tenant 由 auto-login JWT 決定。
  const order = await ctx.post(`${APP}/api/orders`, {
    headers: { "x-idempotency-key": `${slug}-order` },
    data: {
      customerName,
      phone: "61110001",
      items: [
        { productId, name: `Rcpt Item ${run}`, unitPrice: 128, quantity: 1 },
      ],
      amounts: { subtotal: 128, total: 128, currency: "HKD" },
      fulfillment: { type: "pickup" },
    },
  });
  expect(
    order.status(),
    `${slug} 落單應該 200，實際 ${order.status()}：${await order.text()}`,
  ).toBe(200);
  const orderId = (await order.json()).data?.id as string;
  expect(orderId, "訂單應該有 id").toBeTruthy();

  return { slug, ctx, orderId, customerName };
}

test.describe("收據跨租戶隔離", () => {
  let storeA: SeededStore;
  let storeB: SeededStore;

  test.beforeAll(async () => {
    // slug 喺 beforeAll 即場生 —— CI 有 retries: 2，module-level 生嘅話重跑會
    // register 撞 409，真 failure 就俾 setup 錯誤遮咗。
    const run = uid();
    storeA = await seedStoreWithOrder("a", run);
    storeB = await seedStoreWithOrder("b", run);
  });

  test.afterAll(async () => {
    await storeA?.ctx.dispose();
    await storeB?.ctx.dispose();
  });

  test("A 店 admin 讀自己張單收據 → 200（control）", async () => {
    const res = await storeA.ctx.get(
      `${APP}/api/admin/orders/${storeA.orderId}/receipt`,
      { failOnStatusCode: false },
    );
    expect(
      res.status(),
      "自己間店張單一定要讀得到，否則個 fix 係矯枉過正",
    ).toBe(200);
    expect(await res.text()).toContain(storeA.customerName);
  });

  test("B 店 admin 讀 A 店張單收據 → 404，唔准漏 A 嘅客人資料", async () => {
    const res = await storeB.ctx.get(
      `${APP}/api/admin/orders/${storeA.orderId}/receipt`,
      { failOnStatusCode: false },
    );

    // 舊 code：200 + A 店客人姓名／電話／貨品／金額。
    expect(
      res.status(),
      "B 店唔應該讀到 A 店張收據（跨租戶 IDOR）",
    ).toBe(404);
    expect(
      await res.text(),
      "就算 status 啱，body 都唔准帶 A 店客人個名",
    ).not.toContain(storeA.customerName);
  });

  test("`..%2f` 爬唔出 /tmp/receipts", async () => {
    // `..%2freceipts%2f{id}` 解碼後 = `../receipts/{id}`，path.join 之後會
    // 兜返 /tmp/receipts/{id}.html —— 舊 code 照讀，即係個 param 真係爬得。
    // 呢度用 A 店自己張單，所以 200/404 嘅分別淨係嚟自 traversal 本身，
    // 唔會同上面條租戶 check 撈亂。
    const res = await storeA.ctx.get(
      `${APP}/api/admin/orders/..%2freceipts%2f${storeA.orderId}/receipt`,
      { failOnStatusCode: false },
    );
    expect(
      res.status(),
      "帶 ../ 嘅 order id 一律 404，唔可以靠 path.join 兜返啱",
    ).toBe(404);
  });
});
