/**
 * Read-only audit: how many existing customers can no longer log in
 * after the WhatsApp/SMS → Email OTP switch?
 *
 * A user is "stranded" if:
 *   - User.email IS NULL (or empty), AND
 *   - User.phone looks like a real HK phone (starts with +852 then 8 digits),
 *     i.e. NOT a string we wrote there post-switch (which would be an email)
 *
 * Cross-references Order.phone to find users with actual purchase history —
 * those are the highest-value "rescue first" segment.
 *
 * Run:  npx tsx scripts/count-phone-only-users.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { prisma } from "../lib/prisma";

const HK_PHONE = /^\+852\d{8}$/;

async function main() {
  console.log("🔍 Auditing user base after email-OTP migration...\n");

  // ── Whole-table counts ──────────────────────────────────────────
  const total = await prisma.user.count();
  const withEmail = await prisma.user.count({
    where: { email: { not: null, notIn: [""] } },
  });
  const withoutEmail = total - withEmail;

  // Phone-only that LOOK like real HK phones (i.e. legacy users, not the
  // email-mirrored-into-phone records that the new flow creates).
  const legacyPhoneOnly = await prisma.user.findMany({
    where: { OR: [{ email: null }, { email: "" }] },
    select: { id: true, phone: true, name: true, createdAt: true, tenantId: true },
  });
  const stranded = legacyPhoneOnly.filter((u) => HK_PHONE.test(u.phone));

  console.log("━━━ User table ━━━");
  console.log(`Total users:           ${total.toLocaleString()}`);
  console.log(`With email set:        ${withEmail.toLocaleString()}`);
  console.log(`Without email:         ${withoutEmail.toLocaleString()}`);
  console.log(
    `  → looks like phone:  ${stranded.length.toLocaleString()}  ⚠️  potentially locked out`,
  );
  console.log(
    `  → other (junk/test): ${(withoutEmail - stranded.length).toLocaleString()}`,
  );

  if (stranded.length === 0) {
    console.log("\n✅ Zero stranded users. Safe to skip migration work.\n");
    await prisma.$disconnect();
    return;
  }

  // ── Order activity for stranded users ───────────────────────────
  const strandedPhones = stranded.map((u) => u.phone);
  const strandedOrders = await prisma.order.groupBy({
    by: ["phone"],
    where: { phone: { in: strandedPhones } },
    _count: { _all: true },
  });

  const strandedWithOrders = strandedOrders.length;
  const totalOrdersFromStranded = strandedOrders.reduce(
    (sum, row) => sum + row._count._all,
    0,
  );

  console.log("\n━━━ Stranded users — order history ━━━");
  console.log(`Stranded users with orders: ${strandedWithOrders.toLocaleString()}`);
  console.log(`Total orders from them:     ${totalOrdersFromStranded.toLocaleString()}`);

  // ── Top 10 highest-volume stranded users (rescue-first list) ────
  const topByOrders = strandedOrders
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 10);

  if (topByOrders.length > 0) {
    const phoneToUser = new Map(stranded.map((u) => [u.phone, u]));
    console.log("\n━━━ Top 10 stranded users by order count ━━━");
    console.log("phone               orders  name        created");
    console.log("──────────────────  ──────  ──────────  ──────────");
    for (const row of topByOrders) {
      const u = phoneToUser.get(row.phone);
      const phone = row.phone.padEnd(18);
      const orders = String(row._count._all).padStart(6);
      const name = (u?.name || "—").slice(0, 10).padEnd(10);
      const created = u?.createdAt.toISOString().slice(0, 10) || "—";
      console.log(`${phone}  ${orders}  ${name}  ${created}`);
    }
  }

  // ── Tenant breakdown ────────────────────────────────────────────
  const byTenant = new Map<string, number>();
  for (const u of stranded) {
    byTenant.set(u.tenantId, (byTenant.get(u.tenantId) || 0) + 1);
  }
  if (byTenant.size > 1) {
    console.log("\n━━━ Stranded users by tenant ━━━");
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: [...byTenant.keys()] } },
      select: { id: true, slug: true, name: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));
    for (const [tenantId, count] of [...byTenant.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      const t = tenantMap.get(tenantId);
      console.log(`  ${(t?.slug || tenantId).padEnd(20)} ${count}`);
    }
  }

  console.log("\n📋 Recommendation:");
  if (strandedWithOrders === 0) {
    console.log(
      "   Stranded users exist but none placed an order. Low value to rescue.",
    );
    console.log("   Acceptable to leave as-is and onboard them fresh by email.");
  } else if (strandedWithOrders < 10) {
    console.log(
      `   Only ${strandedWithOrders} stranded users with orders. Manual outreach is cheapest:`,
    );
    console.log("   contact them by phone, collect email, backfill User.email yourself.");
  } else {
    console.log(
      `   ${strandedWithOrders} stranded users with orders — too many for manual.`,
    );
    console.log("   Build a phone-fallback OTP flow OR a one-time email-claim page.");
  }
  console.log();

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌ Audit failed:", err);
  process.exit(1);
});
