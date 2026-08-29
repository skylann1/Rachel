-- supabase/schema_org_roles.sql
--
-- roles.type sudah TEXT bebas (lihat schema_update_role_type.sql), jadi
-- ini murni migrasi DATA, bukan skema. Urutan penting: pgsol_reviewer
-- dipindah duluan supaya tidak ikut tersapu UPDATE generik 'internal'.

UPDATE public.roles SET type = 'pgsol' WHERE name = 'pgsol_reviewer';
UPDATE public.roles SET type = 'pgn' WHERE type = 'internal';
UPDATE public.roles SET type = 'vendor' WHERE type = 'external';

INSERT INTO public.roles (name, description, is_system, type, permissions) VALUES
  (
    'vendor_admin',
    'Admin perusahaan vendor — mengelola staff vendor sendiri.',
    false,
    'vendor',
    '{"dashboard": ["view"], "masterData": ["manage_org_staff"]}'
  ),
  (
    'pgsol_admin',
    'Admin PGSOL — mengelola staff PGSOL sendiri.',
    false,
    'pgsol',
    '{"dashboard": ["view"], "masterData": ["manage_org_staff"]}'
  )
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description, type = EXCLUDED.type, permissions = EXCLUDED.permissions;
