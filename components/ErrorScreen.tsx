import type { ReactNode } from "react";

/**
 * 全站共用錯誤畫面（404 / 500 / 店鋪唔存在）。
 *
 * 特登用 base `--wlx-*` token（近白 paper + 近黑 ink，app/globals.css :root）：
 * - 租戶店嘅客見到係中性淺色 —— 唔會俾平台嘅品牌色搶咗間店嘅戲
 * - platform 面同 Ink & Bone marketing 皮同一語言（安靜、editorial）
 *
 * ⚠️ 唔准喺呢度 import marketing fonts（components/marketing/fonts.ts）——
 * error/not-found boundary 係全站共用，會將 Fraunces/NSHK 洩漏落租戶 route。
 */
export default function ErrorScreen({
  code,
  title,
  action,
  children,
  showWordmark = true,
}: {
  code: string;
  title: string;
  action: ReactNode;
  children?: ReactNode;
  showWordmark?: boolean;
}) {
  return (
    <div className="min-h-screen bg-wlx-paper text-wlx-ink flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {showWordmark && (
          <p className="mb-10 text-sm font-semibold tracking-tight text-wlx-ink">
            WoWlix
          </p>
        )}

        <p className="font-wlx-display text-[96px] leading-none tracking-[-0.04em] text-wlx-ink">
          {code}
        </p>
        <div className="mx-auto mt-7 mb-7 h-px w-16 bg-wlx-mist" />

        <h2 className="text-xl font-semibold text-wlx-ink mb-2">{title}</h2>
        <div className="text-wlx-stone text-sm leading-relaxed space-y-1">
          {children}
        </div>

        <div className="mt-9">{action}</div>
      </div>
    </div>
  );
}

/** 錯誤頁 CTA 統一樣式（pill，同 marketing CTA 同形；租戶面睇落係中性黑掣） */
export const errorActionClass =
  "inline-block rounded-full bg-wlx-ink px-8 py-3.5 text-wlx-paper font-semibold text-sm hover:bg-wlx-ink/90 transition-colors cursor-pointer";
