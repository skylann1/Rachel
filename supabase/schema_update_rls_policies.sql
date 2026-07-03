-- RLS Policies for procedures, jsa, jsa_steps, ptw tables
-- These were missing from the original schema

-- PROCEDURES: Vendor can insert/update their own project's procedures
CREATE POLICY "Vendors can insert procedures for their projects"
ON public.procedures FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = auth.uid()
  )
);

CREATE POLICY "Vendors can update procedures for their projects"
ON public.procedures FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = auth.uid()
  )
);

CREATE POLICY "Vendors can view their own procedures"
ON public.procedures FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = auth.uid()
  )
);

CREATE POLICY "Internal users can view all procedures"
ON public.procedures FOR SELECT
TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Internal users can update all procedures"
ON public.procedures FOR UPDATE
TO authenticated
USING (public.is_internal_user());

-- JSA: Vendor can insert/update their own project's JSA
CREATE POLICY "Vendors can insert JSA for their projects"
ON public.jsa FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = auth.uid()
  )
);

CREATE POLICY "Vendors can update JSA for their projects"
ON public.jsa FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = auth.uid()
  )
);

CREATE POLICY "Vendors can view their own JSA"
ON public.jsa FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = auth.uid()
  )
);

CREATE POLICY "Internal users can view all JSA"
ON public.jsa FOR SELECT
TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Internal users can update all JSA"
ON public.jsa FOR UPDATE
TO authenticated
USING (public.is_internal_user());

-- JSA_STEPS: Vendor can manage steps for their own JSA
CREATE POLICY "Vendors can insert JSA steps"
ON public.jsa_steps FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jsa j
    JOIN public.projects p ON p.id = j.project_id
    WHERE j.id = jsa_id AND p.vendor_id = auth.uid()
  )
);

CREATE POLICY "Vendors can update JSA steps"
ON public.jsa_steps FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jsa j
    JOIN public.projects p ON p.id = j.project_id
    WHERE j.id = jsa_id AND p.vendor_id = auth.uid()
  )
);

CREATE POLICY "Vendors can delete JSA steps"
ON public.jsa_steps FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jsa j
    JOIN public.projects p ON p.id = j.project_id
    WHERE j.id = jsa_id AND p.vendor_id = auth.uid()
  )
);

CREATE POLICY "Everyone can view JSA steps"
ON public.jsa_steps FOR SELECT
TO authenticated
USING (true);

-- PTW: Vendor can insert/view their own PTW
CREATE POLICY "Vendors can insert PTW for their projects"
ON public.ptw FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = auth.uid()
  )
);

CREATE POLICY "Vendors can view their own PTW"
ON public.ptw FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = auth.uid()
  )
);

CREATE POLICY "Internal users can view all PTW"
ON public.ptw FOR SELECT
TO authenticated
USING (public.is_internal_user());

CREATE POLICY "Internal users can update all PTW"
ON public.ptw FOR UPDATE
TO authenticated
USING (public.is_internal_user());
