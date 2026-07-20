"use client";

import ErrorScreen, { errorActionClass } from "@/components/ErrorScreen";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
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
  );
}
