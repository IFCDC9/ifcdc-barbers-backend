-- =============================================================================
-- Supabase: Realtime + strict RLS + Storage (run in SQL Editor)
-- Prerequisites:
--   1. Run backend migrations (includes auth_bridge): node src/db/migrate.js
--   2. Tables: appointments, customers, barber_style_photos
--   3. Auth: enable "Anonymous sign-ins" if clients may use anon fallback (Dashboard → Auth → Providers)
--   4. Env: SUPABASE_SERVICE_ROLE_KEY on the API for /api/auth/supabase-bridge
-- Duplicate ALTER PUBLICATION / policy errors can be ignored when re-running.
-- =============================================================================

-- ---- Realtime ----------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.barber_style_photos;

-- ---- Storage bucket (public read; uploads scoped by path prefix = auth.uid) --
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'barber-styles',
  'barber-styles',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---- Drop legacy permissive policies ---------------------------------------
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_style_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_select_all" ON public.appointments;
DROP POLICY IF EXISTS "appointments_insert_all" ON public.appointments;
DROP POLICY IF EXISTS "appointments_update_all" ON public.appointments;
DROP POLICY IF EXISTS "appointments_delete_all" ON public.appointments;
DROP POLICY IF EXISTS "appointments_all_authenticated" ON public.appointments;

DROP POLICY IF EXISTS "customers_select_all" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_all" ON public.customers;
DROP POLICY IF EXISTS "customers_update_all" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_all" ON public.customers;
DROP POLICY IF EXISTS "customers_all_authenticated" ON public.customers;

DROP POLICY IF EXISTS "barber_style_photos_select_all" ON public.barber_style_photos;
DROP POLICY IF EXISTS "barber_style_photos_insert_all" ON public.barber_style_photos;
DROP POLICY IF EXISTS "barber_style_photos_update_all" ON public.barber_style_photos;
DROP POLICY IF EXISTS "barber_style_photos_delete_all" ON public.barber_style_photos;
DROP POLICY IF EXISTS "barber_style_photos_select_public" ON public.barber_style_photos;
DROP POLICY IF EXISTS "barber_style_photos_insert_auth" ON public.barber_style_photos;
DROP POLICY IF EXISTS "barber_style_photos_update_auth" ON public.barber_style_photos;
DROP POLICY IF EXISTS "barber_style_photos_delete_auth" ON public.barber_style_photos;

-- Appointments & customers: only authenticated JWT (app bridge or anonymous auth)
CREATE POLICY "appointments_all_authenticated"
  ON public.appointments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "customers_all_authenticated"
  ON public.customers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Style gallery: public read; writes require authenticated session
CREATE POLICY "barber_style_photos_select_public"
  ON public.barber_style_photos
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "barber_style_photos_insert_auth"
  ON public.barber_style_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "barber_style_photos_update_auth"
  ON public.barber_style_photos
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "barber_style_photos_delete_auth"
  ON public.barber_style_photos
  FOR DELETE
  TO authenticated
  USING (true);

-- ---- Storage object policies -------------------------------------------------
DROP POLICY IF EXISTS "barber_styles_public_read" ON storage.objects;
DROP POLICY IF EXISTS "barber_styles_auth_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "barber_styles_auth_update_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "barber_styles_auth_delete_own_folder" ON storage.objects;

CREATE POLICY "barber_styles_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'barber-styles');

-- First path segment must equal auth.uid() (set by mobile uploads)
CREATE POLICY "barber_styles_auth_insert_own_folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'barber-styles'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "barber_styles_auth_update_own_folder"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'barber-styles'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "barber_styles_auth_delete_own_folder"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'barber-styles'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
