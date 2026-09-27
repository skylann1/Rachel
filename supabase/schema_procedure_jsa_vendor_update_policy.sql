-- Vendor UPDATE RLS untuk procedures & jsa TIDAK PERNAH punya status
-- whitelist (schema_update_rls_policies.sql) — USING cuma cek kepemilikan
-- proyek, tanpa WITH CHECK sama sekali. Beda dari ptw yang sudah dibenerin
-- di schema_ptw_pgsol_gate_vendor_policy.sql: di sini vendor lewat
-- Supabase client langsung (bukan admin client) bisa update kolom `status`
-- ke NILAI APA PUN pada procedures/jsa milik proyek org mereka sendiri —
-- termasuk lompat langsung ke status "Disetujui", melewati seluruh tahap
-- review PGSOL/HSE PGSOL/PM. Aplikasi sendiri tidak pernah melakukan ini
-- (saveProsedur/saveJsa & approveVendorInternalReview/rejectVendorInternalReview
-- di app/vendor/dashboard/projects/[id]/prosedur|jsa/actions.ts dan
-- app/vendor/dashboard/approval/actions.ts SELALU membatasi diri ke set di
-- bawah), tapi RLS harus menegakkannya sendiri di level DB — bukan cuma
-- dipercayakan ke kode aplikasi — supaya panggilan langsung ke Supabase
-- REST/JS client (di luar server action) tidak bisa memalsukan status.
--
-- Vendor cuma boleh MENYENTUH baris yang masih di tahap merek sendiri
-- (Draft / Review Internal Vendor), dan hasil akhirnya cuma boleh salah
-- satu dari: tetap Draft (reject-cascade), tetap Review Internal Vendor
-- (submit pertama / resubmit), atau maju ke Review PGSOL (approve penuh
-- semua reviewer internal). Internal PGN/PGSOL TIDAK disentuh migrasi ini —
-- kebijakan mereka (`Internal users can update all procedures/jsa`) memang
-- sengaja tanpa whitelist status karena tahapnya dinamis lewat
-- roles.permissions + stage_assignments (lihat lib/procedure-status.ts,
-- lib/jsa-status.ts), bukan celah yang lupa ditutup seperti punya vendor.

DROP POLICY IF EXISTS "Vendors can update procedures for their projects" ON public.procedures;
CREATE POLICY "Vendors can update procedures for their projects"
ON public.procedures FOR UPDATE
TO authenticated
USING (
  status IN ('Draft', 'Review Internal Vendor')
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id())
)
WITH CHECK (
  status IN ('Draft', 'Review Internal Vendor', 'Review PGSOL')
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id())
);

DROP POLICY IF EXISTS "Vendors can update JSA for their projects" ON public.jsa;
CREATE POLICY "Vendors can update JSA for their projects"
ON public.jsa FOR UPDATE
TO authenticated
USING (
  status IN ('Draft', 'Review Internal Vendor')
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id())
)
WITH CHECK (
  status IN ('Draft', 'Review Internal Vendor', 'Review PGSOL')
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id())
);
