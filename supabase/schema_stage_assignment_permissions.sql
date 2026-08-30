-- supabase/schema_stage_assignment_permissions.sql
--
-- pgsol_admin (dibuat di schema_org_roles.sql, Fase 1) belum punya
-- kemampuan menunjuk siapa yang mereview JSA tahap PGSOL untuk proyek
-- tertentu — permission baru ini yang membukanya.
UPDATE public.roles
SET permissions = permissions || '{"jsa": ["manage_assignment_pgsol"]}'::jsonb
WHERE name = 'pgsol_admin';
