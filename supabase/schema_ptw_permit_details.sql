-- SIPERMIT K3: Kolom detail PTW (tipe izin, sumber bahaya, APD)
-- Jalankan script ini di Supabase SQL Editor
--
-- Tanpa kolom ini, tipe PTW / bahaya / APD yang dipilih vendor saat
-- pengajuan tidak pernah tersimpan, sehingga PTW yang sudah terbit tidak
-- bisa dicetak ulang dengan format lengkap (checklist keselamatan sesuai
-- tipe izin, sumber bahaya, dan APD yang relevan).

ALTER TABLE public.ptw
ADD COLUMN IF NOT EXISTS ptw_type TEXT,
ADD COLUMN IF NOT EXISTS hazards TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS apd JSONB DEFAULT '{}'::jsonb;
