-- supabase/schema_doc_sync_flags.sql
--
-- Penanda "perlu ditinjau ulang" untuk dokumen yang berubah OTOMATIS karena
-- sinkronisasi Prosedur ⇄ JSA ⇄ PTW (lihat lib/doc-sync.ts). Dibersihkan saat
-- reviewer memutuskan atau vendor mengajukan ulang. Status approval tidak disentuh.
-- Idempoten, kolom nullable. Kode tetap jalan tanpa migrasi ini (penanda dilewati),
-- tetapi banner "perlu ditinjau ulang" baru muncul setelah kolom ada.

ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS needs_review_since  timestamptz,
  ADD COLUMN IF NOT EXISTS needs_review_reason text;

ALTER TABLE public.jsa
  ADD COLUMN IF NOT EXISTS needs_review_since  timestamptz,
  ADD COLUMN IF NOT EXISTS needs_review_reason text;

ALTER TABLE public.ptw
  ADD COLUMN IF NOT EXISTS needs_review_since  timestamptz,
  ADD COLUMN IF NOT EXISTS needs_review_reason text;
