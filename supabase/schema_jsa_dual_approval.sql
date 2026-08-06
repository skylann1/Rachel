-- =====================================================================
-- JSA Dual Approval: PGSOL (review) + PGN (approve)
--
-- Alur JSA menjadi:
--   Draft  ->  Review PGSOL  ->  Persetujuan PGN  ->  JSA Disetujui
--
--   Review PGSOL     : verifikasi teknis oleh Satker Pemberi Kerja (PGSOL)
--   Persetujuan PGN  : otorisasi formal oleh Satker Penanggung Jawab (PGN)
--
-- Dua tahap ini WAJIB dilakukan oleh dua orang yang berbeda.
--
-- Catatan: profiles.role sudah bertipe TEXT (lihat schema_update_roles.sql),
-- jadi role bersifat data-driven lewat tabel public.roles. Tidak perlu
-- mengubah ENUM user_role sama sekali.
-- =====================================================================

-- 1. Daftarkan dua role baru agar muncul di halaman Role & Permission
--    dan agar getUserPermissions() menemukan permissions-nya.
INSERT INTO public.roles (name, description, is_system, type, permissions) VALUES
  (
    'pgsol_reviewer',
    'Reviewer PGSOL — verifikasi teknis JSA (Satker Pemberi Kerja).',
    false,
    'internal',
    '{"dashboard": ["view"], "approval": ["view", "approve"], "jsa": ["view", "review"], "project": ["view"]}'
  ),
  (
    'pgn_approver',
    'Approver PGN — persetujuan akhir JSA (Satker Penanggung Jawab).',
    false,
    'internal',
    '{"dashboard": ["view"], "approval": ["view", "approve"], "jsa": ["view", "approve"], "project": ["view"]}'
  )
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    type        = EXCLUDED.type,
    permissions = EXCLUDED.permissions;

-- 2. Kolom baru pada tabel JSA (penamaan sesuai form: Direview / Disetujui)
ALTER TABLE public.jsa
ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES public.internal_profiles(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approver_id UUID REFERENCES public.internal_profiles(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- 3. Backfill dari kolom lama (pm_* = reviewer, asset_manager_* = approver)
UPDATE public.jsa SET reviewer_id = pm_id            WHERE reviewer_id IS NULL AND pm_id IS NOT NULL;
UPDATE public.jsa SET reviewed_at = pm_approved_at   WHERE reviewed_at IS NULL AND pm_approved_at IS NOT NULL;
UPDATE public.jsa SET approver_id = asset_manager_id WHERE approver_id IS NULL AND asset_manager_id IS NOT NULL;
UPDATE public.jsa SET approved_at = asset_manager_approved_at
                                                     WHERE approved_at IS NULL AND asset_manager_approved_at IS NOT NULL;

-- 4. Migrasi nama status lama -> baru
UPDATE public.jsa SET status = 'Review PGSOL'    WHERE status IN ('Pembahasan JSA', 'Review PM');
UPDATE public.jsa SET status = 'Persetujuan PGN' WHERE status = 'Review Asset Manager';

-- 5. Bersihkan sisa data dari alur lama: bila reviewer dan approver
--    kebetulan orang yang sama, kosongkan approver agar constraint di
--    bawah dapat dipasang dan JSA tsb wajib disetujui ulang oleh orang lain.
UPDATE public.jsa
SET approver_id = NULL, approved_at = NULL, status = 'Persetujuan PGN'
WHERE reviewer_id IS NOT NULL
  AND approver_id IS NOT NULL
  AND reviewer_id = approver_id;

-- 6. Agar vendor dapat melihat NAMA reviewer/approver pada blok tanda tangan
--    formulir JSA. Tanpa ini, kolom "Direview Oleh" dan "Disetujui Oleh" tampil
--    kosong di sisi vendor karena RLS profiles hanya mengizinkan baca profil
--    sendiri atau oleh sesama internal.
--
--    Hanya baris internal yang dibuka, dan tabel profiles hanya berisi
--    id / type / role / full_name (tidak ada email maupun data kontak).
--    Ini konsisten dengan internal_profiles yang memang sudah dapat dibaca
--    seluruh authenticated user (lihat schema_update_profile_policies.sql).
DROP POLICY IF EXISTS "Internal names are viewable by all authenticated users" ON public.profiles;
CREATE POLICY "Internal names are viewable by all authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (type = 'internal');

-- 7. Guard di level database: reviewer dan approver tidak boleh orang yang sama.
--    Ini lapisan terakhir; aplikasi juga sudah menolak lebih dulu dengan pesan yang jelas.
ALTER TABLE public.jsa DROP CONSTRAINT IF EXISTS jsa_reviewer_approver_berbeda;
ALTER TABLE public.jsa
ADD CONSTRAINT jsa_reviewer_approver_berbeda
CHECK (
  reviewer_id IS NULL
  OR approver_id IS NULL
  OR reviewer_id <> approver_id
);
