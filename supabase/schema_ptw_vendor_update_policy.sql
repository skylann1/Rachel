-- PTW: policy UPDATE untuk vendor.
--
-- schema_update_rls_policies.sql memberi vendor INSERT + SELECT pada `ptw`,
-- tapi tidak pernah memberi UPDATE — berbeda dari `procedures` dan `jsa` yang
-- keduanya punya policy update vendor. Akibatnya savePtw() di
-- app/vendor/dashboard/ptw/create/[id]/actions.ts diam-diam tidak mengubah
-- apa pun setiap kali vendor mengajukan ulang PTW yang sudah ada (misal
-- setelah ditolak): UPDATE yang tidak mengenai baris tidak menghasilkan error,
-- sehingga aplikasi tetap mencatat "PTW Diajukan Ulang" dan menotifikasi
-- approver, padahal baris PTW-nya tidak berubah dan tetap tertahan di Draft.
--
-- Berbeda dari policy vendor pada procedures/jsa yang tidak membatasi status,
-- di sini baris yang boleh disentuh dibatasi ke tahap sebelum approval saja,
-- supaya vendor tidak bisa menyunting PTW yang sudah aktif/dihentikan.

CREATE POLICY "Vendors can update PTW for their projects"
ON public.ptw FOR UPDATE
TO authenticated
USING (
  status IN ('Draft', 'Menunggu Approval PM')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = auth.uid()
  )
)
WITH CHECK (
  -- Hasil update hanya boleh kembali ke antrean approval tahap pertama;
  -- vendor tidak bisa mempromosikan PTW-nya sendiri ke tahap berikutnya.
  status IN ('Draft', 'Menunggu Approval PM')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = auth.uid()
  )
);

-- Nomor PTW dihasilkan approvePtw() dengan count(...) + 1 tanpa penguncian,
-- sehingga dua penomoran yang berjalan bersamaan bisa menghitung angka yang
-- sama. Index ini membuat tabrakan itu gagal di database, bukan menghasilkan
-- dua PTW dengan nomor identik. Partial: baris yang belum bernomor (NULL)
-- tidak ikut dibatasi.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ptw_number_unique
ON public.ptw (ptw_number)
WHERE ptw_number IS NOT NULL;
