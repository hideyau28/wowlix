"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_NUMBER_REGEX = /[0-9]/;

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = (params.locale as string) || "en";
  const token = searchParams.get("token") || "";
  const dict = getDict(locale as Locale);
  const labels = dict.admin.resetPassword;

  const validatePassword = (pw: string): string | null => {
    if (pw.length < PASSWORD_MIN_LENGTH) return labels.passwordTooShort;
    if (!PASSWORD_NUMBER_REGEX.test(pw)) return labels.passwordNeedsNumber;
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError(labels.invalidToken);
      return;
    }

    const pwError = validatePassword(newPassword);
    if (pwError) {
      setError(pwError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(labels.passwordMismatch);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: newPassword }),
      });

      const data = await res.json();

      if (data.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.replace(`/${locale}/admin/login`);
        }, 2000);
      } else {
        setError(data.error?.message || labels.invalidToken);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const noToken = !token;

  return (
    <div className="min-h-screen flex items-center justify-center bg-wlx-cream px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-wlx-mist p-8">
          {/* Branding */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-wlx-ink text-wlx-paper text-2xl">
                ✦
              </div>
              <span className="text-2xl font-bold text-wlx-ink">WoWlix</span>
            </div>
            <h1 className="text-2xl font-semibold text-wlx-ink">{labels.heading}</h1>
            {!success && !noToken && (
              <p className="text-sm text-wlx-stone mt-1">{labels.description}</p>
            )}
          </div>

          {noToken ? (
            <div className="text-center space-y-4">
              <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                <p className="text-red-600 text-sm font-medium">{labels.invalidToken}</p>
              </div>
              <Link
                href={`/${locale}/admin/forgot-password`}
                className="block text-sm text-wlx-ink hover:underline"
              >
                {dict.admin.forgotPassword.submit}
              </Link>
            </div>
          ) : success ? (
            <div className="text-center">
              <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                <p className="text-green-700 text-sm font-medium">{labels.successMessage}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-wlx-stone mb-1.5">
                  {labels.newPassword}
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-wlx-mist bg-white px-4 py-3 text-wlx-ink placeholder:text-wlx-stone focus:border-wlx-ink focus:outline-none focus:ring-2 focus:ring-wlx-ink/20"
                  placeholder={labels.newPasswordPlaceholder}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-wlx-stone mb-1.5">
                  {labels.confirmPassword}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-wlx-mist bg-white px-4 py-3 text-wlx-ink placeholder:text-wlx-stone focus:border-wlx-ink focus:outline-none focus:ring-2 focus:ring-wlx-ink/20"
                  placeholder={labels.confirmPasswordPlaceholder}
                  required
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-red-600 text-sm text-center">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full min-h-[44px] rounded-wlx-soft bg-wlx-ink py-3 text-[12px] uppercase tracking-[0.18em] text-wlx-paper hover:bg-wlx-ink/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? labels.submitting : labels.submit}
              </button>

              <p className="text-center text-sm text-wlx-stone">
                <Link
                  href={`/${locale}/admin/login`}
                  className="text-wlx-ink font-medium hover:underline"
                >
                  {dict.admin.forgotPassword.backToLogin}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
