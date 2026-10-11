-- supabase/schema_vendor_pgsol_two_stage_review.sql
--
-- Alur approval baru untuk Prosedur Kerja, JSA, dan PTW — tiga pihak,
-- masing-masing dua tahap berurutan:
--
--   Vendor : HSE Vendor  -> PM Vendor
--   PGSOL  : HSE PGSOL   -> PM PGSOL     (dulu: Reviewer PGSOL -> HSE PGSOL)
--   PGN    : (tidak berubah)
--
-- Penamaan stage_key & permission lama DIPERTAHANKAN (lihat catatan di
-- lib/jsa-status.ts), jadi tidak ada rename kolom/permission:
--   {doc}.hse_vendor     BARU  = HSE Vendor
--   {doc}.review_vendor        = PM Vendor   (dulu "Review Internal Vendor")
--   {doc}.hse_pgsol            = HSE PGSOL   (sekarang tahap PGSOL pertama)
--   {doc}.review_pgsol         = PM PGSOL    (dulu "Reviewer PGSOL", sekarang kedua)
--
-- Nilai status BARU: 'Review HSE Vendor', 'Review PM Vendor', 'Review PM PGSOL'.
-- Nilai status LAMA yang dipensiunkan: 'Review Internal Vendor', 'Review PGSOL'.
--
-- Yang dikerjakan file ini (satu transaksi):
--   1. Memindahkan dokumen yang SEDANG berjalan ke tahap padanannya — fail-
--      closed: dokumen di 'Review Internal Vendor' dimulai lagi dari
--      'Review HSE Vendor', dokumen di 'Review PGSOL' dimulai dari
--      'Review HSE PGSOL' (kedua tahap PGSOL diulang karena urutannya
--      berubah). Baris stage_assignments tahap-tahap itu di-reset ke 'pending'.
--   2. Memberi izin {procedure,jsa,ptw}.hse_vendor ke setiap role yang sudah
--      punya .review_vendor, supaya tidak ada vendor yang kehilangan akses.
--   3. Memperbarui whitelist status pada policy UPDATE vendor
--      (procedures, jsa, ptw) dan policy stage_assignments vendor.
--
-- SETELAH dijalankan: admin vendor harus mengisi slot "HSE Vendor" tiap
-- proyek yang dokumennya sedang berjalan (halaman proyek vendor →
-- Assignment HSE & PM Vendor), dan admin PGSOL mengisi ulang HSE/PM PGSOL
-- (Master Data → Kelola HSE & PM PGSOL) kalau assignment lamanya tidak
-- sesuai peran baru. TIDAK idempoten untuk bagian 1 — jalankan SEKALI.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Dokumen yang sedang berjalan
-- ---------------------------------------------------------------------

-- Daftar (project, doc_type) yang terdampak, dikumpulkan SEBELUM status diubah.
CREATE TEMP TABLE _affected_docs ON COMMIT DROP AS
  SELECT project_id, 'procedure'::text AS doc_type, status FROM public.procedures
   WHERE status IN ('Review Internal Vendor', 'Review PGSOL', 'Review HSE PGSOL')
  UNION ALL
  SELECT project_id, 'jsa', status FROM public.jsa
   WHERE status IN ('Review Internal Vendor', 'Review PGSOL', 'Review HSE PGSOL')
  UNION ALL
  SELECT project_id, 'ptw', status FROM public.ptw
   WHERE status IN ('Review Internal Vendor', 'Review PGSOL', 'Review HSE PGSOL');

UPDATE public.procedures SET status = 'Review HSE Vendor' WHERE status = 'Review Internal Vendor';
UPDATE public.jsa        SET status = 'Review HSE Vendor' WHERE status = 'Review Internal Vendor';
UPDATE public.ptw        SET status = 'Review HSE Vendor' WHERE status = 'Review Internal Vendor';

UPDATE public.procedures SET status = 'Review HSE PGSOL' WHERE status = 'Review PGSOL';
UPDATE public.jsa        SET status = 'Review HSE PGSOL' WHERE status = 'Review PGSOL';
UPDATE public.ptw        SET status = 'Review HSE PGSOL' WHERE status = 'Review PGSOL';

-- Vendor: PM Vendor (review_vendor) berjalan SETELAH HSE Vendor, jadi baris lamanya diulang.
UPDATE public.stage_assignments sa
   SET status = 'pending', decided_at = NULL, note = NULL
  FROM _affected_docs d
 WHERE sa.project_id = d.project_id AND sa.doc_type = d.doc_type
   AND d.status = 'Review Internal Vendor'
   AND sa.stage_key = d.doc_type || '.review_vendor';

-- PGSOL: kedua tahap diulang dengan urutan baru (HSE lalu PM).
UPDATE public.stage_assignments sa
   SET status = 'pending', decided_at = NULL, note = NULL
  FROM _affected_docs d
 WHERE sa.project_id = d.project_id AND sa.doc_type = d.doc_type
   AND d.status IN ('Review PGSOL', 'Review HSE PGSOL')
   AND sa.stage_key IN (d.doc_type || '.hse_pgsol', d.doc_type || '.review_pgsol');

-- ---------------------------------------------------------------------
-- 2. Izin baru *.hse_vendor — merge ke role yang sudah punya review_vendor
-- ---------------------------------------------------------------------

UPDATE public.roles
SET permissions = jsonb_set(
  permissions, '{procedure}',
  COALESCE(permissions->'procedure', '[]'::jsonb) || '["hse_vendor"]'::jsonb
)
WHERE COALESCE(permissions->'procedure', '[]'::jsonb) ? 'review_vendor'
  AND NOT COALESCE(permissions->'procedure', '[]'::jsonb) ? 'hse_vendor';

UPDATE public.roles
SET permissions = jsonb_set(
  permissions, '{jsa}',
  COALESCE(permissions->'jsa', '[]'::jsonb) || '["hse_vendor"]'::jsonb
)
WHERE COALESCE(permissions->'jsa', '[]'::jsonb) ? 'review_vendor'
  AND NOT COALESCE(permissions->'jsa', '[]'::jsonb) ? 'hse_vendor';

UPDATE public.roles
SET permissions = jsonb_set(
  permissions, '{ptw}',
  COALESCE(permissions->'ptw', '[]'::jsonb) || '["hse_vendor"]'::jsonb
)
WHERE COALESCE(permissions->'ptw', '[]'::jsonb) ? 'review_vendor'
  AND NOT COALESCE(permissions->'ptw', '[]'::jsonb) ? 'hse_vendor';

-- ---------------------------------------------------------------------
-- 3. RLS — whitelist status vendor
-- ---------------------------------------------------------------------
-- Vendor hanya boleh MENYENTUH baris yang masih di tahap miliknya
-- (Draft / Review HSE Vendor / Review PM Vendor), dan hasil akhirnya cuma
-- boleh: tetap Draft (reject), maju satu tahap vendor, atau maju ke
-- 'Review HSE PGSOL' (approve penuh PM Vendor). Internal PGN/PGSOL tidak
-- disentuh — kebijakan mereka memang tanpa whitelist status.

DROP POLICY IF EXISTS "Vendors can update procedures for their projects" ON public.procedures;
CREATE POLICY "Vendors can update procedures for their projects"
ON public.procedures FOR UPDATE
TO authenticated
USING (
  status IN ('Draft', 'Review HSE Vendor', 'Review PM Vendor')
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id())
)
WITH CHECK (
  status IN ('Draft', 'Review HSE Vendor', 'Review PM Vendor', 'Review HSE PGSOL')
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id())
);

DROP POLICY IF EXISTS "Vendors can update JSA for their projects" ON public.jsa;
CREATE POLICY "Vendors can update JSA for their projects"
ON public.jsa FOR UPDATE
TO authenticated
USING (
  status IN ('Draft', 'Review HSE Vendor', 'Review PM Vendor')
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id())
)
WITH CHECK (
  status IN ('Draft', 'Review HSE Vendor', 'Review PM Vendor', 'Review HSE PGSOL')
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id())
);

-- 'Menunggu Approval PM' dipertahankan di kedua klausa persis seperti
-- schema_ptw_pgsol_gate_vendor_policy.sql (tidak ada yang dicabut selain
-- nama status vendor/PGSOL yang berganti).
DROP POLICY IF EXISTS "Vendors can update PTW for their projects" ON public.ptw;
CREATE POLICY "Vendors can update PTW for their projects"
ON public.ptw FOR UPDATE
TO authenticated
USING (
  status IN ('Draft', 'Review HSE Vendor', 'Review PM Vendor', 'Menunggu Approval PM')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()
  )
)
WITH CHECK (
  status IN ('Draft', 'Review HSE Vendor', 'Review PM Vendor', 'Menunggu Approval PM', 'Review HSE PGSOL')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()
  )
);

-- stage_assignments: vendor boleh menulis tahap vendor-only, kini dua per dokumen.
DROP POLICY IF EXISTS "Vendors can manage their own internal-review stage assignments" ON public.stage_assignments;
CREATE POLICY "Vendors can manage their own internal-review stage assignments"
ON public.stage_assignments
FOR ALL
USING (
  stage_key IN (
    'procedure.hse_vendor', 'procedure.review_vendor',
    'jsa.hse_vendor', 'jsa.review_vendor',
    'ptw.hse_vendor', 'ptw.review_vendor'
  )
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()
  )
)
WITH CHECK (
  stage_key IN (
    'procedure.hse_vendor', 'procedure.review_vendor',
    'jsa.hse_vendor', 'jsa.review_vendor',
    'ptw.hse_vendor', 'ptw.review_vendor'
  )
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()
  )
);

COMMIT;
