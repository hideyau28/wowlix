/**
 * Magic-byte sniffing for uploaded images.
 *
 * 為咩存在：`file.type`（MIME）係 client 話俾我哋知嘅，完全信唔過 —— 攻擊者
 * 可以將一個 SVG / HTML / polyglot 檔案 label 做 `image/png` 再上載。淨係比對
 * declared MIME 等於冇驗。呢度睇真實 header bytes 先，同 declared type 對唔上、
 * 或者根本唔係我哋接受嗰幾種光柵圖 → 一律拒。
 *
 * SVG 特登唔支援：佢係 XML，可以夾帶 <script> / onload，喺自己 origin serve
 * 就係 stored XSS 溫床。Cloudinary 亦會當 raw serve。呢度直接當非法。
 */

export type SniffedImageFormat = "jpeg" | "png" | "webp" | "gif";

/** declared MIME → 我哋接受嘅內部格式。SVG 冇份。 */
const MIME_TO_FORMAT: Record<string, SniffedImageFormat> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function allowedMimeTypes(): string[] {
  return Object.keys(MIME_TO_FORMAT);
}

/**
 * 由 buffer header 認出真實圖片格式；認唔到（包括 SVG / 任意 binary）→ null。
 */
export function sniffImageFormat(buf: Uint8Array): SniffedImageFormat | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "png";
  }

  // GIF: "GIF87a" / "GIF89a"
  if (
    buf[0] === 0x47 && // G
    buf[1] === 0x49 && // I
    buf[2] === 0x46 && // F
    buf[3] === 0x38 && // 8
    (buf[4] === 0x37 || buf[4] === 0x39) && // 7 | 9
    buf[5] === 0x61 // a
  ) {
    return "gif";
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 && // R
    buf[1] === 0x49 && // I
    buf[2] === 0x46 && // F
    buf[3] === 0x46 && // F
    buf[8] === 0x57 && // W
    buf[9] === 0x45 && // E
    buf[10] === 0x42 && // B
    buf[11] === 0x50 // P
  ) {
    return "webp";
  }

  return null;
}

export type ImageValidationResult =
  | { ok: true; format: SniffedImageFormat }
  | { ok: false };

/**
 * declared MIME 要喺白名單，而且真實 bytes 要對得返上。任何一項唔啱 → reject。
 */
export function validateImageBytes(
  declaredMime: string,
  buf: Uint8Array,
): ImageValidationResult {
  const expected = MIME_TO_FORMAT[declaredMime];
  if (!expected) return { ok: false };

  const actual = sniffImageFormat(buf);
  if (!actual) return { ok: false };

  // 偽造 MIME（e.g. 講 image/png 但 bytes 係 gif / svg）→ reject。
  if (actual !== expected) return { ok: false };

  return { ok: true, format: actual };
}
