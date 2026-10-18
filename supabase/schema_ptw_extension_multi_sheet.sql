-- supabase/schema_ptw_extension_multi_sheet.sql
--
-- Perpanjangan PTW bisa melewati Hari ke-7 pada PTW yang SAMA (bukan PTW baru).
-- Aturan baru:
--   * Tiap pengajuan perpanjangan menambah maksimal 7 hari dari valid_to saat ini,
--     dan boleh diajukan berkali-kali (selagi PTW masih Aktif).
--   * Satu lembar formulir tetap memuat 7 hari; hari ke-8 dst dicetak di lembar
--     lanjutan pada dokumen PDF yang sama (lihat components/ptw/PtwPDF.tsx).
--   * Daily check & safety checklist berlanjut ke Hari ke-8, 9, ... (batas teknis 366).
--
-- Menggantikan batas "total 7 hari sejak valid_from" di schema_ptw_extension.sql
-- dan batas hari_ke 1..7 di schema_ptw_field_assignments.sql. Idempoten.

-- 1. Longgarkan CHECK hari_ke (nama constraint dicari dari definisinya).
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.ptw_daily_checks'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%hari_ke%'
      AND pg_get_constraintdef(oid) ILIKE '%7%'
  LOOP
    EXECUTE format('ALTER TABLE public.ptw_daily_checks DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.ptw_daily_checks DROP CONSTRAINT IF EXISTS ptw_daily_checks_hari_ke_range;
ALTER TABLE public.ptw_daily_checks
  ADD CONSTRAINT ptw_daily_checks_hari_ke_range CHECK (hari_ke BETWEEN 1 AND 366);

-- 2. Daily check: tidak lagi dibatasi 7 hari sejak valid_from (cukup di dalam masa berlaku).
CREATE OR REPLACE FUNCTION public.ptw_submit_daily_check(
  p_ptw_id uuid, p_uraian text DEFAULT NULL, p_required_keys text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller    uuid := auth.uid();
  v_status    text;
  v_from      date;
  v_to        date;
  v_checklist jsonb;
  v_today     date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_hari      int;
  v_peran     text;
  v_inisial   text;
  v_key       text;
  v_id        uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Silakan login terlebih dahulu.';
  END IF;

  SELECT status, valid_from, valid_to, safety_checklist
    INTO v_status, v_from, v_to, v_checklist
  FROM public.ptw WHERE id = p_ptw_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PTW tidak ditemukan.';
  END IF;
  IF v_status <> 'PTW Aktif' THEN
    RAISE EXCEPTION 'Daily check hanya bisa diisi selama PTW berstatus Aktif.';
  END IF;
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'PTW ini belum punya masa berlaku.';
  END IF;

  v_hari := v_today - v_from + 1;
  IF v_hari < 1 OR v_hari > 366 OR (v_to IS NOT NULL AND v_today > v_to) THEN
    RAISE EXCEPTION 'Hari ini di luar masa berlaku PTW.';
  END IF;

  SELECT peran INTO v_peran FROM public.ptw_field_assignments
  WHERE ptw_id = p_ptw_id AND user_id = v_caller AND aktif_sampai IS NULL;
  IF v_peran IS NULL THEN
    RAISE EXCEPTION 'Anda bukan Pemegang/Pengawas aktif untuk PTW ini.';
  END IF;

  IF v_peran = 'pemegang' AND length(btrim(coalesce(p_uraian, ''))) = 0 THEN
    RAISE EXCEPTION 'Uraian pekerjaan hari ini wajib diisi.';
  END IF;

  IF v_peran = 'pengawas' THEN
    FOREACH v_key IN ARRAY p_required_keys LOOP
      IF jsonb_typeof(v_checklist -> v_key -> 'days' -> (v_hari - 1)) IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION 'Safety checklist hari ini belum lengkap — jawab semua baris (Sudah/Belum) dulu.';
      END IF;
    END LOOP;
  END IF;

  SELECT coalesce(nullif(upper(string_agg(left(w.word, 1), '' ORDER BY w.n)), ''), '?')
    INTO v_inisial
  FROM public.profiles pr,
       LATERAL (
         SELECT word, n
         FROM regexp_split_to_table(btrim(coalesce(pr.full_name, '')), '\s+') WITH ORDINALITY AS t(word, n)
         WHERE word <> '' AND n <= 3
       ) w
  WHERE pr.id = v_caller;

  BEGIN
    INSERT INTO public.ptw_daily_checks (ptw_id, hari_ke, tanggal, peran, user_id, inisial, uraian_pekerjaan)
    VALUES (
      p_ptw_id, v_hari, v_today, v_peran, v_caller, coalesce(v_inisial, '?'),
      CASE WHEN v_peran = 'pemegang' THEN btrim(p_uraian) ELSE NULL END
    )
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Daily check hari ini sudah diisi.';
  END;

  RETURN v_id;
END;
$$;

-- 3. Perpanjangan: maksimal 7 hari per pengajuan, boleh berulang.
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
  IF (p_new_valid_to - v_to) > 7 THEN
    RAISE EXCEPTION 'Satu perpanjangan maksimal 7 hari (sampai %). Ajukan perpanjangan lagi bila masih kurang.', (v_to + 7);
  END IF;
  IF (p_new_valid_to - v_from) + 1 > 366 THEN
    RAISE EXCEPTION 'Total masa berlaku PTW melebihi batas sistem.';
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
  v_to          date;
  v_pending     date;
  v_caller_type text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Silakan login terlebih dahulu.';
  END IF;

  SELECT status, project_id, valid_to, extension_requested_to
    INTO v_status, v_project, v_to, v_pending
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

REVOKE ALL ON FUNCTION public.ptw_submit_daily_check(uuid, text, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ptw_request_extension(uuid, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ptw_decide_extension(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ptw_submit_daily_check(uuid, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ptw_request_extension(uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ptw_decide_extension(uuid, boolean, text) TO authenticated;
