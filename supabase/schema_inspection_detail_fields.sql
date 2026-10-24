-- Inspeksi Temuan: field lengkap untuk form lapor + halaman detail.
-- Semua kolom nullable; baris lama tetap valid. Idempotent.
-- Harus dijalankan SEBELUM deploy kode form lengkap / halaman detail
-- (createInspection dan halaman detail menulis/membaca kolom ini).
-- Daftar list (getInspections) sengaja TIDAK membaca kolom baru ini.
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS description      TEXT,         -- uraian detail temuan (title tetap ringkasan)
  ADD COLUMN IF NOT EXISTS category         TEXT,         -- kategori bahaya (APD, Bekerja di Ketinggian, dst)
  ADD COLUMN IF NOT EXISTS found_at         TIMESTAMPTZ,  -- waktu temuan di lapangan
  ADD COLUMN IF NOT EXISTS root_cause       TEXT,         -- dugaan akar penyebab
  ADD COLUMN IF NOT EXISTS immediate_action TEXT,         -- tindakan segera yang sudah dilakukan di tempat
  ADD COLUMN IF NOT EXISTS recommendation   TEXT,         -- rekomendasi / instruksi perbaikan ke vendor
  ADD COLUMN IF NOT EXISTS reference_std    TEXT,         -- referensi regulasi / SOP / pasal
  ADD COLUMN IF NOT EXISTS due_date         DATE;         -- batas waktu perbaikan (SLA)
