-- supabase/schema_stage_assignments_vendor_review.sql
--
-- Fase 3: vendor sekarang perlu menulis (bukan cuma baca) baris
-- stage_assignments untuk tahap internalnya sendiri — admin vendor
-- menugaskan reviewer, dan reviewer itu sendiri mencatat approve/reject.
-- Policy existing hanya izinkan is_internal_user() menulis apa pun, dan
-- vendor cuma boleh baca (transparansi) atau reset ke pending saat resubmit.
--
-- Sama seperti sisi internal: RLS di sini cuma jaga batas kasar (proyek
-- miliknya sendiri + stage_key vendor-only). Siapa yang boleh assign
-- (manage_org_staff) vs siapa yang boleh approve (baris pending miliknya)
-- tetap dicek di TypeScript (app/vendor/dashboard/projects/[id]/assignment-actions.ts
-- dan app/vendor/dashboard/approval/actions.ts) — konsisten dengan
-- is_internal_user() yang juga permisif di RLS dan ketat di TypeScript.
CREATE POLICY "Vendors can manage their own internal-review stage assignments"
ON public.stage_assignments
FOR ALL
USING (
  stage_key IN ('procedure.review_vendor', 'jsa.review_vendor', 'ptw.review_vendor')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()
  )
)
WITH CHECK (
  stage_key IN ('procedure.review_vendor', 'jsa.review_vendor', 'ptw.review_vendor')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()
  )
);
