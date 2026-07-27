// GAP B — payment-proof coarse rate limit（查 order 之前）。
// API-only spec → 直接用 @playwright/test。
import { test, expect, request as apiRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { APP, uid } from "./helpers";

/**
 * 真 bug（修之前）：payment-proof miss path 唯一 key 係 client 任意 orderId。攻擊者
 * 每次用 random orderId 就開一個新 per-order bucket，令 `prisma.order.findUnique`
 * 無限次行 —— 冇任何 coarse 上限。
 *
 * 而家：查 order 之前加 coarse limiter（per-IP + 固定 global bucket）。random
 * orderId 輪換會喺 coarse 層食 429，唔會每次都真去 DB lookup；但合法已驗證客人
 * （自己 IP 未爆）仍然入到。per-order miss / success bucket 一律保留。
 *
 * ⚠️ e2e 用假 Cloudinary adapter（UPLOAD_TEST_MODE=1）：合法上載回含 "test-fake"
 *    嘅假 URL，被拒請求根本行唔到落 adapter。
 */

// PNG magic bytes（過 magic-byte sniffer）。
const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
]);

// per-IP coarse cap 係 30/min（見 route.ts PROOF_COARSE_PER_IP）；行多過佢就一定見 429。
const PER_IP_CAP = 30;

/** 每 test / rep 用一個獨一 IP，令 per-IP bucket 隔離、斷言 deterministic。 */
function freshIp(tag: string): string {
  // TEST-NET-3（198.51.100.0/24 保留做文件/測試），加 uid 令唔撞。
  const n = Math.abs(hashUid(`${tag}-${uid()}`)) % 250 + 1;
  return `198.51.100.${n}`;
}
function hashUid(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/** 開一間店，回一個已 auto-login 嘅 ctx + tenantId。 */
async function registerAuthed(tag: string): Promise<{
  ctx: APIRequestContext;
  tenantId: string;
  slug: string;
}> {
  const run = uid();
  const slug = `e2e-uplcoarse-${tag}-${run}`;
  const ctx = await apiRequest.newContext();
  const reg = await ctx.post(`${APP}/api/tenant/register`, {
    data: {
      name: `E2E Coarse ${tag.toUpperCase()} ${run}`,
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

/** 開一間店 + 一件貨 + 一張 PENDING 單。 */
async function seedPendingOrder(phone: string): Promise<{ orderId: string }> {
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
    return { orderId: (await order.json()).data.orderId as string };
  } finally {
    await ctx.dispose();
  }
}

test.describe("GAP B — payment-proof coarse limit", () => {
  test("[critical] random orderId 輪換 → coarse 429（DB lookup 被封頂）", async () => {
    // critical：loop 3 次，每次用全新 IP（乾淨 per-IP bucket）守穩。
    for (let rep = 0; rep < 3; rep++) {
      const ip = freshIp(`rot-${rep}`);
      const ctx = await apiRequest.newContext({
        extraHTTPHeaders: { "x-forwarded-for": ip },
      });
      try {
        let saw404 = false;
        let saw429 = false;
        let blockedBody: unknown = null;
        // 行到超過 per-IP cap；每次 random orderId → 冇 coarse 就永遠 404、永遠唔 429。
        for (let i = 0; i < PER_IP_CAP + 8 && !saw429; i++) {
          const res = await ctx.post(`${APP}/api/upload`, {
            multipart: {
              intent: "payment-proof",
              orderId: `nonexistent-${uid()}`, // 每次都唔同 → 舊 code 每次真去 findUnique
              phone: "60000000", // 合法格式，確保行到 coarse / lookup，唔係俾 400 擋
              file: { name: "p.png", mimeType: "image/png", buffer: VALID_PNG },
            },
            failOnStatusCode: false,
          });
          if (res.status() === 404) saw404 = true;
          if (res.status() === 429) {
            saw429 = true;
            blockedBody = await res.json();
          }
        }
        expect(saw404, `rep ${rep}: 頭幾個 random orderId 應該正常流到 404`).toBe(true);
        expect(
          saw429,
          `rep ${rep}: 修之前 random orderId 輪換永遠唔會 429（冇 coarse 上限）`,
        ).toBe(true);
        expect(
          (blockedBody as { data?: { url?: string } })?.data?.url,
          `rep ${rep}: 被 coarse 擋 = uploader 冇被 call，冇 url`,
        ).toBeFalsy();
      } finally {
        await ctx.dispose();
      }
    }
  });

  test("[critical] 合法已驗證客人喺 coarse layer 下仍然 200 + url", async () => {
    // critical：3 個獨立客人（各自新 IP + 新單），確保 coarse 層冇連累正常流程。
    for (let rep = 0; rep < 3; rep++) {
      const phone = `6111${String(2000 + rep).padStart(4, "0")}`; // 8 位
      const { orderId } = await seedPendingOrder(phone);
      const ip = freshIp(`ok-${rep}`);
      const ctx = await apiRequest.newContext({
        extraHTTPHeaders: { "x-forwarded-for": ip },
      });
      try {
        const res = await ctx.post(`${APP}/api/upload`, {
          multipart: {
            intent: "payment-proof",
            orderId,
            phone,
            file: { name: "p.png", mimeType: "image/png", buffer: VALID_PNG },
          },
          failOnStatusCode: false,
        });
        expect(
          res.status(),
          `rep ${rep}: 合法客人（新 IP）一定要入到：${await res.text()}`,
        ).toBe(200);
        expect((await res.json()).data?.url).toContain("test-fake");
      } finally {
        await ctx.dispose();
      }
    }
  });
});
