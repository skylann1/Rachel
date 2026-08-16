-- SIPERMIT K3: Documentation photo for incident reports
-- Jalankan script ini di Supabase SQL Editor

ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS image_url TEXT;
