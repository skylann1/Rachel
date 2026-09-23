-- SIPERMIT K3: Kebutuhan sumber daya per langkah JSA (asal: prosedur kerja)
-- Jalankan script ini di Supabase SQL Editor
--
-- Setiap sub-langkah TAHAPAN PEKERJAAN pada prosedur kerja (content
-- tahapanPekerjaan[].points[].kebutuhan) sekarang bisa membawa kebutuhan:
-- pekerja, peralatan, material, dan APD. Kebutuhan tiap bagian tahapan
-- diagregat ke satu langkah JSA yang bersangkutan dan disimpan di kolom ini
-- supaya bisa dipakai sebagai prefill (auto-check) form PTW nanti.
--
-- Format: objek StepKebutuhan —
-- { "workers": [{id,label}], "equipment": [{id,label}],
--   "materials": [{id,label}], "apd": {kategori: [butir,...]} }.
-- Material DOKUMEN saja (tidak ikut prefill PTW). Baris lama bernilai {}.

ALTER TABLE public.jsa_steps
ADD COLUMN IF NOT EXISTS kebutuhan JSONB DEFAULT '{}'::jsonb;