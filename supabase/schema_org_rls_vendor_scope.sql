-- supabase/schema_org_rls_vendor_scope.sql
--
-- Setiap policy vendor yang tadinya membandingkan vendor_id = auth.uid()
-- (baik langsung maupun lewat join ke projects/vendor_workers/
-- vendor_equipment/vendor_materials) diganti memakai
-- current_vendor_org_id() — supaya SEMUA staff di company vendor yang
-- sama (bukan cuma 1 akun) bisa mengakses data proyek/asetnya. Lihat
-- bagian "Helper SQL untuk RLS" di spec untuk penjelasan kenapa ini aman
-- tanpa kolom/join tambahan.

CREATE OR REPLACE FUNCTION public.current_vendor_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ===== projects (schema.sql) =====
DROP POLICY IF EXISTS "External users can view their own projects" ON public.projects;
CREATE POLICY "Vendor org members can view their own projects" ON public.projects
FOR SELECT USING (vendor_id = public.current_vendor_org_id());

DROP POLICY IF EXISTS "External users can insert their own projects" ON public.projects;
CREATE POLICY "Vendor org members can insert their own projects" ON public.projects
FOR INSERT WITH CHECK (vendor_id = public.current_vendor_org_id());

-- ===== procedures (schema_update_rls_policies.sql) =====
DROP POLICY IF EXISTS "Vendors can insert procedures for their projects" ON public.procedures;
CREATE POLICY "Vendors can insert procedures for their projects"
ON public.procedures FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can update procedures for their projects" ON public.procedures;
CREATE POLICY "Vendors can update procedures for their projects"
ON public.procedures FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can view their own procedures" ON public.procedures;
CREATE POLICY "Vendors can view their own procedures"
ON public.procedures FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()));

-- ===== jsa (schema_update_rls_policies.sql) =====
DROP POLICY IF EXISTS "Vendors can insert JSA for their projects" ON public.jsa;
CREATE POLICY "Vendors can insert JSA for their projects"
ON public.jsa FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can update JSA for their projects" ON public.jsa;
CREATE POLICY "Vendors can update JSA for their projects"
ON public.jsa FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can view their own JSA" ON public.jsa;
CREATE POLICY "Vendors can view their own JSA"
ON public.jsa FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()));

-- ===== jsa_steps (schema_update_rls_policies.sql) =====
DROP POLICY IF EXISTS "Vendors can insert JSA steps" ON public.jsa_steps;
CREATE POLICY "Vendors can insert JSA steps"
ON public.jsa_steps FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.jsa j JOIN public.projects p ON p.id = j.project_id
  WHERE j.id = jsa_id AND p.vendor_id = public.current_vendor_org_id()
));

DROP POLICY IF EXISTS "Vendors can update JSA steps" ON public.jsa_steps;
CREATE POLICY "Vendors can update JSA steps"
ON public.jsa_steps FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.jsa j JOIN public.projects p ON p.id = j.project_id
  WHERE j.id = jsa_id AND p.vendor_id = public.current_vendor_org_id()
));

DROP POLICY IF EXISTS "Vendors can delete JSA steps" ON public.jsa_steps;
CREATE POLICY "Vendors can delete JSA steps"
ON public.jsa_steps FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.jsa j JOIN public.projects p ON p.id = j.project_id
  WHERE j.id = jsa_id AND p.vendor_id = public.current_vendor_org_id()
));

-- ===== ptw (schema_update_rls_policies.sql + schema_ptw_vendor_update_policy.sql) =====
DROP POLICY IF EXISTS "Vendors can insert PTW for their projects" ON public.ptw;
CREATE POLICY "Vendors can insert PTW for their projects"
ON public.ptw FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can view their own PTW" ON public.ptw;
CREATE POLICY "Vendors can view their own PTW"
ON public.ptw FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can update PTW for their projects" ON public.ptw;
CREATE POLICY "Vendors can update PTW for their projects"
ON public.ptw FOR UPDATE TO authenticated
USING (
  status IN ('Draft', 'Menunggu Approval PM')
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id())
)
WITH CHECK (
  status IN ('Draft', 'Menunggu Approval PM')
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id())
);

-- ===== incidents (schema_update_incidents_rls.sql) =====
DROP POLICY IF EXISTS "Vendors can insert incidents for their projects" ON incidents;
CREATE POLICY "Vendors can insert incidents for their projects" ON incidents
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM projects WHERE vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can view incidents for their projects" ON incidents;
CREATE POLICY "Vendors can view incidents for their projects" ON incidents
FOR SELECT USING (project_id IN (SELECT id FROM projects WHERE vendor_id = public.current_vendor_org_id()));

-- ===== vendor_documents (schema_update_vendor_documents.sql) =====
DROP POLICY IF EXISTS "Vendors can insert their own documents" ON public.vendor_documents;
CREATE POLICY "Vendors can insert their own documents"
ON public.vendor_documents FOR INSERT TO authenticated
WITH CHECK (vendor_id = public.current_vendor_org_id() OR public.is_internal_user());

DROP POLICY IF EXISTS "Vendors can delete their own documents" ON public.vendor_documents;
CREATE POLICY "Vendors can delete their own documents"
ON public.vendor_documents FOR DELETE TO authenticated
USING (vendor_id = public.current_vendor_org_id() OR public.is_internal_user());

-- ===== vendor_workers / vendor_equipment (schema_vendor_workers_equipment.sql) =====
DROP POLICY IF EXISTS "Vendors can manage their own workers" ON vendor_workers;
CREATE POLICY "Vendors can manage their own workers" ON vendor_workers
FOR ALL USING (vendor_id = public.current_vendor_org_id()) WITH CHECK (vendor_id = public.current_vendor_org_id());

DROP POLICY IF EXISTS "Vendors can manage their own equipment" ON vendor_equipment;
CREATE POLICY "Vendors can manage their own equipment" ON vendor_equipment
FOR ALL USING (vendor_id = public.current_vendor_org_id()) WITH CHECK (vendor_id = public.current_vendor_org_id());

-- ===== vendor_worker_competencies / vendor_equipment_documents / vendor_materials / vendor_material_documents (schema_master_data_detail.sql) =====
DROP POLICY IF EXISTS "Vendors manage own worker competencies" ON public.vendor_worker_competencies;
CREATE POLICY "Vendors manage own worker competencies"
ON public.vendor_worker_competencies FOR ALL
USING (EXISTS (SELECT 1 FROM public.vendor_workers w WHERE w.id = worker_id AND w.vendor_id = public.current_vendor_org_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_workers w WHERE w.id = worker_id AND w.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors manage own equipment documents" ON public.vendor_equipment_documents;
CREATE POLICY "Vendors manage own equipment documents"
ON public.vendor_equipment_documents FOR ALL
USING (EXISTS (SELECT 1 FROM public.vendor_equipment e WHERE e.id = equipment_id AND e.vendor_id = public.current_vendor_org_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_equipment e WHERE e.id = equipment_id AND e.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can manage their own materials" ON public.vendor_materials;
CREATE POLICY "Vendors can manage their own materials"
ON public.vendor_materials FOR ALL
USING (vendor_id = public.current_vendor_org_id())
WITH CHECK (vendor_id = public.current_vendor_org_id());

DROP POLICY IF EXISTS "Vendors manage own material documents" ON public.vendor_material_documents;
CREATE POLICY "Vendors manage own material documents"
ON public.vendor_material_documents FOR ALL
USING (EXISTS (SELECT 1 FROM public.vendor_materials m WHERE m.id = material_id AND m.vendor_id = public.current_vendor_org_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_materials m WHERE m.id = material_id AND m.vendor_id = public.current_vendor_org_id()));

-- ===== toolbox_meetings / site_checkins (schema_swa_toolbox_checkin.sql) =====
DROP POLICY IF EXISTS "Vendors can read their own toolbox meetings" ON public.toolbox_meetings;
CREATE POLICY "Vendors can read their own toolbox meetings" ON public.toolbox_meetings
FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = toolbox_meetings.project_id AND p.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can log their own toolbox meetings" ON public.toolbox_meetings;
CREATE POLICY "Vendors can log their own toolbox meetings" ON public.toolbox_meetings
FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = toolbox_meetings.project_id AND p.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can read their own site checkins" ON public.site_checkins;
CREATE POLICY "Vendors can read their own site checkins" ON public.site_checkins
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.ptw t JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = site_checkins.ptw_id AND p.vendor_id = public.current_vendor_org_id()
));
