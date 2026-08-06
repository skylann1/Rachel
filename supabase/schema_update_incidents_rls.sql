-- incidents RLS was enabled (schema.sql) but no policies were ever checked in,
-- which means vendor reads/inserts are denied by default unless a policy exists
-- only in the live dashboard. This adds the missing coverage; safe to run even
-- if equivalent policies already exist under different names (distinct names here).

CREATE POLICY "Vendors can insert incidents for their projects" ON incidents
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE vendor_id = auth.uid())
  );

CREATE POLICY "Vendors can view incidents for their projects" ON incidents
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE vendor_id = auth.uid())
  );

CREATE POLICY "Internal users can view all incidents" ON incidents
  FOR SELECT USING (public.is_internal_user());

CREATE POLICY "Internal users can update incidents" ON incidents
  FOR UPDATE USING (public.is_internal_user());
