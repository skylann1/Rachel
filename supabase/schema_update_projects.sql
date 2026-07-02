-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  contract_number text NOT NULL,
  location text NOT NULL,
  start_date date,
  end_date date,
  vendor_id uuid REFERENCES public.vendor_profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Preparation',
  progress integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Policies for projects
CREATE POLICY "Projects are viewable by all authenticated users" 
ON public.projects FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Projects are insertable by authenticated users" 
ON public.projects FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Projects are updatable by authenticated users" 
ON public.projects FOR UPDATE
TO authenticated 
USING (true);

CREATE POLICY "Projects are deletable by authenticated users" 
ON public.projects FOR DELETE
TO authenticated 
USING (true);
