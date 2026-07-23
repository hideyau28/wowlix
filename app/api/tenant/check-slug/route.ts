import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi, ok, ApiError } from "@/lib/api/route-helpers";
import {
  REGISTRATION_RESERVED_SLUGS,
  SLUG_FORMAT_MESSAGE,
  SLUG_REGEX,
  SLUG_RESERVED_MESSAGE,
} from "@/lib/slug-policy";

// ⚠️ 呢度嘅判斷必須同 register route 一致（兩邊都食 lib/slug-policy）——
// 以前各揸一份 list，呢邊話 "wowlix" 可用、register 先 400，wizard 綠燈變炸彈。

export const GET = withApi(async (req: Request) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug")?.trim().toLowerCase();

  if (!slug) {
    throw new ApiError(400, "BAD_REQUEST", "slug parameter required");
  }

  if (!SLUG_REGEX.test(slug)) {
    return ok(req, {
      available: false,
      reason: SLUG_FORMAT_MESSAGE,
    });
  }

  if (REGISTRATION_RESERVED_SLUGS.has(slug)) {
    return ok(req, { available: false, reason: SLUG_RESERVED_MESSAGE });
  }

  // Query database for existing tenant with this slug
  const existing = await prisma.tenant.findUnique({
    where: { slug: slug },
  });

  if (existing) {
    return ok(req, { available: false, reason: "呢個名已經有人用咗" });
  }

  return ok(req, { available: true });
});
