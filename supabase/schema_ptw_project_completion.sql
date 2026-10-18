-- supabase/schema_ptw_project_completion.sql
--
-- Penutupan PTW + penyelesaian Proyek. Spec:
-- docs/superpowers/specs/2026-10-19-ptw-and-project-completion-design.md
--
-- Idempoten. Bergantung pada ptw_user_has_perm() dari
-- schema_ptw_field_assignments.sql (item 14 di README_org_migration_order.md)
-- dan current_vendor_org_id() dari schema_org_*.sql.
--
-- Semua transisi status lewat RPC SECURITY DEFINER (pola yang sama dengan
-- ptw_assign_field_role), jadi policy UPDATE vendor pada tabel `ptw` TIDAK
-- diubah: vendor tetap tidak bisa menulis status 'Selesai' lewat REST.

ALTER TABLE public.ptw
  ADD COLUMN IF NOT EXISTS closure_requested_at     timestamptz,
  ADD COLUMN IF NOT EXISTS closure_requested_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closure_finished_at      timestamptz,
  ADD COLUMN IF NOT EXISTS closure_checklist        jsonb,
  ADD COLUMN IF NOT EXISTS closure_note             text,
  ADD COLUMN IF NOT EXISTS closure_rejection_note   text,
  ADD COLUMN IF NOT EXISTS closed_at                timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by                uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS completion_requested_at   timestamptz,
  ADD COLUMN IF NOT EXISTS completion_requested_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completion_note           text,
  ADD COLUMN IF NOT EXISTS completion_rejection_note text,
  ADD COLUMN IF NOT EXISTS completed_at              timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by              uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 1. Vendor mengajukan penutupan PTW
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ptw_request_closure(
  p_ptw_id uuid, p_checklist jsonb, p_note text, p_finished_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_status      text;
  v_vendor_org  uuid;
  v_caller_type text;
  v_caller_org  uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Silakan login terlebih dahulu.';
  END IF;

  SELECT t.status, p.vendor_id INTO v_status, v_vendor_org
  FROM public.ptw t JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = p_ptw_id
  FOR UPDATE OF t;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PTW tidak ditemukan.';
  END IF;

  SELECT type::text, org_id INTO v_caller_type, v_caller_org FROM public.profiles WHERE id = v_caller;
  IF v_caller_type IS DISTINCT FROM 'vendor'
     OR v_caller_org IS DISTINCT FROM v_vendor_org
     OR NOT public.ptw_user_has_perm(v_caller, 'request_closure') THEN
    RAISE EXCEPTION 'Anda tidak berwenang mengajukan penutupan PTW ini.';
  END IF;

  IF v_status NOT IN ('PTW Aktif', 'Expired') THEN
    RAISE EXCEPTION 'Penutupan hanya bisa diajukan untuk PTW yang berstatus Aktif atau Expired.';
  END IF;

  IF length(btrim(coalesce(p_note, ''))) = 0 THEN
    RAISE EXCEPTION 'Catatan penutupan wajib diisi.';
  END IF;
  IF p_finished_at IS NULL THEN
    RAISE EXCEPTION 'Waktu selesai pekerjaan wajib diisi.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.site_checkins WHERE ptw_id = p_ptw_id AND checked_out_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Masih ada pekerja yang belum check-out. Selesaikan check-out dulu sebelum menutup PTW.';
  END IF;

  UPDATE public.ptw SET
    status = 'Penutupan Diajukan',
    closure_requested_at = now(),
    closure_requested_by = v_caller,
    closure_finished_at = p_finished_at,
    closure_checklist = coalesce(p_checklist, '{}'::jsonb),
    closure_note = btrim(p_note),
    closure_rejection_note = NULL
  WHERE id = p_ptw_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. Internal (HSSE) memverifikasi / menolak penutupan PTW
--    Gerbang: permission ptw.verify_closure DAN ditugaskan di tahap
--    ptw.numbering_hsse proyek ini (fail-closed, sama seperti approval lain).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ptw_decide_closure(
  p_ptw_id uuid, p_approve boolean, p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_status      text;
  v_project     uuid;
  v_requested_by uuid;
  v_caller_type text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Silakan login terlebih dahulu.';
  END IF;

  SELECT status, project_id, closure_requested_by INTO v_status, v_project, v_requested_by
  FROM public.ptw WHERE id = p_ptw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PTW tidak ditemukan.';
  END IF;
  IF v_status <> 'Penutupan Diajukan' THEN
    RAISE EXCEPTION 'PTW ini tidak sedang menunggu verifikasi penutupan.';
  END IF;

  SELECT type::text INTO v_caller_type FROM public.profiles WHERE id = v_caller;
  IF v_caller_type IS DISTINCT FROM 'pgn'
     OR NOT public.ptw_user_has_perm(v_caller, 'verify_closure')
     OR NOT EXISTS (
       SELECT 1 FROM public.stage_assignments sa
       WHERE sa.project_id = v_project AND sa.doc_type = 'ptw'
         AND sa.stage_key = 'ptw.numbering_hsse' AND sa.assignee_id = v_caller
     ) THEN
    RAISE EXCEPTION 'Anda tidak berwenang memverifikasi penutupan PTW ini.';
  END IF;

  IF NOT p_approve AND length(btrim(coalesce(p_note, ''))) = 0 THEN
    RAISE EXCEPTION 'Catatan penolakan wajib diisi.';
  END IF;

  IF p_approve THEN
    UPDATE public.ptw SET
      status = 'Selesai', closed_at = now(), closed_by = v_caller, closure_rejection_note = NULL
    WHERE id = p_ptw_id;
  ELSE
    UPDATE public.ptw SET
      status = 'PTW Aktif', closure_rejection_note = btrim(p_note)
    WHERE id = p_ptw_id;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Vendor mengajukan penyelesaian proyek
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.project_request_completion(
  p_project_id uuid, p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_status      text;
  v_vendor_org  uuid;
  v_pending     timestamptz;
  v_caller_type text;
  v_caller_org  uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Silakan login terlebih dahulu.';
  END IF;

  SELECT status::text, vendor_id, completion_requested_at INTO v_status, v_vendor_org, v_pending
  FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proyek tidak ditemukan.';
  END IF;

  SELECT type::text, org_id INTO v_caller_type, v_caller_org FROM public.profiles WHERE id = v_caller;
  IF v_caller_type IS DISTINCT FROM 'vendor'
     OR v_caller_org IS DISTINCT FROM v_vendor_org
     OR NOT public.ptw_user_has_perm(v_caller, 'request_project_completion') THEN
    RAISE EXCEPTION 'Anda tidak berwenang mengajukan penyelesaian proyek ini.';
  END IF;

  IF v_status IN ('Selesai', 'Ditolak') THEN
    RAISE EXCEPTION 'Proyek ini sudah berstatus %.', v_status;
  END IF;
  IF v_pending IS NOT NULL THEN
    RAISE EXCEPTION 'Penyelesaian proyek ini sudah diajukan dan sedang menunggu verifikasi.';
  END IF;
  IF length(btrim(coalesce(p_note, ''))) = 0 THEN
    RAISE EXCEPTION 'Catatan penyelesaian wajib diisi.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ptw WHERE project_id = p_project_id) THEN
    RAISE EXCEPTION 'Proyek belum memiliki PTW.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ptw WHERE project_id = p_project_id AND status <> 'Selesai') THEN
    RAISE EXCEPTION 'Semua PTW proyek harus sudah ditutup (Selesai) sebelum proyek diselesaikan.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.inspections WHERE project_id = p_project_id AND status::text <> 'Closed') THEN
    RAISE EXCEPTION 'Masih ada Inspeksi Temuan yang belum ditutup pada proyek ini.';
  END IF;

  UPDATE public.projects SET
    completion_requested_at = now(),
    completion_requested_by = v_caller,
    completion_note = btrim(p_note),
    completion_rejection_note = NULL
  WHERE id = p_project_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Internal memverifikasi / menolak penyelesaian proyek
--    Gerbang: permission ptw.verify_project_completion DAN ditugaskan di
--    tahap ptw.approve_pm (PM) proyek ini.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.project_decide_completion(
  p_project_id uuid, p_approve boolean, p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_status      text;
  v_pending     timestamptz;
  v_caller_type text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Silakan login terlebih dahulu.';
  END IF;

  SELECT status::text, completion_requested_at INTO v_status, v_pending
  FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proyek tidak ditemukan.';
  END IF;
  IF v_pending IS NULL OR v_status = 'Selesai' THEN
    RAISE EXCEPTION 'Proyek ini tidak sedang menunggu verifikasi penyelesaian.';
  END IF;

  SELECT type::text INTO v_caller_type FROM public.profiles WHERE id = v_caller;
  IF v_caller_type IS DISTINCT FROM 'pgn'
     OR NOT public.ptw_user_has_perm(v_caller, 'verify_project_completion')
     OR NOT EXISTS (
       SELECT 1 FROM public.stage_assignments sa
       WHERE sa.project_id = p_project_id AND sa.doc_type = 'ptw'
         AND sa.stage_key = 'ptw.approve_pm' AND sa.assignee_id = v_caller
     ) THEN
    RAISE EXCEPTION 'Anda tidak berwenang memverifikasi penyelesaian proyek ini.';
  END IF;

  IF NOT p_approve AND length(btrim(coalesce(p_note, ''))) = 0 THEN
    RAISE EXCEPTION 'Catatan penolakan wajib diisi.';
  END IF;

  IF p_approve THEN
    -- Cek ulang syarat: kondisi bisa berubah sejak diajukan (mis. temuan baru).
    IF EXISTS (SELECT 1 FROM public.ptw WHERE project_id = p_project_id AND status <> 'Selesai') THEN
      RAISE EXCEPTION 'Masih ada PTW yang belum ditutup pada proyek ini.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.inspections WHERE project_id = p_project_id AND status::text <> 'Closed') THEN
      RAISE EXCEPTION 'Masih ada Inspeksi Temuan yang belum ditutup pada proyek ini.';
    END IF;
    UPDATE public.projects SET
      status = 'Selesai', completed_at = now(), completed_by = v_caller, completion_rejection_note = NULL
    WHERE id = p_project_id;
  ELSE
    UPDATE public.projects SET
      completion_requested_at = NULL, completion_requested_by = NULL,
      completion_rejection_note = btrim(p_note)
    WHERE id = p_project_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ptw_request_closure(uuid, jsonb, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ptw_decide_closure(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.project_request_completion(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.project_decide_completion(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ptw_request_closure(uuid, jsonb, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ptw_decide_closure(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_request_completion(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_decide_completion(uuid, boolean, text) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. Permission baru untuk role yang sudah ada (idempoten)
--    * verify_closure            -> pemegang ptw.numbering_hsse (HSSE)
--    * verify_project_completion -> pemegang ptw.approve_pm (PM)
--    * request_closure / request_project_completion -> role vendor yang
--      memegang ptw.assign_holder (admin vendor)
-- ---------------------------------------------------------------------
UPDATE public.roles
SET permissions = jsonb_set(permissions, '{ptw}', coalesce(permissions -> 'ptw', '[]'::jsonb) || '["verify_closure"]'::jsonb)
WHERE jsonb_exists(permissions -> 'ptw', 'numbering_hsse')
  AND NOT jsonb_exists(permissions -> 'ptw', 'verify_closure');

UPDATE public.roles
SET permissions = jsonb_set(permissions, '{ptw}', coalesce(permissions -> 'ptw', '[]'::jsonb) || '["verify_project_completion"]'::jsonb)
WHERE jsonb_exists(permissions -> 'ptw', 'approve_pm')
  AND NOT jsonb_exists(permissions -> 'ptw', 'verify_project_completion');

UPDATE public.roles
SET permissions = jsonb_set(permissions, '{ptw}', coalesce(permissions -> 'ptw', '[]'::jsonb) || '["request_closure"]'::jsonb)
WHERE type = 'vendor' AND jsonb_exists(permissions -> 'ptw', 'assign_holder')
  AND NOT jsonb_exists(permissions -> 'ptw', 'request_closure');

UPDATE public.roles
SET permissions = jsonb_set(permissions, '{ptw}', coalesce(permissions -> 'ptw', '[]'::jsonb) || '["request_project_completion"]'::jsonb)
WHERE type = 'vendor' AND jsonb_exists(permissions -> 'ptw', 'assign_holder')
  AND NOT jsonb_exists(permissions -> 'ptw', 'request_project_completion');

-- ---------------------------------------------------------------------
-- 6. Role siap pakai: Pemegang PTW (vendor) dan Pengawas PTW (PGN)
-- ---------------------------------------------------------------------
INSERT INTO public.roles (name, description, is_system, type, permissions) VALUES
(
  'vendor_pemegang_ptw',
  'Pemegang PTW — staff vendor yang memegang izin kerja di lapangan: mengisi daily check, mencatat toolbox meeting, dan mengajukan penutupan PTW saat pekerjaan selesai.',
  false, 'vendor',
  '{"dashboard":["view"],"announcement":["view"],"inspection":["view"],"incident":["view","create"],"ptw":["view","field_holder","request_closure","request_extension"],"siteOps":["view","manage"],"masterData":["view_project"],"vendorResources":["view_worker","view_equipment","view_material"]}'::jsonb
),
(
  'pgn_pengawas_ptw',
  'Pengawas PTW — staff PGN yang mengawasi pekerjaan di lapangan: mengisi safety checklist dan daily check pengawas selama PTW aktif.',
  false, 'pgn',
  '{"dashboard":["view"],"announcement":["view"],"inspection":["view","create"],"incident":["view","create"],"ptw":["view","field_pengawas","edit_safety_checklist"],"siteOps":["view"],"masterData":["view_project"],"vendorResources":["view_worker","view_equipment","view_material"]}'::jsonb
)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description, type = EXCLUDED.type, permissions = EXCLUDED.permissions;
