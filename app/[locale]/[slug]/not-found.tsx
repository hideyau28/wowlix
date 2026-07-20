import Link from "next/link";
import ErrorScreen, { errorActionClass } from "@/components/ErrorScreen";

export default function StoreNotFound() {
  return (
    <ErrorScreen
      code="404"
      title="呢間店唔存在"
      action={
        <Link href="/zh-HK/start" className={errorActionClass}>
          免費開店
        </Link>
      }
    >
      <p>搵唔到呢間店鋪，可能已經關閉或者網址有誤。</p>
    </ErrorScreen>
  );
}
