-- Real backing tables for the vendor "Data Pekerja" (workers) and
-- "Data Peralatan" (equipment) roster pages, which previously only rendered
-- hardcoded mock arrays with no persistence.

CREATE TABLE public.vendor_workers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES public.vendor_profiles(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  ktp_number TEXT,
  bpjs_number TEXT,
  certification TEXT,
  status TEXT NOT NULL DEFAULT 'Active', -- 'Active' | 'Inactive'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.vendor_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can manage their own workers" ON vendor_workers
  FOR ALL USING (vendor_id = auth.uid()) WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "Internal users can view all workers" ON vendor_workers
  FOR SELECT USING (public.is_internal_user());


CREATE TABLE public.vendor_equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES public.vendor_profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT,
  certificate_number TEXT,
  certificate_expiry DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.vendor_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can manage their own equipment" ON vendor_equipment
  FOR ALL USING (vendor_id = auth.uid()) WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "Internal users can view all equipment" ON vendor_equipment
  FOR SELECT USING (public.is_internal_user());
