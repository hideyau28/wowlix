/**
 * Admin 圖片上載 rate-limit policy —— 共用 key + policy，唔畀兩條 route 分開 bucket。
 *
 * 兩條 route 都會用商戶身份上載圖片：
 *   • /api/upload            （intent="admin"）
 *   • /api/admin/upload      （legacy authenticated route）
 *
 * 兩邊 **必須用同一個 key + 同一份 policy**，否則同一個 tenant 就有兩個獨立 bucket、
 * 加起嚟等於雙倍額度，rate limit 就被繞過。抽做共用常數／helper，杜絕日後漂移。
 *
 * key 只用 **server 已驗證** 嘅 tenantId（唔係 client 可控），確保 tenant A 灌爆
 * 唔會連累 tenant B（各自獨立 bucket）。
 */

export const ADMIN_UPLOAD_RATE_LIMIT = {
  interval: 60 * 1000, // 1 分鐘滑動窗
  maxRequests: 60,
} as const;

export function adminUploadRateLimitKey(tenantId: string): string {
  return `upload:admin:${tenantId}`;
}
