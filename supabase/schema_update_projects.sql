-- Add missing columns to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS contract_number TEXT,
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
