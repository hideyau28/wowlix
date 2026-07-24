import { test, expect } from "./fixtures";
import { APP, PLATFORM, loadSharedTenant } from "./helpers";

/**
 * 平台 host 唔准滲出租戶店嘅嘢。
 *
 * live 實測（修之前）：`www.wowlix.com/en/shipping` 個 title 係
 * 「Shipping Policy - B」—— B 係 default 店個名，即係用 WoWlix 條 host
 * 出緊人哋間店嘅政策。`/en/collections` 更加係「My Wishlist - B」，而且
 * 仲擺咗入 sitemap 主動叫 Google index。
 *
 * ⚠️ 平台 shipping/returns 喺 middleware redirect（唔喺 page notFound()）：
 * 呢個 app 個 [locale] layout 好早 stream 咗 <html> 殼，deep (customer) page
 * 先跑到，到時 page 級 redirect()/notFound() 已經變 soft 200（client-side）。
 * middleware 喺 render 前 return，個 307 係硬。
 */

for (const route of ["/en/shipping", "/en/returns"]) {
  test(`platform ${route} redirects to landing (平台冇送貨/退貨政策)`, async ({
    page,
  }) => {
    const res = await page.goto(`${PLATFORM}${route}`);
    // 307 跟到底 → 落 landing（/en，200），唔再係租戶店政策頁
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(`${PLATFORM}/en`);
    // 唔准仲見到店政策內容
    await expect(
      page.getByText(/Ships From|Shipping Options|Return Window/i),
    ).toHaveCount(0);
  });

  test(`tenant ${route} still renders (唔准連租戶面一齊拆)`, async ({
    page,
    context,
  }) => {
    const tenant = loadSharedTenant();
    // localhost 唔係 platform host；用 __dev_tenant cookie 指定測試店
    await context.addCookies([
      {
        name: "__dev_tenant",
        value: tenant.slug,
        domain: "localhost",
        path: "/",
      },
    ]);
    const res = await page.goto(`${APP}${route}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

test("sitemap 唔准再叫 Google index 租戶個人化頁", async ({ request }) => {
  const res = await request.get(`${PLATFORM}/sitemap.xml`);
  expect(res.status()).toBe(200);
  const xml = await res.text();

  // 心願單 / 購物車 / 我嘅訂單 —— 個人化、空、對搜尋者零價值
  for (const leaked of ["/en/collections", "/en/cart", "/en/orders"]) {
    expect(xml, `sitemap 仲有 ${leaked}`).not.toContain(
      `<loc>https://www.wowlix.com${leaked}</loc>`,
    );
  }

  // 真正嘅平台面要在
  for (const kept of ["/en", "/zh-HK", "/en/pricing", "/zh-HK/pricing"]) {
    expect(xml, `sitemap 少咗 ${kept}`).toContain(
      `<loc>https://www.wowlix.com${kept}</loc>`,
    );
  }
});
