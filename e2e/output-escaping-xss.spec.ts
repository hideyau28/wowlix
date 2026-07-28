import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { escapeHtml, serializeJsonLd } from "../lib/escape";
import { renderReceiptHtml } from "../lib/email";

/**
 * 輸出編碼（output encoding）回歸守門 —— 收據 HTML 同 application/ld+json 兩個
 * 唔同 context 嘅 script injection。
 *
 * RED baseline（fix 前）：
 *  - lib/email.ts renderReceiptHtml 將 customerName/phone/email/item 原文插入
 *    HTML，攻擊者 payload 內嘅 <script>/on*= 會變成真 tag。
 *  - 全部 application/ld+json call site 用 bare JSON.stringify，字串內嘅
 *    </script> 會提早收 script、開新 <script data-xss> sibling。
 *  執行方法：將 lib/escape.ts 兩個 helper 暫時改成 passthrough（escapeHtml=String、
 *  serializeJsonLd=JSON.stringify，即現行 prod 行為），renderReceiptHtml 未接線，
 *  跑呢個 spec → 收據、serializer、結構守門三組全部 RED（見 PR body 貼咗實際輸出）。
 *
 * GREEN（fix 後）：escapeHtml 出 HTML entity、serializeJsonLd 出 JSON \uXXXX escape、
 * email.ts 逐個 dynamic 值 escape、全部 call site 改用 serializeJsonLd。
 *
 * 兩個 context 用唔同編碼：收據用 HTML entity，JSON-LD 用 JSON \u escape —— 唔可撈亂。
 */

// 真實攻擊 payload：閉合 script + 開新 sibling + img onerror handler。
const CLOSING_SCRIPT = `</script><script data-xss>alert(document.domain)</script>`;
const HTML_TAG_ATTACK = `<img src=x onerror="alert('xss')">`;
// 合法非 ASCII，要求 round-trip 唔崩：廣東話 + & 標點 + emoji。
const LEGIT_UNICODE = `陳大文 & 「限量版」波鞋 👟`;

test.describe("收據 HTML — stored XSS 編碼", () => {
  const attackerOrder = {
    id: `e2e-xss-${HTML_TAG_ATTACK}`,
    customerName: `${LEGIT_UNICODE}${HTML_TAG_ATTACK}`,
    phone: `</td></tr><script data-xss>alert(1)</script>`,
    email: `x"@evil.com<script data-xss>1</script>`,
    items: [
      {
        name: `波鞋 ${CLOSING_SCRIPT}`,
        unitPrice: 100,
        quantity: 1,
        size: `<b>US 9</b>`,
        sizeSystem: `US"onmouseover="alert(1)`,
      },
    ],
    amounts: {
      subtotal: 100,
      total: 100,
      currency: `HKD<script data-xss>1</script>`,
    },
    createdAt: "2026-07-28T00:00:00.000Z",
  };

  test("攻擊者資料唔會產生真 tag/script/handler，但廣東話原文顯示得返", async ({
    page,
  }) => {
    const html = renderReceiptHtml(attackerOrder);

    // 冇任何 attacker 造出嚟嘅可執行/注入元素殘留喺 raw markup。
    expect(html).not.toContain("<script data-xss");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain(`onerror="alert`);
    expect(html).not.toContain(`onmouseover="alert`);
    expect(html).not.toContain("</td></tr><script");

    // 用真瀏覽器 parse：受控 doc 骨架有 1 個 script（我哋 wrap 用嘅 marker），
    // attacker payload 唔可以整多個出嚟。
    await page.setContent(
      `<div id="receipt">${html}</div><script id="marker"></script>`,
      { waitUntil: "domcontentloaded" },
    );
    const scriptCount = await page.locator("script").count();
    expect(scriptCount).toBe(1); // 只有 #marker，收據內零 script
    expect(await page.locator("script#marker").count()).toBe(1);
    expect(await page.locator("img[onerror]").count()).toBe(0);
    expect(await page.locator("[onmouseover]").count()).toBe(0);

    // 合法廣東話 + & 標點 emoji 要照顯示（decode 後見到原文）。
    const receiptText = await page.locator("#receipt").innerText();
    expect(receiptText).toContain("陳大文 & 「限量版」波鞋 👟");
  });

  test("escapeHtml 編碼五個字元、保留 Unicode、唔雙重編碼", () => {
    expect(escapeHtml(`<a href="x" data='y'>&`)).toBe(
      "&lt;a href=&quot;x&quot; data=&#39;y&#39;&gt;&amp;",
    );
    // Unicode/廣東話原封不動。
    expect(escapeHtml(LEGIT_UNICODE)).toBe("陳大文 &amp; 「限量版」波鞋 👟");
    // 已 escape 一次唔會再 escape（single-escape）。
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });
});

test.describe("application/ld+json — serializer 編碼", () => {
  const payload = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `波鞋 ${CLOSING_SCRIPT}`,
    description: `${LEGIT_UNICODE} ${HTML_TAG_ATTACK}`,
    sep: "line sep end",
  };

  test("閉合 script payload 無法逃出 <script>，但 JSON.parse round-trip 保留原文", async ({
    page,
  }) => {
    const out = serializeJsonLd(payload);

    // 冇任何 HTML parser breakout 字元 leak 到 raw 輸出。
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("&");
    expect(out).not.toContain(" ");
    expect(out).not.toContain(" ");

    // JSON.parse round-trip：攻擊者字串原文以「資料」形式完整保留。
    expect(JSON.parse(out)).toEqual(payload);

    // 真瀏覽器：塞入 <script type="application/ld+json"> 後唔會多開一個 sibling script。
    await page.setContent(
      `<script type="application/ld+json">${out}</script><script id="marker"></script>`,
      { waitUntil: "domcontentloaded" },
    );
    expect(await page.locator("script").count()).toBe(2); // ld+json + marker
    expect(await page.locator("script[data-xss]").count()).toBe(0);
    // 瀏覽器解析返出嚟個 JSON-LD 內容同原 payload 一致。
    const parsed = await page.evaluate(
      () =>
        JSON.parse(
          document.querySelector('script[type="application/ld+json"]')!
            .textContent || "null",
        ) as unknown,
    );
    expect(parsed).toEqual(payload);
  });

  test("唔用 HTML entity（JSON 內用 \\uXXXX，唔係 &lt;）", () => {
    const out = serializeJsonLd({ x: "<>&" });
    expect(out).toContain("\\u003c");
    expect(out).toContain("\\u003e");
    expect(out).toContain("\\u0026");
    expect(out).not.toContain("&lt;");
    expect(out).not.toContain("&amp;");
  });
});

test.describe("結構守門 — 唔准新增 bare JSON.stringify 注入點", () => {
  test("每個 application/ld+json dangerouslySetInnerHTML 都用 serializeJsonLd", async () => {
    const appDir = path.resolve(__dirname, "../app");

    async function walk(dir: string): Promise<string[]> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const out: string[] = [];
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...(await walk(full)));
        else if (e.name.endsWith(".tsx")) out.push(full);
      }
      return out;
    }

    const files = await walk(appDir);
    const offenders: string[] = [];

    for (const file of files) {
      const src = await fs.readFile(file, "utf8");
      if (!src.includes("application/ld+json")) continue;
      // 逐個 __html: 注入點，睇緊接住嗰段（跨行）有冇 bare JSON.stringify( ——
      // fix 後一律係 serializeJsonLd(，任何新 JSON.stringify( 注入點都會被揪出。
      const re = /__html:\s*/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const window = src.slice(m.index, m.index + 400);
        if (window.includes("JSON.stringify(")) {
          const firstLine = window.split("\n")[0].trim();
          offenders.push(`${path.relative(appDir, file)} :: ${firstLine}`);
        }
      }
    }

    expect(
      offenders,
      `application/ld+json 內仲有 bare JSON.stringify（改用 serializeJsonLd）:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
