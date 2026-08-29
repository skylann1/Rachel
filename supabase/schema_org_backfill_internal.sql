-- supabase/schema_org_backfill_internal.sql
--
-- Dijalankan setelah schema_organizations.sql dan
-- schema_org_add_pgsol_type.sql. Label enum 'internal' masih valid di sini
-- (rename terjadi belakangan, lihat schema_org_rename_type_labels.sql).

DO $$
DECLARE
  pgn_org_id UUID;
  pgsol_org_id UUID;
BEGIN
  INSERT INTO public.organizations (kind, name) VALUES ('pgn', 'PGN')
  RETURNING id INTO pgn_org_id;

  INSERT INTO public.organizations (kind, name) VALUES ('pgsol', 'PGSOL')
  RETURNING id INTO pgsol_org_id;

  UPDATE public.profiles
  SET org_id = pgsol_org_id, type = 'pgsol'
  WHERE type = 'internal' AND role = 'pgsol_reviewer';

  UPDATE public.profiles
  SET org_id = pgn_org_id
  WHERE type = 'internal' AND role <> 'pgsol_reviewer';
END $$;
