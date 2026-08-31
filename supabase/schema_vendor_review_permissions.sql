-- supabase/schema_vendor_review_permissions.sql
--
-- Fase 3: vendor_admin butuh izin default untuk jadi kandidat reviewer
-- internal (procedure/jsa/ptw . review_vendor) supaya perusahaan vendor
-- dengan satu admin saja bisa langsung pakai fitur ini tanpa harus bikin
-- role custom dulu lewat halaman Role & Permission. Merge (bukan replace
-- penuh seperti schema_org_roles.sql) supaya tidak menimpa perubahan
-- permission vendor_admin yang mungkin sudah dilakukan admin PGN lewat UI
-- sejak Fase 1. Guarded dengan `NOT ... ? 'review_vendor'` supaya aman
-- dijalankan ulang tanpa menduplikasi entri array.
UPDATE public.roles
SET permissions = jsonb_set(
  permissions, '{procedure}',
  COALESCE(permissions->'procedure', '[]'::jsonb) || '["review_vendor"]'::jsonb
)
WHERE name = 'vendor_admin'
  AND NOT COALESCE(permissions->'procedure', '[]'::jsonb) ? 'review_vendor';

UPDATE public.roles
SET permissions = jsonb_set(
  permissions, '{jsa}',
  COALESCE(permissions->'jsa', '[]'::jsonb) || '["review_vendor"]'::jsonb
)
WHERE name = 'vendor_admin'
  AND NOT COALESCE(permissions->'jsa', '[]'::jsonb) ? 'review_vendor';

UPDATE public.roles
SET permissions = jsonb_set(
  permissions, '{ptw}',
  COALESCE(permissions->'ptw', '[]'::jsonb) || '["review_vendor"]'::jsonb
)
WHERE name = 'vendor_admin'
  AND NOT COALESCE(permissions->'ptw', '[]'::jsonb) ? 'review_vendor';
