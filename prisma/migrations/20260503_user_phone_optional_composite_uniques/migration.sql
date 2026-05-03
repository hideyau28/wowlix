-- User schema cleanup: phone becomes optional; identity uniqueness moves to
-- composite per-tenant keys so the same person can shop at multiple tenants.
--
-- Pre-migration audit (2026-05-03): 1 user total, 0 orders, 0 duplicate
-- (email, tenantId) pairs. Safe to apply with no data backfill.
--
-- Effects:
--   - drops global UNIQUE("phone")           — was blocking same phone across tenants
--   - phone becomes NULLABLE                 — email-only signups no longer need a stub
--   - adds UNIQUE("phone", "tenantId")       — per-tenant phone identity
--   - adds UNIQUE("email", "tenantId")       — per-tenant email identity
--   - Postgres treats NULLs as distinct in unique indexes, so multiple email-only
--     users with NULL phones (or vice versa) won't collide.

-- 1. Drop the existing global unique constraint on phone.
ALTER TABLE "User" DROP CONSTRAINT "User_phone_key";

-- 2. Allow NULL in phone.
ALTER TABLE "User" ALTER COLUMN "phone" DROP NOT NULL;

-- 3. Per-tenant uniqueness for phone.
ALTER TABLE "User"
  ADD CONSTRAINT "User_phone_tenantId_key" UNIQUE ("phone", "tenantId");

-- 4. Per-tenant uniqueness for email.
ALTER TABLE "User"
  ADD CONSTRAINT "User_email_tenantId_key" UNIQUE ("email", "tenantId");
