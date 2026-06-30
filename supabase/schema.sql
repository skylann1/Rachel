-- ==============================================================================
-- SIPERMIT K3 SUPABASE SCHEMA & ROLE MANAGEMENT
-- ==============================================================================
-- Execute this script in your Supabase SQL Editor.

-- 1. Create Role Enums
CREATE TYPE user_role AS ENUM ('admin', 'pm', 'hse', 'pengawas', 'vendor');
CREATE TYPE project_status AS ENUM ('Menunggu Review', 'Prosedur Disetujui', 'JSA Disetujui', 'PTW Aktif', 'Selesai', 'Ditolak');
CREATE TYPE inspection_priority AS ENUM ('Low', 'Medium', 'High', 'Critical');
CREATE TYPE inspection_status AS ENUM ('Open', 'In Progress', 'Closed');
CREATE TYPE incident_type AS ENUM ('Near Miss', 'First Aid', 'Medical Treatment', 'LTI', 'Fatality', 'Environmental', 'Property Damage');

-- 2. Create Profiles Table (Linked to Supabase Auth)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role user_role NOT NULL DEFAULT 'vendor',
  full_name TEXT NOT NULL,
  company_name TEXT, -- Khusus Vendor
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create Projects Table
CREATE TABLE public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status project_status DEFAULT 'Menunggu Review',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 4. Create JSA (Job Safety Analysis) Table
CREATE TABLE public.jsa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'Draft',
  reviewed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.jsa ENABLE ROW LEVEL SECURITY;

-- 5. Create PTW (Permit to Work) Table
CREATE TABLE public.ptw (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  workers JSONB,     -- Array of {name, role}
  equipment JSONB,   -- Array of {name, type}
  status TEXT DEFAULT 'Menunggu Approval PM',
  approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.ptw ENABLE ROW LEVEL SECURITY;

-- 6. Create Inspections Table (HSE Patrol)
-- Sesuai kesepakatan: Pengawas & HSE boleh membuat laporan temuan K3
CREATE TABLE public.inspections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES public.profiles(id), -- User Internal (HSE/Pengawas)
  target_vendor UUID REFERENCES public.profiles(id), -- Vendor yang melanggar
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
  type incident_type NOT NULL,
  incident_date DATE NOT NULL,
  incident_time TIME NOT NULL,
  location TEXT NOT NULL,
  chronology TEXT NOT NULL,
  immediate_action TEXT,
  status TEXT DEFAULT 'Menunggu Investigasi',
  rca_root_cause TEXT,
  rca_corrective TEXT,
  rca_preventive TEXT,
  investigated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- PROFILES
CREATE POLICY "Users can read their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Internal users can read all profiles" ON profiles FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'pm', 'hse', 'pengawas')
);

-- PROJECTS
CREATE POLICY "Vendors can view their own projects" ON projects FOR SELECT USING (vendor_id = auth.uid());
CREATE POLICY "Internal users can view all projects" ON projects FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'pm', 'hse', 'pengawas')
);
CREATE POLICY "Vendors can insert their own projects" ON projects FOR INSERT WITH CHECK (vendor_id = auth.uid());

-- (For MVP, we'll keep RLS relatively open for the remaining tables, 
--  but they are secured enough that vendors only see what they should).

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER
-- ==============================================================================
-- When a user signs up, insert them into profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', COALESCE((new.raw_user_meta_data->>'role')::user_role, 'vendor'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
