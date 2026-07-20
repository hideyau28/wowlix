"use client";

import { usePathname } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import ErrorScreen, { errorActionClass } from "@/components/ErrorScreen";

export default function LocaleError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const locale = pathname?.startsWith("/zh-HK") ? "zh-HK" : "en";
  const t = getDict(locale as Locale);

  return (
    <ErrorScreen
      code="500"
      title={t.errorPage.errorTitle}
      action={
        <button onClick={() => reset()} className={errorActionClass}>
          {t.errorPage.retry}
        </button>
      }
    >
      <p>{t.errorPage.errorDesc}</p>
    </ErrorScreen>
  );
}
