-- supabase/schema_ptw_extension_numbers.sql
--
-- Perpanjangan PTW kini dicetak sebagai lembar PTW LENGKAP (bukan hanya lanjutan
-- Safety Checklist) dengan NOMOR BARU, mis. PTW-2026-006-2, yang diinput HSSE saat
-- menyetujui perpanjangan.
--   * ptw.extensions : riwayat perpanjangan yang disetujui
--       [{ no, number, from, to, reason, decided_at, decided_by }]
--     `from` = hari setelah valid_to sebelumnya, `to` = valid_to baru.
--   * ptw_decide_extension() menerima p_number (wajib saat menyetujui) dan
--     menolak nomor yang sudah dipakai (ptw.ptw_number atau perpanjangan lain).
-- Perpanjangan lama (sebelum migrasi ini) tidak punya baris di extensions dan
-- tetap dicetak sebagai lembar lanjutan checklist seperti sebelumnya.
-- Idempoten. Bergantung pada schema_ptw_extension_multi_sheet.sql.

ALTER TABLE public.ptw
  ADD COLUMN IF NOT EXISTS extensions jsonb NOT NULL DEFAULT '[]'::jsonb;

DROP FUNCTION IF EXISTS public.ptw_decide_extension(uuid, boolean, text);

CREATE OR REPLACE FUNCTION public.ptw_decide_extension(
  p_ptw_id uuid, p_approve boolean, p_note text DEFAULT NULL, p_number text DEFAULT NULL
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
  v_to          date;
  v_pending     date;
  v_reason      text;
  v_count       integer;
  v_caller_type text;
  v_number      text := btrim(coalesce(p_number, ''));
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Silakan login terlebih dahulu.';
  END IF;

  SELECT status, project_id, valid_to, extension_requested_to, extension_reason, extension_count
    INTO v_status, v_project, v_to, v_pending, v_reason, v_count
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
    IF v_pending <= v_to THEN
      RAISE EXCEPTION 'Tanggal perpanjangan sudah tidak lagi melewati masa berlaku PTW.';
    END IF;
    IF length(v_number) = 0 THEN
      RAISE EXCEPTION 'Nomor PTW perpanjangan wajib diisi oleh HSSE.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.ptw WHERE ptw_number = v_number)
       OR EXISTS (
         SELECT 1 FROM public.ptw t, jsonb_array_elements(t.extensions) e
         WHERE e ->> 'number' = v_number
       ) THEN
      RAISE EXCEPTION 'Nomor % sudah dipakai PTW lain.', v_number;
    END IF;

    UPDATE public.ptw SET
      valid_to = v_pending,
      extension_count = extension_count + 1,
      extensions = extensions || jsonb_build_array(jsonb_build_object(
        'no', v_count + 1,
        'number', v_number,
        'from', (v_to + 1)::text,
        'to', v_pending::text,
        'reason', v_reason,
        'decided_at', now(),
        'decided_by', v_caller
      )),
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

REVOKE ALL ON FUNCTION public.ptw_decide_extension(uuid, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ptw_decide_extension(uuid, boolean, text, text) TO authenticated;
