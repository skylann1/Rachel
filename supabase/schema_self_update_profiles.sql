-- SIPERMIT K3: Self-service profile edits
-- Jalankan script ini di Supabase SQL Editor
--
-- profiles/internal_profiles/vendor_profiles have RLS enabled but no
-- self-scoped UPDATE policy, so the profile-edit forms (internal & vendor)
-- silently affect 0 rows under RLS instead of persisting changes.
--
-- Safe to re-run: each policy is dropped first. Without the DROP, a re-run
-- aborts the whole batch on the first "policy already exists" error and the
-- remaining policies never get created.

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own internal profile" ON public.internal_profiles;
CREATE POLICY "Users can update their own internal profile"
ON public.internal_profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Vendors can update their own vendor profile" ON public.vendor_profiles;
CREATE POLICY "Vendors can update their own vendor profile"
ON public.vendor_profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Verify: expect exactly three rows (one UPDATE policy per table).
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'internal_profiles', 'vendor_profiles')
  AND cmd = 'UPDATE'
ORDER BY tablename;
