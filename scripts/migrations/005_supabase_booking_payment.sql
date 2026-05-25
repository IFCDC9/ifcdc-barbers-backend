-- Supabase: extend `bookings` + add `payment_transactions` (run in SQL editor).

alter table public.bookings
  add column if not exists paypal_order_id text,
  add column if not exists paypal_capture_id text,
  add column if not exists deposit_amount numeric(10, 2) default 0,
  add column if not exists remaining_balance numeric(10, 2) default 0;

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  paypal_order_id text,
  capture_id text,
  amount numeric(10, 2) not null,
  platform_fee numeric(10, 2) not null default 0.99,
  payment_status text not null default 'completed',
  created_at timestamptz not null default now()
);

create index if not exists payment_transactions_booking_id_idx
  on public.payment_transactions (booking_id);

create index if not exists payment_transactions_capture_id_idx
  on public.payment_transactions (capture_id);
