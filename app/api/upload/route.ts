export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { uploadStoreImage } from "@/lib/upload/cloudinary";
import { allowedMimeTypes, validateImageBytes } from "@/lib/upload/image-signature";

// POST /api/upload — 上載圖片去 Cloudinary。
//
// ⚠️ 以前呢條 route 係零 auth / 零 tenant scope / 零 rate-limit：任何人可以反覆
// 上載 5MB 圖片灌爆 Cloudinary quota，兼且 `folder` 由 client 任意指定（folder
// injection）。而家改成 **intent-based、server-authoritative**：
//
//   • folder 一律由 server 按 intent 決定，client 唔准指定 folder / public_id。
//   • intent="admin"        → 要 tenant-admin JWT（authenticateAdmin），綁 tenantId。
//   • intent="payment-proof"→ 要 order id + 落單電話對得上一張 PENDING 單（同
//                             sibling payment-proof/route.ts 一致嘅公開訂單憑證），
//                             folder 綁返嗰張單自己嘅 tenantId。
//
// 上載去 Cloudinary 一定係「授權 + 驗檔」全部過咗之後嘅最後一步 —— 任何 4xx
// 回應都代表 uploader 根本冇被 call（quota 唔會俾未授權請求消耗）。
//
// 注意：onboarding（開店未有 tenant）唔經呢條 route —— 佢冇任何可驗證身份。
// QR 上載改咗喺 /api/tenant/register 內部 server-side 做，憑證 = 完成註冊本身。

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// GAP B — payment-proof 查 order 之前嘅 coarse rate limit。
// 攻擊者每次用 random orderId 都開新 per-order bucket，令 DB order lookup 無限行；
// 呢層喺任何 DB lookup 之前封頂。兩層：
//  • per-IP（best-effort）：x-forwarded-for 係 spoofable，唔當唯一權威，但擋到
//    最普遍嘅單源狂 loop。真客人各有自己 IP bucket，唔會被其他人 DoS。
//  • global（固定 bucket）：就算攻擊者連 IP 都偽造輪換，都封頂「miss path 總 DB
//    lookup 量」。cap 遠高於正常量，正常客人唔會撞到（defense-in-depth，唔作假）。
const PROOF_COARSE_PER_IP = { interval: 60 * 1000, maxRequests: 30 };
const PROOF_COARSE_GLOBAL = { interval: 60 * 1000, maxRequests: 600 };

type UploadIntent = "admin" | "payment-proof";

function badRequest(message: string) {
  return NextResponse.json(
    { ok: false, error: { code: "VALIDATION_ERROR", message } },
    { status: 400 },
  );
}

function notFound() {
  // order 存唔存在、電話啱唔啱 —— 一律同一個 404，唔做存在性 oracle。
  return NextResponse.json(
    { ok: false, error: { code: "NOT_FOUND", message: "找不到訂單 | Order not found" } },
    { status: 404 },
  );
}

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: { code: "UNAUTHORIZED", message: "需要登入 | Authentication required" } },
    { status: 401 },
  );
}

function tooMany() {
  return NextResponse.json(
    { ok: false, error: { code: "RATE_LIMITED", message: "試得太密，請稍後再試 | Too many attempts" } },
    { status: 429 },
  );
}

/**
 * 盡力攞 client IP 做 coarse limiter dimension。x-forwarded-for 第一跳係
 * client 可偽造，所以只當 best-effort（配合 global bucket），唔當唯一權威。
 * 攞唔到（如本地直連）一律 fallback 去共享 "unknown" bucket。
 */
function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/**
 * Coarse pre-lookup guard：喺查 order 之前擋 random-orderId 輪換灌爆 DB lookup。
 * per-IP 先擋單源狂 loop，再過 global bucket 封頂總量。任何一層爆 → 唔畀落 lookup。
 */
async function proofCoarseAllowed(req: NextRequest): Promise<boolean> {
  const perIp = await rateLimit(
    `upload:proof:ip:${clientIp(req)}`,
    PROOF_COARSE_PER_IP,
  );
  if (!perIp.allowed) return false;

  const global = await rateLimit("upload:proof:coarse-global", PROOF_COARSE_GLOBAL);
  return global.allowed;
}

/** 讀 file + 驗 size / MIME / magic bytes。回 buffer + mime 或者一個錯誤 response。 */
async function readValidatedFile(
  formData: FormData,
): Promise<{ buffer: Buffer; mime: string } | { error: NextResponse }> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: badRequest("未有提供檔案 | No file provided") };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: badRequest("檔案太大，最大 5MB | File too large (max 5MB)") };
  }
  if (!allowedMimeTypes().includes(file.type)) {
    return { error: badRequest("只接受圖片檔案 (JPG, PNG, WebP, GIF) | Images only") };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Magic-byte 驗證：declared MIME 信唔過，睇真實 header bytes；偽造 MIME / SVG /
  // 任意 binary 一律拒。
  const check = validateImageBytes(file.type, new Uint8Array(buffer));
  if (!check.ok) {
    return { error: badRequest("圖片格式無效 | Invalid image file") };
  }
  return { buffer, mime: file.type };
}

async function handleAdminUpload(
  req: NextRequest,
  formData: FormData,
): Promise<NextResponse> {
  // 授權：tenant-admin JWT（cookie / bearer）→ tenantId。冇 → authenticateAdmin throw。
  let tenantId: string;
  try {
    const ctx = await authenticateAdmin(req);
    tenantId = ctx.tenantId;
  } catch {
    return unauthorized();
  }
  if (!tenantId) return unauthorized();

  // Defense-in-depth rate limit，key = 已驗證 tenantId（唔係 attacker-controlled）。
  const limit = await rateLimit(`upload:admin:${tenantId}`, {
    interval: 60 * 1000,
    maxRequests: 60,
  });
  if (!limit.allowed) return tooMany();

  const validated = await readValidatedFile(formData);
  if ("error" in validated) return validated.error;

  const uploaded = await uploadStoreImage(
    validated.buffer,
    validated.mime,
    `hk-marketplace/tenants/${tenantId}/store`,
  );
  return NextResponse.json({ ok: true, data: uploaded });
}

async function handlePaymentProofUpload(
  req: NextRequest,
  formData: FormData,
): Promise<NextResponse> {
  // GAP B：coarse limiter 一定要喺任何 DB order lookup 之前 —— random orderId
  // 輪換一律喺呢度封頂，唔會每次都真去 findUnique。
  if (!(await proofCoarseAllowed(req))) return tooMany();

  const orderId = String(formData.get("orderId") || "").trim();
  const phone = String(formData.get("phone") || "").trim();

  if (!orderId) return notFound();
  // 電話 = 憑證，格式同 checkout / payment-proof route 一致（8 位數字）。
  if (!/^\d{8}$/.test(phone)) {
    return badRequest(
      "請輸入落單時嘅 8 位電話號碼 | Enter the 8-digit phone used at checkout",
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, phone: true, tenantId: true },
  });

  // 舊 row 可能存咗 +852 前綴，同 track / payment-proof route 一樣剝走先比。
  const orderPhone = (order?.phone || "").replace(/^\+852/, "").trim();
  const phoneMatches = Boolean(order) && orderPhone === phone;
  // 只有 PENDING 單先俾補截圖（同 payment-proof attach route 一致）。
  const statusOk = order?.status === "PENDING";

  if (!order || !phoneMatches || !statusOk) {
    // ⚠️ Rate limit 擺喺「miss」path（憑證對唔上先計數），key = orderId、只計失敗。
    // 擺喺頂 / 計成功 = 攻擊者揸住 order id 就灌爆 bucket，令啱啱俾完錢嘅客人
    // 永遠上載唔到截圖（用個 fix 嚟做 DoS）。打啱憑證嘅人幾時都入到。
    const miss = await rateLimit(`upload:proof-miss:${orderId}`, {
      interval: 10 * 60 * 1000,
      maxRequests: 10,
    });
    if (!miss.allowed) return tooMany();
    return notFound();
  }

  // 成功 path rate limit：key 綁 orderId（要憑證先掂到），防止已驗證客人狂 spam；
  // 因為要打啱電話先入到呢度，唔會連累第二個客人。
  const okLimit = await rateLimit(`upload:proof:${orderId}`, {
    interval: 10 * 60 * 1000,
    maxRequests: 30,
  });
  if (!okLimit.allowed) return tooMany();

  const validated = await readValidatedFile(formData);
  if ("error" in validated) return validated.error;

  const uploaded = await uploadStoreImage(
    validated.buffer,
    validated.mime,
    `hk-marketplace/tenants/${order.tenantId}/payment-proofs`,
  );
  return NextResponse.json({ ok: true, data: uploaded });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const intent = String(formData.get("intent") || "").trim() as UploadIntent;

    if (intent === "admin") return await handleAdminUpload(req, formData);
    if (intent === "payment-proof") return await handlePaymentProofUpload(req, formData);

    // 冇 / 未知 intent（包括舊 client 淨係傳 folder）一律拒 —— 唔再有匿名上載路徑。
    return badRequest("未知上載類型 | Unknown upload intent");
  } catch (error) {
    // 內部 / Cloudinary error：詳情只落 server log，俾客戶一律 generic，
    // 唔漏 Cloudinary / internal message。
    console.error("[upload] error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "UPLOAD_ERROR", message: "上傳失敗，請稍後再試 | Upload failed" } },
      { status: 500 },
    );
  }
}
