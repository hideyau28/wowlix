import { NextResponse } from "next/server";
import { emailTestSeamEnabled, readEmailAttempts } from "@/lib/email/test-outbox";
import { fingerprint } from "@/lib/auth/auth-rate-limit";

export const runtime = "nodejs";

// ⚠️ TEST SEAM —— **fail-closed**（同 /api/test-only/rate-limit-keys 同款）。
//
// 淨係為咗 e2e 驗證 forgot-password 嘅 after() reset-email task 有冇執行到。
// 除非 process.env.EMAIL_TEST_SEAM === "1"（只喺 playwright webServer.env 設），
// 一律回 404（唔做存在性 oracle）。Vercel prod 冇呢個 env → 永遠 404，讀唔到嘢。
//
// 就算開咗，都只回某 email fingerprint 嘅 send-attempt 結果數（send / failed），
// 唔存 / 唔回 raw email。

export async function GET(req: Request) {
  if (!emailTestSeamEnabled()) return new NextResponse(null, { status: 404 });

  const url = new URL(req.url);
  const to = (url.searchParams.get("to") || "").trim().toLowerCase();
  if (!to) {
    return NextResponse.json(
      { ok: false, error: "query param 'to' is required" },
      { status: 400 }
    );
  }

  const list = readEmailAttempts(fingerprint(to));
  return NextResponse.json({
    ok: true,
    count: list.length,
    sent: list.filter((a) => a.ok).length,
    failed: list.filter((a) => !a.ok).length,
  });
}
