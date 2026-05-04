/**
 * List unique / index constraints on the User table.
 * Used to recover from migration P3018 — actual constraint name didn't
 * match what the migration tried to drop.
 *
 * Run:  npx tsx scripts/inspect-user-constraints.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { prisma } from "../lib/prisma";

async function main() {
  const constraints = await prisma.$queryRaw<
    { conname: string; definition: string }[]
  >`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = '"User"'::regclass
    ORDER BY conname
  `;
  console.log("User table constraints:");
  console.table(constraints);

  const indexes = await prisma.$queryRaw<
    { indexname: string; indexdef: string }[]
  >`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'User'
    ORDER BY indexname
  `;
  console.log("\nUser table indexes:");
  console.table(indexes);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
