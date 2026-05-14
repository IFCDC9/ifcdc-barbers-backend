import { dbQuery } from "./db.js";

/**
 * Multi-tenant barber business data (Postgres).
 * Idempotent CREATE / ALTER — safe on every server boot.
 */
export async function ensureBarberBusinessTables() {
  await dbQuery(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS barbers (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID UNIQUE REFERENCES app_users(id) ON DELETE SET NULL,
      name TEXT,
      bio TEXT,
      profile_image TEXT,
      logo TEXT,
      location TEXT,
      phone TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Older DBs may already have a different `barbers` shape (CREATE TABLE was skipped).
  // Align columns so seeds, /api/barber/list, and profile routes match this codebase.
  await dbQuery(`ALTER TABLE barbers ADD COLUMN IF NOT EXISTS user_id UUID;`);
  await dbQuery(`ALTER TABLE barbers ADD COLUMN IF NOT EXISTS name TEXT;`);
  await dbQuery(`ALTER TABLE barbers ADD COLUMN IF NOT EXISTS bio TEXT;`);
  await dbQuery(`ALTER TABLE barbers ADD COLUMN IF NOT EXISTS profile_image TEXT;`);
  await dbQuery(`ALTER TABLE barbers ADD COLUMN IF NOT EXISTS logo TEXT;`);
  await dbQuery(`ALTER TABLE barbers ADD COLUMN IF NOT EXISTS location TEXT;`);
  await dbQuery(`ALTER TABLE barbers ADD COLUMN IF NOT EXISTS phone TEXT;`);
  await dbQuery(`ALTER TABLE barbers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`);

  await dbQuery(`CREATE INDEX IF NOT EXISTS barbers_user_id_idx ON barbers (user_id);`);
  await dbQuery(`ALTER TABLE barbers ADD COLUMN IF NOT EXISTS business_id BIGINT;`);
  await dbQuery(`ALTER TABLE barbers ADD COLUMN IF NOT EXISTS shop_name TEXT;`);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS barber_services (
      id BIGSERIAL PRIMARY KEY,
      barber_id BIGINT NOT NULL,
      name TEXT NOT NULL,
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      duration_minutes INT NOT NULL DEFAULT 30,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await dbQuery(`CREATE INDEX IF NOT EXISTS barber_services_barber_id_idx ON barber_services (barber_id);`);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS barber_availability (
      id BIGSERIAL PRIMARY KEY,
      barber_id BIGINT NOT NULL,
      day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      is_off BOOLEAN NOT NULL DEFAULT FALSE
    );
  `);
  await dbQuery(
    `CREATE INDEX IF NOT EXISTS barber_availability_barber_day_idx ON barber_availability (barber_id, day_of_week);`,
  );

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS barber_settings (
      id BIGSERIAL PRIMARY KEY,
      barber_id BIGINT NOT NULL UNIQUE,
      theme_color TEXT NOT NULL DEFAULT '#FFD700',
      booking_deposit_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'paypal',
      aura_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      aura_voice_type TEXT NOT NULL DEFAULT 'Polly.Joanna',
      language TEXT NOT NULL DEFAULT 'en'
    );
  `);

  // Subscription MVP: tier + optional price; billing ids reserved for future checkout.
  await dbQuery(`
    ALTER TABLE barber_settings
      ADD COLUMN IF NOT EXISTS subscription_tier TEXT NULL;
  `);
  await dbQuery(`
    UPDATE barber_settings
    SET subscription_tier = 'pro'
    WHERE subscription_tier IS NULL OR btrim(subscription_tier) = '';
  `);
  await dbQuery(`
    ALTER TABLE barber_settings
      ALTER COLUMN subscription_tier SET DEFAULT 'free';
  `);
  await dbQuery(`
    ALTER TABLE barber_settings
      ALTER COLUMN subscription_tier SET NOT NULL;
  `);
  await dbQuery(`
    ALTER TABLE barber_settings
      ADD COLUMN IF NOT EXISTS subscription_monthly_price NUMERIC(10,2) NULL;
  `);
  await dbQuery(`
    ALTER TABLE barber_settings
      ADD COLUMN IF NOT EXISTS billing_provider TEXT NOT NULL DEFAULT 'none';
  `);
  await dbQuery(`
    ALTER TABLE barber_settings
      ADD COLUMN IF NOT EXISTS billing_subscription_id TEXT NULL;
  `);

  await dbQuery(`ALTER TABLE barber_settings ADD COLUMN IF NOT EXISTS is_pro BOOLEAN NOT NULL DEFAULT false;`);
  await dbQuery(
    `ALTER TABLE barber_settings ADD COLUMN IF NOT EXISTS pro_purchase_status VARCHAR(50) NOT NULL DEFAULT 'not_purchased';`,
  );
  await dbQuery(`ALTER TABLE barber_settings ADD COLUMN IF NOT EXISTS pro_transaction_id TEXT;`);
  await dbQuery(`ALTER TABLE barber_settings ADD COLUMN IF NOT EXISTS pro_purchased_at TIMESTAMPTZ;`);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS barber_clients (
      id BIGSERIAL PRIMARY KEY,
      barber_id BIGINT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await dbQuery(`ALTER TABLE barber_clients ADD COLUMN IF NOT EXISTS email TEXT;`);
  await dbQuery(`CREATE INDEX IF NOT EXISTS barber_clients_barber_id_idx ON barber_clients (barber_id);`);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS barber_portfolio_images (
      id BIGSERIAL PRIMARY KEY,
      barber_id BIGINT NOT NULL,
      image_url TEXT NOT NULL,
      caption TEXT,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await dbQuery(`CREATE INDEX IF NOT EXISTS barber_portfolio_barber_id_idx ON barber_portfolio_images (barber_id);`);

  const barberFkMigrations = [
    {
      rel: "barber_services",
      name: "barber_services_barber_id_fkey",
      sql: `ALTER TABLE barber_services ADD CONSTRAINT barber_services_barber_id_fkey FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE`,
    },
    {
      rel: "barber_availability",
      name: "barber_availability_barber_id_fkey",
      sql: `ALTER TABLE barber_availability ADD CONSTRAINT barber_availability_barber_id_fkey FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE`,
    },
    {
      rel: "barber_settings",
      name: "barber_settings_barber_id_fkey",
      sql: `ALTER TABLE barber_settings ADD CONSTRAINT barber_settings_barber_id_fkey FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE`,
    },
    {
      rel: "barber_clients",
      name: "barber_clients_barber_id_fkey",
      sql: `ALTER TABLE barber_clients ADD CONSTRAINT barber_clients_barber_id_fkey FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE`,
    },
    {
      rel: "barber_portfolio_images",
      name: "barber_portfolio_images_barber_id_fkey",
      sql: `ALTER TABLE barber_portfolio_images ADD CONSTRAINT barber_portfolio_images_barber_id_fkey FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE`,
    },
  ];
  for (const { rel, name, sql } of barberFkMigrations) {
    try {
      await dbQuery(`
        DO $fk$
        BEGIN
          IF to_regclass('public.barbers') IS NULL OR to_regclass('public.${rel}') IS NULL THEN
            RETURN;
          END IF;
          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = ('public.${rel}')::regclass AND conname = '${name}'
          ) THEN
            RETURN;
          END IF;
          ${sql};
        END $fk$;
      `);
    } catch (e) {
      console.warn(`[migrate] barber FK ${name} skipped:`, e?.message || e);
    }
  }

  // Seed legacy in-memory barber ids 1 & 2 so bookings/styles stay aligned.
  // Some older DBs had `barbers.id` as UUID; in that case, skip numeric seeding.
  let barbersIdType = "unknown";
  try {
    const t = await dbQuery(
      `SELECT data_type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'barbers' AND column_name = 'id'
       LIMIT 1`,
    );
    barbersIdType = String(t.rows?.[0]?.data_type || "unknown").toLowerCase();
  } catch {
    barbersIdType = "unknown";
  }

  const barbersIdLooksNumeric =
    barbersIdType === "bigint" || barbersIdType === "integer" || barbersIdType === "smallint";
  if (barbersIdLooksNumeric) {
    await dbQuery(`
      INSERT INTO barbers (id, user_id, name, profile_image, bio, location)
      OVERRIDING SYSTEM VALUE
      VALUES
        (1, NULL, 'Fade Master', '/uploads/sample1.jpg', '', ''),
        (2, NULL, 'Clipper King', '/uploads/sample2.jpg', '', '')
      ON CONFLICT (id) DO NOTHING;
    `);

    await dbQuery(`
      SELECT setval(
        pg_get_serial_sequence('barbers', 'id'),
        GREATEST((SELECT COALESCE(MAX(id), 1) FROM barbers), 1)
      );
    `);
  }

  await dbQuery(`
    INSERT INTO barber_settings (barber_id, subscription_tier)
    SELECT b.id, 'pro' FROM barbers b
    WHERE NOT EXISTS (SELECT 1 FROM barber_settings s WHERE s.barber_id = b.id);
  `);

  // Link app_users.barber_id rows to existing barber profiles when user_id is still null.
  await dbQuery(`
    UPDATE barbers br
    SET user_id = u.id
    FROM app_users u
    WHERE u.barber_id = br.id AND br.user_id IS NULL AND u.role = 'barber';
  `);
}
