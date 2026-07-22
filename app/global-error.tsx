"use client";

import "./globals.css";
import ErrorScreen, { errorActionClass } from "@/components/ErrorScreen";

// Root shell（app/[locale]/layout.tsx —— 而家係 root layout）本身 render 爆嘅
// 最後防線。以前 app/error.tsx 坐喺 root layout 之下、[locale] 之上，接得住
// provider 嘅 render/hydration throw；root shell 搬入 [locale] 之後嗰層冇咗，
// 冇 global-error 就會見 Next 內建無品牌 "Application error"。
// global-error 取代成個 root layout，所以必須自己揸 <html>/<body> + globals.css。
// 字體 variable 唔存在（root layout 已死），font-wlx-display 行 fallback chain，
// 可接受降級。
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-HK">
      <body className="bg-white text-zinc-900 antialiased">
        <ErrorScreen
          code="500"
          title="出咗啲問題"
          action={
            <button onClick={() => reset()} className={errorActionClass}>
              重試 / Try Again
            </button>
          }
        >
          <p>伺服器出現錯誤，請稍後再試。</p>
          <p>An unexpected error occurred. Please try again.</p>
        </ErrorScreen>
      </body>
    </html>
  );
}
