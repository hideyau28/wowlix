import "server-only";
import crypto from "node:crypto";

/**
 * 訂單確認頁嘅「睇得全單」憑證。
 *
 * 背景：呢頁以前對任何人都 render 全單 —— 客人姓名／電話／送貨地址／逐件貨／
 * 金額，零 session 零 ownership 檢查。攞到（或者撞到）一個 order id 就睇晒。
 *
 * 但又唔可以要求登入：checkout 特登容許 guest（`Order.userId` 係 optional），
 * 客人啱啱先俾完錢，迫佢開 account = 直接殺收入。
 *
 * 所以行 grant cookie：checkout 成功之後，**server 自己**核對過張單先派一個
 * 簽名 cookie 落嗰個瀏覽器。冇 grant 嘅人照睇得到單號／狀態／總額（夠佢知單
 * 落成），但敏感欄位一律唔出。
 *
 * ⚠️ 特登用 raw HMAC，唔用 JWT。lib/api/route-helpers.ts 接受任何用
 * TENANT_JWT_SECRET 簽、payload 有 tenantId 嘅 JWT 做 admin auth —— 派張帶
 * tenantId 嘅 JWT 落客人個 browser，等於俾佢 replay 做 admin token（提權）。
 * `{orderId}.{hmac}` 唔係 JWS，任何 auth 路徑都用唔到。
 */

export const ORDER_ACCESS_COOKIE = "wlx_order_access";

/** 30 日 —— 夠客人事後返嚟碌返張單，又唔會永遠有效。 */
export const ORDER_ACCESS_MAX_AGE = 60 * 60 * 24 * 30;

function getSecret(): string | null {
  // JWT_SECRET 係客人 session 用嗰個；TENANT_JWT_SECRET 做後備。
  // 兩個都冇就 return null —— 派唔到 grant，頁面 fail closed 去 summary，
  // 唔會 throw（唔想個確認頁因為 env 漏咗就爆）。
  return process.env.JWT_SECRET || process.env.TENANT_JWT_SECRET || null;
}

function sign(tenantId: string, orderId: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    // 加 domain prefix：呢個簽名淨係代表「睇得呢張單」，
    // 唔可以喺第二個 context 被當成第二種憑證。
    .update(`order-access:v1:${tenantId}:${orderId}`)
    .digest("hex");
}

/** 派 grant 之前一定要 server 自己核實過張單屬於邊個 —— 呢度淨係負責簽。 */
export function mintOrderGrant(
  tenantId: string,
  orderId: string,
): string | null {
  const secret = getSecret();
  if (!secret) return null;
  return `${orderId}.${sign(tenantId, orderId, secret)}`;
}

export function verifyOrderGrant(
  cookieValue: string | undefined,
  tenantId: string,
  orderId: string,
): boolean {
  if (!cookieValue) return false;
  const secret = getSecret();
  if (!secret) return false;

  const sep = cookieValue.lastIndexOf(".");
  if (sep <= 0) return false;

  const gotOrderId = cookieValue.slice(0, sep);
  const gotSig = cookieValue.slice(sep + 1);
  if (gotOrderId !== orderId) return false;

  const wantSig = sign(tenantId, orderId, secret);
  const got = Buffer.from(gotSig, "utf8");
  const want = Buffer.from(wantSig, "utf8");
  // 長度唔同 timingSafeEqual 會 throw，要自己先擋。
  if (got.length !== want.length) return false;
  return crypto.timingSafeEqual(got, want);
}

/** 客人電話 vs 訂單電話：兩邊淨低數字再比，食得返 +852 前綴嘅舊 row。 */
export function phoneMatchesOrder(
  sessionPhone: string | null | undefined,
  orderPhone: string | null | undefined,
): boolean {
  const a = (sessionPhone || "").replace(/\D/g, "");
  const b = (orderPhone || "").replace(/\D/g, "");
  if (a.length < 8 || b.length < 8) return false;
  // 一邊可能存咗 852 前綴，一邊冇 —— 比最後 8 位。
  return a.slice(-8) === b.slice(-8);
}
