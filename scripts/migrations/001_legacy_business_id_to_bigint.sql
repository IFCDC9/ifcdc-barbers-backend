-- =============================================================================
-- One-time: legacy TEXT tenant values -> BIGINT referencing businesses.id
-- Target: PostgreSQL. Back up the database before running.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/001_legacy_business_id_to_bigint.sql
--
-- Edit the legacy slug list in normalize_sql() inside the DO blocks if needed.
-- =============================================================================

BEGIN;

-- Ensure at least one businesses row exists (anchor for orphan tenants)
INSERT INTO businesses (name, phone, plan, subscription_status)
SELECT 'IFCDC (legacy migration)', NULL, 'free', 'active'
WHERE NOT EXISTS (SELECT 1 FROM businesses LIMIT 1);

-- -----------------------------------------------------------------------------
-- STEP 1 — Inspect (run manually in psql if you want a report)
-- -----------------------------------------------------------------------------
-- SELECT DISTINCT business_id FROM barbers ORDER BY 1;
-- SELECT DISTINCT business_id FROM app_users ORDER BY 1;
-- SELECT DISTINCT business_id FROM bookings ORDER BY 1;
-- SELECT DISTINCT business_id FROM barber_services ORDER BY 1;

-- -----------------------------------------------------------------------------
-- STEP 2 — Point invalid / non-numeric values at anchor (lowest businesses.id)
-- -----------------------------------------------------------------------------
UPDATE barbers
SET business_id = (SELECT id FROM businesses ORDER BY id ASC LIMIT 1)
WHERE business_id IS NULL
   OR btrim(business_id::text) = ''
   OR lower(business_id::text) IN ('default', 'legacy', 'tenant')
   OR business_id::text !~ '^-?[0-9]+$';

UPDATE app_users
SET business_id = (SELECT id FROM businesses ORDER BY id ASC LIMIT 1)
WHERE business_id IS NULL
   OR btrim(business_id::text) = ''
   OR lower(business_id::text) IN ('default', 'legacy', 'tenant')
   OR business_id::text !~ '^-?[0-9]+$';

UPDATE bookings
SET business_id = (SELECT id FROM businesses ORDER BY id ASC LIMIT 1)
WHERE business_id IS NULL
   OR btrim(business_id::text) = ''
   OR lower(business_id::text) IN ('default', 'legacy', 'tenant')
   OR business_id::text !~ '^-?[0-9]+$';

DO $$
DECLARE
  anchor bigint := (SELECT id FROM businesses ORDER BY id ASC LIMIT 1);
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'barber_services' AND column_name = 'business_id'
  ) THEN
    EXECUTE $u$
      UPDATE barber_services SET business_id = $1
      WHERE business_id IS NULL
         OR btrim(business_id::text) = ''
         OR lower(business_id::text) IN ('default', 'legacy', 'tenant')
         OR business_id::text !~ '^-?[0-9]+$';
    $u$
    USING anchor;
  END IF;

  IF to_regclass('public.services') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'business_id'
     ) THEN
    EXECUTE $u$
      UPDATE services SET business_id = $1
      WHERE business_id IS NULL
         OR btrim(business_id::text) = ''
         OR lower(business_id::text) IN ('default', 'legacy', 'tenant')
         OR business_id::text !~ '^-?[0-9]+$';
    $u$
    USING anchor;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 3 — BIGINT columns (skip tables/columns that do not exist)
-- -----------------------------------------------------------------------------
ALTER TABLE barbers
  ALTER COLUMN business_id TYPE bigint USING business_id::bigint;

ALTER TABLE app_users
  ALTER COLUMN business_id TYPE bigint USING business_id::bigint;

ALTER TABLE bookings
  ALTER COLUMN business_id TYPE bigint USING business_id::bigint;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'barber_services' AND column_name = 'business_id'
  ) THEN
    EXECUTE
      'ALTER TABLE barber_services ALTER COLUMN business_id TYPE bigint USING business_id::bigint';
  END IF;

  IF to_regclass('public.services') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'business_id'
     ) THEN
    EXECUTE 'ALTER TABLE services ALTER COLUMN business_id TYPE bigint USING business_id::bigint';
  END IF;
END $$;

COMMIT;
