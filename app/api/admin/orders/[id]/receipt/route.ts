export const runtime = "nodejs";

import { ApiError, withApi } from "@/lib/api/route-helpers";
import { authenticateAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/prisma";
import { promises as fs } from "node:fs";
import path from "node:path";

const RECEIPT_DIR = "/tmp/receipts";

// Order.id 係 Prisma cuid（prisma/schema.prisma:93 @default(cuid())）。
// Next 嘅 route param 係 decodeURIComponent 過先落到 handler
// （node_modules/next/dist/shared/lib/router/utils/route-matcher.js:35），
// 所以 `..%2f...` 會變成真 `../` 再入 path.join → 爬得出 RECEIPT_DIR。
// 先用白名單擋住，唔靠下面個 DB 查詢做唯一防線。
const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const GET = withApi(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { tenantId } = await authenticateAdmin(req);

  const { id } = await params;
  if (!ORDER_ID_PATTERN.test(id)) {
    throw new ApiError(404, "NOT_FOUND", "Receipt not found");
  }

  // 收據 HTML 入面有客人姓名／電話／email／買咗乜／幾錢（lib/email.ts:88-132）。
  // 以前淨係驗「係唔係 admin」就照讀檔，即係任何一間店嘅 admin 揸住條 order id
  // 就讀到第二間店嘅客人資料。一定要確認張單屬於自己間店先俾睇。
  const order = await prisma.order.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!order) {
    throw new ApiError(404, "NOT_FOUND", "Receipt not found");
  }

  // 用 DB 攞返嚟嗰個 id 砌路徑（唔用 raw param）—— 路徑一定係真存在嘅 order id。
  const filePath = path.join(RECEIPT_DIR, `${order.id}.html`);

  try {
    const html = await fs.readFile(filePath, "utf8");
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  } catch {
    throw new ApiError(404, "NOT_FOUND", "Receipt not found");
  }
});
