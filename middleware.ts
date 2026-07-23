import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ROUTE_RESERVED_SLUGS } from "@/lib/slug-policy";

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

// 保留字清單搬咗去 lib/slug-policy.ts（單一真相）——
// 呢度用 route 版：判斷「首個 path segment 唔係租戶 slug」。
const RESERVED_SLUGS = ROUTE_RESERVED_SLUGS;

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
    // 剷走 client 可以偽造嘅 internal header，之後先 set 可信值 —
    // 否則 curl -H 'x-is-platform: true' 可以扮平台 mode。
    requestHeaders.delete("x-is-platform");
    requestHeaders.delete("x-tenant-slug");
    requestHeaders.delete("x-tenant-path-slug");
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

  // --- Platform landing → 靜態 route ---
  // 平台 bare domain 嘅 /en /zh-HK 內部 rewrite 去 /{locale}/landing（SSG 頁，
  // 冇 headers()/DB，TTFB 唔使等 server render）。公開 URL 不變（rewrite 唔係
  // redirect —— sitemap/canonical/e2e 全部照舊）。?tenant= override（demo 預覽）
  // 會令 tenantOverridden=true，跌返落 (customer) 動態 route，行為不變。
  if (
    isPlatform &&
    !tenantOverridden &&
    (pathname === "/en" || pathname === "/zh-HK")
  ) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `${pathname}/landing`;
    const landingHeaders = new Headers(request.headers);
    landingHeaders.delete("x-is-platform");
    landingHeaders.delete("x-tenant-slug");
    landingHeaders.delete("x-tenant-path-slug");
    landingHeaders.set("x-tenant-slug", tenantSlug);
    landingHeaders.set("x-locale", pathLocale);
    landingHeaders.set("x-is-platform", "true");
    return NextResponse.rewrite(rewriteUrl, {
      request: { headers: landingHeaders },
    });
  }

  // --- Skip admin guards for API routes (they handle auth themselves) ---
  const isApiRoute = pathname.startsWith("/api/");

  // --- "/" → default locale（以前由 app/page.tsx redirect；root shell 搬入
  //     [locale] 之後 app/ 頂層冇得再擺 page，redirect 搬嚟呢度）---
  // 用 nextUrl.clone() 保留 query：/?tenant=x 要落到 /zh-HK?tenant=x 先入到
  // 上面個 override branch（舊 flow 係 middleware 過 route 先 redirect，cookie
  // 喺 "/" 嗰下已經 set 咗；而家 middleware 直接 redirect，唔保留 query 就會
  // 整跛 demo 預覽）。
  if (pathname === "/") {
    const rootRedirect = request.nextUrl.clone();
    rootRedirect.pathname = "/zh-HK";
    return NextResponse.redirect(rootRedirect);
  }

  // --- /start redirect: /start → /en/start ---
  if (!isApiRoute && pathname === "/start") {
    const startUrl = new URL("/zh-HK/start", request.url);
    return NextResponse.redirect(startUrl);
  }

  // --- 光板 /pricing 學 /start redirect ---
  // 唔處理嘅話會以 locale="pricing" 跌落 (customer) home（platform host 上
  // 即係 render 咗 landing 內容）—— 而 pricing 頁個 canonical 正正指住
  // https://wowlix.com/pricing，即 canonical 目標同真內容對唔上。
  if (!isApiRoute && pathname === "/pricing") {
    return NextResponse.redirect(new URL("/zh-HK/pricing", request.url));
  }

  // --- /landing 收口 ---
  // 租戶 host 直接開 /{locale}/landing 會食到 platform landing（static segment
  // 贏 [slug]，middleware 個 rewrite gate 唔會攔直接 hit）—— 即係每間租戶店
  //（包括 hideBranding Pro 店）都掛住份 200 嘅平台廣告。彈返去店首頁。
  if (
    !isPlatform &&
    (pathname === "/en/landing" || pathname === "/zh-HK/landing")
  ) {
    const localePrefix = pathname.split("/")[1];
    return NextResponse.redirect(new URL(`/${localePrefix}`, request.url));
  }
  // 光板 /landing（"landing" 而家係 reserved，唔會再入 slug rewrite）——
  // 唔處理嘅話會以 locale="landing" 跌落 (customer) home（垃圾 canonical）。
  // 學 /start 咁 redirect 落 default locale；platform host 就係 landing 本尊，
  // 租戶 host 就會俾上面個 gate 接力彈返店首頁。
  if (!isApiRoute && pathname === "/landing") {
    return NextResponse.redirect(new URL("/zh-HK/landing", request.url));
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
  // 剷走 client 可以偽造嘅 internal header，之後先 set 可信值。
  requestHeaders.delete("x-is-platform");
  requestHeaders.delete("x-tenant-slug");
  requestHeaders.delete("x-tenant-path-slug");
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
