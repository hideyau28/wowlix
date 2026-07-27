export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/admin-auth";
import { rateLimit } from "@/lib/rate-limit";
import { uploadStoreImage } from "@/lib/upload/cloudinary";
import { readValidatedFile } from "@/lib/upload/validate-upload";
import {
  ADMIN_UPLOAD_RATE_LIMIT,
  adminUploadRateLimitKey,
} from "@/lib/upload/admin-upload-policy";

// POST /api/admin/upload — 商戶後台上載圖片（product / logo / cover）。
//
// ⚠️ 修之前呢條 route 直接 call Cloudinary uploader、`resource_type:"auto"`、只信
// declared MIME、所有 tenant 共用 flat "hk-marketplace" folder、冇 rate limit、
// provider error 原文回 client。#376 abuse-hardening 漏咗佢（佢仍被 ProductEditSheet /
// ImageUpload / BioLinkDashboard 使用）。
//
// 而家同 /api/upload（intent="admin"）睇齊：
//   • 授權：authenticateAdmin(req) → server-derived tenantId。冇 → 401/403。
//   • folder 一律 server 按 tenantId 決定（tenant-scoped），client 唔准指定 folder。
//   • 一律經 uploadStoreImage adapter（resource_type:"image"、metadata strip、test seam）
//     —— route 唔直接掂 Cloudinary（見 e2e/upload-direct-provider-guard 結構守衛）。
//   • 檔案經共用 magic-byte validator（fake MIME / SVG / polyglot / truncated 拒 400）。
//   • per-tenant admin rate bucket，同 /api/upload intent="admin" **共用同一個 key**，
//     唔畀分開 route 繞過雙倍額度。429 帶 Retry-After。
//   • provider / internal error 只落 server log，client 一律 generic 500（唔漏內部訊息）。
//
// 契約保持：{ ok, data:{ url, publicId, width?, height? } } —— 三個 caller 只用 url。

function jsonError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  // 1) 授權 → server-derived tenantId（唔係 client 可控）。
  let tenantId: string;
  try {
    const ctx = await authenticateAdmin(req);
    tenantId = ctx.tenantId;
  } catch (error) {
    // authenticateAdmin 掟 ApiError { status, code, message } —— 保留原 status（401/403）。
    if (error && typeof error === "object" && "status" in error) {
      const e = error as { status: number; code?: string; message?: string };
      return jsonError(
        e.status,
        e.code || "UNAUTHORIZED",
        e.message || "Authentication required",
      );
    }
    return jsonError(401, "UNAUTHORIZED", "Authentication required");
  }
  if (!tenantId) return jsonError(401, "UNAUTHORIZED", "Authentication required");

  // 2) 共用 per-tenant admin rate bucket（同 /api/upload intent="admin" 同一 key）。
  const limit = await rateLimit(
    adminUploadRateLimitKey(tenantId),
    ADMIN_UPLOAD_RATE_LIMIT,
  );
  if (!limit.allowed) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: "試得太密，請稍後再試 | Too many attempts",
        },
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  // 3) 解析 multipart body。壞 body / 錯 content-type（如 JSON）→ safe 400，唔好 500。
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "無效的請求格式 | Malformed multipart form data",
    );
  }

  // 4) 驗檔（size / declared MIME / magic bytes）—— 共用 validator。
  const validated = await readValidatedFile(formData);
  if (!validated.ok) return jsonError(400, "VALIDATION_ERROR", validated.message);

  // 5) 上載：folder server-derived、tenant-scoped；uploader 只喺呢個 seam 之內。
  try {
    const uploaded = await uploadStoreImage(
      validated.buffer,
      validated.mime,
      `hk-marketplace/tenants/${tenantId}/admin`,
    );
    return NextResponse.json({ ok: true, data: uploaded });
  } catch (error) {
    // provider / internal error：詳情只落 server log，client 一律 generic 500，
    // 唔漏 Cloudinary / secret / 內部訊息。
    console.error("[admin/upload] provider error:", error);
    return jsonError(500, "UPLOAD_ERROR", "上傳失敗，請稍後再試 | Upload failed");
  }
}
