import { dbQuery } from "./db.js";

/** `business_id` = shop/tenant id (bigint) — aligns with `app_users.business_id` and `barbers.business_id`. */
export async function ensureSecurityTenantColumns() {
  await dbQuery(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS business_id BIGINT;`);
  await dbQuery(`
    UPDATE bookings bk
    SET business_id = br.business_id
    FROM barbers br
    WHERE bk.barber_id = br.id
      AND br.business_id IS NOT NULL
      AND (bk.business_id IS DISTINCT FROM br.business_id);
  `);

  await dbQuery(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.app_users'::regclass AND conname = 'app_users_role_allowed'
      ) THEN
        ALTER TABLE app_users DROP CONSTRAINT app_users_role_allowed;
      END IF;
      ALTER TABLE app_users
        ADD CONSTRAINT app_users_role_allowed
        CHECK (role IN ('super_admin','admin','shop_owner','barber','user'));
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);
}

export async function ensureSecurityAuditTable() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS security_audit_log (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      event_type TEXT NOT NULL,
      actor_user_id UUID,
      actor_email TEXT,
      ip_text TEXT,
      user_agent TEXT,
      metadata JSONB
    );
  `);
  await dbQuery(
    `CREATE INDEX IF NOT EXISTS security_audit_log_created_idx ON security_audit_log (created_at DESC);`,
  );
  await dbQuery(
    `CREATE INDEX IF NOT EXISTS security_audit_log_event_idx ON security_audit_log (event_type);`,
  );
}
