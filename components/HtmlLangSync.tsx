"use client";

import { useEffect } from "react";

/**
 * <html lang> 由 root layout 用 x-locale header set（server），但 SPA
 * client navigation（例如 landing 個 繁↔EN 掣）唔會重新 render root layout —
 * 呢個細 component 喺 locale segment 之下跟住 locale 同步返個 attribute。
 */
export default function HtmlLangSync({ lang }: { lang: string }) {
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
