-- Role per organisasi: admin vendor / PGSOL boleh membuat & mengatur role
-- sendiri, tapi hanya untuk organisasinya.
--   org_id IS NULL     -> role global (system / dibuat PGN), hanya dikelola PGN
--   org_id = <org>     -> role milik satu organisasi, dikelola admin org itu
-- Idempotent. Jalankan setelah schema_org_* (butuh tabel organizations).
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS roles_org_id_idx ON public.roles(org_id);
