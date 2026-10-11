-- Konsolidasi role vendor (2026-10-11)
--   * Role sistem `vendor` dihapus; penyusun dokumen = `vendor_admin`.
--   * Tambah `vendor_hse` & `vendor_pm` (review tahap HSE / PM Vendor).
-- Aman dijalankan sekali; tidak idempotent untuk bagian INSERT (roles.name UNIQUE).

BEGIN;

INSERT INTO roles (name, description, is_system, type, permissions) VALUES
('vendor_hse', 'HSE Vendor — review keselamatan tahap HSE Vendor (Prosedur, JSA, PTW) dan isi Safety Checklist PTW.', false, 'vendor',
 '{"dashboard":["view"],"announcement":["view"],"inspection":["view","create"],"incident":["view","create"],"procedure":["view","hse_vendor"],"jsa":["view","hse_vendor"],"ptw":["view","edit_safety_checklist","hse_vendor"],"siteOps":["view","manage"],"masterData":["view_project"],"vendorResources":["view_worker","view_equipment","view_material"]}'::jsonb),
('vendor_pm', 'PM Vendor — review & persetujuan tahap PM Vendor (Prosedur, JSA, PTW) sebelum diteruskan ke PGSOL.', false, 'vendor',
 '{"dashboard":["view"],"announcement":["view"],"inspection":["view"],"incident":["view","create"],"procedure":["view","review_vendor"],"jsa":["view","review_vendor"],"ptw":["view","review_vendor"],"siteOps":["view"],"masterData":["view_project"],"vendorResources":["view_worker","view_equipment","view_material"]}'::jsonb);

-- Akun yang masih memakai role `vendor` dipindah ke `vendor_admin`.
UPDATE profiles SET role = 'vendor_admin' WHERE role = 'vendor' AND type = 'vendor';

-- Default untuk akun baru.
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'vendor_admin';

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_type public.user_type;
  new_role TEXT;
BEGIN
  new_type := COALESCE((new.raw_user_meta_data->>'type')::public.user_type, 'vendor'::public.user_type);
  new_role := COALESCE(new.raw_user_meta_data->>'role', 'vendor_admin');

  INSERT INTO public.profiles (id, full_name, role, type)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new_role, new_type);

  IF new_type <> 'vendor' THEN
    INSERT INTO public.internal_profiles (id, nip)
    VALUES (new.id, new.raw_user_meta_data->>'nip');
  END IF;

  RETURN new;
END;
$function$;

UPDATE roles
SET description = 'Admin & penyusun dokumen vendor — membuat Prosedur/JSA/PTW, mengelola staff & data perusahaan, menunjuk HSE/PM per proyek.'
WHERE name = 'vendor_admin';

DELETE FROM roles WHERE name = 'vendor' AND type = 'vendor';

COMMIT;
