-- supabase/schema_organizations.sql
--
-- Fondasi multi-tenant: PGN, PGSOL, dan tiap vendor company jadi baris
-- `organizations` yang setara. `profiles.org_id` menautkan tiap user ke
-- organisasinya. Lihat docs/superpowers/specs/2026-08-30-multi-tenant-org-
-- foundation-design.md untuk desain lengkap dan urutan migrasi berikutnya
-- (file ini harus dijalankan PALING PERTAMA dari seri schema_org_*.sql).

CREATE TYPE org_kind AS ENUM ('pgn', 'pgsol', 'vendor');

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind org_kind NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Semua user login boleh membaca nama organisasi (dipakai untuk tampilan
-- "perusahaan X" di berbagai halaman) — tidak ada data sensitif di sini.
CREATE POLICY "Authenticated users can read organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (true);

ALTER TABLE public.profiles ADD COLUMN org_id UUID REFERENCES public.organizations(id);
