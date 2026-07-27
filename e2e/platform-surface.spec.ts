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

// --- 平台 about / faq / contact 出 WoWlix 自己文案，唔好跌落 default 店 ---
// 中英兩個 locale 都驗（zh-HK 係主力語言，係本 PR 嘅 headline deliverable）。
for (const locale of ["en", "zh-HK"]) {
  for (const p of ["about", "faq", "contact"]) {
    const route = `/${locale}/${p}`;
    test(`platform ${route} 出 WoWlix 唔係 default 店（title 唔含「- B」）`, async ({
      page,
    }) => {
      await page.goto(`${PLATFORM}${route}`);
      await expect(page).toHaveTitle(/WoWlix/);
      await expect(page).not.toHaveTitle(/- B$/);
      // <head> 啱唔代表 body 啱 —— 原本個 bug 正正係 body 出咗 default 店文案。
      // about/contact 個 h1 本身帶 WoWlix；faq 個 h1 係「常見問題」，所以驗
      // 副題（platform 版先會寫 WoWlix，租戶版寫店名）。
      if (p === "faq") {
        await expect(page.getByText(/WoWlix/).first()).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          /WoWlix/,
        );
      }
    });

    test(`platform ${route} 有 self-canonical + hreflang（唔好裸奔俾人當 dup）`, async ({
      page,
    }) => {
      await page.goto(`${PLATFORM}${route}`);
      // normalize 同 lib/site-url.ts platformAlternates 一致（非 zh-HK → en）
      const l = locale === "zh-HK" ? "zh-HK" : "en";
      // 用 locator assertion 而唔係 page.getAttribute：canonical 唔見咗會即刻
      // 出 diff，唔會變一個 60 秒 opaque timeout
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `https://www.wowlix.com/${l}/${p}`,
      );
      const langs = await page.$$eval(
        'link[rel="alternate"][hreflang]',
        (els) => els.map((e) => e.getAttribute("hreflang")).sort(),
      );
      expect(langs).toEqual(["en", "x-default", "zh-HK"].sort());
    });
  }
}

// 信用卡老實話 —— 中英各驗一次（zh/en 係兩條唔同 data path + 唔同字串）
for (const t of [
  { locale: "en", q: "How do I get paid?", a: /credit-card checkout is still in the works/i },
  { locale: "zh-HK", q: "我點收錢？", a: /暫時未開放/ },
]) {
  test(`平台 FAQ (${t.locale}) 老實講信用卡未開放（唔好又賣未起好嘅嘢）`, async ({
    page,
  }) => {
    await page.goto(`${PLATFORM}/${t.locale}/faq`);
    // FAQ 係 <details> accordion，答案預設收埋 —— 撳開條「點收錢」問題先
    await page.getByText(t.q).click();
    await expect(page.getByText(t.a)).toBeVisible();
  });
}

for (const p of ["about", "faq", "contact"]) {
  test(`租戶 ${p} 唔准滲入平台文案／唔准 canonical 去平台頁`, async ({
    page,
    context,
  }) => {
    const tenant = loadSharedTenant();
    await context.addCookies([
      { name: "__dev_tenant", value: tenant.slug, domain: "localhost", path: "/" },
    ]);
    await page.goto(`${APP}/en/${p}`);
    // 平台專屬句子唔應該喺租戶店出現
    await expect(page.getByText("0% platform commission")).toHaveCount(0);
    // ⚠️ 呢個先係高危方向：platformAlternates 一旦有人 hoist 出 conditional，
    // 租戶頁就會親口同 Google 講「我係 WoWlix 嗰頁嘅副本」。唔用 toHaveCount(0)
    //（租戶頁第日加自己嘅 self-canonical 係啱嘅），只禁指住平台 URL。
    const hrefs = await page.$$eval(
      'link[rel="canonical"], link[rel="alternate"][hreflang]',
      (els) => els.map((e) => e.getAttribute("href") ?? ""),
    );
    for (const href of hrefs) {
      expect(href, `租戶 ${p} 指住平台 canonical/hreflang`).not.toMatch(
        /^https:\/\/www\.wowlix\.com\/(en|zh-HK)\/(about|faq|contact)$/,
      );
    }
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
  for (const kept of [
    "/en",
    "/zh-HK",
    "/en/pricing",
    "/zh-HK/pricing",
    "/en/about",
    "/zh-HK/about",
    "/en/faq",
    "/zh-HK/faq",
    "/en/contact",
    "/zh-HK/contact",
  ]) {
    expect(xml, `sitemap 少咗 ${kept}`).toContain(
      `<loc>https://www.wowlix.com${kept}</loc>`,
    );
  }
});
