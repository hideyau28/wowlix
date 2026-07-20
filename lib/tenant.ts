import { prisma } from "@/lib/prisma";
import { verifyToken, getTokenFromRequest } from "@/lib/auth/jwt";

export type TenantContext = {
  id: string;
  slug: string;
  name: string;
  currency: string;
  region: string;
  timezone: string;
  languages: string[];
  themeColor: string;
  status: string;
};

const DEFAULT_SLUG = "maysshop";

/**
 * Known hostnames that should resolve to the default tenant
 * rather than being treated as a subdomain slug.
 */
const DEFAULT_HOSTS = new Set(["wowlix", "www", "localhost", "127.0.0.1"]);

/**
 * Extract tenant slug from a hostname string.
 * Pattern: {slug}.wowlix.com
 * Returns DEFAULT_SLUG for bare domain, www, or localhost.
 */
export function resolveSlugFromHostname(hostname: string): string {
  // Strip port if present (e.g. localhost:3012)
  const host = hostname.split(":")[0];

  // Single-label host (no dots) — e.g. "localhost"
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
 * Resolve the current tenant.
 *
 * Priority:
 * 1. x-tenant-slug header (set by middleware)
 * 2. Hostname-based subdomain parsing
 * 3. ?tenant= query param (dev fallback)
 * 4. Default slug "maysshop"
 */
export async function resolveTenant(req?: Request): Promise<TenantContext> {
  let slug = DEFAULT_SLUG;

  if (req) {
    // 1. Middleware already resolved the slug
    const headerSlug = req.headers.get("x-tenant-slug");
    if (headerSlug) {
      slug = headerSlug;
    } else {
      // 2. Parse subdomain from host header
      const host = req.headers.get("host") || "";
      if (host) {
        slug = resolveSlugFromHostname(host);
      }

      // 3. Dev fallback: ?tenant= query param (non-production only)
      if (process.env.NODE_ENV !== "production") {
        try {
          const url = new URL(req.url);
          const tenantParam = url.searchParams.get("tenant");
          if (tenantParam) {
            slug = tenantParam;
          }
        } catch {
          // Ignore URL parsing errors
        }
      }
    }
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      currency: true,
      region: true,
      timezone: true,
      languages: true,
      themeColor: true,
      status: true,
    },
  });

  if (!tenant || tenant.status !== "active") {
    throw new Error("Tenant not found or inactive");
  }

  return tenant as TenantContext;
}

export async function getTenantId(req?: Request): Promise<string> {
  if (req) {
    // ⚠️ 唔准信 inbound x-tenant-id header —— middleware 從來冇 set 佢
    // （set 嘅係 x-tenant-slug），所以呢個 header 唯一來源就係 client。
    // 以前喺度做「fast path」= 任何人 `curl -H 'x-tenant-id: <受害店>'` 就
    // 攞到人哋張單 / 客人 PII（跨租戶 IDOR，~40 條 route 中招）。tenant 一律
    // 由 JWT（下面）或 x-tenant-slug（resolveTenant）決定。
    // 外部 x-admin-secret caller 用 x-tenant-id 嗰條路喺 admin-auth 個
    // getExplicitTenantId 度處理，同呢度無關。

    // Check JWT token (admin requests carry tenantId in JWT)
    const token = getTokenFromRequest(req);
    if (token) {
      const payload = verifyToken(token);
      if (payload?.tenantId) {
        return payload.tenantId;
      }
    }
  }

  const tenant = await resolveTenant(req);
  return tenant.id;
}

/**
 * 喺 Server Component 判斷係咪 platform bare domain（wowlix.com）。
 * Middleware set x-is-platform: "true" 嘅時候 return true。
 */
export async function isPlatformMode(): Promise<boolean> {
  const { headers } = await import("next/headers");
  const headersList = await headers();
  return headersList.get("x-is-platform") === "true";
}

/**
 * Get tenantId inside Next.js Server Components / Server Actions.
 * Reads the x-tenant-slug header set by middleware via next/headers.
 */
export async function getServerTenantId(): Promise<string> {
  const { headers } = await import("next/headers");
  const headersList = await headers();
  const slug = headersList.get("x-tenant-slug") || DEFAULT_SLUG;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });

  if (!tenant || tenant.status !== "active") {
    throw new Error("Tenant not found or inactive");
  }

  return tenant.id;
}

/**
 * Get tenantId for Admin Server Components / Server Actions.
 * 只從 JWT cookie 讀 tenantId，唔再 fallback 去 DEFAULT_SLUG。
 * 如果冇有效 JWT → throw error。
 */
export async function getAdminTenantId(): Promise<string> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("tenant-admin-token");
    if (tokenCookie?.value) {
      const payload = verifyToken(tokenCookie.value);
      if (payload?.tenantId) {
        // Verify tenant exists and is active
        const tenant = await prisma.tenant.findUnique({
          where: { id: payload.tenantId },
          select: { id: true, status: true },
        });
        if (tenant && tenant.status === "active") {
          return tenant.id;
        }
      }
    }
  } catch {
    // JWT verification failed
  }

  throw new Error("Admin tenant context required: no valid tenant-admin-token JWT found");
}
