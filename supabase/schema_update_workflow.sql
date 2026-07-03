-- 1. Add new roles to user_role enum
-- Note: PostgreSQL requires ALTER TYPE ADD VALUE to be outside a transaction block
-- So we run them directly here. If they already exist, it will throw an error, but that's fine for our initial setup if we run it once.
COMMIT;
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'asset_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ptw_authority';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ptw_issuer';

-- 2. Update JSA Table
ALTER TABLE public.jsa
ADD COLUMN IF NOT EXISTS pm_id UUID REFERENCES public.internal_profiles(id),
ADD COLUMN IF NOT EXISTS pm_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS asset_manager_id UUID REFERENCES public.internal_profiles(id),
ADD COLUMN IF NOT EXISTS asset_manager_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_note TEXT;

-- 3. Update PTW Table
ALTER TABLE public.ptw
ADD COLUMN IF NOT EXISTS authority_id UUID REFERENCES public.internal_profiles(id),
ADD COLUMN IF NOT EXISTS authority_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS issuer_id UUID REFERENCES public.internal_profiles(id),
ADD COLUMN IF NOT EXISTS issuer_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS hsse_id UUID REFERENCES public.internal_profiles(id),
ADD COLUMN IF NOT EXISTS ptw_number TEXT,
ADD COLUMN IF NOT EXISTS rejection_note TEXT;
