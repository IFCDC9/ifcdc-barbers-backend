import "dotenv/config"
import pg from "pg"

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const migrations = [
  {
    name: "create customers table",
    sql: `
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(30) UNIQUE NOT NULL,
        name VARCHAR(255),
        preferred_barber VARCHAR(255),
        language VARCHAR(20),
        last_visit TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    name: "create bookings table",
    sql: `
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        service VARCHAR(255),
        date DATE,
        time TIME,
        status VARCHAR(50) DEFAULT 'pending',
        payment_status VARCHAR(50),
        payment_provider VARCHAR(50),
        paypal_order_id TEXT,
        paypal_capture_id TEXT,
        payment_amount DECIMAL(10,2),
        payment_currency VARCHAR(10),
        paid_at TIMESTAMP,
        payment_verified_at TIMESTAMP,
        payment_payload JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    name: "add bookings payment fields",
    sql: `
      ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2);
      ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS payment_currency VARCHAR(10);
      ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMP;
    `,
  },
  {
    name: "create payment_attempts table",
    sql: `
      CREATE TABLE IF NOT EXISTS payment_attempts (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        booking_id INTEGER,
        attempt_type VARCHAR(50) NOT NULL,
        paypal_order_id TEXT,
        paypal_capture_id TEXT,
        status VARCHAR(50),
        amount DECIMAL(10,2),
        currency VARCHAR(10),
        payload JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    name: "add customers email column",
    sql: `
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    `,
  },
  {
    name: "add bookings status column",
    sql: `
      ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
    `,
  },
  {
    name: "add bookings price column",
    sql: `
      ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS price DECIMAL(10,2);
    `,
  },
  {
    name: "add users google auth columns",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER,
        full_name VARCHAR(255),
        phone_number VARCHAR(30) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email VARCHAR(255);
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS avatar TEXT;
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_hash TEXT;

      CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
      ON users (email)
      WHERE email IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique
      ON users (google_id)
      WHERE google_id IS NOT NULL;
    `,
  },
  {
    name: "create auth_bridge for supabase jwt bridge",
    sql: `
      CREATE TABLE IF NOT EXISTS auth_bridge (
        backend_sub TEXT PRIMARY KEY,
        supabase_user_id UUID NOT NULL UNIQUE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
  {
    name: "add appointments service column for AI bookings",
    sql: `
      ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS service TEXT;
    `,
  },
]

for (const migration of migrations) {
  try {
    await pool.query(migration.sql)
    console.log(`✅ ${migration.name}`)
  } catch (e) {
    console.error(`❌ ${migration.name}: ${e.message}`)
  }
}

await pool.end()
console.log("Migration complete.")
