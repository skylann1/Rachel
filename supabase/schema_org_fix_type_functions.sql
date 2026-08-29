-- =====================================================================
-- Update is_internal_user(), is_external_user(), handle_new_user()
-- for renamed user_type enum labels (internal/external → pgn/vendor/pgsol)
-- =====================================================================

-- is_internal_user() now returns true for BOTH pgn and pgsol,
-- so existing "Internal users can view/update all X" RLS policies
-- automatically apply to PGSOL staff without modification.
CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND type IN ('pgn', 'pgsol'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- is_external_user() now checks for 'vendor' type only
CREATE OR REPLACE FUNCTION public.is_external_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND type = 'vendor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- handle_new_user() no longer references dead 'external' literal
-- Defaults new_type to 'vendor' and checks new_type = 'vendor' in branch condition
-- Note: SET search_path = public is CRITICAL because this trigger runs under
-- auth schema context and would fail to find public.profiles without it
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_type public.user_type;
  new_role TEXT;
BEGIN
  new_type := COALESCE((new.raw_user_meta_data->>'type')::public.user_type, 'vendor'::public.user_type);
  new_role := COALESCE(new.raw_user_meta_data->>'role', 'vendor');

  INSERT INTO public.profiles (id, full_name, role, type)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new_role,
    new_type
  );

  IF new_type = 'vendor' THEN
    INSERT INTO public.vendor_profiles (id, company_name)
    VALUES (new.id, COALESCE(new.raw_user_meta_data->>'company_name', 'Nama Perusahaan Belum Diisi'));
  ELSE
    INSERT INTO public.internal_profiles (id, nip)
    VALUES (new.id, new.raw_user_meta_data->>'nip');
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
