-- Create vendor documents table
CREATE TABLE IF NOT EXISTS public.vendor_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id uuid REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL, -- e.g., 'PDF', 'Image'
  size text, -- e.g., '2.4 MB'
  file_url text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read vendor documents
CREATE POLICY "Vendor documents are viewable by all authenticated users" 
ON public.vendor_documents FOR SELECT 
TO authenticated 
USING (true);

-- Allow vendors to upload their own documents (and internal users to upload for them)
CREATE POLICY "Vendors can insert their own documents" 
ON public.vendor_documents FOR INSERT 
TO authenticated 
WITH CHECK (vendor_id = auth.uid() OR public.is_internal_user());

-- Allow vendors to delete their own documents (and internal users)
CREATE POLICY "Vendors can delete their own documents" 
ON public.vendor_documents FOR DELETE 
TO authenticated 
USING (vendor_id = auth.uid() OR public.is_internal_user());
