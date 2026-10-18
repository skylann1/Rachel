-- supabase/schema_ptw_extension.sql
--
-- Perpanjangan PTW: vendor mengajukan tanggal berlaku baru selagi PTW masih
-- Aktif, HSSE memverifikasi. PTW tetap 'PTW Aktif' selama pengajuan menunggu
-- (pekerjaan tidak berhenti); hanya valid_to yang berubah saat disetujui.
--
-- Batas total masa berlaku tetap 7 hari sejak valid_from (PTW_MAX_VALID_DAYS):
-- formulir PTW dan daily check hanya punya kolom Hari ke-1 s/d ke-7. Perpanjangan
-- berguna kalau PTW awalnya diterbitkan kurang dari 7 hari.
--
-- Idempoten. Bergantung pada schema_ptw_project_completion.sql (item 15) dan
-- ptw_user_has_perm() dari schema_ptw_field_assignments.sql (item 14).

ALTER TABLE public.ptw
  ADD COLUMN IF NOT EXISTS extension_requested_to    date,
  ADD COLUMN IF NOT EXISTS extension_reason          text,
  ADD COLUMN IF NOT EXISTS extension_requested_at    timestamptz,
  ADD COLUMN IF NOT EXISTS extension_requested_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extension_rejection_note  text,
  ADD COLUMN IF NOT EXISTS extension_count           integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.ptw_request_extension(
  p_ptw_id uuid, p_new_valid_to date, p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_status      text;
  v_from        date;
  v_to          date;
  v_pending     date;
  v_vendor_org  uuid;
  v_caller_type text;
  v_caller_org  uuid;
  v_today       date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Silakan login terlebih dahulu.';
  END IF;

  SELECT t.status, t.valid_from, t.valid_to, t.extension_requested_to, p.vendor_id
    INTO v_status, v_from, v_to, v_pending, v_vendor_org
  FROM public.ptw t JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = p_ptw_id
  FOR UPDATE OF t;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PTW tidak ditemukan.';
  END IF;

  SELECT type::text, org_id INTO v_caller_type, v_caller_org FROM public.profiles WHERE id = v_caller;
  IF v_caller_type IS DISTINCT FROM 'vendor'
     OR v_caller_org IS DISTINCT FROM v_vendor_org
     OR NOT public.ptw_user_has_perm(v_caller, 'request_extension') THEN
    RAISE EXCEPTION 'Anda tidak berwenang mengajukan perpanjangan PTW ini.';
  END IF;

  IF v_status <> 'PTW Aktif' THEN
    RAISE EXCEPTION 'Perpanjangan hanya bisa diajukan untuk PTW yang masih Aktif.';
  END IF;
  IF v_from IS NULL OR v_to IS NULL THEN
    RAISE EXCEPTION 'PTW ini belum punya masa berlaku.';
  END IF;
  IF v_to < v_today THEN
    RAISE EXCEPTION 'PTW sudah lewat masa berlaku. Perpanjangan harus diajukan sebelum PTW berakhir.';
  END IF;
  IF v_pending IS NOT NULL THEN
    RAISE EXCEPTION 'Sudah ada pengajuan perpanjangan yang menunggu verifikasi.';
  END IF;
  IF p_new_valid_to IS NULL OR p_new_valid_to <= v_to THEN
    RAISE EXCEPTION 'Tanggal berlaku baru harus setelah tanggal berlaku saat ini (%).', v_to;
  END IF;
  IF (p_new_valid_to - v_from) + 1 > 7 THEN
    RAISE EXCEPTION 'Masa berlaku PTW maksimal 7 hari sejak tanggal mulai (sampai %).', (v_from + 6);
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Alasan perpanjangan wajib diisi.';
  END IF;

  UPDATE public.ptw SET
    extension_requested_to = p_new_valid_to,
    extension_reason = btrim(p_reason),
    extension_requested_at = now(),
    extension_requested_by = v_caller,
    extension_rejection_note = NULL
  WHERE id = p_ptw_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ptw_decide_extension(
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
  v_from        date;
  v_pending     date;
  v_caller_type text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Silakan login terlebih dahulu.';
  END IF;

  SELECT status, project_id, valid_from, extension_requested_to
    INTO v_status, v_project, v_from, v_pending
  FROM public.ptw WHERE id = p_ptw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PTW tidak ditemukan.';
  END IF;
  IF v_pending IS NULL THEN
    RAISE EXCEPTION 'PTW ini tidak sedang menunggu verifikasi perpanjangan.';
  END IF;
  IF v_status <> 'PTW Aktif' THEN
    RAISE EXCEPTION 'Perpanjangan hanya bisa diproses untuk PTW yang masih Aktif.';
  END IF;

  SELECT type::text INTO v_caller_type FROM public.profiles WHERE id = v_caller;
  IF v_caller_type IS DISTINCT FROM 'pgn'
     OR NOT public.ptw_user_has_perm(v_caller, 'verify_extension')
     OR NOT EXISTS (
       SELECT 1 FROM public.stage_assignments sa
       WHERE sa.project_id = v_project AND sa.doc_type = 'ptw'
         AND sa.stage_key = 'ptw.numbering_hsse' AND sa.assignee_id = v_caller
     ) THEN
    RAISE EXCEPTION 'Anda tidak berwenang memverifikasi perpanjangan PTW ini.';
  END IF;

  IF NOT p_approve AND length(btrim(coalesce(p_note, ''))) = 0 THEN
    RAISE EXCEPTION 'Catatan penolakan wajib diisi.';
  END IF;

  IF p_approve THEN
    IF v_from IS NOT NULL AND (v_pending - v_from) + 1 > 7 THEN
      RAISE EXCEPTION 'Masa berlaku PTW maksimal 7 hari sejak tanggal mulai.';
    END IF;
    UPDATE public.ptw SET
      valid_to = v_pending,
      extension_count = extension_count + 1,
      extension_requested_to = NULL, extension_reason = NULL,
      extension_requested_at = NULL, extension_requested_by = NULL,
      extension_rejection_note = NULL
    WHERE id = p_ptw_id;
  ELSE
    UPDATE public.ptw SET
      extension_requested_to = NULL, extension_reason = NULL,
      extension_requested_at = NULL, extension_requested_by = NULL,
      extension_rejection_note = btrim(p_note)
    WHERE id = p_ptw_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ptw_request_extension(uuid, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ptw_decide_extension(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ptw_request_extension(uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ptw_decide_extension(uuid, boolean, text) TO authenticated;

-- Permission baru untuk role yang sudah ada (idempoten).
UPDATE public.roles
SET permissions = jsonb_set(permissions, '{ptw}', coalesce(permissions -> 'ptw', '[]'::jsonb) || '["verify_extension"]'::jsonb)
WHERE jsonb_exists(permissions -> 'ptw', 'numbering_hsse')
  AND NOT jsonb_exists(permissions -> 'ptw', 'verify_extension');

UPDATE public.roles
SET permissions = jsonb_set(permissions, '{ptw}', coalesce(permissions -> 'ptw', '[]'::jsonb) || '["request_extension"]'::jsonb)
WHERE type = 'vendor'
  AND (jsonb_exists(permissions -> 'ptw', 'assign_holder') OR jsonb_exists(permissions -> 'ptw', 'field_holder'))
  AND NOT jsonb_exists(permissions -> 'ptw', 'request_extension');

-- Admin vendor (vendor_admin) = penyusun dokumen: beri izin yang dibutuhkan
-- fitur penutupan/perpanjangan/penyelesaian proyek + penugasan Pemegang PTW.
-- Idempoten (hanya menambahkan izin yang belum ada).
UPDATE public.roles r
SET permissions = jsonb_set(r.permissions, '{ptw}',
  coalesce(r.permissions -> 'ptw', '[]'::jsonb) || (
    SELECT coalesce(jsonb_agg(p), '[]'::jsonb)
    FROM unnest(ARRAY['assign_holder','request_closure','request_extension','request_project_completion']) AS p
    WHERE NOT jsonb_exists(coalesce(r.permissions -> 'ptw', '[]'::jsonb), p)
  ))
WHERE r.name = 'vendor_admin';
