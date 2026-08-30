-- supabase/schema_stage_assignments.sql
--
-- Fase 2: siapa yang harus mereview/approve tahap internal (Prosedur/JSA/PTW)
-- sekarang eksplisit per proyek, bukan lagi "siapa pun yang punya permission
-- ini". Satu baris = satu orang, satu tahap, satu proyek. Lihat
-- docs/superpowers/specs/2026-08-30-per-project-approver-assignment-design.md
-- untuk desain lengkap.
--
-- stage_key memakai vokabuler {module}.{action} yang sudah ada di
-- PROCEDURE_STAGE_PERMISSION/JSA_STAGE_PERMISSION/PTW_STAGE_PERMISSION
-- (lib/procedure-status.ts, lib/jsa-status.ts, lib/ptw-status.ts) — bukan
-- vokabuler baru.

CREATE TABLE public.stage_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  doc_type TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  assignee_id UUID REFERENCES public.profiles(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_at TIMESTAMP WITH TIME ZONE,
  note TEXT,
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (project_id, doc_type, stage_key, assignee_id)
);

ALTER TABLE public.stage_assignments ENABLE ROW LEVEL SECURITY;

-- Internal users (PGN + PGSOL, is_internal_user() sudah mencakup keduanya
-- sejak Fase 1) boleh membaca dan menulis semua baris di sini — pemilahan
-- "boleh assign tahap yang mana" (manage_project vs
-- jsa.manage_assignment_pgsol) dan "assignee harus dari org sendiri"
-- dilakukan di server action (lib/stage-assignments.ts), bukan di RLS —
-- konsisten dengan bagaimana roles.permissions dicek di seluruh aplikasi
-- ini (selalu di TypeScript lewat hasPermissionForUser, tidak pernah di
-- SQL).
CREATE POLICY "Internal users can read stage assignments" ON public.stage_assignments
FOR SELECT USING (public.is_internal_user());

CREATE POLICY "Internal users can write stage assignments" ON public.stage_assignments
FOR ALL USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());

-- Vendor pemilik proyek boleh melihat siapa yang menjadi reviewer/approver
-- tahapnya — transparansi, bukan hak tulis.
CREATE POLICY "Vendors can view assignments for their own projects" ON public.stage_assignments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()
  )
);
