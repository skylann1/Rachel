-- supabase/schema_push_subscriptions.sql
--
-- Web Push: menyimpan satu baris per perangkat/browser yang mengaktifkan
-- notifikasi aplikasi — notifikasi yang muncul di notification tray HP walau
-- aplikasi ditutup (mirip WhatsApp/Instagram), bukan sekadar lonceng in-app.
--
-- Alur:
--   - Klien: tombol "Aktifkan" di dropdown lonceng meminta izin notifikasi,
--     lalu pushManager.subscribe() memakai NEXT_PUBLIC_VAPID_PUBLIC_KEY.
--   - Server: app/dashboard/inbox/push-actions.ts menyimpan langganan di sini
--     (upsert berdasarkan endpoint, lewat service role).
--   - Pengiriman: lib/push.ts mengirim lewat web-push ke semua langganan
--     penerima setiap kali notifikasi in-app dibuat (app/dashboard/inbox/
--     actions.ts, lib/assignment-notify.ts, app/checkin/[token]/actions.ts).
--
-- Independen dari migrasi lain (tidak butuh backfill / urutan Fase 1-3.1).
-- Butuh tabel public.profiles (schema.sql). Aman dijalankan ulang.
--
-- Dijalankan manual di Supabase SQL editor, sesuai konvensi repo ini
-- (lihat AGENTS.md, "Supabase schema changes are manual SQL files").

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  -- Setiap perangkat/browser punya endpoint unik dari layanan push-nya.
  -- UNIQUE supaya aktivasi ulang di perangkat yang sama tidak menumpuk baris.
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Pengguna hanya boleh membaca/mengubah langganan miliknya sendiri.
-- Penulisan saat aktivasi dilakukan lewat service role (push-actions.ts):
-- satu endpoint bisa dipakai ulang oleh akun lain di perangkat/browser yang
-- sama, dan upsert-nya harus boleh memindahkan kepemilikan baris tersebut.
-- Pengiriman push (lib/push.ts) juga lewat service role. Policy di bawah ini
-- backstop untuk akses langsung dari klien.
DROP POLICY IF EXISTS "Users can read own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can read own push subscriptions"
ON public.push_subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert own push subscriptions"
ON public.push_subscriptions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own push subscriptions"
ON public.push_subscriptions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions"
ON public.push_subscriptions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
