import { cookies } from "next/headers";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

type Props = { params: Promise<{ locale: string }> };

export default async function StartPage({ params }: Props) {
  const { locale } = await params;

  // Read the one-time Google onboarding email set by the OAuth callback.
  // Using httpOnly cookie avoids exposing the email in the redirect URL.
  const cookieStore = await cookies();
  const googleEmail = cookieStore.get("google_onboard_email")?.value || null;

  return (
    <div className="min-h-screen bg-wlx-cream text-wlx-ink flex flex-col items-center justify-center px-4 py-10 sm:py-12">
      {/* 品牌錨 — 同 landing nav 個 wordmark 一致，俾人知自己喺 WoWlix */}
      <Link
        href={`/${locale}`}
        className="font-wlx-display text-lg tracking-tight text-wlx-ink mb-6"
      >
        WoWlix
      </Link>
      <OnboardingWizard locale={locale as Locale} initialGoogleEmail={googleEmail} />
    </div>
  );
}
