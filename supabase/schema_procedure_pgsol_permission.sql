-- supabase/schema_procedure_pgsol_permission.sql
--
-- Prosedur Kerja mendapat gerbang PGSOL baru (menyamakan pola dengan JSA:
-- vendor -> PGSOL -> PGN). Role pgsol_reviewer sudah pegang jsa.review_pgsol
-- (lihat schema_permission_driven_approval.sql) — orang yang sama harus
-- otomatis jadi kandidat review Prosedur Kerja juga, tanpa admin PGSOL perlu
-- setup role baru dulu lewat halaman Role & Permission. Merge (bukan
-- replace penuh) dan di-guard idempoten, pola sama seperti
-- schema_vendor_review_permissions.sql. Tidak ada perubahan RLS di sini —
-- policy "Internal users can write stage assignments" (is_internal_user(),
-- sudah mencakup PGSOL) sudah otomatis mengizinkan stage_key baru ini.
UPDATE public.roles
SET permissions = jsonb_set(
  permissions, '{procedure}',
  COALESCE(permissions->'procedure', '[]'::jsonb) || '["review_pgsol"]'::jsonb
)
WHERE name = 'pgsol_reviewer'
  AND NOT COALESCE(permissions->'procedure', '[]'::jsonb) ? 'review_pgsol';
