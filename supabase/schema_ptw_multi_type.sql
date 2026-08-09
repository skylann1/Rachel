-- SIPERMIT K3: Multi-tipe PTW per proyek
-- Jalankan script ini di Supabase SQL Editor
--
-- Satu pekerjaan bisa membutuhkan beberapa PTW simultan dengan tipe berbeda
-- (mis. Kerja Dingin + Kerja di Ketinggian + Kerja Panas sekaligus) yang
-- merujuk ke JSA dan Prosedur Kerja yang sama. Sebelumnya aplikasi hanya
-- pernah menulis 1 baris ptw per project_id (dipaksa di kode lewat savePtw,
-- bukan di skema), jadi mengajukan tipe PTW kedua diam-diam menimpa data
-- tipe pertama. Constraint ini menjadikan (project_id, ptw_type) kunci unik
-- sungguhan, sekaligus mengizinkan banyak tipe berbeda per proyek.
--
-- Aman dijalankan kapan saja: karena aplikasi hari ini hanya pernah menulis
-- satu baris per project_id, tidak mungkin ada duplikat (project_id,
-- ptw_type) yang melanggar constraint di bawah.

-- Baris lama (dibuat sebelum schema_ptw_permit_details.sql) mungkin punya
-- ptw_type NULL; NOT NULL di bawah butuh nilai default historis.
UPDATE public.ptw SET ptw_type = 'dingin' WHERE ptw_type IS NULL;

ALTER TABLE public.ptw
  ALTER COLUMN ptw_type SET NOT NULL;

ALTER TABLE public.ptw
  ADD CONSTRAINT ptw_project_type_unique UNIQUE (project_id, ptw_type);
