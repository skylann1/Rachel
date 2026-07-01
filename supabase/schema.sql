-- ==============================================================================
-- SIPERMIT K3 SUPABASE SCHEMA & ROLE MANAGEMENT
-- ==============================================================================
-- Execute this script in your Supabase SQL Editor.

-- 0. Drop existing tables and types if they exist (to allow re-running this script)
DROP TABLE IF EXISTS public.incidents CASCADE;
DROP TABLE IF EXISTS public.inspections CASCADE;
DROP TABLE IF EXISTS public.ptw CASCADE;
DROP TABLE IF EXISTS public.jsa_steps CASCADE;
DROP TABLE IF EXISTS public.jsa CASCADE;
DROP TABLE IF EXISTS public.procedures CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.vendor_profiles CASCADE;
DROP TABLE IF EXISTS public.internal_profiles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP TYPE IF EXISTS user_type CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS project_status CASCADE;
DROP TYPE IF EXISTS inspection_priority CASCADE;
DROP TYPE IF EXISTS inspection_status CASCADE;
DROP TYPE IF EXISTS incident_type CASCADE;

-- 1. Create Role & Type Enums
CREATE TYPE user_type AS ENUM ('internal', 'external');
CREATE TYPE user_role AS ENUM ('admin', 'pm', 'hse', 'pengawas', 'vendor');
CREATE TYPE project_status AS ENUM ('Menunggu Review', 'Prosedur Disetujui', 'JSA Disetujui', 'PTW Aktif', 'Selesai', 'Ditolak');
CREATE TYPE inspection_priority AS ENUM ('Low', 'Medium', 'High', 'Critical');
CREATE TYPE inspection_status AS ENUM ('Open', 'In Progress', 'Closed');
CREATE TYPE incident_type AS ENUM ('Near Miss', 'First Aid', 'Medical Treatment', 'LTI', 'Fatality', 'Environmental', 'Property Damage');

-- 2. Create Base Profiles Table (Linked to Supabase Auth)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  type user_type NOT NULL DEFAULT 'external',
  role user_role NOT NULL DEFAULT 'vendor',
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2.1 Vendor Profiles Table
CREATE TABLE public.vendor_profiles (
  id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  company_name TEXT NOT NULL,
  logo_url TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;

-- 2.2 Internal Profiles Table
CREATE TABLE public.internal_profiles (
  id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  nip TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.internal_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create Projects Table
CREATE TABLE public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status project_status DEFAULT 'Menunggu Review',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 3.5 Create Procedures Table
CREATE TABLE public.procedures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  content JSONB,
  status TEXT DEFAULT 'Draft',
  reviewed_by UUID REFERENCES public.internal_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;

-- 4. Create JSA (Job Safety Analysis) Table
CREATE TABLE public.jsa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'Draft',
  reviewed_by UUID REFERENCES public.internal_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.jsa ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.jsa_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jsa_id UUID REFERENCES public.jsa(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  pekerjaan TEXT NOT NULL,
  bahaya TEXT NOT NULL,
  risiko TEXT NOT NULL,
  tindakan TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.jsa_steps ENABLE ROW LEVEL SECURITY;

-- 5. Create PTW (Permit to Work) Table
CREATE TABLE public.ptw (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  workers JSONB,     -- Array of {name, role}
  equipment JSONB,   -- Array of {name, type}
  status TEXT DEFAULT 'Menunggu Approval PM',
  approved_by UUID REFERENCES public.internal_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.ptw ENABLE ROW LEVEL SECURITY;

-- 6. Create Inspections Table (HSE Patrol)
-- Sesuai kesepakatan: Pengawas & HSE boleh membuat laporan temuan K3
CREATE TABLE public.inspections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES public.internal_profiles(id), -- User Internal (HSE/Pengawas)
  target_vendor UUID REFERENCES public.vendor_profiles(id), -- Vendor yang melanggar
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  finding_type TEXT NOT NULL,
  priority inspection_priority DEFAULT 'Low',
  status inspection_status DEFAULT 'Open',
  image_url TEXT,
  vendor_response TEXT,
  vendor_evidence_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- 7. Create Incidents Table (Laporan Kecelakaan)
CREATE TABLE public.incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES public.profiles(id), -- Vendor / Internal
  title TEXT NOT NULL,
  type incident_type NOT NULL,
  incident_date DATE NOT NULL,
  incident_time TIME NOT NULL,
  location TEXT NOT NULL,
  victims TEXT, -- JSONB atau TEXT list korban
  chronology TEXT NOT NULL,
  immediate_action TEXT,
  status TEXT DEFAULT 'Menunggu Investigasi',
  rca_root_cause TEXT,
  rca_corrective TEXT,
  rca_preventive TEXT,
  investigated_by UUID REFERENCES public.internal_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- SECURITY DEFINER FUNCTIONS (Untuk mencegah Infinite Recursion)
CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND type = 'internal');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_external_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND type = 'external');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES
CREATE POLICY "Users can read their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Internal users can read all profiles" ON profiles FOR SELECT USING (public.is_internal_user());

-- PROJECTS
CREATE POLICY "External users can view their own projects" ON projects FOR SELECT USING (vendor_id = auth.uid());
CREATE POLICY "Internal users can view all projects" ON projects FOR SELECT USING (public.is_internal_user());
CREATE POLICY "External users can insert their own projects" ON projects FOR INSERT WITH CHECK (vendor_id = auth.uid());

-- (For MVP, we'll keep RLS relatively open for the remaining tables, 
--  but they are secured enough that vendors only see what they should).

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER
-- ==============================================================================
-- When a user signs up, insert them into profiles, then into the respective child table.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_type user_type;
  new_role user_role;
BEGIN
  new_type := COALESCE((new.raw_user_meta_data->>'type')::user_type, 'external');
  new_role := COALESCE((new.raw_user_meta_data->>'role')::user_role, 'vendor');

  -- 1. Insert Base Profile
  INSERT INTO public.profiles (id, full_name, role, type)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new_role,
    new_type
  );

  -- 2. Insert into Specific Profile Table
  IF new_type = 'external' THEN
    INSERT INTO public.vendor_profiles (id, company_name)
    VALUES (new.id, COALESCE(new.raw_user_meta_data->>'company_name', 'Nama Perusahaan Belum Diisi'));
  ELSE
    INSERT INTO public.internal_profiles (id, nip)
    VALUES (new.id, new.raw_user_meta_data->>'nip');
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- STORAGE BUCKETS
-- ==============================================================================
-- Supabase Storage for Evidences and Avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('sipermit-images', 'sipermit-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'sipermit-images');

DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
CREATE POLICY "Authenticated users can upload images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'sipermit-images' AND auth.role() = 'authenticated');
