// API-only spec → 直接用 @playwright/test（同 upload-abuse-hardening.spec.ts 一致）。
import { test, expect, request as apiRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { APP, uid } from "./helpers";
import { UPLOAD_TEST_FAIL_SENTINEL } from "../lib/upload/cloudinary";
import { ADMIN_UPLOAD_RATE_LIMIT } from "../lib/upload/admin-upload-policy";

/**
 * /api/admin/upload hardening（legacy authenticated route，仍被 ProductEditSheet /
 * ImageUpload / BioLinkDashboard 實際使用）。
 *
 * 真 bug（修之前）：呢條 route 直接 call Cloudinary uploader、`resource_type:"auto"`、
 * 只信 declared MIME、所有 tenant 共用 flat "hk-marketplace" folder、冇 rate limit、
 * provider error 原文回 client。#376 abuse-hardening 漏咗佢。
 *
 * 而家：統一經 uploadStoreImage adapter、server-derived tenant-scoped folder、共用
 * magic-byte validator、共用 per-tenant admin rate bucket（同 /api/upload intent=admin
 * 同一個 key）、provider error 只落 server log、client 一律 generic 500。
 *
 * ⚠️ e2e 用假 Cloudinary adapter（UPLOAD_TEST_MODE=1）：合法上載回含 "test-fake"
 *    嘅假 secure_url，且 url path 內嵌 server 決定嘅 folder（可觀測 tenant scoping）；
 *    被拒請求根本行唔到落 adapter（冇 url = uploader 冇被 call）。唔打真 Cloudinary。
 */

// PNG magic (89 50 4E 47 0D 0A 1A 0A) + padding —— 過 magic-byte sniffer。
const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
]);
// 講 image/png 但 bytes 係 SVG/text —— 偽造 MIME（polyglot / stored-XSS 溫床）。
const FAKE_MIME_BYTES = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
);
// 只有 8 bytes < 12 —— truncated / 唔夠 header。
const TRUNCATED = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// 合法 PNG magic + provider-fail sentinel：過 validator，喺 test adapter 觸發模擬失敗。
const PROVIDER_FAIL_PNG = Buffer.concat([
  VALID_PNG,
  Buffer.from(UPLOAD_TEST_FAIL_SENTINEL),
]);

const LEGACY = `${APP}/api/admin/upload`;
const UNIFIED = `${APP}/api/upload`;

type Authed = { ctx: APIRequestContext; tenantId: string; slug: string };

/** 開一間店，回一個已 auto-login（帶 tenant-admin-token cookie）嘅 ctx。 */
async function registerAuthed(tag: string): Promise<Authed> {
  const run = uid();
  // slug regex 上限 30 字（SLUG_REGEX）—— prefix + tag 保持短，uid 已足夠唯一。
  const slug = `e2e-au-${tag.slice(0, 3)}-${run}`;
  const ctx = await apiRequest.newContext();
  const reg = await ctx.post(`${APP}/api/tenant/register`, {
    data: {
      name: `E2E AdminUpload ${tag.toUpperCase()} ${run}`,
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

async function anonCtx() {
  return apiRequest.newContext();
}

/** 打 legacy /api/admin/upload（唔傳 intent —— 呢條 route 冇 intent 概念）。 */
async function postLegacy(
  ctx: APIRequestContext,
  buffer: Buffer,
  extra: Record<string, unknown> = {},
) {
  return ctx.post(LEGACY, {
    multipart: {
      file: { name: "img.png", mimeType: "image/png", buffer },
      ...extra,
    },
    failOnStatusCode: false,
  });
}

/** 打 unified /api/upload（intent=admin），同一 tenant 應共用同一 rate bucket。 */
async function postUnifiedAdmin(ctx: APIRequestContext, buffer: Buffer) {
  return ctx.post(UNIFIED, {
    multipart: {
      intent: "admin",
      file: { name: "img.png", mimeType: "image/png", buffer },
    },
    failOnStatusCode: false,
  });
}

test.describe("/api/admin/upload hardening", () => {
  test("[critical] 匿名（冇 auth）→ 401，冇 url（uploader 唔被 call）", async () => {
    for (let rep = 0; rep < 3; rep++) {
      const ctx = await anonCtx();
      try {
        const res = await postLegacy(ctx, VALID_PNG);
        expect(res.status(), `rep ${rep}: 匿名一定要 401`).toBe(401);
        const json = await res.json();
        expect(json.ok).toBe(false);
        expect(
          json.data?.url,
          `rep ${rep}: 被拒 = uploader 冇被 call，冇 url`,
        ).toBeFalsy();
      } finally {
        await ctx.dispose();
      }
    }
  });

  test("[critical] 合法 tenant admin → 200 + tenant-scoped folder（不可注入）", async () => {
    for (let rep = 0; rep < 3; rep++) {
      const { ctx, tenantId } = await registerAuthed(`ok${rep}`);
      try {
        // client 特登塞多個 folder 欄位企圖注入 —— server 一律忽略。
        const res = await postLegacy(ctx, VALID_PNG, { folder: "../../etc/evil" });
        expect(res.status(), `rep ${rep}: 合法 admin 要入到：${await res.text()}`).toBe(200);
        const json = await res.json();
        expect(json.ok).toBe(true);
        // 契約：{ ok, data:{ url, publicId, ... } }，三個 caller 只用 url。
        expect(json.data?.url, `rep ${rep}: 應回 secure_url`).toContain("test-fake");
        expect(json.data?.publicId, `rep ${rep}: 應回 publicId`).toBeTruthy();
        // folder = server-derived、tenant-scoped，且唔含 client 注入嘅路徑。
        expect(
          json.data.url,
          `rep ${rep}: folder 要綁已驗證 tenantId`,
        ).toContain(`tenants/${tenantId}/admin`);
        expect(
          json.data.url,
          `rep ${rep}: client folder 不可注入`,
        ).not.toContain("etc/evil");
      } finally {
        await ctx.dispose();
      }
    }
  });

  test("偽造 MIME（講 png 但係 SVG bytes）→ 400，冇 url", async () => {
    const { ctx } = await registerAuthed("mime");
    try {
      const res = await postLegacy(ctx, FAKE_MIME_BYTES);
      expect(res.status(), "偽造 MIME 一定要拒").toBe(400);
      expect((await res.json()).data?.url).toBeFalsy();
    } finally {
      await ctx.dispose();
    }
  });

  test("SVG（declared image/svg+xml）→ 400", async () => {
    const { ctx } = await registerAuthed("svg");
    try {
      const res = await ctx.post(LEGACY, {
        multipart: {
          file: { name: "x.svg", mimeType: "image/svg+xml", buffer: FAKE_MIME_BYTES },
        },
        failOnStatusCode: false,
      });
      expect(res.status(), "SVG 一律唔准").toBe(400);
    } finally {
      await ctx.dispose();
    }
  });

  test("truncated / 唔夠 header 嘅檔案 → 400", async () => {
    const { ctx } = await registerAuthed("trunc");
    try {
      const res = await postLegacy(ctx, TRUNCATED);
      expect(res.status(), "truncated 一律拒").toBe(400);
      expect((await res.json()).data?.url).toBeFalsy();
    } finally {
      await ctx.dispose();
    }
  });

  test("malformed body（JSON content-type，唔係 multipart）→ 400，唔係 500", async () => {
    // 已驗證身份 → 過 auth / rate limit，再喺 formData() parse 失敗 → 應該 safe 400。
    const { ctx } = await registerAuthed("malformed");
    try {
      const res = await ctx.post(LEGACY, {
        data: { not: "a-form" }, // application/json
        failOnStatusCode: false,
      });
      expect(res.status(), `malformed multipart 應該 400 唔係 500：${await res.text()}`).toBe(400);
      expect((await res.json()).data?.url).toBeFalsy();
    } finally {
      await ctx.dispose();
    }
  });

  test("[critical] provider / internal error → generic 500，唔漏內部訊息 / Cloudinary", async () => {
    for (let rep = 0; rep < 3; rep++) {
      const { ctx } = await registerAuthed(`fail${rep}`);
      try {
        // 純 seam：test adapter 見到 sentinel 就掟 error 模擬 provider 失敗，唔打真服務。
        const res = await postLegacy(ctx, PROVIDER_FAIL_PNG);
        expect(res.status(), `rep ${rep}: provider 失敗要 generic 500`).toBe(500);
        const raw = await res.text();
        expect(raw, `rep ${rep}: 唔可以漏內部 error message`).not.toContain(
          "SECRET_should_not_leak",
        );
        expect(raw, `rep ${rep}: 唔可以漏 provider 名`).not.toContain("simulated provider");
        expect(raw.toLowerCase(), `rep ${rep}: 唔可以漏 cloudinary`).not.toContain("cloudinary");
        const json = JSON.parse(raw);
        expect(json.ok).toBe(false);
        expect(json.data?.url, `rep ${rep}: 失敗冇 url`).toBeFalsy();
      } finally {
        await ctx.dispose();
      }
    }
  });

  test("[critical] 同一 tenant 跨兩條 route 共用 rate bucket；tenant B 不受影響", async () => {
    test.slow(); // 需要打到 cap（~60+ 請求）
    const cap = ADMIN_UPLOAD_RATE_LIMIT.maxRequests;
    const A = await registerAuthed("shareA");
    const B = await registerAuthed("shareB");
    try {
      let sawLegacy200 = false;
      let sawUnified200 = false;
      let blocked: { status: number; retryAfter: string | null } | null = null;

      // 交替打兩條 route。若各自獨立 bucket（各 cap 個），每條 route 只行到 ~cap/2 個，
      // 永遠唔會 429；出現 429 = 兩條 route 加起嚟過咗同一個 shared cap。
      for (let i = 0; i < cap + 5 && !blocked; i++) {
        const useLegacy = i % 2 === 0;
        const res = useLegacy
          ? await postLegacy(A.ctx, VALID_PNG)
          : await postUnifiedAdmin(A.ctx, VALID_PNG);
        if (res.status() === 200) {
          if (useLegacy) sawLegacy200 = true;
          else sawUnified200 = true;
        }
        if (res.status() === 429) {
          blocked = {
            status: res.status(),
            retryAfter: res.headers()["retry-after"] ?? null,
          };
        }
      }

      expect(
        sawLegacy200 && sawUnified200,
        "兩條 route 都要成功過（同一 authed tenant 都收）",
      ).toBe(true);
      expect(blocked, "跨兩條 route 加起嚟過 cap → 共用 bucket 觸 429").not.toBeNull();
      expect(blocked!.retryAfter, "429 要帶 Retry-After").toBeTruthy();

      // tenant B 全新 bucket（唔同 key）→ A 灌爆之後 B 仍然入到。
      const bRes = await postLegacy(B.ctx, VALID_PNG);
      expect(bRes.status(), `tenant B 唔應受 A 影響：${await bRes.text()}`).toBe(200);
      expect((await bRes.json()).data?.url).toContain("test-fake");
    } finally {
      await A.ctx.dispose();
      await B.ctx.dispose();
    }
  });
});
