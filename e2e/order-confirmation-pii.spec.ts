// API-only 落單 + 用 browser context 睇頁 —— 用 @playwright/test，唔用
// ./fixtures（consoleGuard 係 auto fixture，呢度特登要睇陌生人視角）。
import { test, expect, request as apiRequest } from "@playwright/test";
import { APP, uid } from "./helpers";

/**
 * 訂單確認頁 `/{locale}/orders/{id}`：陌生人唔准讀到客人 PII。
 *
 * 真 bug（修之前）：
 *  ① `actions.ts` 個 server action 行 server-to-server
 *     `fetch(${NEXT_PUBLIC_API_URL}/api/orders/${id})` 淨帶 `x-admin-secret`，
 *     **冇 forward x-tenant-slug** → 收嗰邊 `getTenantId(_req)` 靠 internal URL
 *     個 host 解析 → 永遠 default 店。
 *  ② `page.tsx` **零 session／零 phone／零 ownership 檢查**，攞到 order id 就
 *     render 晒 customerName / phone / 送貨地址 / 逐件貨 / 金額。
 *
 * 而家：陌生人淨係見得單號／狀態／總額（Tier 1 summary）。啱啱落完單嘅瀏覽器
 * 有 checkout 派嘅簽名 grant cookie，照見全單，零阻力。
 *
 * ⚠️ 呢條 spec 特登**唔**驗「見唔見到 __next_error__」之類 —— 舊 code 喺 e2e
 *    harness（冇 ADMIN_SECRET）會短路去 degraded 頁，所以 PII 條要靠「陌生人
 *    見唔見到姓名／地址」嚟分真假，唔可以靠 status code。
 */

const CUSTOMER_NAME_PREFIX = "PII Victim";
const ITEM_NAME_PREFIX = "PII Item";

type Seeded = {
  slug: string;
  orderId: string;
  customerName: string;
  phone: string;
  itemName: string;
};

async function seedOrder(run: string): Promise<Seeded> {
  const slug = `e2e-pii-${run}`;
  const customerName = `${CUSTOMER_NAME_PREFIX} ${run}`;
  const phone = "61110001";
  const itemName = `${ITEM_NAME_PREFIX} ${run}`;
  const ctx = await apiRequest.newContext();
  try {
    const reg = await ctx.post(`${APP}/api/tenant/register`, {
      data: {
        name: `E2E PII ${run}`,
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
      data: { title: itemName, price: 128, stock: 5 },
    });
    expect(prod.status()).toBe(200);
    const productId = (await prod.json()).data?.id as string;

    const order = await ctx.post(`${APP}/api/orders`, {
      headers: { "x-idempotency-key": `${slug}-order` },
      data: {
        customerName,
        phone,
        items: [
          { productId, name: itemName, unitPrice: 128, quantity: 1 },
        ],
        amounts: { subtotal: 128, total: 128, currency: "HKD" },
        // pickup：唔使夾 server 計嘅運費，測試唔會因為運費規則變咗就紅。
        fulfillment: { type: "pickup" },
      },
    });
    expect(
      order.status(),
      `落單應該 200，實際 ${order.status()}：${await order.text()}`,
    ).toBe(200);

    return {
      slug,
      orderId: (await order.json()).data?.id as string,
      customerName,
      phone,
      itemName,
    };
  } finally {
    await ctx.dispose();
  }
}

/**
 * 落單落喺 **default tenant**（localhost 冇 cookie 冇 param 就解做佢）。
 *
 * 點解要special-case：舊 code 個 internal fetch 永遠解做 default 店，所以如果
 * 張單落喺第二間店，舊 code 根本搵唔到張單 → 跌落 degraded 頁 → 條 spec 會
 * 因為「連單號都冇」而紅，PII 嗰幾句斷言**根本行唔到**。落喺 default 店先
 * 兩邊都搵到張單，紅綠差異就淨係嚟自 PII gate 本身。
 */
async function seedOrderOnDefaultTenant(run: string): Promise<Seeded> {
  const defaultSlug = process.env.DEFAULT_TENANT_SLUG || "e2e-default";
  const customerName = `${CUSTOMER_NAME_PREFIX} DEF ${run}`;
  const phone = "62220002";
  const itemName = `${ITEM_NAME_PREFIX} DEF ${run}`;
  const ctx = await apiRequest.newContext();
  try {
    // tenant.setup.ts 用呢個 email/password seed default 店。
    const login = await ctx.post(`${APP}/api/tenant/login`, {
      data: {
        email: `${defaultSlug}-default@example.com`,
        password: "E2e-passw0rd-1234",
      },
    });
    expect(
      login.status(),
      `default 店登入應該 200，實際 ${login.status()}：${await login.text()}`,
    ).toBe(200);

    const prod = await ctx.post(`${APP}/api/admin/products`, {
      headers: { "x-idempotency-key": `pii-def-${run}-prod` },
      data: { title: itemName, price: 128, stock: 5 },
    });
    expect(prod.status()).toBe(200);
    const productId = (await prod.json()).data?.id as string;

    const order = await ctx.post(`${APP}/api/orders`, {
      headers: { "x-idempotency-key": `pii-def-${run}-order` },
      data: {
        customerName,
        phone,
        items: [{ productId, name: itemName, unitPrice: 128, quantity: 1 }],
        amounts: { subtotal: 128, total: 128, currency: "HKD" },
        fulfillment: { type: "pickup" },
      },
    });
    expect(
      order.status(),
      `default 店落單應該 200，實際 ${order.status()}：${await order.text()}`,
    ).toBe(200);

    return {
      slug: defaultSlug,
      orderId: (await order.json()).data?.id as string,
      customerName,
      phone,
      itemName,
    };
  } finally {
    await ctx.dispose();
  }
}

test.describe("訂單確認頁 PII", () => {
  let seeded: Seeded;
  let defaultSeeded: Seeded;

  test.beforeAll(async () => {
    const run = uid();
    seeded = await seedOrder(run);
    defaultSeeded = await seedOrderOnDefaultTenant(run);
  });

  test("default 店張單：陌生人一樣唔准見 PII（PII gate 本身嘅 RED proof）", async ({
    browser,
  }) => {
    // 冇 __dev_tenant cookie → localhost 解做 default 店，
    // 即係舊 code 都搵到張單、會 render 全單。紅綠差異純粹係 PII gate。
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${APP}/en/orders/${defaultSeeded.orderId}`);

    const body = page.locator("body");
    await expect(body, "單號／總額應該照出").toContainText("128");

    await expect(
      body,
      "陌生人唔准見到客人姓名（舊 code 會出）",
    ).not.toContainText(defaultSeeded.customerName);
    await expect(
      body,
      "陌生人唔准見到客人電話（舊 code 會出）",
    ).not.toContainText(defaultSeeded.phone);
    await expect(
      body,
      "陌生人唔准見到買咗乜（舊 code 會出）",
    ).not.toContainText(defaultSeeded.itemName);

    await ctx.close();
  });

  test("陌生人開條 order link → 見到單號／總額，但唔准見姓名、電話、買咗乜", async ({
    browser,
  }) => {
    // 全新 context = 冇 grant cookie、冇 session，即係攻擊者視角。
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await ctx.addCookies([
      { name: "__dev_tenant", value: seeded.slug, domain: "localhost", path: "/" },
    ]);
    await page.goto(`${APP}/en/orders/${seeded.orderId}`);

    const body = page.locator("body");

    // Tier 1 照出 —— 客人要知單落成咗。
    await expect(body, "單號／總額應該照出").toContainText("128");

    // 舊 code 呢三樣全部出晒。
    await expect(
      body,
      "陌生人唔准見到客人姓名",
    ).not.toContainText(seeded.customerName);
    await expect(
      body,
      "陌生人唔准見到客人電話",
    ).not.toContainText(seeded.phone);
    await expect(
      body,
      "陌生人唔准見到買咗乜（逐件貨屬於單嘅內容）",
    ).not.toContainText(seeded.itemName);

    await ctx.close();
  });
});
