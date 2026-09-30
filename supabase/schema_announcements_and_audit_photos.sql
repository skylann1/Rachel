-- supabase/schema_announcements_and_audit_photos.sql
--
-- Dua tabel baru, independen dari migrasi lain (tidak butuh backfill,
-- tidak bergantung urutan Fase 1-3.1 di README_org_migration_order.md):
--
--   1. announcements      — konten carousel News/Pengumuman di home
--      dashboard internal & vendor. Dikelola PGN lewat permission
--      'announcement'/'manage' (lihat app/dashboard/master-data/role/
--      constants.ts), bukan hardcode role admin.
--   2. inspection_photos  — galeri multi-foto untuk sisi LAPORAN temuan
--      K3 (inspections.image_url tetap dipertahankan sebagai foto
--      pertama, untuk kompatibilitas baris lama). vendor_evidence_url
--      (bukti perbaikan vendor) sengaja TIDAK disentuh — tetap 1 foto.
--
-- Harus dijalankan SETELAH schema.sql dasar dan migrasi schema_org_*
-- (RLS di bawah memakai public.is_internal_user() dan
-- public.current_vendor_org_id() yang didefinisikan di situ).
--
-- Dijalankan manual di Supabase SQL editor, sesuai konvensi repo ini
-- (lihat AGENTS.md, "Supabase schema changes are manual SQL files").

-- ==============================================================================
-- 1. ANNOUNCEMENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  display_order INT DEFAULT 0 NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Semua user authenticated (pgn/pgsol/vendor) boleh lihat pengumuman aktif —
-- carousel tampil di kedua dashboard home, bukan data sensitif.
DROP POLICY IF EXISTS "Authenticated users can read active announcements" ON public.announcements;
CREATE POLICY "Authenticated users can read active announcements"
ON public.announcements FOR SELECT
TO authenticated
USING (is_active = true);

-- Internal (pgn/pgsol) juga boleh baca baris NONAKTIF — dibutuhkan halaman
-- kelola (getAnnouncementsForManagement) untuk menampilkan semua baris.
-- Mutasi tetap lewat createAdminClient() + gate permission di action, ini
-- backstop RLS saja (pola sama seperti schema_inspections_rls.sql).
DROP POLICY IF EXISTS "Internal users can read all announcements" ON public.announcements;
CREATE POLICY "Internal users can read all announcements"
ON public.announcements FOR SELECT
TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS "Internal users can insert announcements" ON public.announcements;
CREATE POLICY "Internal users can insert announcements"
ON public.announcements FOR INSERT
TO authenticated
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS "Internal users can update announcements" ON public.announcements;
CREATE POLICY "Internal users can update announcements"
ON public.announcements FOR UPDATE
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS "Internal users can delete announcements" ON public.announcements;
CREATE POLICY "Internal users can delete announcements"
ON public.announcements FOR DELETE
TO authenticated
USING (public.is_internal_user());

-- ==============================================================================
-- 2. INSPECTION_PHOTOS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inspection_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID REFERENCES public.inspections(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users can read all inspection photos" ON public.inspection_photos;
CREATE POLICY "Internal users can read all inspection photos"
ON public.inspection_photos FOR SELECT
TO authenticated
USING (public.is_internal_user());

-- inspection_photos sendiri tidak punya target_vendor — vendor boleh baca
-- kalau inspeksi induknya ditujukan ke organisasi mereka.
DROP POLICY IF EXISTS "Vendors can read own inspection photos" ON public.inspection_photos;
CREATE POLICY "Vendors can read own inspection photos"
ON public.inspection_photos FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.inspections i
  WHERE i.id = inspection_photos.inspection_id
  AND i.target_vendor = public.current_vendor_org_id()
));

-- Hanya internal yang membuat laporan (createInspection), sinkron dengan
-- INSERT policy inspections di schema_inspections_rls.sql.
DROP POLICY IF EXISTS "Internal users can insert inspection photos" ON public.inspection_photos;
CREATE POLICY "Internal users can insert inspection photos"
ON public.inspection_photos FOR INSERT
TO authenticated
WITH CHECK (public.is_internal_user());

-- Tidak ada UPDATE/DELETE policy — foto laporan tidak pernah diedit
-- setelah dibuat, sama seperti tidak adanya edit pada inspections sendiri
-- di luar field status/disposisi/validasi.
