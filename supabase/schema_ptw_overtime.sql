-- supabase/schema_ptw_overtime.sql
--
-- Lembur pada PTW yang sudah Aktif. Jam kerja normal tetap di ptw.work_start/work_end;
-- pekerjaan di luar jam itu (lembur / shift malam) harus diajukan vendor per tanggal
-- dan diverifikasi HSSE yang ditugaskan di proyek (tahap ptw.numbering_hsse) —
-- pola sama dengan perpanjangan PTW. Memakai izin yang sama:
--   * vendor  : ptw.request_extension
--   * HSSE    : ptw.verify_extension (+ ditugaskan di ptw.numbering_hsse)
-- Jam selesai <= jam mulai berarti melewati tengah malam (jatuh ke hari berikutnya).
-- Idempoten. Bergantung pada schema_ptw_extension.sql (ptw_user_has_perm).

CREATE TABLE IF NOT EXISTS public.ptw_overtimes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ptw_id        uuid NOT NULL REFERENCES public.ptw(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tanggal       date NOT NULL,
  jam_mulai     text NOT NULL,
  jam_selesai   text NOT NULL,
  alasan        text NOT NULL,
  status        text NOT NULL DEFAULT 'Menunggu' CHECK (status IN ('Menunggu', 'Disetujui', 'Ditolak')),
  requested_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_at  timestamptz NOT NULL DEFAULT now(),
  decided_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at    timestamptz,
  decision_note text
);

CREATE INDEX IF NOT EXISTS idx_ptw_overtimes_ptw ON public.ptw_overtimes(ptw_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_ptw_overtimes_project ON public.ptw_overtimes(project_id, status);
-- Satu pengajuan aktif (menunggu / disetujui) per PTW per tanggal.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ptw_overtimes_active
  ON public.ptw_overtimes(ptw_id, tanggal) WHERE status IN ('Menunggu', 'Disetujui');

ALTER TABLE public.ptw_overtimes ENABLE ROW LEVEL SECURITY;

-- Baca: semua user login (seperti document_logs). Tulis HANYA lewat fungsi di bawah.
DROP POLICY IF EXISTS "Authenticated can read ptw overtimes" ON public.ptw_overtimes;
CREATE POLICY "Authenticated can read ptw overtimes"
ON public.ptw_overtimes FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.ptw_request_overtime(
  p_ptw_id uuid, p_tanggal date, p_mulai text, p_selesai text, p_alasan text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_status      text;
  v_from        date;
  v_to          date;
  v_project     uuid;
  v_vendor_org  uuid;
  v_caller_type text;
  v_caller_org  uuid;
  v_today       date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_id          uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Silakan login terlebih dahulu.';
  END IF;

  SELECT t.status, t.valid_from, t.valid_to, t.project_id, p.vendor_id
    INTO v_status, v_from, v_to, v_project, v_vendor_org
  FROM public.ptw t JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = p_ptw_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PTW tidak ditemukan.';
  END IF;

  SELECT type::text, org_id INTO v_caller_type, v_caller_org FROM public.profiles WHERE id = v_caller;
  IF v_caller_type IS DISTINCT FROM 'vendor'
     OR v_caller_org IS DISTINCT FROM v_vendor_org
     OR NOT public.ptw_user_has_perm(v_caller, 'request_extension') THEN
    RAISE EXCEPTION 'Anda tidak berwenang mengajukan lembur untuk PTW ini.';
  END IF;

  IF v_status <> 'PTW Aktif' THEN
    RAISE EXCEPTION 'Lembur hanya bisa diajukan untuk PTW yang masih Aktif.';
  END IF;
  IF p_tanggal IS NULL OR p_tanggal < v_today THEN
    RAISE EXCEPTION 'Tanggal lembur tidak boleh sebelum hari ini.';
  END IF;
  IF v_from IS NOT NULL AND v_to IS NOT NULL AND (p_tanggal < v_from OR p_tanggal > v_to) THEN
    RAISE EXCEPTION 'Tanggal lembur harus berada dalam masa berlaku PTW (% s/d %).', v_from, v_to;
  END IF;
  IF p_mulai !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR p_selesai !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RAISE EXCEPTION 'Format jam harus HH:MM.';
  END IF;
  IF p_mulai = p_selesai THEN
    RAISE EXCEPTION 'Jam mulai dan jam selesai lembur tidak boleh sama.';
  END IF;
  IF length(btrim(coalesce(p_alasan, ''))) = 0 THEN
    RAISE EXCEPTION 'Alasan lembur wajib diisi.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ptw_overtimes WHERE ptw_id = p_ptw_id AND tanggal = p_tanggal AND status IN ('Menunggu', 'Disetujui')) THEN
    RAISE EXCEPTION 'Sudah ada pengajuan lembur untuk tanggal tersebut.';
  END IF;

  INSERT INTO public.ptw_overtimes (ptw_id, project_id, tanggal, jam_mulai, jam_selesai, alasan, requested_by)
  VALUES (p_ptw_id, v_project, p_tanggal, p_mulai, p_selesai, btrim(p_alasan), v_caller)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ptw_decide_overtime(
  p_overtime_id uuid, p_approve boolean, p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_project     uuid;
  v_status      text;
  v_caller_type text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Silakan login terlebih dahulu.';
  END IF;

  SELECT project_id, status INTO v_project, v_status
  FROM public.ptw_overtimes WHERE id = p_overtime_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan lembur tidak ditemukan.';
  END IF;
  IF v_status <> 'Menunggu' THEN
    RAISE EXCEPTION 'Pengajuan lembur ini sudah diputuskan.';
  END IF;

  SELECT type::text INTO v_caller_type FROM public.profiles WHERE id = v_caller;
  IF v_caller_type IS DISTINCT FROM 'pgn'
     OR NOT public.ptw_user_has_perm(v_caller, 'verify_extension')
     OR NOT EXISTS (
       SELECT 1 FROM public.stage_assignments sa
       WHERE sa.project_id = v_project AND sa.doc_type = 'ptw'
         AND sa.stage_key = 'ptw.numbering_hsse' AND sa.assignee_id = v_caller
     ) THEN
    RAISE EXCEPTION 'Anda tidak berwenang memverifikasi lembur PTW ini.';
  END IF;

  IF NOT p_approve AND length(btrim(coalesce(p_note, ''))) = 0 THEN
    RAISE EXCEPTION 'Catatan penolakan wajib diisi.';
  END IF;

  UPDATE public.ptw_overtimes SET
    status = CASE WHEN p_approve THEN 'Disetujui' ELSE 'Ditolak' END,
    decided_by = v_caller,
    decided_at = now(),
    decision_note = NULLIF(btrim(coalesce(p_note, '')), '')
  WHERE id = p_overtime_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ptw_request_overtime(uuid, date, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ptw_decide_overtime(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ptw_request_overtime(uuid, date, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ptw_decide_overtime(uuid, boolean, text) TO authenticated;
