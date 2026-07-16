"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import ErrorScreen, { errorActionClass } from "@/components/ErrorScreen";

export default function LocaleNotFound() {
  const pathname = usePathname();
  const locale = pathname?.startsWith("/zh-HK") ? "zh-HK" : "en";
  const t = getDict(locale as Locale);

  return (
    <ErrorScreen
      code="404"
      title={t.errorPage.notFoundTitle}
      action={
        <Link href={`/${locale}`} className={errorActionClass}>
          {t.errorPage.backToHome}
        </Link>
      }
    >
      <p>{t.errorPage.notFoundDesc}</p>
    </ErrorScreen>
  );
}
