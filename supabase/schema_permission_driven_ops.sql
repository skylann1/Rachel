-- =====================================================================
-- Lanjutan dari schema_permission_driven_approval.sql: menambahkan
-- gerbang permission nyata untuk modul Inspeksi & Insiden (sebelumnya
-- cuma checkbox tanpa enforcement), plus dokumen vendor untuk HSE.
--
-- Kunci baru yang sekarang dibaca kode:
--   inspection.create   -> app/dashboard/inspection/actions.ts: createInspection
--   inspection.manage   -> delegateInspection, validateInspection
--   incident.investigate -> app/dashboard/incident/actions.ts: updateIncidentInvestigation
--   inspection.view / incident.view -> guard halaman (layout.tsx)
--   masterData.manage_vendor/manage_account/manage_project -> guard
--     addVendor/updateVendor, addAccount/updateAccount/suspendAccount/
--     resetAccountPassword/deleteAccount, createProject
--
-- Tanpa migrasi ini, role hse & petugas (field supervisor) akan kehilangan
-- akses ke fitur yang sebelumnya bisa mereka pakai bebas (belum ada
-- gerbangnya sama sekali sebelum sesi ini).
-- =====================================================================

-- hse: kelola inspeksi, investigasi insiden, verifikasi dokumen vendor.
UPDATE public.roles
SET permissions = permissions || '{
  "inspection": ["view", "manage"],
  "incident": ["view", "investigate"],
  "vendorDocs": ["view", "approve"]
}'::jsonb
WHERE name = 'hse';

-- petugas (a.k.a pengawas — nama role ini pernah diganti lewat halaman
-- Role & Permission, jadi dua-duanya ditarget biar aman): field supervisor,
-- lapor & tindak lanjuti temuan inspeksi + insiden dari lapangan.
UPDATE public.roles
SET permissions = permissions || '{
  "inspection": ["view", "create", "manage"],
  "incident": ["view", "create"]
}'::jsonb
WHERE name IN ('petugas', 'pengawas');

-- admin: disegarkan biar checklist di halaman Role & Permission lengkap
-- (kode sendiri sudah selalu memberi admin akses penuh via bypass).
UPDATE public.roles
SET permissions = permissions || '{
  "inspection": ["view", "create", "manage"],
  "incident": ["view", "create", "investigate"],
  "masterData": ["view_vendor", "manage_vendor", "view_account", "manage_account", "manage_role", "view_project", "manage_project"],
  "vendorDocs": ["view", "approve"]
}'::jsonb
WHERE name = 'admin';
