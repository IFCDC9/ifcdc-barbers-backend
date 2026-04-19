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

  await dbQuery(`CREATE INDEX IF NOT EXISTS barbers_user_id_idx ON barbers (user_id);`);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS barber_services (
      id BIGSERIAL PRIMARY KEY,
      barber_id BIGINT NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
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
      barber_id BIGINT NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
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
      barber_id BIGINT NOT NULL UNIQUE REFERENCES barbers(id) ON DELETE CASCADE,
      theme_color TEXT NOT NULL DEFAULT '#FFD700',
      booking_deposit_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'paypal',
      aura_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      aura_voice_type TEXT NOT NULL DEFAULT 'Polly.Joanna',
      language TEXT NOT NULL DEFAULT 'en'
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS barber_clients (
      id BIGSERIAL PRIMARY KEY,
      barber_id BIGINT NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await dbQuery(`CREATE INDEX IF NOT EXISTS barber_clients_barber_id_idx ON barber_clients (barber_id);`);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS barber_portfolio_images (
      id BIGSERIAL PRIMARY KEY,
      barber_id BIGINT NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      caption TEXT,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await dbQuery(`CREATE INDEX IF NOT EXISTS barber_portfolio_barber_id_idx ON barber_portfolio_images (barber_id);`);

  // Seed legacy in-memory barber ids 1 & 2 so bookings/styles stay aligned.
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

  await dbQuery(`
    INSERT INTO barber_settings (barber_id)
    SELECT b.id FROM barbers b
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
