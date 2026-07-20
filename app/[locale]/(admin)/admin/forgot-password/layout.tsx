import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth/jwt";

// 真·登入咗（JWT 驗到簽名）先彈返 dashboard —— 唔好喺 middleware 憑
// 「cookie 存在」就彈：揸住 stale/爛 cookie（secret 轉咗、admin 刪咗）
// 嘅人正正係最需要「忘記密碼」呢頁嘅人。
export default async function ForgotPasswordLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("tenant-admin-token")?.value;
  if (token && verifyToken(token)) {
    redirect(`/${locale}/admin`);
  }
  return <>{children}</>;
}
