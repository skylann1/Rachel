-- supabase/schema_activity_log.sql
--
-- Dua tabel baru, additive dan independen dari migrasi lain (tidak butuh
-- backfill, tidak bergantung urutan Fase 1-3.1):
--
--   1. activity_logs — jejak aksi di luar alur approval dokumen K3: login,
--      logout, dan CRUD Master Data. Approval Prosedur/JSA/PTW tetap di
--      document_logs; halaman Log Aktivitas menggabungkan keduanya saat
--      dibaca, tanpa menulis ganda.
--   2. user_presence — satu baris per user, di-upsert heartbeat client tiap
--      60 detik (current_path + last_seen_at). Dipisah dari profiles dengan
--      sengaja: baris ini berubah jauh lebih sering daripada profil, dan
--      profiles dibaca di puluhan tempat.
--
-- RLS sengaja permisif untuk SELECT/INSERT (sama pola document_logs): akses
-- sebenarnya dijaga di sisi aplikasi lewat permission 'activityLog'/'view'.
--
-- Dijalankan manual di Supabase SQL editor (lihat AGENTS.md). Aman
-- dijalankan ulang.

-- ==============================================================================
-- 1. ACTIVITY LOGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'auth', 'vendor', 'account', 'role', 'project', 'announcement', 'pgsol_assignment'
  )),
  entity_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON public.activity_logs(actor_id, created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all activity logs" ON public.activity_logs;
CREATE POLICY "Users can read all activity logs"
ON public.activity_logs FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can insert activity logs" ON public.activity_logs;
CREATE POLICY "Users can insert activity logs"
ON public.activity_logs FOR INSERT
WITH CHECK (true);

-- ==============================================================================
-- 2. USER PRESENCE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  current_path TEXT,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all presence" ON public.user_presence;
CREATE POLICY "Users can read all presence"
ON public.user_presence FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can insert own presence" ON public.user_presence;
CREATE POLICY "Users can insert own presence"
ON public.user_presence FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own presence" ON public.user_presence;
CREATE POLICY "Users can update own presence"
ON public.user_presence FOR UPDATE
USING (auth.uid() = user_id);
