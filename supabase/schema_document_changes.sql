-- Riwayat perubahan isi dokumen (JSA / PTW) saat reviewer mengubah langsung.
-- Prosedur Kerja menyimpan riwayatnya di procedures.content.changeLog (JSONB),
-- sedangkan JSA & PTW tidak punya kolom content, jadi memakai tabel ini.
-- Idempotent. Dijalankan manual di Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.document_changes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  doc_type    TEXT NOT NULL CHECK (doc_type IN ('procedure', 'jsa', 'ptw')),
  doc_id      UUID NOT NULL,
  actor_id    UUID REFERENCES public.profiles(id),
  actor_name  TEXT,
  actor_label TEXT,            -- tahap/peran pengubah, mis. "HSE PGSOL"
  summary     TEXT NOT NULL,
  note        TEXT,
  changes     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{label, kind, before, after, isImage}]
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_document_changes_doc ON public.document_changes(doc_type, doc_id, created_at);
CREATE INDEX IF NOT EXISTS idx_document_changes_project ON public.document_changes(project_id, created_at);

ALTER TABLE public.document_changes ENABLE ROW LEVEL SECURITY;

-- Sama dengan document_logs: terbaca semua user login. Tulis hanya atas nama diri sendiri.
DROP POLICY IF EXISTS "Authenticated can read document changes" ON public.document_changes;
CREATE POLICY "Authenticated can read document changes"
ON public.document_changes FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users insert own document changes" ON public.document_changes;
CREATE POLICY "Users insert own document changes"
ON public.document_changes FOR INSERT
TO authenticated
WITH CHECK (actor_id = auth.uid());
