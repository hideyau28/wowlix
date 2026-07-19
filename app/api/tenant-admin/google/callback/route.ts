import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth/jwt";

export const runtime = "nodejs";

/**
 * GET /api/tenant-admin/google/callback
 * Handles the OAuth 2.0 callback from Google.
 * Exchanges the authorization code for tokens, verifies the user,
 * creates an admin session, and redirects to the admin dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const stateParam = searchParams.get("state");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_BASE_URL is required");

  // Parse state to check if this is an onboarding flow + locale + CSRF nonce
  let isOnboarding = false;
  let locale = "en";
  let stateNonce: string | null = null;
  if (stateParam) {
    try {
      const stateObj = JSON.parse(
        Buffer.from(stateParam, "base64url").toString(),
      );
      isOnboarding = stateObj.onboarding === true;
      if (stateObj.locale && typeof stateObj.locale === "string") {
        locale = stateObj.locale;
      }
      if (stateObj.nonce && typeof stateObj.nonce === "string") {
        stateNonce = stateObj.nonce;
      }
    } catch {
      // Invalid state, ignore
    }
  }

  const errorRedirect = isOnboarding
    ? `${baseUrl}/${locale}/start`
    : `${baseUrl}/${locale}/admin/login`;

  if (error) {
    console.error("[Google OAuth] Error from Google:", error);
    return NextResponse.redirect(`${errorRedirect}?error=google_denied`);
  }

  if (!code) {
    console.error("[Google OAuth] No authorization code in callback");
    return NextResponse.redirect(`${errorRedirect}?error=no_code`);
  }

  // CSRF state verification — nonce in state must match httpOnly cookie
  const storedNonce = request.cookies.get("google_oauth_state")?.value;
  if (!stateNonce || !storedNonce || stateNonce !== storedNonce) {
    console.error("[Google OAuth] State mismatch (CSRF check failed)");
    return NextResponse.redirect(`${errorRedirect}?error=state_mismatch`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${baseUrl}/api/tenant-admin/google/callback`;

  if (!clientId || !clientSecret) {
    console.error("[Google OAuth] Google OAuth credentials not configured");
    return NextResponse.redirect(`${errorRedirect}?error=config`);
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const tokenError = await tokenRes.text();
      console.error("[Google OAuth] Token exchange failed:", tokenError);
      return NextResponse.redirect(`${errorRedirect}?error=token_exchange`);
    }

    const tokens = await tokenRes.json();

    // Fetch user info from Google
    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );

    if (!userInfoRes.ok) {
      console.error("[Google OAuth] Failed to fetch user info");
      return NextResponse.redirect(`${errorRedirect}?error=user_info`);
    }

    const userInfo = await userInfoRes.json();

    // Onboarding flow: check if email already has a TenantAdmin record.
    // If so, skip onboarding and go straight to admin dashboard.
    if (isOnboarding) {
      const existingAdmin = await prisma.tenantAdmin.findUnique({
        where: { email: (userInfo.email || "").toLowerCase() },
      });

      if (existingAdmin) {
        // Existing account — 只簽租戶級 tenant-admin-token，唔簽平台 admin_session
        const adminToken = signToken({
          tenantId: existingAdmin.tenantId,
          adminId: existingAdmin.id,
          email: existingAdmin.email,
          role: existingAdmin.role,
        });
        const response = NextResponse.redirect(`${baseUrl}/${locale}/admin`);
        response.cookies.set("tenant-admin-token", adminToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7,
          path: "/",
        });
        return response;
      }

      // New user — redirect to /start with email via httpOnly cookie.
      // Email must NOT appear in the redirect URL to prevent leakage via logs/history.
      const redirectUrl = `${baseUrl}/${locale}/start`;
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.set("google_onboard_email", userInfo.email || "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax", // "lax" required for cross-site OAuth redirects
        maxAge: 120, // 2-minute window — consumed by the next page render
        path: "/",
      });
      return response;
    }

    // Look up existing TenantAdmin by Google email
    const existingAdmin = await prisma.tenantAdmin.findUnique({
      where: { email: (userInfo.email || "").toLowerCase() },
    });

    if (!existingAdmin) {
      console.error(
        "[Google OAuth] No TenantAdmin found for email:",
        userInfo.email,
      );
      return NextResponse.redirect(`${errorRedirect}?error=no_account`);
    }

    // 只簽租戶級 tenant-admin-token（tenant context）—— 唔簽平台 god-mode admin_session
    const adminToken = signToken({
      tenantId: existingAdmin.tenantId,
      adminId: existingAdmin.id,
      email: existingAdmin.email,
      role: existingAdmin.role,
    });

    const redirectUrl = `${baseUrl}/${locale}/admin/products`;
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set("tenant-admin-token", adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[Google OAuth] Callback error:", err);
    return NextResponse.redirect(`${errorRedirect}?error=callback_failed`);
  }
}
