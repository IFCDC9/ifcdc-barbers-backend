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
        paid_at TIMESTAMP,
        payment_payload JSONB,
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
