-- =====================================================================
-- Menjadikan alur approval Prosedur -> JSA -> PTW sepenuhnya data-driven
-- lewat kolom roles.permissions, bukan lagi role slug yang di-hardcode
-- di kode (lihat lib/procedure-status.ts, lib/jsa-status.ts, lib/ptw-status.ts,
-- app/dashboard/approval/actions.ts, utils/permissions.ts).
--
-- Kunci permission baru yang dibaca kode:
--   procedure.review        -> approve/reject Prosedur Kerja (tahap PM)
--   jsa.review_pgsol        -> review JSA tahap PGSOL
--   jsa.approve_pgn         -> approve JSA tahap PGN
--   ptw.approve_pm          -> approve PTW tahap PM (PTW Authority)
--   ptw.review_issuer       -> approve PTW tahap PTW Issuer
--   ptw.numbering_hsse      -> penomoran & penerbitan PTW (HSSE)
--
-- Setelah ini, admin bisa mengganti siapa yang berhak di tiap tahap lewat
-- halaman Role & Permission (centang/hilangkan permission di atas pada
-- role apa pun) tanpa perlu deploy ulang kode.
-- =====================================================================

-- Role 'ptw_authority' dan 'ptw_issuer' sebelumnya hanya ada di ENUM lama
-- (schema_update_workflow.sql) dan TIDAK PERNAH punya baris di public.roles,
-- jadi tidak pernah muncul/bisa dikelola di halaman Role & Permission.
-- Ditambahkan di sini supaya keduanya jadi role biasa yang bisa diedit dari UI.
INSERT INTO public.roles (name, description, is_system, type, permissions) VALUES
  (
    'ptw_authority',
    'PTW Authority — approval tahap pertama PTW (Project Manager).',
    false,
    'internal',
    '{"dashboard": ["view"], "approval": ["view"], "ptw": ["view", "approve_pm"], "masterData": ["view_project"]}'
  ),
  (
    'ptw_issuer',
    'PTW Issuer — review tahap kedua PTW.',
    false,
    'internal',
    '{"dashboard": ["view"], "approval": ["view"], "ptw": ["view", "review_issuer"], "masterData": ["view_project"]}'
  )
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    type        = EXCLUDED.type,
    permissions = public.roles.permissions || EXCLUDED.permissions;

-- pm: approve Prosedur Kerja (sebelumnya hardcoded 'pm' di PROCEDURE_STAGE_ROLES)
UPDATE public.roles
SET permissions = permissions || '{"procedure": ["view", "review"]}'::jsonb
WHERE name = 'pm';

-- pgsol_reviewer: tahap Review PGSOL pada JSA
UPDATE public.roles
SET permissions = permissions || '{"jsa": ["view", "review_pgsol"]}'::jsonb
WHERE name = 'pgsol_reviewer';

-- pgn_approver: tahap Persetujuan PGN pada JSA
UPDATE public.roles
SET permissions = permissions || '{"jsa": ["view", "approve_pgn"]}'::jsonb
WHERE name = 'pgn_approver';

-- hse: tahap Penomoran HSSE pada PTW (permission lain milik hse tetap dipertahankan)
UPDATE public.roles
SET permissions = permissions || '{"ptw": ["view", "numbering_hsse"]}'::jsonb
WHERE name = 'hse';

-- admin: kolom permissions disegarkan agar mencakup modul procedure & ptw yang
-- baru. Ini murni untuk konsistensi tampilan checklist di halaman Role &
-- Permission — kode aplikasi sendiri sudah selalu memberi admin akses penuh
-- (lihat fullAccessPermissions() di utils/permissions.ts).
UPDATE public.roles
SET permissions = permissions || '{
  "procedure": ["view", "review"],
  "jsa": ["view", "create", "review_pgsol", "approve_pgn", "delete"],
  "ptw": ["view", "approve_pm", "review_issuer", "numbering_hsse"]
}'::jsonb
WHERE name = 'admin';
