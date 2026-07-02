-- 1. Create the new dynamic roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access for all authenticated users" ON public.roles FOR SELECT TO authenticated USING (true);

-- 2. Insert Default Roles
INSERT INTO public.roles (name, description, is_system, permissions) VALUES 
('admin', 'Akses penuh ke seluruh sistem dan konfigurasi.', true, '{"jsa": ["view", "create", "review", "approve", "delete"], "project": ["view", "manage"], "masterData": ["view_vendor", "manage_vendor", "view_account", "manage_account", "manage_role"]}'),
('vendor', 'Submit JSA, PTW, dan update progres kerja.', true, '{"jsa": ["view", "create"], "project": ["view"], "masterData": []}'),
('hse', 'Review dan approve/reject JSA serta laporan K3.', false, '{"jsa": ["view", "review", "approve"], "project": ["view"], "masterData": ["view_vendor"]}'),
('pm', 'Validasi PTW dan kontrol vendor pada proyek terkait.', false, '{"jsa": ["view", "approve"], "project": ["view", "manage"], "masterData": ["view_vendor"]}'),
('pengawas', 'Pengawas lapangan.', false, '{"jsa": ["view"], "project": ["view"], "masterData": []}')
ON CONFLICT (name) DO UPDATE 
SET description = EXCLUDED.description, is_system = EXCLUDED.is_system, permissions = EXCLUDED.permissions;

-- 3. Change 'role' column in profiles to TEXT and drop ENUM
ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN role TYPE TEXT USING role::text;
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'vendor';

-- We can drop the enum type if we want, but it might be used in other places like triggers.
-- Let's leave the ENUM type alone just in case it's used elsewhere, but profiles now uses TEXT.
