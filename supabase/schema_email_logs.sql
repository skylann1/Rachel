-- ==============================================================================
-- EMAIL LOGS: catatan setiap percobaan kirim email (Resend) untuk halaman
-- Sistem → Log Email & Notifikasi.
--
-- status:
--   sent    — Resend menerima email
--   failed  — Resend menolak / error jaringan (kolom error terisi)
--   skipped — RESEND_API_KEY belum diset, email tidak dikirim sama sekali
--
-- Hanya ditulis & dibaca lewat service role (utils/supabase/admin.ts), jadi RLS
-- aktif TANPA policy: user biasa tidak bisa melihat isi tabel ini.
-- Aman dijalankan ulang (IF NOT EXISTS).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error TEXT,
  provider_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_logs_created ON public.email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status, created_at DESC);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
