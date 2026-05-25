-- Run in Supabase SQL editor (or psql) after `bookings` exists.
-- Stores unified checkout amounts: haircut + platform fee = total_price.

alter table public.bookings
  add column if not exists haircut_price numeric(10, 2),
  add column if not exists platform_fee numeric(10, 2),
  add column if not exists total_price numeric(10, 2);
