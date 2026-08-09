-- SIPERMIT K3: Log Uji Kandungan Gas untuk PTW
-- Jalankan script ini di Supabase SQL Editor
--
-- Tipe PTW Panas, Listrik, Ruang Terbatas, dan Penggunaan Kamera mewajibkan
-- Formulir Uji Kandungan Gas (O2/Toxic/Combustible) sebagai lampiran wajib
-- (lihat sheet "Form UjiKand.Gas" pada template PGN). Tanpa kolom ini, hasil
-- uji gas yang dicatat vendor tidak pernah tersimpan dan tidak bisa dicetak
-- ulang di PDF PTW.

ALTER TABLE public.ptw
ADD COLUMN IF NOT EXISTS gas_tests JSONB DEFAULT '[]'::jsonb;
