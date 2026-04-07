-- IFCDC Barbers Database Schema

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  barber_id INTEGER NOT NULL,
  shop_id INTEGER,
  customer_name VARCHAR(255),
  service TEXT,
  appointment_time TIMESTAMP,
  price DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tips table
CREATE TABLE IF NOT EXISTS tips (
  id SERIAL PRIMARY KEY,
  barber_id INTEGER NOT NULL,
  shop_id INTEGER,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Queue table
CREATE TABLE IF NOT EXISTS queue (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL,
  barber_id INTEGER,
  shop_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Barber status table
CREATE TABLE IF NOT EXISTS barber_status (
  id SERIAL PRIMARY KEY,
  barber_id INTEGER NOT NULL,
  shop_id INTEGER,
  status VARCHAR(50) DEFAULT 'available',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Barber media routes table (assuming for uploads)
CREATE TABLE IF NOT EXISTS barber_media (
  id SERIAL PRIMARY KEY,
  barber_id INTEGER NOT NULL,
  shop_id INTEGER,
  media_type VARCHAR(50),
  file_path VARCHAR(500),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table (for returning-customer recognition)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER,
  full_name VARCHAR(255),
  email VARCHAR(255),
  phone_number VARCHAR(30) UNIQUE,
  google_id VARCHAR(255),
  avatar TEXT,
  password_hash TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
ON users (email)
WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique
ON users (google_id)
WHERE google_id IS NOT NULL;

-- Customers table (used by memoryService for phone-based upserts)
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  preferred_barber VARCHAR(255),
  language VARCHAR(20),
  last_visit TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookings table (pending → confirmed after PayPal capture)
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  service VARCHAR(255),
  date DATE,
  time TIME,
  price DECIMAL(10,2),
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

-- Payment attempts audit log (PayPal, etc.)
CREATE TABLE IF NOT EXISTS payment_attempts (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  booking_id INTEGER,
  attempt_type VARCHAR(50) NOT NULL, -- create_order | capture | verify | webhook
  paypal_order_id TEXT,
  paypal_capture_id TEXT,
  status VARCHAR(50),
  amount DECIMAL(10,2),
  currency VARCHAR(10),
  payload JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shops table: maps Twilio `To` numbers to shop configs
CREATE TABLE IF NOT EXISTS shops (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  hours JSONB,
  services JSONB,
  default_language TEXT DEFAULT 'en',
  greeting TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);