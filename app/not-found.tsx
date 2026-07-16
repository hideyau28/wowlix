import Link from "next/link";
import ErrorScreen, { errorActionClass } from "@/components/ErrorScreen";

export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="搵唔到呢個頁面"
      action={
        <Link href="/" className={errorActionClass}>
          返回首頁 / Back to Home
        </Link>
      }
    >
      <p>你搵緊嘅頁面唔存在或者已經搬咗。</p>
      <p>The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
    </ErrorScreen>
  );
}
