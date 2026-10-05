-- ==============================================================================
-- PROFILES: kolom "jabatan" (job title) per akun
-- ==============================================================================
-- Terpisah dari `role` (slug permission, mis. 'admin'/'hse') — jabatan adalah
-- teks bebas isian admin saat membuat/mengedit akun (mis. "HSE Supervisor
-- Lapangan"), dipakai untuk melengkapi tampilan Riwayat Dokumen (document_logs)
-- dan timeline approval: "siapa" + "jabatan apa" + "aksi apa", bukan cuma nama.
-- Opsional (nullable) — akun lama tanpa jabatan tetap tampil, cuma tanpa label itu.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS jabatan TEXT;

-- ==============================================================================
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR
-- ==============================================================================
