-- =====================================================================
-- Perbaikan lanjutan Fase 1 (multi-tenant organizations)
--
-- Dijalankan PALING AKHIR dari seri schema_org_*.sql (langkah 9, lihat
-- README_org_migration_order.md). Tiga perbaikan yang saling terkait:
--
--   1. handle_new_user() tidak boleh lagi menyisipkan baris
--      `vendor_profiles` — sejak schema_org_backfill_vendor.sql,
--      `vendor_profiles.id` menunjuk `organizations(id)`, sedangkan
--      `new.id` adalah id auth user BARU. INSERT-nya pasti melanggar FK
--      dan menggagalkan SELURUH auth.admin.createUser(), sehingga tidak
--      ada akun tipe apa pun yang bisa dibuat.
--   2. Anggota organisasi belum punya policy SELECT untuk membaca profil
--      rekan satu organisasinya — halaman /vendor/dashboard/staff dan
--      /pgsol/dashboard/staff cuma menampilkan dirinya sendiri.
--   3. Policy self-update `vendor_profiles` masih memakai
--      `auth.uid() = id`, padahal id-nya sekarang id organisasi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. handle_new_user(): hapus INSERT ke vendor_profiles
--
-- Baris company (vendor_profiles) sekarang dibuat oleh aplikasi pada id
-- ORGANISASI, bukan oleh trigger pada id user — lihat addAccount() di
-- app/dashboard/master-data/account/actions.ts dan addVendor() di
-- app/dashboard/master-data/vendor/actions.ts. Untuk tipe 'vendor'
-- trigger ini cukup membuat baris `profiles` saja.
--
-- SET search_path = public tetap dipertahankan (trigger berjalan di
-- konteks skema auth, lihat schema_fix_handle_new_user_role.sql).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_type public.user_type;
  new_role TEXT;
BEGIN
  new_type := COALESCE((new.raw_user_meta_data->>'type')::public.user_type, 'vendor'::public.user_type);
  new_role := COALESCE(new.raw_user_meta_data->>'role', 'vendor');

  INSERT INTO public.profiles (id, full_name, role, type)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new_role,
    new_type
  );

  IF new_type <> 'vendor' THEN
    INSERT INTO public.internal_profiles (id, nip)
    VALUES (new.id, new.raw_user_meta_data->>'nip');
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------
-- 2. Anggota organisasi boleh membaca profil rekan satu organisasi
--
-- Tanpa policy ini, satu-satunya policy SELECT yang cocok untuk user
-- vendor/PGSOL adalah "auth.uid() = id" (schema.sql), sehingga daftar
-- staff di /vendor/dashboard/staff dan /pgsol/dashboard/staff selalu
-- berisi tepat satu baris (dirinya sendiri).
--
-- current_vendor_org_id() (schema_org_rls_vendor_scope.sql) mengembalikan
-- org_id milik pemanggil; NULL org_id gagal-tertutup karena `NULL = NULL`
-- bukan TRUE.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can read their own organization's profiles" ON public.profiles;
CREATE POLICY "Org members can read their own organization's profiles" ON public.profiles
FOR SELECT USING (org_id = public.current_vendor_org_id());

-- ---------------------------------------------------------------------
-- 3. Self-update vendor_profiles memakai id ORGANISASI
--
-- Menggantikan policy dengan nama yang sama di
-- schema_self_update_profiles.sql (file itu sengaja tidak diedit —
-- konvensi repo ini additif, migrasi lama tidak pernah diubah).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendors can update their own vendor profile" ON public.vendor_profiles;
CREATE POLICY "Vendors can update their own vendor profile"
ON public.vendor_profiles FOR UPDATE
USING (id = public.current_vendor_org_id())
WITH CHECK (id = public.current_vendor_org_id());

-- Verifikasi: policy SELECT baru harus muncul di profiles, dan policy
-- UPDATE vendor_profiles harus memakai current_vendor_org_id().
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (tablename = 'profiles' AND policyname = 'Org members can read their own organization''s profiles')
    OR (tablename = 'vendor_profiles' AND cmd = 'UPDATE')
  )
ORDER BY tablename, policyname;
