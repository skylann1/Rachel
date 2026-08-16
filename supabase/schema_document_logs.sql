-- ==============================================================================
-- DOCUMENT LOGS: audit trail for Prosedur / JSA / PTW status changes
-- Mirrors the inspection_logs pattern (schema_update_inspections.sql) but is
-- polymorphic across the three K3 document types instead of one table per type.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.document_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('procedure', 'jsa', 'ptw')),
  doc_id UUID NOT NULL,
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_document_logs_project ON public.document_logs(project_id, created_at);

ALTER TABLE public.document_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all document logs"
ON public.document_logs FOR SELECT
USING (true); -- simplified for MVP, same as inspection_logs

CREATE POLICY "Users can insert document logs"
ON public.document_logs FOR INSERT
WITH CHECK (true); -- simplified for MVP, same as inspection_logs

-- ==============================================================================
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR
-- ==============================================================================
