-- supabase/schema_inspections_rls.sql
--
-- RLS policies untuk tabel `inspections`.
--
-- Sampai migration ini, `inspections` sudah ENABLE ROW LEVEL SECURITY
-- (schema.sql) tapi TIDAK pernah diberi satu policy pun di source of truth —
-- file policy yang ada hanya menyentuh `inspection_logs`.
-- (schema_document_logs.sql bahkan menyebut "schema_update_inspections.sql"
-- sebagai referensi pola, padahal file itu tidak berisi policy inspections.)
-- Akibatnya DB yang dibangun dari SQL editor murni tidak bisa membaca/
-- menulis inspeksi oleh role apa pun. Migration ini menutup celah itu
-- (drop + recreate supaya idempotent & aman dijalankan lagi di DB yang
-- sudah di-patch manual lewat dashboard).
--
-- Pola pemisahan akses sama dengan tabel dokumen lain:
--   - Internal (PGN/PGSOL, via is_internal_user())  -> baca tulis SEMUA baris
--   - Vendor (via current_vendor_org_id())          -> baca/tulis baris yang
--     target_vendor-nya = organisasi pemanggil. target_vendor menunjuk
--     vendor_profiles(id) = organizations(id), BUKAN auth.uid().

-- ===== SELECT =====
DROP POLICY IF EXISTS "Internal users can read all inspections" ON public.inspections;
CREATE POLICY "Internal users can read all inspections"
ON public.inspections FOR SELECT
TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS "Vendors can read own inspections" ON public.inspections;
CREATE POLICY "Vendors can read own inspections"
ON public.inspections FOR SELECT
TO authenticated
USING (target_vendor = public.current_vendor_org_id());

-- ===== INSERT =====
-- Hanya internal yang melapor temuan; vendor hanya menindaklanjuti
-- (UPDATE), tidak membuat sendiri.
DROP POLICY IF EXISTS "Internal users can create inspections" ON public.inspections;
CREATE POLICY "Internal users can create inspections"
ON public.inspections FOR INSERT
TO authenticated
WITH CHECK (public.is_internal_user());

-- ===== UPDATE =====
DROP POLICY IF EXISTS "Internal users can update inspections" ON public.inspections;
CREATE POLICY "Internal users can update inspections"
ON public.inspections FOR UPDATE
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

-- Vendor boleh memperbarui respons/bukti perbaikan pada temuan milik
-- company-nya; WITH CHECK menjaga target_vendor tidak bisa digeser ke
-- organisasi lain lewat update.
DROP POLICY IF EXISTS "Vendors can update own inspections" ON public.inspections;
CREATE POLICY "Vendors can update own inspections"
ON public.inspections FOR UPDATE
TO authenticated
USING (target_vendor = public.current_vendor_org_id())
WITH CHECK (target_vendor = public.current_vendor_org_id());