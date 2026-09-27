-- supabase/schema_ptw_pgsol_gate_vendor_policy.sql
--
-- PTW: memperluas whitelist status pada policy UPDATE vendor
-- (schema_ptw_vendor_update_policy.sql, terakhir di-superscede oleh
-- schema_org_rls_vendor_scope.sql) supaya dua transisi berikut tidak
-- diam-diam gagal kena RLS (UPDATE cocok nol baris, tanpa error eksplisit):
--
--   1. 'Review Internal Vendor' -> status berikutnya. Ini SEBENARNYA celah
--      lama yang mendahului gerbang PGSOL ini — status 'Review Internal
--      Vendor' tidak pernah ada di USING, jadi approveVendorInternalReview
--      (app/vendor/dashboard/approval/actions.ts) untuk PTW sudah lama gagal
--      diam-diam di production: baris PTW tidak pernah benar-benar
--      meninggalkan 'Review Internal Vendor'. Ditambahkan ke USING di sini
--      karena tanpanya, perbaikan gerbang PGSOL di bawah tidak akan pernah
--      tercapai sama sekali (transisi keluar dari 'Review Internal Vendor'
--      akan tetap gagal duluan).
--   2. 'Review PGSOL' sebagai status HASIL update. approveVendorInternalReview
--      sekarang mengarahkan PTW ke 'Review PGSOL' (bukan lagi langsung ke
--      'Menunggu Approval PM'), dan status itu belum ada di WITH CHECK.
--
-- Murni aditif terhadap whitelist yang sudah ada — 'Draft' dan
-- 'Menunggu Approval PM' tetap dipertahankan di kedua klausa persis seperti
-- sebelumnya, tidak ada yang dicabut.

DROP POLICY IF EXISTS "Vendors can update PTW for their projects" ON public.ptw;

CREATE POLICY "Vendors can update PTW for their projects"
ON public.ptw FOR UPDATE
TO authenticated
USING (
  status IN ('Draft', 'Review Internal Vendor', 'Menunggu Approval PM')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()
  )
)
WITH CHECK (
  -- Hasil update hanya boleh kembali ke antrean approval (Draft), maju ke
  -- Review Internal Vendor (submit/resubmit), atau maju SATU tahap ke
  -- gerbang PGSOL (approveVendorInternalReview) — vendor tidak bisa
  -- mempromosikan PTW-nya sendiri lebih jauh dari itu; approve_pm/
  -- review_issuer/numbering_hsse tetap ditulis lewat approvePtw (internal),
  -- bukan lewat policy vendor ini.
  status IN ('Draft', 'Review Internal Vendor', 'Menunggu Approval PM', 'Review PGSOL')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()
  )
);
