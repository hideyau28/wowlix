import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { testSeamEnabled } from "@/lib/test-seam/seam-guard";

export const runtime = "nodejs";

// ⚠️ TEST SEAM —— **fail-closed**。
//
// 淨係為咗 e2e 證明「raw token / email / password 唔會原文出現喺 RateLimitEntry.key」。
// 除非 RATE_LIMIT_TEST_SEAM === "1" **且** 唔喺 Vercel（VERCEL !== "1"，只喺 playwright
// webServer.env 開）—— 一律回 404（同一條唔存在嘅 route 一樣，唔做存在性 oracle）。
// Vercel production／preview build + runtime 都自動 set VERCEL=1，即使有人誤設 flag
// 都 fail-closed → 呢條 route 喺 Vercel 永遠 404，讀唔到任何嘢。
//
// 就算開咗，都只准查 "auth:" namespace 嘅 key、淨係回 key 名（key 本身已係
// fingerprint / 非敏感），take 上限封頂 —— 唔係一個通用 DB reader。

const ALLOWED_PREFIX = "auth:";
const MAX_KEYS = 500;

function disabled() {
  return new NextResponse(null, { status: 404 });
}

// 純決策抽落 testSeamEnabled()：flag=1 且 VERCEL!==1 先開（同 email seam 一致）。
function rateLimitKeysSeamEnabled(): boolean {
  return testSeamEnabled(process.env.RATE_LIMIT_TEST_SEAM, process.env.VERCEL);
}

export async function GET(req: Request) {
  if (!rateLimitKeysSeamEnabled()) return disabled();

  const url = new URL(req.url);
  const prefix = (url.searchParams.get("prefix") || "").trim();

  if (!prefix.startsWith(ALLOWED_PREFIX)) {
    return NextResponse.json(
      { ok: false, error: "prefix must start with 'auth:'" },
      { status: 400 }
    );
  }

  const rows = await prisma.rateLimitEntry.findMany({
    where: { key: { startsWith: prefix } },
    select: { key: true },
    distinct: ["key"],
    take: MAX_KEYS,
  });

  return NextResponse.json({ ok: true, keys: rows.map((r) => r.key) });
}
