import { dbQuery } from "./db.js";

export async function ensureBookingsTable() {
  await dbQuery(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      customer_name TEXT,
      customer_email TEXT,
      barber_id BIGINT NOT NULL,
      service TEXT NOT NULL,
      date DATE NOT NULL,
      time TIME NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      payment_status TEXT NOT NULL,
      payment_provider TEXT,
      paypal_order_id TEXT,
      paypal_capture_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await dbQuery(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2);`);
  await dbQuery(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2);`);
  await dbQuery(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2);`);
  await dbQuery(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(10,2);`);
  await dbQuery(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_type TEXT;`);
  await dbQuery(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS barber_name TEXT;`);
  await dbQuery(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS style_id UUID;`);
  await dbQuery(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS style_title TEXT;`);
  await dbQuery(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS style_image_url TEXT;`);
  await dbQuery(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10,2);`);
  await dbQuery(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_paid NUMERIC(10,2);`);
  await dbQuery(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS phone TEXT;`);

  await dbQuery(`UPDATE bookings SET tip_amount = 0 WHERE tip_amount IS NULL;`);
  await dbQuery(
    `UPDATE bookings SET total_paid = COALESCE(amount_paid, 0) + COALESCE(tip_amount, 0) WHERE total_paid IS NULL;`
  );
  await dbQuery(`
    UPDATE bookings SET
      total_price = COALESCE(total_price, amount),
      deposit_amount = COALESCE(deposit_amount, 0),
      amount_paid = COALESCE(amount_paid, amount),
      remaining_balance = COALESCE(
        remaining_balance,
        GREATEST(0::numeric, COALESCE(total_price, amount) - COALESCE(amount_paid, amount))
      ),
      payment_type = CASE
        WHEN payment_type IS NOT NULL AND btrim(payment_type) <> '' THEN payment_type
        ELSE 'full'
      END
    WHERE total_price IS NULL OR deposit_amount IS NULL OR amount_paid IS NULL OR remaining_balance IS NULL
       OR payment_type IS NULL OR btrim(COALESCE(payment_type, '')) = '';
  `);

  // Idempotency: PayPal IDs must be unique (prevents duplicates on refresh/double-click).
  // Use table UNIQUE constraints (not partial indexes): INSERT ... ON CONFLICT (paypal_capture_id)
  // requires a non-partial unique constraint or matching inference.
  await dbQuery(`DROP INDEX IF EXISTS bookings_paypal_order_unique;`);
  await dbQuery(`DROP INDEX IF EXISTS bookings_paypal_capture_unique;`);
  await dbQuery(`
    DO $m$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'bookings'::regclass AND conname = 'bookings_paypal_order_key'
      ) THEN
        ALTER TABLE bookings ADD CONSTRAINT bookings_paypal_order_key UNIQUE (paypal_order_id);
      END IF;
    END
    $m$;
  `);
  await dbQuery(`
    DO $m$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'bookings'::regclass AND conname = 'bookings_paypal_capture_key'
      ) THEN
        ALTER TABLE bookings ADD CONSTRAINT bookings_paypal_capture_key UNIQUE (paypal_capture_id);
      END IF;
    END
    $m$;
  `);

  // Slot uniqueness once deposit or full payment captured (same barber + slot).
  await dbQuery(`DROP INDEX IF EXISTS bookings_slot_unique_paid;`);
  await dbQuery(`
    CREATE UNIQUE INDEX IF NOT EXISTS bookings_slot_unique_paid
    ON bookings (barber_id, date, time)
    WHERE payment_status IN ('paid', 'deposit_paid');
  `);

  await dbQuery(`CREATE INDEX IF NOT EXISTS bookings_created_at_idx ON bookings (created_at DESC);`);
  await dbQuery(`CREATE INDEX IF NOT EXISTS bookings_barber_id_idx ON bookings (barber_id);`);
  await dbQuery(`CREATE INDEX IF NOT EXISTS bookings_payment_status_idx ON bookings (payment_status);`);
}

