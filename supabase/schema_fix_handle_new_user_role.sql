-- =====================================================================
-- Fix: handle_new_user() masih meng-cast role baru ke ENUM user_role
--      lama, padahal profiles.role sudah TEXT sejak schema_update_roles.sql
--      dan role sekarang data-driven lewat public.roles.
--
-- Akibatnya: membuat akun dengan role apa pun yang TIDAK ada di ENUM lama
-- (mis. pgsol_reviewer, pgn_approver, atau role baru mana pun ke depannya)
-- gagal dengan error "invalid input value for enum user_role: ...".
-- =====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_type user_type;
  new_role TEXT;
BEGIN
  new_type := COALESCE((new.raw_user_meta_data->>'type')::user_type, 'external');
  new_role := COALESCE(new.raw_user_meta_data->>'role', 'vendor');

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
