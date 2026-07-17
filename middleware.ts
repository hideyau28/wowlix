import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DEFAULT_SLUG = process.env.DEFAULT_TENANT_SLUG || "maysshop";
const DEFAULT_HOSTS = new Set(["wowlix", "www", "localhost", "127.0.0.1"]);

/**
 * Bare platform domain 偵測。
 * wowlix.com / www.wowlix.com → true（show landing page）
 * maysshop.wowlix.com → false（tenant subdomain）
 */
const PLATFORM_ROOT = process.env.PLATFORM_ROOT || "wowlix";

function isPlatformBare(hostname: string): boolean {
  const host = hostname.split(":")[0];
  const parts = host.split(".");
  if (parts.length === 2 && parts[0] === PLATFORM_ROOT) return true;
  if (parts.length === 3 && parts[0] === "www" && parts[1] === PLATFORM_ROOT)
    return true;
  // *.vercel.app preview/production URLs — treat as platform bare domain
  if (host.endsWith(".vercel.app")) return true;
  return false;
}

/**
 * 保留字清單 — 呢啲 path segment 唔會被當成 tenant slug。
 * 用於 /{slug} 路由（P4-F 先用到），而家預留。
 */
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "auth",
  "login",
  "signup",
  "settings",
  "checkout",
  "cart",
  "about",
  "contact",
  "terms",
  "privacy",
  "start",
  "_next",
  "favicon.ico",
  "categories",
  "collections",
  "faq",
  "orders",
  "product",
  "products",
  "profile",
  "returns",
  "search",
  "shipping",
  "track",
  "pricing",
]);

/**
 * Extract tenant slug from hostname.
 * Pattern: {slug}.wowlix.com
 * Returns DEFAULT_SLUG for bare domain, www, or localhost.
 */
function resolveSlugFromHostname(hostname: string): string {
  const host = hostname.split(":")[0];

  if (!host.includes(".")) {
    return DEFAULT_SLUG;
  }

  const subdomain = host.split(".")[0];

  if (DEFAULT_HOSTS.has(subdomain)) {
    return DEFAULT_SLUG;
  }

  return subdomain;
}

/**
 * Check if the first path segment could be a tenant slug (for future /{slug} routing).
 * Returns the slug if it matches, null otherwise.
 */
function resolveSlugFromPath(pathname: string): string | null {
  // Match /{slug} or /{slug}/... where slug is not a reserved word or locale
  const match = pathname.match(/^\/([a-z0-9][\w-]*?)(?:\/|$)/);
  if (!match) return null;

  const segment = match[1];

  // Skip reserved paths
  if (RESERVED_SLUGS.has(segment)) return null;

  // Skip locale prefixes (en, zh, zh-HK etc.)
  if (/^[a-z]{2}(-[a-z]{2,4})?$/i.test(segment)) return null;

  return segment;
}

/**
 * Detect tenant slug in locale-prefixed paths like /en/giftyouflora or /zh-HK/petitfleur.
 * Returns the slug segment if found, null otherwise.
 */
function resolveSlugFromLocalePath(pathname: string): string | null {
  const match = pathname.match(
    /^\/[a-z]{2}(?:-[a-zA-Z]{2,4})?\/([a-z0-9][\w-]*?)(?:\/|$)/,
  );
  if (!match) return null;
  const segment = match[1];
  if (RESERVED_SLUGS.has(segment)) return null;
  return segment;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Tenant resolution ---
  // 1. Start with subdomain-based slug
  let tenantSlug = resolveSlugFromHostname(request.headers.get("host") || "");
  let devTenantCookieChanged = false;
  let tenantOverridden = false;

  const isPlatform = isPlatformBare(request.headers.get("host") || "");

  // 2. Path-based slug detection (highest priority for slug URLs)
  //    If the URL contains a tenant slug in the path, cookie/param are ignored
  //    so that biolink pages always resolve to the correct tenant.
  const pathSlug = resolveSlugFromPath(pathname);
  const localePathSlug = resolveSlugFromLocalePath(pathname);

  // Root layout 靠呢個 header set <html lang> — 唔好寫死 zh-HK
  const pathLocale = pathname.match(/^\/(en|zh-HK)(?:\/|$)/)?.[1] || "zh-HK";

  if (pathSlug) {
    // Bare path /{slug}/... → rewrite to /zh-HK/{slug}/...
    const restPath = pathname.substring(pathSlug.length + 1);
    if (restPath === "/admin" || restPath.startsWith("/admin/")) {
      return NextResponse.redirect(new URL(`/zh-HK${restPath}`, request.url));
    }
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/zh-HK${pathname}`;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-tenant-slug", tenantSlug);
    requestHeaders.set("x-tenant-path-slug", pathSlug);
    requestHeaders.set("x-locale", "zh-HK");
    if (isPlatform) {
      requestHeaders.set("x-is-platform", "true");
    }
    return NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    });
  }

  // 3. For non-slug URLs: apply cookie/param tenant override
  //    localePathSlug URLs (e.g. /en/giftyouflora) skip cookie override
  //    so the [slug] page resolves the correct tenant from the URL segment.
  //    On platform-bare domains (wowlix.com / www.wowlix.com), the implicit
  //    `__dev_tenant` cookie is ignored so the landing page always renders;
  //    explicit `?tenant=` param still wins (used for preview / demos).
  if (!localePathSlug) {
    const tenantParam = request.nextUrl.searchParams.get("tenant");
    if (tenantParam) {
      tenantSlug = tenantParam;
      devTenantCookieChanged = true;
      tenantOverridden = true;
    } else if (!isPlatform) {
      const cookieVal = request.cookies.get("__dev_tenant")?.value;
      if (cookieVal) {
        tenantSlug = cookieVal;
        tenantOverridden = true;
      }
    }
  }

  // Platform bare domain default
  if (isPlatform && !tenantOverridden) {
    tenantSlug = DEFAULT_SLUG;
  }

  // --- Skip admin guards for API routes (they handle auth themselves) ---
  const isApiRoute = pathname.startsWith("/api/");

  // --- /start redirect: /start → /en/start ---
  if (!isApiRoute && pathname === "/start") {
    const startUrl = new URL("/zh-HK/start", request.url);
    return NextResponse.redirect(startUrl);
  }

  // --- Admin redirect: /admin → /en/admin ---
  if (
    !isApiRoute &&
    (pathname === "/admin" || pathname.startsWith("/admin/"))
  ) {
    const adminUrl = new URL(`/zh-HK${pathname}`, request.url);
    return NextResponse.redirect(adminUrl);
  }

  // --- Admin auth guard (page routes only) ---
  const isAdminRoute = !isApiRoute && pathname.match(/^\/[^/]+\/admin(?:\/|$)/);
  // login / forgot-password / reset-password 係 public auth 頁 —
  // 唔可以俾 auth guard 彈返 login（否則未登入嘅人永遠入唔到 forgot/reset）
  const isAuthRoute = pathname.match(
    /^\/[^/]+\/admin\/(login|forgot-password|reset-password)(?:\/|$)/,
  );
  const isLoginRoute = pathname.match(/^\/[^/]+\/admin\/login(?:\/|$)/);

  if (isAdminRoute && !isAuthRoute) {
    const sessionCookie = request.cookies.get("admin_session");
    const tenantAdminCookie = request.cookies.get("tenant-admin-token");

    if (!sessionCookie?.value && !tenantAdminCookie?.value) {
      const localeMatch = pathname.match(/^\/([^/]+)/);
      const locale = localeMatch ? localeMatch[1] : "zh-HK";

      const loginUrl = new URL(`/${locale}/admin/login`, request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // --- Auto-redirect from login if already authenticated via JWT ---
  // 只做 login：middleware 冇得驗 JWT（edge），淨係查「cookie 存在」。
  // forgot-password 嘅彈走喺 page 層 layout 用 verifyToken 真驗先彈 —
  // 揸住 stale/爛 cookie 嘅人正正最需要嗰頁，唔可以喺度憑存在就彈走。
  // reset-password 永遠唔彈 — email link flow，登入緊都要照行到尾。
  // !isApiRoute：API route 自己管 auth（isApiRoute 嘅約定）—— 冇呢個 gate，
  // regex 個 [^/]+ 會食埋 "api"，帶 cookie POST /api/admin/login 就會被
  // 307 去唔存在嘅 /api/admin（pre-existing bug，順手修埋）。
  if (!isApiRoute && isLoginRoute) {
    const tenantAdminCookie = request.cookies.get("tenant-admin-token");
    if (tenantAdminCookie?.value) {
      const localeMatch = pathname.match(/^\/([^/]+)/);
      const locale = localeMatch ? localeMatch[1] : "zh-HK";
      const dashboardUrl = new URL(`/${locale}/admin`, request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // --- Forward tenant slug via request header ---
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-slug", tenantSlug);
  requestHeaders.set("x-locale", pathLocale);
  if (isPlatform && !tenantOverridden) {
    requestHeaders.set("x-is-platform", "true");
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Persist dev tenant cookie so client-side fetches resolve correctly
  if (devTenantCookieChanged) {
    response.cookies.set("__dev_tenant", tenantSlug, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24h
    });
  }

  return response;
}

export const config = {
  // Skip static assets; include API routes so they also receive x-tenant-slug
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
