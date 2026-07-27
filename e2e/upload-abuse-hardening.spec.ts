// API-only spec → 直接用 @playwright/test（同 payment-proof-ownership.spec.ts 一樣）。
import { test, expect, request as apiRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { APP, uid } from "./helpers";

/**
 * /api/upload abuse hardening。
 *
 * 真 bug（修之前）：`POST /api/upload` 零 auth / 零 tenant scope / 零 rate-limit —
 * 任何人可以反覆上載 5MB 圖片灌爆 Cloudinary quota，兼且 `folder` 由 client 任意
 * 指定（folder injection）。
 *
 * 而家：intent-based、server-authoritative。
 *   • intent="admin"         → 要 tenant-admin JWT，folder 綁 tenantId。
 *   • intent="payment-proof" → 要 order id + 落單電話對得上一張 PENDING 單。
 *   • folder 一律 server 決定，client 唔准指定。
 *   • 授權 / 驗檔全過先至 call Cloudinary uploader。
 *
 * ⚠️ e2e 用假 Cloudinary adapter（UPLOAD_TEST_MODE=1，見 lib/upload/cloudinary.ts）：
 *    合法上載回一條含 "test-fake" 嘅假 secure_url；被拒請求根本行唔到落 adapter，
 *    冇 url = uploader 冇被 call。唔會打真 Cloudinary。
 */

// PNG magic (89 50 4E 47 0D 0A 1A 0A) + padding —— 過 magic-byte sniffer。
const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
]);
// 講自己係 image/png 但 bytes 係 SVG/text —— 偽造 MIME。
const FAKE_MIME_BYTES = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
);

type Authed = { ctx: APIRequestContext; tenantId: string; slug: string };

/** 開一間店，回一個已 auto-login（帶 tenant-admin-token cookie）嘅 ctx。 */
async function registerAuthed(tag: string): Promise<Authed> {
  const run = uid();
  const slug = `e2e-upl-${tag}-${run}`;
  const ctx = await apiRequest.newContext();
  const reg = await ctx.post(`${APP}/api/tenant/register`, {
    data: {
      name: `E2E Upload ${tag.toUpperCase()} ${run}`,
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
  expect(tenantId).toBeTruthy();
  return { ctx, tenantId, slug };
}

/** 開一間店 + 一件貨 + 一張 PENDING 單（冇 paymentProof）。 */
async function seedPendingOrder(
  phone: string,
): Promise<{ orderId: string; slug: string }> {
  const { ctx, tenantId, slug } = await registerAuthed("ord");
  try {
    const prod = await ctx.post(`${APP}/api/admin/products`, {
      headers: { "x-idempotency-key": `${slug}-prod` },
      data: { title: `Proof Item ${slug}`, price: 128, stock: 5 },
    });
    expect(prod.status(), `${slug} 開產品應該 200`).toBe(200);
    const productId = (await prod.json()).data?.id as string;

    const order = await ctx.post(`${APP}/api/biolink/orders`, {
      headers: { "x-idempotency-key": `${slug}-order` },
      data: {
        tenantId,
        items: [{ productId, productName: "Proof Item", qty: 1, price: 128 }],
        customer: { name: "E2E", phone },
        delivery: { method: "meetup", address: null },
        payment: { method: "fps" },
        total: 128,
      },
    });
    expect(order.status(), `${slug} 落單應該 200：${await order.text()}`).toBe(200);
    return { orderId: (await order.json()).data.orderId as string, slug };
  } finally {
    await ctx.dispose();
  }
}

async function anonCtx() {
  return apiRequest.newContext();
}

test.describe("upload abuse hardening", () => {
  test("匿名（冇 auth）admin upload → 401，冇 url", async () => {
    const ctx = await anonCtx();
    try {
      const res = await ctx.post(`${APP}/api/upload`, {
        multipart: {
          intent: "admin",
          file: { name: "x.png", mimeType: "image/png", buffer: VALID_PNG },
        },
        failOnStatusCode: false,
      });
      expect(res.status(), `舊 code 會匿名照收（實際 ${res.status()}）`).toBe(401);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.data?.url, "被拒請求唔應有 url = uploader 冇被 call").toBeFalsy();
    } finally {
      await ctx.dispose();
    }
  });

  test("冇 / 未知 intent（舊式淨傳 folder）→ 400，冇 url", async () => {
    const ctx = await anonCtx();
    try {
      const res = await ctx.post(`${APP}/api/upload`, {
        multipart: {
          // 攻擊者任意指定 folder，冇 intent —— 一律拒，冇匿名上載路徑。
          folder: "../../etc/evil",
          file: { name: "x.png", mimeType: "image/png", buffer: VALID_PNG },
        },
        failOnStatusCode: false,
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).data?.url).toBeFalsy();
    } finally {
      await ctx.dispose();
    }
  });

  test("合法 admin upload → 200 + url", async () => {
    const { ctx } = await registerAuthed("ok");
    try {
      const res = await ctx.post(`${APP}/api/upload`, {
        multipart: {
          intent: "admin",
          file: { name: "qr.png", mimeType: "image/png", buffer: VALID_PNG },
        },
        failOnStatusCode: false,
      });
      expect(res.status(), `合法 admin 一定要入到：${await res.text()}`).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data?.url, "應回 secure_url").toContain("test-fake");
    } finally {
      await ctx.dispose();
    }
  });

  test("偽造 MIME（講 png 但係 SVG bytes）→ 400，冇 url", async () => {
    // 用合法 admin，確保唔係俾 auth 擋 —— 專測 magic-byte 驗證。
    const { ctx } = await registerAuthed("mime");
    try {
      const res = await ctx.post(`${APP}/api/upload`, {
        multipart: {
          intent: "admin",
          file: {
            name: "evil.png",
            mimeType: "image/png",
            buffer: FAKE_MIME_BYTES,
          },
        },
        failOnStatusCode: false,
      });
      expect(res.status(), "偽造 MIME 一定要拒").toBe(400);
      expect((await res.json()).data?.url).toBeFalsy();
    } finally {
      await ctx.dispose();
    }
  });

  test("SVG（declared image/svg+xml）→ 400", async () => {
    const { ctx } = await registerAuthed("svg");
    try {
      const res = await ctx.post(`${APP}/api/upload`, {
        multipart: {
          intent: "admin",
          file: {
            name: "x.svg",
            mimeType: "image/svg+xml",
            buffer: FAKE_MIME_BYTES,
          },
        },
        failOnStatusCode: false,
      });
      expect(res.status(), "SVG 一律唔准").toBe(400);
    } finally {
      await ctx.dispose();
    }
  });

  test("payment-proof：錯電話（跨租戶 IDOR 視角）→ 404，uploader 唔被 call", async () => {
    const o = await seedPendingOrder("61110001");
    const ctx = await anonCtx();
    try {
      const res = await ctx.post(`${APP}/api/upload`, {
        multipart: {
          intent: "payment-proof",
          orderId: o.orderId,
          phone: "69999999", // 打錯
          file: { name: "p.png", mimeType: "image/png", buffer: VALID_PNG },
        },
        failOnStatusCode: false,
      });
      expect(res.status(), "憑證對唔上一律 404，唔做存在性 oracle").toBe(404);
      expect(
        (await res.json()).data?.url,
        "被拒 = uploader 冇被 call，Cloudinary quota 唔會俾陌生人消耗",
      ).toBeFalsy();
    } finally {
      await ctx.dispose();
    }
  });

  test("payment-proof：真客人啱電話 → 200 + url（control）", async () => {
    const o = await seedPendingOrder("61110002");
    const ctx = await anonCtx();
    try {
      const res = await ctx.post(`${APP}/api/upload`, {
        multipart: {
          intent: "payment-proof",
          orderId: o.orderId,
          phone: "61110002",
          file: { name: "p.png", mimeType: "image/png", buffer: VALID_PNG },
        },
        failOnStatusCode: false,
      });
      expect(res.status(), `真客人要入到：${await res.text()}`).toBe(200);
      expect((await res.json()).data?.url).toContain("test-fake");
    } finally {
      await ctx.dispose();
    }
  });

  test("onboarding：合法 QR data URL → register 200（server-side 上載）", async () => {
    const run = uid();
    const slug = `e2e-upl-onbok-${run}`;
    const ctx = await anonCtx();
    try {
      const dataUrl = `data:image/png;base64,${VALID_PNG.toString("base64")}`;
      const res = await ctx.post(`${APP}/api/tenant/register`, {
        data: {
          name: `Onboard OK ${run}`,
          slug,
          email: `${slug}@example.com`,
          password: "E2e-passw0rd-1234",
          whatsapp: "+85291234567",
          paymentMethods: ["fps", "payme"],
          fpsId: "91234567",
          paymeQrUrl: dataUrl,
          templateId: "matcha",
        },
        failOnStatusCode: false,
      });
      expect(res.status(), `合法 QR 應該開到店：${await res.text()}`).toBe(200);
      expect((await res.json()).data?.tenantId).toBeTruthy();
    } finally {
      await ctx.dispose();
    }
  });

  test("onboarding：偽造 MIME QR → register 400，唔燒 slug", async () => {
    const run = uid();
    const slug = `e2e-upl-onbbad-${run}`;
    const ctx = await anonCtx();
    try {
      // 講 image/png 但係 SVG bytes
      const badDataUrl = `data:image/png;base64,${FAKE_MIME_BYTES.toString("base64")}`;
      const res = await ctx.post(`${APP}/api/tenant/register`, {
        data: {
          name: `Onboard Bad ${run}`,
          slug,
          email: `${slug}@example.com`,
          password: "E2e-passw0rd-1234",
          whatsapp: "+85291234567",
          paymentMethods: ["fps", "payme"],
          fpsId: "91234567",
          paymeQrUrl: badDataUrl,
          templateId: "matcha",
        },
        failOnStatusCode: false,
      });
      expect(res.status(), "偽造 QR 應該 400").toBe(400);

      // slug 冇燒：同一個 slug 用合法資料應該仲開得到（400 發生喺 tenant.create 之前）。
      const retry = await ctx.post(`${APP}/api/tenant/register`, {
        data: {
          name: `Onboard Retry ${run}`,
          slug,
          email: `${slug}-retry@example.com`,
          password: "E2e-passw0rd-1234",
          whatsapp: "+85291234567",
          paymentMethods: ["fps"],
          fpsId: "91234567",
          templateId: "matcha",
        },
        failOnStatusCode: false,
      });
      expect(retry.status(), `slug 應該冇被燒：${await retry.text()}`).toBe(200);
    } finally {
      await ctx.dispose();
    }
  });
});
