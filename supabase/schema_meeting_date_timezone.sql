-- Menyamakan "hari ini" untuk tanggal harian (meeting_date dkk) dengan kode
-- JS (lib/site-ops.ts todayDateString(), zona Asia/Jakarta). Sebelumnya
-- default kolom memakai CURRENT_DATE yang bergantung zona sesi Postgres
-- (Supabase umumnya UTC), sehingga di sekitar tengah malam WIB tanggal
-- "hari ini" versi DB bisa berbeda satu hari dengan versi aplikasi.
--
-- JANGAN re-run: cukup dijalankan sekali di SQL Editor Supabase.

ALTER TABLE toolbox_meetings
  ALTER COLUMN meeting_date
  SET DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date);