/**
 * Cloudinary 上載嘅唯一入口（seam）。
 *
 * 兩個原因要收窄喺一個 module：
 * 1. 安全 —— 全部上載都行 `resource_type: "image"`（唔係 "auto"）。auto 會接受
 *    raw / video / 任意檔案；image 迫 Cloudinary 真係 decode 做光柵圖，decode
 *    唔到就佢自己 reject，係 magic-byte 檢查之外多一層 server-side 防線。順手
 *    strip metadata（EXIF / GPS 等）。
 * 2. 可測 —— e2e 唔准打真 Cloudinary。CI / 本地 e2e 落 `UPLOAD_TEST_MODE=1`
 *    （playwright.config.ts webServer.env），回一個假 secure_url，零 network call。
 *    因為所有上載都經呢度，一個 4xx 回應就結構性證明咗「Cloudinary uploader
 *    冇被 call」（route 喺授權／驗證失敗時，行都行唔到落嚟呢個 adapter）。
 *
 * ⚠️ Fail-loud（唔可以 fail-open）：以前 `isTestMode` 係
 *    `UPLOAD_TEST_MODE===1 || !hasCredentials()` —— production 一旦漏咗 Cloudinary
 *    credentials，就會靜靜雞當 test mode、回一條假 `test-fake` URL，令商戶以為
 *    上載成功但其實冇 asset（data-integrity 坑）。而家假 adapter 只可以由「明確
 *    test flag」啟用，同時用 VERCEL guard 確保就算個 flag 意外流入任何 Vercel
 *    部署（prod / preview）都唔會生效 —— 缺 credentials 一律 fail-loud 掟 error，
 *    上層 catch 出 generic 500 + server log（唔漏內部訊息）。
 */
import { v2 as cloudinary } from "cloudinary";

export type UploadedImage = {
  url: string;
  publicId: string;
};

/** 只需 upload 決策用到嗰幾個 env key —— 抽做參數令 `shouldUseTestAdapter` 可純測。 */
export type UploadEnv = {
  UPLOAD_TEST_MODE?: string;
  VERCEL?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  // index signature：令 `process.env`（ProcessEnv）可以直接傳入。
  [key: string]: string | undefined;
};

let configured = false;

/** 三個 Cloudinary credentials 齊先算「有真 account」。 */
export function hasCloudinaryCredentials(env: UploadEnv): boolean {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME &&
      env.CLOUDINARY_API_KEY &&
      env.CLOUDINARY_API_SECRET,
  );
}

/**
 * 決定用唔用假 test adapter。純函數，方便測全 matrix（唔使真 env / 真服務）。
 *
 * 規則（server-authoritative，唔靠 credentials 有冇嚟決定）：
 *  • 冇明確 `UPLOAD_TEST_MODE=1` → 一定唔 fake（正常 runtime 行真上載）。
 *  • 有 flag 但喺任何 Vercel 部署（`VERCEL==="1"`，prod / preview 都係）→ 一律
 *    唔 fake —— 假 adapter 淨係為 CI / 本地 e2e（呢啲環境冇 VERCEL），就算有人
 *    喺 Vercel env 誤設 flag 都令佢失效，唔會靜靜雞回假 URL。
 *
 * 注意：呢度冇用 `!hasCredentials()` 做條件 —— 本地 e2e 個 shell 可能已經 export
 * 咗真 Cloudinary credentials（.env.production），但我哋仍然唔想打真服務；用
 * VERCEL 而唔係 credentials 做 guard，先至兩邊都啱。
 */
export function shouldUseTestAdapter(env: UploadEnv): boolean {
  if (env.UPLOAD_TEST_MODE !== "1") return false;
  if (env.VERCEL === "1") return false;
  return true;
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
  // 明確 test mode（CI / 本地 e2e）：回假 URL，零 network。
  if (shouldUseTestAdapter(process.env)) {
    const rand = Math.abs(hashString(`${folder}:${buffer.length}:${mime}`))
      .toString(36)
      .slice(0, 10);
    return {
      url: `https://res.cloudinary.com/test-fake/image/upload/${folder}/${rand}.jpg`,
      publicId: `test-fake/${folder}/${rand}`,
    };
  }

  // Fail-loud：唔係 test mode 又冇 credentials，絕不可以偽造成功 URL。掟 error，
  // 上層 catch 統一出 generic 500 + server log（可診斷、唔漏內部訊息）。
  if (!hasCloudinaryCredentials(process.env)) {
    throw new Error(
      "[upload] Cloudinary credentials 缺失：拒絕偽造成功 URL（fail-loud）",
    );
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
