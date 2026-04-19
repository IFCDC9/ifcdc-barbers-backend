import { dbQuery } from "./db.js";

export const ALLOWED_ROLES = ["super_admin", "admin", "barber", "user"];

export async function ensureUsersRoleColumn() {
  await dbQuery(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  // App-owned auth table (avoid conflicts with Supabase auth/public.users).
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS app_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR DEFAULT 'user',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await dbQuery(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS barber_id BIGINT;`);

  // Enforce allowed values via CHECK constraint (idempotent).
  await dbQuery(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'app_users_role_allowed'
      ) THEN
        ALTER TABLE app_users
          ADD CONSTRAINT app_users_role_allowed
          CHECK (role IN ('super_admin','admin','barber','user'));
      END IF;
    END $$;
  `);

  // Ensure default exists (older rows may have null role).
  await dbQuery(`UPDATE app_users SET role = 'user' WHERE role IS NULL;`);
}

