/**
 * Read-only: dump every User row + their order count.
 * Used before the User schema cleanup to know exactly what data we're touching.
 *
 * Run:  npx tsx scripts/inspect-users.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { prisma } from "../lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    include: {
      tenant: { select: { slug: true } },
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${users.length} user(s):\n`);
  for (const u of users) {
    console.log({
      id: u.id,
      tenant: u.tenant.slug,
      phone: u.phone,
      email: u.email,
      name: u.name,
      orders: u._count.orders,
      createdAt: u.createdAt.toISOString(),
    });
  }

  // Also surface any duplicate (email, tenantId) pairs that would block
  // adding @@unique([email, tenantId]) — should be zero with 1 user.
  const dupes = await prisma.$queryRaw<{ email: string; tenant_id: string; n: bigint }[]>`
    SELECT email, "tenantId" AS tenant_id, COUNT(*)::int AS n
    FROM "User"
    WHERE email IS NOT NULL
    GROUP BY email, "tenantId"
    HAVING COUNT(*) > 1
  `;
  console.log(`\nDuplicate (email, tenantId) pairs: ${dupes.length}`);
  if (dupes.length) console.table(dupes);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
