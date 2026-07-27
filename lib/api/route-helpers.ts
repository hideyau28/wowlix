import { randomUUID } from "crypto";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL"
  | "ADMIN_AUTH_MISSING"
  | "ADMIN_AUTH_INVALID";

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  details?: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getRequestId(req: Request) {
  return req.headers.get("x-request-id") || randomUUID();
}

export function ok(req: Request, data: unknown, init?: ResponseInit) {
  const requestId = getRequestId(req);
  return Response.json(
    { ok: true, requestId, data },
    {
      ...init,
      headers: {
        "x-request-id": requestId,
        "content-type": "application/json; charset=utf-8",
        ...(init?.headers || {}),
      },
    }
  );
}

export function fail(req: Request, err: unknown, init?: ResponseInit) {
  const requestId = getRequestId(req);

  const apiErr =
    err instanceof ApiError
      ? err
      : new ApiError(500, "INTERNAL", "Internal Server Error");

  return Response.json(
    {
      ok: false,
      requestId,
      error: {
        code: apiErr.code,
        message: apiErr.message,
        details: apiErr.details ?? undefined,
      },
    },
    {
      status: apiErr.status,
      ...init,
      headers: {
        "x-request-id": requestId,
        "content-type": "application/json; charset=utf-8",
        ...(init?.headers || {}),
      },
    }
  );
}

/**
 * 統一嘅 429 回應（同 fail() 一樣嘅 envelope）+ Retry-After header。
 * 俾 auth rate-limit 直接 early-return 用（唔經 throw ApiError，因為要帶 Retry-After）。
 */
export function rateLimited(
  req: Request,
  opts?: { retryAfterSec?: number; message?: string }
) {
  const requestId = getRequestId(req);
  const retryAfter = Math.max(1, Math.floor(opts?.retryAfterSec ?? 60));
  return Response.json(
    {
      ok: false,
      requestId,
      error: {
        code: "RATE_LIMITED" as ApiErrorCode,
        message: opts?.message ?? "試得太密，請稍後再試 | Too many attempts, try later",
      },
    },
    {
      status: 429,
      headers: {
        "x-request-id": requestId,
        "content-type": "application/json; charset=utf-8",
        "Retry-After": String(retryAfter),
      },
    }
  );
}

type WithApiOptions = {
  admin?: boolean; // true = require admin secret
};

const RATE_LIMIT_DEFAULT_ROUTES = "POST:/api/orders";
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
let rateLimitLastSweep = 0;

function isRateLimitEnabled() {
  const raw = process.env.RATE_LIMIT_ENABLED;
  if (!raw) return true;
  const normalized = raw.trim().toLowerCase();
  return normalized !== "0" && normalized !== "false" && normalized !== "off";
}

function parseRateLimitNumber(raw: string | undefined, fallback: number) {
  if (!raw) return fallback;
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function parseRateLimitRoutes(raw: string): Set<string> {
  const routes = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const set = new Set<string>();
  for (const route of routes) {
    const idx = route.indexOf(":");
    if (idx <= 0) continue;
    const method = route.slice(0, idx).trim().toUpperCase();
    const path = route.slice(idx + 1).trim();
    if (!method || !path) continue;
    set.add(`${method}:${path}`);
  }
  return set;
}

function getRateLimitConfig() {
  const windowMs = parseRateLimitNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000);
  const max = parseRateLimitNumber(process.env.RATE_LIMIT_MAX, 120);
  const routesRaw =
    process.env.RATE_LIMIT_ROUTES !== undefined
      ? process.env.RATE_LIMIT_ROUTES
      : RATE_LIMIT_DEFAULT_ROUTES;
  const routes = routesRaw && routesRaw.trim().length > 0 ? parseRateLimitRoutes(routesRaw) : new Set<string>();
  return { windowMs, max, routes };
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

function enforceRateLimit(req: Request) {
  if (!isRateLimitEnabled()) return;

  const { windowMs, max, routes } = getRateLimitConfig();
  if (max <= 0) return;

  const url = new URL(req.url);
  const routeKey = `${req.method.toUpperCase()}:${url.pathname}`;
  if (!routes.has(routeKey)) return;

  const now = Date.now();
  if (now - rateLimitLastSweep > windowMs) {
    for (const [key, bucket] of rateLimitBuckets.entries()) {
      if (bucket.resetAt <= now) rateLimitBuckets.delete(key);
    }
    rateLimitLastSweep = now;
  }

  const clientKey = getClientIp(req);
  const bucketKey = `${clientKey}:${routeKey}`;
  const bucket = rateLimitBuckets.get(bucketKey);
  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > max) {
    throw new ApiError(429, "RATE_LIMITED", "Too many requests");
  }
}

function assertAdmin(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    // 不設 secret 就當未啟用 guard（避免卡死 dev）
    return;
  }

  const headerSecret = req.headers.get("x-admin-secret");
  const auth = req.headers.get("authorization") ?? "";

  // 1) x-admin-secret header
  if (headerSecret) {
    if (headerSecret !== secret) throw new ApiError(403, "ADMIN_AUTH_INVALID", "Invalid admin credential");
    return;
  }

  // 2) Bearer token — try ADMIN_SECRET first, then JWT
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length);
    if (token === secret) return;

    // Try as JWT token
    try {
      const { verifyToken } = require("@/lib/auth/jwt");
      const payload = verifyToken(token);
      if (payload?.tenantId) return;
    } catch {
      // JWT verification failed
    }

    throw new ApiError(403, "ADMIN_AUTH_INVALID", "Invalid admin credential");
  }

  // 3) Basic Auth
  if (auth.toLowerCase().startsWith("basic ")) {
    const b64 = auth.slice(6).trim();
    let decoded = "";
    try {
      // Node runtime
      decoded = Buffer.from(b64, "base64").toString("utf8");
    } catch {
      // Fallback (non-Node): try atob if available
      try {
        decoded = (globalThis as any).atob ? (globalThis as any).atob(b64) : "";
      } catch {
        decoded = "";
      }
    }

    const idx = decoded.indexOf(":");
    const user = idx >= 0 ? decoded.slice(0, idx) : decoded;
    const pass = idx >= 0 ? decoded.slice(idx + 1) : "";

    const expectedUser = process.env.ADMIN_BASIC_USER || "admin";
    const expectedPass = process.env.ADMIN_BASIC_PASS || secret;

    if (user === expectedUser && pass === expectedPass) return;

    // Wrong basic auth -> 403
    throw new ApiError(403, "ADMIN_AUTH_INVALID", "Invalid admin credential");
  }

  // 4) Check tenant-admin-token cookie (browser requests from tenant admin)
  const cookie = req.headers.get("cookie");
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)tenant-admin-token=([^;]*)/);
    if (match?.[1]) {
      try {
        const { verifyToken } = require("@/lib/auth/jwt");
        const payload = verifyToken(match[1]);
        if (payload?.tenantId) return;
      } catch {
        // JWT verification failed
      }
    }
  }

  // Missing credential -> 401
  throw new ApiError(401, "ADMIN_AUTH_MISSING", "Missing admin credential");
}

export function withApi(
  handler: (req: Request) => Promise<Response>,
  opts?: WithApiOptions
): (req: Request) => Promise<Response>;
export function withApi<C>(
  handler: (req: Request, ctx: C) => Promise<Response>,
  opts?: WithApiOptions
): (req: Request, ctx: C) => Promise<Response>;
export function withApi<C>(
  handler: ((req: Request) => Promise<Response>) | ((req: Request, ctx: C) => Promise<Response>),
  opts?: WithApiOptions
) {
  return async (req: Request, ctx?: C) => {
    try {
      enforceRateLimit(req);
      if (opts?.admin) assertAdmin(req);
      // Call handler with ctx only if it expects 2 args; keep TS happy via casting.
      return await ((handler as any).length >= 2 ? (handler as any)(req, ctx) : (handler as any)(req));
    } catch (e) {
      // Temporary debug logging for INTERNAL errors
      if (!(e instanceof ApiError)) {
        const requestId = getRequestId(req);
        console.error("[API_INTERNAL]", {
          requestId,
          method: req.method,
          url: req.url,
          xForwardedFor: req.headers.get("x-forwarded-for"),
          xRealIp: req.headers.get("x-real-ip"),
          err: e,
        });
      }
      return fail(req, e);
    }
  };
}
