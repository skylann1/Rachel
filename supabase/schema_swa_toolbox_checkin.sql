-- SIPERMIT K3: Stop Work Authority + Toolbox Meeting + QR Check-in
-- Jalankan script ini di Supabase SQL Editor
--
-- Menambahkan jalur "lapangan tanpa login" untuk PTW yang sudah Aktif:
-- setiap PTW dapat token unik (field_token) yang, lewat halaman publik
-- /checkin/[token], memungkinkan siapa pun di lapangan mencatat toolbox
-- meeting harian, check-in/out pekerja, dan memicu Stop Work Authority
-- tanpa perlu akun. Halaman itu memakai service-role client (lihat
-- utils/supabase/admin.ts) karena tidak ada sesi Supabase untuk dibawa
-- lewat RLS — token itu sendiri adalah batas otorisasinya, divalidasi di
-- kode aplikasi sebelum tiap query.

ALTER TABLE public.ptw
  ADD COLUMN IF NOT EXISTS field_token UUID UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS stopped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stopped_reason TEXT,
  ADD COLUMN IF NOT EXISTS stopped_by_name TEXT;

CREATE TABLE IF NOT EXISTS public.toolbox_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ptw_id UUID NOT NULL REFERENCES public.ptw(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  topics TEXT NOT NULL,
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  conducted_by_id UUID REFERENCES public.profiles(id),
  conducted_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ptw_id UUID NOT NULL REFERENCES public.ptw(id) ON DELETE CASCADE,
  worker_name TEXT NOT NULL,
  checked_in_at TIMESTAMPTZ DEFAULT now(),
  checked_out_at TIMESTAMPTZ,
  method TEXT DEFAULT 'qr'
);

CREATE INDEX IF NOT EXISTS idx_toolbox_meetings_ptw_date ON public.toolbox_meetings(ptw_id, meeting_date);
CREATE INDEX IF NOT EXISTS idx_site_checkins_ptw_open ON public.site_checkins(ptw_id) WHERE checked_out_at IS NULL;

ALTER TABLE public.toolbox_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_checkins ENABLE ROW LEVEL SECURITY;

-- Internal staff: full read access (same helper used throughout schema.sql).
CREATE POLICY "Internal users can read toolbox meetings" ON public.toolbox_meetings
  FOR SELECT USING (public.is_internal_user());
CREATE POLICY "Internal users can read site checkins" ON public.site_checkins
  FOR SELECT USING (public.is_internal_user());

-- Vendor: read/insert only for their own projects.
CREATE POLICY "Vendors can read their own toolbox meetings" ON public.toolbox_meetings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = toolbox_meetings.project_id AND p.vendor_id = auth.uid())
  );
CREATE POLICY "Vendors can log their own toolbox meetings" ON public.toolbox_meetings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = toolbox_meetings.project_id AND p.vendor_id = auth.uid())
  );
CREATE POLICY "Vendors can read their own site checkins" ON public.site_checkins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ptw t JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = site_checkins.ptw_id AND p.vendor_id = auth.uid()
    )
  );

-- No anon policies: the public /checkin/[token] page reads and writes
-- through the service-role admin client, never the anon/session client.
