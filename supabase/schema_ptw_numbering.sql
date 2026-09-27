-- Penomoran PTW yang aman terhadap balapan (race).
--
-- Sebelumnya nomor dihitung lewat `count(*)` semua PTW `PTW-<tahun>-%`
-- lalu +1 dari kode aplikasi (app/dashboard/approval/actions.ts). Dua
-- penomoran yang nyaris bersamaan (PTW beda proyek / beda pengguna) bisa
-- mendapat nomor sama; unique index ptw_number cuma membuat yang kalah
-- error — bukan menyelesaikan masalah.
--
-- Ganti dengan penghitung atomik per tahun: INSERT ... ON CONFLICT ...
-- DO UPDATE ... RETURNING adalah satu statement, jadi dua panggilan
-- bersamaan selalu di-serahkan berurutan oleh Postgres dan tak mungkin
-- mendapat nilai yang sama.
--
-- JANGAN dijalankan dua kali tanpa alasan; fungsi dibuat dengan
-- CREATE OR REPLACE dan tabel dengan IF NOT EXISTS, jadi aman diulang.

CREATE TABLE IF NOT EXISTS ptw_numbering (
  "year" INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION get_next_ptw_number(p_year integer)
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  INSERT INTO ptw_numbering ("year", last_number) VALUES (p_year, 1)
  ON CONFLICT ("year")
    DO UPDATE SET last_number = ptw_numbering.last_number + 1
  RETURNING format('PTW-%s-%s', p_year, lpad(last_number::text, 3, '0'));
$$;

-- WAJIB setelah tabel dibuat: sinkronkan counter dengan nomor yang sudah
-- ada. Tanpa ini PTW existing tidak terhitung dan nomor baru bisa bentrok
-- dengan unique index ptw_number. Baris terakhir konsumsi hasilnya supaya
-- editor Supabase tidak menampilkan result set — nilai counter tidak diubah.
INSERT INTO ptw_numbering ("year", last_number)
SELECT
  substring(ptw_number from 5 for 4)::integer AS "year",
  max(substring(ptw_number from 10)::integer) AS last_number
FROM ptw
WHERE ptw_number ~ '^PTW-\d{4}-\d+$'
GROUP BY 1
ON CONFLICT ("year") DO NOTHING;

SELECT 1;