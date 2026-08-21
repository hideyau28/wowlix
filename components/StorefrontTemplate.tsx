"use client";

import { useMemo, useEffect, type ReactNode } from "react";
import { getCoverTemplate } from "@/lib/cover-templates";
import { TemplateProvider } from "@/lib/template-context";

type Props = {
  templateId: string;
  children: ReactNode;
};

/**
 * Storefront template wrapper — sets template CSS variables.
 * Fonts are self-hosted via next/font (declared in app/layout.tsx).
 */
export default function StorefrontTemplate({ templateId, children }: Props) {
  const tmpl = useMemo(() => getCoverTemplate(templateId), [templateId]);

  // Set CSS variables for template design tokens
  //
  // 以前呢度仲會 set --tmpl-heading-font / --tmpl-body-font，但全 repo 冇一句
  // CSS 或者 inline style 讀過佢哋（globals.css:37-38 得個 :root default，冇
  // rule 用）—— 寫落 documentElement 一直係 no-op。剷咗佢：template font 嘅
  // CSS variable 已經收窄到 storefront subtree（lib/storefront-fonts.ts），
  // 喺 <html> 度砌一句指住 subtree 先解析得到嘅 var，留低只會呃下一個人。
  useEffect(() => {
    document.documentElement.style.setProperty("--tmpl-accent", tmpl.accent);
  }, [tmpl]);

  return <TemplateProvider value={tmpl}>{children}</TemplateProvider>;
}
