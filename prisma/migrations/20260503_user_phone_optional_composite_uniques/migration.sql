-- User schema cleanup: phone becomes optional; identity uniqueness moves to
-- composite per-tenant keys so the same person can shop at multiple tenants.
--
-- Pre-migration audit (2026-05-03): 1 user total, 0 orders, 0 duplicate
-- (email, tenantId) pairs. Safe to apply with no data backfill.
--
-- Effects:
--   - drops global UNIQUE INDEX on "phone"   — was blocking same phone across tenants
--   - phone becomes NULLABLE                 — email-only signups no longer need a stub
--   - adds UNIQUE INDEX ("phone", "tenantId")— per-tenant phone identity
--   - adds UNIQUE INDEX ("email", "tenantId")— per-tenant email identity
--   - Postgres treats NULLs as distinct in unique indexes, so multiple email-only
--     users with NULL phones (or vice versa) won't collide.
--
-- Note: in this DB the per-column uniqueness was created as a unique INDEX
-- (User_phone_key), not as a table CONSTRAINT — so we drop with DROP INDEX,
-- not DROP CONSTRAINT, and create the new ones with CREATE UNIQUE INDEX too.
-- IF EXISTS / IF NOT EXISTS makes this safe to re-run on a partially-migrated DB.

-- 1. Drop the existing unique index on phone.
DROP INDEX IF EXISTS "User_phone_key";

-- 2. Allow NULL in phone.
ALTER TABLE "User" ALTER COLUMN "phone" DROP NOT NULL;

-- 3. Per-tenant uniqueness for phone.
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_tenantId_key"
  ON "User" ("phone", "tenantId");

-- 4. Per-tenant uniqueness for email.
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_tenantId_key"
  ON "User" ("email", "tenantId");
