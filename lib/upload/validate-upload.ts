/**
 * 上載檔案讀取 + 驗證的唯一共用入口。
 *
 * 兩條 upload route 共用：
 *   • /api/upload            （intent=admin / payment-proof）
 *   • /api/admin/upload      （legacy authenticated route，product / logo / cover 圖）
 *
 * 抽做共用係為咗「唔好兩邊各寫一份驗證，日子有功慢慢漂移」——
 * declared MIME 信唔過，一律睇真實 magic bytes（見 image-signature.ts），
 * fake MIME / SVG / polyglot / raw / video / truncated 一律喺呢度擋。
 */
import { allowedMimeTypes, validateImageBytes } from "@/lib/upload/image-signature";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB，兩條 route 一致

export type ValidatedUpload =
  | { ok: true; buffer: Buffer; mime: string }
  | { ok: false; message: string };

/**
 * 由 multipart formData 讀出 "file"，驗 size / declared MIME / magic bytes。
 * 回 buffer + mime，或者一個可俾 route 砌成 400 嘅 user-facing message。
 * 特登唔綁 NextResponse —— 保持純淨、可單獨測、兩條 route 各自決定點包裝錯誤。
 */
export async function readValidatedFile(
  formData: FormData,
): Promise<ValidatedUpload> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "未有提供檔案 | No file provided" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "檔案太大，最大 5MB | File too large (max 5MB)" };
  }
  if (!allowedMimeTypes().includes(file.type)) {
    return {
      ok: false,
      message: "只接受圖片檔案 (JPG, PNG, WebP, GIF) | Images only",
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Magic-byte 驗證：declared MIME 信唔過，睇真實 header bytes；偽造 MIME / SVG /
  // 任意 binary / truncated 一律拒。
  const check = validateImageBytes(file.type, new Uint8Array(buffer));
  if (!check.ok) {
    return { ok: false, message: "圖片格式無效 | Invalid image file" };
  }
  return { ok: true, buffer, mime: file.type };
}
