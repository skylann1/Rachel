-- supabase/schema_announcements_advanced.sql
--
-- News & Pengumuman tingkat lanjut: konten panjang + lampiran, kategori,
-- target audiens (PGN / PGSOL / Vendor), jadwal terbit & kedaluwarsa, pin,
-- wajib-baca, dan pelacakan pembaca. Bergantung pada
-- schema_announcements_and_audit_photos.sql (tabel `announcements`) dan fungsi
-- public.is_internal_user(). Idempoten.
--
-- Catatan: filter audiens / jadwal dilakukan di sisi aplikasi (query server),
-- bukan RLS — isi pengumuman bukan data sensitif (sama seperti carousel lama).

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS content       text,
  ADD COLUMN IF NOT EXISTS category      text        NOT NULL DEFAULT 'Info',
  ADD COLUMN IF NOT EXISTS audience      text[]      NOT NULL DEFAULT ARRAY['pgn','pgsol','vendor'],
  ADD COLUMN IF NOT EXISTS publish_at    timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at    timestamptz,
  ADD COLUMN IF NOT EXISTS is_pinned     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_mandatory  boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attachments   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notified_at   timestamptz;

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at         timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS announcement_reads_user_idx ON public.announcement_reads (user_id);

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own announcement reads" ON public.announcement_reads;
CREATE POLICY "Users read own announcement reads"
ON public.announcement_reads FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_internal_user());

DROP POLICY IF EXISTS "Users insert own announcement reads" ON public.announcement_reads;
CREATE POLICY "Users insert own announcement reads"
ON public.announcement_reads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own announcement reads" ON public.announcement_reads;
CREATE POLICY "Users update own announcement reads"
ON public.announcement_reads FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
