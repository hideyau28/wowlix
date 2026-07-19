import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForToken, getFacebookUser } from "@/lib/auth/facebook";
import { signToken } from "@/lib/auth/jwt";

export const runtime = "nodejs";

const ALLOWED_LOCALES = new Set(["en", "zh-HK"]);

/**
 * Build a redirect response and clear the CSRF nonce cookie at the same time.
 * Used for both error and success paths so the cookie never lingers across flows.
 */
function redirectAndClearState(url: string): NextResponse {
  const response = NextResponse.redirect(url);
  response.cookies.delete("fb_oauth_state");
  return response;
}

/**
 * GET /api/tenant-admin/facebook/callback
 * Handles the OAuth 2.0 callback from Facebook.
 * Verifies CSRF state, exchanges code for token, checks email whitelist,
 * creates an admin session (admin_session + tenant-admin-token cookies),
 * and redirects to the admin dashboard in the user's locale.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const stateParam = searchParams.get("state");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_BASE_URL is required");

  // Parse state to extract locale + CSRF nonce
  let locale = "en";
  let stateNonce: string | null = null;
  if (stateParam) {
    try {
      const stateObj = JSON.parse(
        Buffer.from(stateParam, "base64url").toString(),
      );
      if (stateObj.locale && ALLOWED_LOCALES.has(stateObj.locale)) {
        locale = stateObj.locale;
      }
      if (stateObj.nonce && typeof stateObj.nonce === "string") {
        stateNonce = stateObj.nonce;
      }
    } catch {
      // Invalid state — fall back to default locale, fail CSRF check below
    }
  }

  const errorRedirect = `${baseUrl}/${locale}/admin/login`;

  // User cancelled the Facebook login
  if (error) {
    console.error("[Facebook OAuth] Error from Facebook:", error);
    return redirectAndClearState(`${errorRedirect}?error=facebook_denied`);
  }

  if (!code) {
    console.error("[Facebook OAuth] No authorization code in callback");
    return redirectAndClearState(`${errorRedirect}?error=no_code`);
  }

  // CSRF state verification — nonce in state must match httpOnly cookie
  const storedNonce = request.cookies.get("fb_oauth_state")?.value;
  if (!stateNonce || !storedNonce || stateNonce !== storedNonce) {
    console.error("[Facebook OAuth] State mismatch (CSRF check failed)");
    return redirectAndClearState(`${errorRedirect}?error=state_mismatch`);
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    console.error("[Facebook OAuth] Facebook OAuth credentials not configured");
    return redirectAndClearState(`${errorRedirect}?error=config`);
  }

  const callbackUrl = `${baseUrl}/api/tenant-admin/facebook/callback`;

  try {
    // Exchange authorization code for access token
    const tokenData = await exchangeCodeForToken(code, callbackUrl);

    // Fetch user info from Facebook
    const fbUser = await getFacebookUser(tokenData.access_token);

    if (!fbUser.email) {
      console.error("[Facebook OAuth] No email returned from Facebook");
      return redirectAndClearState(`${errorRedirect}?error=no_email`);
    }

    // Check if email is in the TenantAdmin whitelist
    const admin = await prisma.tenantAdmin.findFirst({
      where: { email: fbUser.email },
    });

    if (!admin) {
      console.error(
        "[Facebook OAuth] Email not in TenantAdmin whitelist:",
        fbUser.email,
      );
      return redirectAndClearState(`${errorRedirect}?error=unauthorized`);
    }

    // 只簽租戶級 tenant-admin-token —— JWT 帶 tenantId/adminId/email/role，
    // API route 靠佢做 tenant context（7d）。唔再簽平台 god-mode admin_session
    // （同 super-admin 同款，會經 select-tenant 提權去任何租戶）；middleware
    // guard 收 tenant-admin-token，admin layout 亦用佢判 mode，所以照樣入到後台。
    const adminToken = signToken({
      tenantId: admin.tenantId,
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
    });

    // Set cookie directly on the redirect response (same pattern as Google OAuth)
    const redirectUrl = `${baseUrl}/${locale}/admin/products`;
    const response = redirectAndClearState(redirectUrl);
    response.cookies.set("tenant-admin-token", adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days, matches Google callback
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[Facebook OAuth] Callback error:", err);
    return redirectAndClearState(`${errorRedirect}?error=callback_failed`);
  }
}
