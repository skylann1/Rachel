-- Allow all authenticated users to read vendor profiles
CREATE POLICY "Vendor profiles are viewable by all authenticated users" 
ON public.vendor_profiles FOR SELECT 
TO authenticated 
USING (true);

-- Allow all authenticated users to read internal profiles
CREATE POLICY "Internal profiles are viewable by all authenticated users" 
ON public.internal_profiles FOR SELECT 
TO authenticated 
USING (true);
