-- =====================================================================
-- Fix: handle_new_user() masih meng-cast role baru ke ENUM user_role
--      lama, padahal profiles.role sudah TEXT sejak schema_update_roles.sql
--      dan role sekarang data-driven lewat public.roles.
--
-- Akibatnya: membuat akun dengan role apa pun yang TIDAK ada di ENUM lama
-- (mis. pgsol_reviewer, pgn_approver, atau role baru mana pun ke depannya)
-- gagal dengan error "invalid input value for enum user_role: ...".
--
-- Update kedua (penting, jangan dilewati): fungsi ini adalah trigger pada
-- auth.users, yang dieksekusi oleh proses Auth (GoTrue) — bukan sesi SQL
-- biasa. search_path proses itu tidak otomatis menyertakan schema public,
-- jadi referensi tipe tanpa qualifier seperti `::user_type` gagal dengan
-- error "type \"user_type\" does not exist", meski tipenya benar-benar ada
-- di public.user_type. Ini yang menyebabkan create user gagal total (baik
-- dari aplikasi maupun dari Supabase Dashboard langsung) dengan error
-- kosong "{}" di sisi klien — pesan aslinya cuma kelihatan di Postgres
-- Logs. Fix di bawah meng-qualify semua referensi tipe/tabel dengan
-- `public.` dan mengunci search_path function ini supaya masalah yang
-- sama tidak terulang untuk penambahan kolom/tipe baru ke depannya.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_type public.user_type;
  new_role TEXT;
BEGIN
  new_type := COALESCE((new.raw_user_meta_data->>'type')::public.user_type, 'external'::public.user_type);
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
