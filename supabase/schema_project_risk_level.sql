-- supabase/schema_project_risk_level.sql
--
-- Kategori Risiko Proyek (low | moderate | high). Radio "Kategori Risiko Proyek"
-- di form Buat Proyek sebelumnya tidak disimpan ke mana pun; kolom ini
-- menyimpannya dan dipakai membedakan tampilan kartu proyek (internal & vendor).
-- NULL = belum diatur (proyek lama). Idempoten.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS risk_level text;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_risk_level_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_risk_level_check
  CHECK (risk_level IS NULL OR risk_level IN ('low', 'moderate', 'high'));
