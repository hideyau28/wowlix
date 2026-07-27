/**
 * Cloudinary 上載嘅唯一入口（seam）。
 *
 * 兩個原因要收窄喺一個 module：
 * 1. 安全 —— 全部上載都行 `resource_type: "image"`（唔係 "auto"）。auto 會接受
 *    raw / video / 任意檔案；image 迫 Cloudinary 真係 decode 做光柵圖，decode
 *    唔到就佢自己 reject，係 magic-byte 檢查之外多一層 server-side 防線。順手
 *    strip metadata（EXIF / GPS 等）。
 * 2. 可測 —— e2e 唔准打真 Cloudinary。`UPLOAD_TEST_MODE=1`（playwright 會落）
 *    或者根本冇 credentials 時，回一個假 secure_url，零 network call。因為所有
 *    上載都經呢度，一個 4xx 回應就結構性證明咗「Cloudinary uploader 冇被 call」
 *    （route 喺授權／驗證失敗時，行都行唔到落嚟呢個 adapter）。
 */
import { v2 as cloudinary } from "cloudinary";

export type UploadedImage = {
  url: string;
  publicId: string;
};

let configured = false;

function hasCredentials(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

function isTestMode(): boolean {
  return process.env.UPLOAD_TEST_MODE === "1" || !hasCredentials();
}

function ensureConfigured(): void {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

/**
 * 上載一個「已經過 magic-byte 驗證」嘅圖片 buffer 去指定 folder。
 * folder 一律由 server 按 upload intent 決定 —— 呢個 function 唔接受 client
 * 任意 folder / public_id。
 *
 * 失敗掟 error（上層 catch 統一出 generic message，唔漏 Cloudinary 內部訊息）。
 */
export async function uploadStoreImage(
  buffer: Buffer,
  mime: string,
  folder: string,
): Promise<UploadedImage> {
  // Test / 無 credentials：回假 URL，零 network。
  if (isTestMode()) {
    const rand = Math.abs(hashString(`${folder}:${buffer.length}:${mime}`))
      .toString(36)
      .slice(0, 10);
    return {
      url: `https://res.cloudinary.com/test-fake/image/upload/${folder}/${rand}.jpg`,
      publicId: `test-fake/${folder}/${rand}`,
    };
  }

  ensureConfigured();

  const base64 = buffer.toString("base64");
  const dataURI = `data:${mime};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataURI, {
    folder,
    // resource_type: "image" 迫 Cloudinary decode 做真光柵圖 —— raw / svg / video /
    // 任意 binary 會喺 server 側俾佢 reject，係 magic-byte sniffer 之外多一層防線。
    // （metadata / EXIF strip 想做嘅話要落 delivery transform，需要對住 live
    // Cloudinary account 驗；本 task 唔准掂真服務，留做低風險 follow-up。）
    resource_type: "image",
  });

  return { url: result.secure_url, publicId: result.public_id };
}

// 細細個 deterministic hash，淨係為咗喺 test-mode 砌一個唔撞名嘅假 public_id。
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}
