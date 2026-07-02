-- Add phone, company_email, and csms_status to vendor_profiles
ALTER TABLE public.vendor_profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS company_email TEXT,
ADD COLUMN IF NOT EXISTS csms_status TEXT DEFAULT 'Pending Review';

-- Add RLS policy for UPDATE on vendor_profiles so that Admins can update it.
-- Since the Admin client (Service Role) bypasses RLS, we don't strictly *need* an UPDATE policy
-- if we only update via Server Actions using Service Role. 
-- But it's good practice just in case.
CREATE POLICY "Internal users can update vendor profiles" 
ON public.vendor_profiles FOR UPDATE 
USING (public.is_internal_user());
