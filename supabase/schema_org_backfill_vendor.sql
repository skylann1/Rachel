-- supabase/schema_org_backfill_vendor.sql
--
-- Dijalankan setelah schema_org_backfill_internal.sql. Label enum
-- 'external' masih valid di sini (rename terjadi setelah file ini, lihat
-- schema_org_rename_type_labels.sql).
--
-- Trik kunci: id organisasi vendor baru DIPAKAI ULANG dari
-- vendor_profiles.id yang sudah ada (dulu = id user vendor). Karena setiap
-- FK lain yang menunjuk vendor_profiles(id) — projects.vendor_id,
-- vendor_workers.vendor_id, vendor_equipment.vendor_id,
-- vendor_materials.vendor_id, vendor_documents.vendor_id — hanya peduli
-- pada NILAI id-nya (bukan tabel mana yang jadi target FK-nya), semua
-- kolom itu otomatis jadi kolom org-id yang valid tanpa UPDATE apa pun.

INSERT INTO public.organizations (id, kind, name)
SELECT id, 'vendor', company_name FROM public.vendor_profiles;

-- Nama constraint di bawah ini asumsi konvensi penamaan default Postgres.
-- Verifikasi dulu lewat `\d vendor_profiles` (atau tab constraints di
-- Supabase Table Editor) sebelum menjalankan file ini — sesuaikan namanya
-- kalau berbeda.
ALTER TABLE public.vendor_profiles DROP CONSTRAINT vendor_profiles_id_fkey;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_org_id_fkey
  FOREIGN KEY (id) REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.profiles p
SET org_id = p.id
WHERE p.type = 'external' AND p.id IN (SELECT id FROM public.vendor_profiles);
