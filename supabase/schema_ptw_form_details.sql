-- SIPERMIT K3: Kelengkapan data formulir PTW
-- Jalankan script ini di Supabase SQL Editor
--
-- Menyesuaikan data yang disimpan dengan form PTW asli PGN (lihat contoh
-- terisi pada "8. JSA PTW - HSSE.Pembongkaran Ruang Limbah.pdf").
--
-- 1. Masa berlaku PTW adalah miliknya sendiri, TERPISAH dari durasi proyek.
--    Pada contoh asli, kontrak proyek dimulai 6 April tetapi PTW-nya hanya
--    berlaku 11-17 April (7 hari) — itu sebabnya kolom checklist harian di
--    form berjudul "Hari ke-1" s/d "Hari ke-7". Sebelumnya aplikasi memakai
--    tanggal proyek, sehingga PTW terlihat berlaku jauh lebih lama dari
--    seharusnya.
-- 2. Jam kerja sebelumnya di-hardcode "08:00 s/d 17:00" di PDF.
-- 3. Kolom khusus Ijin Kerja Panas: "Jenis Pekerjaan Panas" (bagian A) dan
--    frekuensi "Pengujian Kandungan Gas" (bagian E).

ALTER TABLE public.ptw
ADD COLUMN IF NOT EXISTS valid_from DATE,
ADD COLUMN IF NOT EXISTS valid_to DATE,
ADD COLUMN IF NOT EXISTS work_start TEXT,
ADD COLUMN IF NOT EXISTS work_end TEXT,
ADD COLUMN IF NOT EXISTS hot_work_types TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS gas_test_frequency JSONB DEFAULT '{}'::jsonb;
