-- supabase/schema_activity_log_advanced.sql
--
-- Lanjutan schema_activity_log.sql (WAJIB dijalankan setelahnya). Menambahkan:
--
--   1. activity_logs.ip_address / user_agent / metadata — jejak perangkat dan
--      detail perubahan (sebelum → sesudah) untuk audit.
--   2. public.can_view_activity_log() — gerbang baca di level DB: admin, atau
--      role yang memegang permission activityLog.view. Dipakai policy di bawah.
--   3. Pengetatan RLS. Versi pertama sengaja permisif (USING true, sama pola
--      document_logs), tapi sekarang tabel ini memuat IP, user agent, dan
--      isi perubahan permission — tidak boleh terbaca vendor/PGSOL lewat API.
--      INSERT juga dikunci ke actor_id = auth.uid() supaya tidak ada yang bisa
--      memalsukan log atas nama orang lain. Login gagal (belum ada sesi) ditulis
--      server pakai service role, yang melewati RLS.
--   4. presence_history — riwayat halaman yang dibuka per user (satu baris per
--      "kunjungan" halaman), sumber timeline di drawer detail user.
--   5. user_presence masuk publikasi supabase_realtime — tab Pengguna Online
--      berlangganan perubahannya. Realtime menghormati RLS, jadi hanya
--      pemegang activityLog.view yang menerima eventnya.
--
-- Dijalankan manual di Supabase SQL editor (lihat AGENTS.md). Aman dijalankan
-- ulang.

-- ==============================================================================
-- 1. KOLOM BARU activity_logs
-- ==============================================================================
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_activity_logs_action_created
  ON public.activity_logs(action, created_at DESC);

-- ==============================================================================
-- 2. GERBANG BACA
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.can_view_activity_log()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.roles r ON r.name = p.role
    WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR (r.permissions -> 'activityLog') ? 'view')
  );
$$;

-- ==============================================================================
-- 3. RLS activity_logs
-- ==============================================================================
DROP POLICY IF EXISTS "Users can read all activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Activity log viewers can read" ON public.activity_logs;
CREATE POLICY "Activity log viewers can read"
ON public.activity_logs FOR SELECT
USING (public.can_view_activity_log());

DROP POLICY IF EXISTS "Users can insert activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert own activity logs" ON public.activity_logs;
CREATE POLICY "Users can insert own activity logs"
ON public.activity_logs FOR INSERT
WITH CHECK (actor_id = auth.uid());

-- ==============================================================================
-- 4. RLS user_presence (baca: milik sendiri atau pemegang activityLog.view)
-- ==============================================================================
DROP POLICY IF EXISTS "Users can read all presence" ON public.user_presence;
DROP POLICY IF EXISTS "Users can read own or viewer presence" ON public.user_presence;
CREATE POLICY "Users can read own or viewer presence"
ON public.user_presence FOR SELECT
USING (auth.uid() = user_id OR public.can_view_activity_log());

-- ==============================================================================
-- 5. PRESENCE HISTORY
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.presence_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  path TEXT,
  entered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_presence_history_user
  ON public.presence_history(user_id, entered_at DESC);

ALTER TABLE public.presence_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own or viewer presence history" ON public.presence_history;
CREATE POLICY "Read own or viewer presence history"
ON public.presence_history FOR SELECT
USING (auth.uid() = user_id OR public.can_view_activity_log());

DROP POLICY IF EXISTS "Insert own presence history" ON public.presence_history;
CREATE POLICY "Insert own presence history"
ON public.presence_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update own presence history" ON public.presence_history;
CREATE POLICY "Update own presence history"
ON public.presence_history FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete own presence history" ON public.presence_history;
CREATE POLICY "Delete own presence history"
ON public.presence_history FOR DELETE
USING (auth.uid() = user_id);

-- ==============================================================================
-- 6. REALTIME
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
  END IF;
END $$;
