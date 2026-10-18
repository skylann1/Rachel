-- supabase/schema_inspection_activity_type.sql
--
-- "Tipe Kegiatan" inspeksi: Proyek | Non-Proyek | Audit / Kunjungan.
-- "Audit / Kunjungan" sebelumnya disimpan sebagai finding_type; sekarang
-- menjadi tipe kegiatan, sedangkan Jenis Temuan tetap Unsafe Condition /
-- Unsafe Act / Near Miss. Kolom finding_type tidak berubah (teks bebas).
--
-- Idempoten. Baris lama di-backfill dari is_project_activity dan
-- finding_type = 'Audit / Kunjungan' (nilai finding_type lama dibiarkan agar
-- riwayat tetap terbaca).

ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS activity_type text;

UPDATE public.inspections
SET activity_type = CASE
  WHEN finding_type = 'Audit / Kunjungan' THEN 'Audit / Kunjungan'
  WHEN is_project_activity IS FALSE THEN 'Non-Proyek'
  ELSE 'Proyek'
END
WHERE activity_type IS NULL;

ALTER TABLE public.inspections
  ALTER COLUMN activity_type SET DEFAULT 'Proyek',
  ALTER COLUMN activity_type SET NOT NULL;

ALTER TABLE public.inspections
  DROP CONSTRAINT IF EXISTS inspections_activity_type_check;
ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_activity_type_check
  CHECK (activity_type IN ('Proyek', 'Non-Proyek', 'Audit / Kunjungan'));
