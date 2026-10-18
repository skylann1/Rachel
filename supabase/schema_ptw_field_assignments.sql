-- SIPERMIT K3: Pemegang & Pengawas PTW per PTW + daily check
-- Jalankan di Supabase SQL Editor SEBELUM deploy kode fitur ini.
-- Aman dijalankan ulang (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).
--
-- Spec: docs/superpowers/specs/2026-10-18-ptw-field-roles-daily-check-design.md
--
-- Penulisan HANYA lewat RPC SECURITY DEFINER di bawah; tabel tidak punya
-- policy INSERT/UPDATE/DELETE untuk user biasa, jadi daily check terkunci
-- setelah dikirim.

CREATE TABLE IF NOT EXISTS public.ptw_field_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ptw_id          uuid NOT NULL REFERENCES public.ptw(id) ON DELETE CASCADE,
  peran           text NOT NULL CHECK (peran IN ('pemegang', 'pengawas')),
  user_id         uuid NOT NULL REFERENCES public.profiles(id),
  aktif_dari      timestamptz NOT NULL DEFAULT now(),
  aktif_sampai    timestamptz,
  ditugaskan_oleh uuid REFERENCES public.profiles(id),
  alasan          text
);

-- Hanya satu penjabat aktif per peran per PTW.
CREATE UNIQUE INDEX IF NOT EXISTS ptw_field_assignments_active_uidx
  ON public.ptw_field_assignments (ptw_id, peran) WHERE aktif_sampai IS NULL;
CREATE INDEX IF NOT EXISTS ptw_field_assignments_user_active_idx
  ON public.ptw_field_assignments (user_id) WHERE aktif_sampai IS NULL;

CREATE TABLE IF NOT EXISTS public.ptw_daily_checks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ptw_id           uuid NOT NULL REFERENCES public.ptw(id) ON DELETE CASCADE,
  hari_ke          int  NOT NULL CHECK (hari_ke BETWEEN 1 AND 7),
  tanggal          date NOT NULL,
  peran            text NOT NULL CHECK (peran IN ('pemegang', 'pengawas')),
  user_id          uuid NOT NULL REFERENCES public.profiles(id),
  diisi_pada       timestamptz NOT NULL DEFAULT now(),
  inisial          text NOT NULL,
  uraian_pekerjaan text,
  UNIQUE (ptw_id, hari_ke, peran),
  CHECK (peran = 'pengawas' OR length(btrim(coalesce(uraian_pekerjaan, ''))) > 0)
);

ALTER TABLE public.ptw_field_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptw_daily_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users can view PTW field assignments" ON public.ptw_field_assignments;
CREATE POLICY "Internal users can view PTW field assignments"
ON public.ptw_field_assignments FOR SELECT TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS "Vendors can view their PTW field assignments" ON public.ptw_field_assignments;
CREATE POLICY "Vendors can view their PTW field assignments"
ON public.ptw_field_assignments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.ptw t JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = ptw_field_assignments.ptw_id AND p.vendor_id = public.current_vendor_org_id()
));

DROP POLICY IF EXISTS "Internal users can view PTW daily checks" ON public.ptw_daily_checks;
CREATE POLICY "Internal users can view PTW daily checks"
ON public.ptw_daily_checks FOR SELECT TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS "Vendors can view their PTW daily checks" ON public.ptw_daily_checks;
CREATE POLICY "Vendors can view their PTW daily checks"
ON public.ptw_daily_checks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.ptw t JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = ptw_daily_checks.ptw_id AND p.vendor_id = public.current_vendor_org_id()
));

-- Permission modul 'ptw' dari roles.permissions; role 'admin' selalu penuh
-- (sama seperti utils/permissions.ts).
CREATE OR REPLACE FUNCTION public.ptw_user_has_perm(p_user uuid, p_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = p_user
      AND (
        pr.role = 'admin'
        OR EXISTS (
          SELECT 1 FROM public.roles r
          WHERE r.name = pr.role AND jsonb_exists(r.permissions -> 'ptw', p_action)
        )
      )
  );
$$;

-- Tugaskan / ganti penjabat. Atomik: menutup baris aktif lama lalu membuat
-- baris baru dalam satu transaksi.
CREATE OR REPLACE FUNCTION public.ptw_assign_field_role(
  p_ptw_id uuid, p_peran text, p_user_id uuid, p_alasan text DEFAULT NULL
)
RETURNS uuid
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
  v_target_type text;
  v_target_org  uuid;
  v_new_id      uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Silakan login terlebih dahulu.';
  END IF;
  IF p_peran NOT IN ('pemegang', 'pengawas') THEN
    RAISE EXCEPTION 'Peran tidak valid.';
  END IF;

  SELECT t.status, p.vendor_id INTO v_status, v_vendor_org
  FROM public.ptw t JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = p_ptw_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PTW tidak ditemukan.';
  END IF;
  IF v_status <> 'PTW Aktif' THEN
    RAISE EXCEPTION 'Penugasan hanya bisa dibuat selama PTW berstatus Aktif.';
  END IF;

  SELECT type::text, org_id INTO v_caller_type, v_caller_org FROM public.profiles WHERE id = v_caller;
  SELECT type::text, org_id INTO v_target_type, v_target_org FROM public.profiles WHERE id = p_user_id;
  IF v_target_type IS NULL THEN
    RAISE EXCEPTION 'Pengguna yang ditugaskan tidak ditemukan.';
  END IF;

  IF p_peran = 'pengawas' THEN
    IF v_caller_type IS DISTINCT FROM 'pgn' OR NOT public.ptw_user_has_perm(v_caller, 'assign_pengawas') THEN
      RAISE EXCEPTION 'Anda tidak berwenang menugaskan Pengawas PTW.';
    END IF;
    IF v_target_type <> 'pgn' OR NOT public.ptw_user_has_perm(p_user_id, 'field_pengawas') THEN
      RAISE EXCEPTION 'Pengguna ini tidak bisa ditugaskan sebagai Pengawas PTW.';
    END IF;
  ELSE
    IF v_caller_type IS DISTINCT FROM 'vendor'
       OR v_caller_org IS DISTINCT FROM v_vendor_org
       OR NOT public.ptw_user_has_perm(v_caller, 'assign_holder') THEN
      RAISE EXCEPTION 'Anda tidak berwenang menugaskan Pemegang PTW.';
    END IF;
    IF v_target_type <> 'vendor'
       OR v_target_org IS DISTINCT FROM v_vendor_org
       OR NOT public.ptw_user_has_perm(p_user_id, 'field_holder') THEN
      RAISE EXCEPTION 'Pengguna ini tidak bisa ditugaskan sebagai Pemegang PTW.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ptw_field_assignments
    WHERE ptw_id = p_ptw_id AND peran = p_peran AND aktif_sampai IS NULL AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Pengguna ini sudah menjadi penjabat aktif.';
  END IF;

  UPDATE public.ptw_field_assignments SET aktif_sampai = now()
  WHERE ptw_id = p_ptw_id AND peran = p_peran AND aktif_sampai IS NULL;

  INSERT INTO public.ptw_field_assignments (ptw_id, peran, user_id, ditugaskan_oleh, alasan)
  VALUES (p_ptw_id, p_peran, p_user_id, v_caller, NULLIF(btrim(coalesce(p_alasan, '')), ''))
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Kirim daily check hari ini. Peran ditentukan dari penugasan aktif pemanggil.
-- p_required_keys = kunci baris safety checklist yang wajib terjawab hari ini
-- (dihitung server action dari PTW_TYPES; hanya dipakai untuk 'pengawas').
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
  IF v_hari < 1 OR v_hari > 7 OR (v_to IS NOT NULL AND v_today > v_to) THEN
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

  -- Inisial = huruf pertama maksimal 3 kata nama, huruf besar.
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

-- Safety checklist: untuk PTW yang SUDAH punya Pengawas aktif, hanya Pengawas
-- aktif itu yang boleh menulis. PTW tanpa penugasan tetap seperti sebelumnya.
-- (Menggantikan fungsi di schema_ptw_safety_checklist_fix.sql; sisanya sama.)
CREATE OR REPLACE FUNCTION public.update_ptw_safety_checklist(p_ptw_id uuid, p_checklist jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.ptw t
    JOIN public.projects p ON p.id = t.project_id
    WHERE t.id = p_ptw_id
      AND t.status = 'PTW Aktif'
      AND (
        public.is_internal_user()
        OR p.vendor_id = public.current_vendor_org_id()
      )
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Safety checklist hanya bisa diisi oleh pihak berwenang selama PTW berstatus Aktif.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ptw_field_assignments
    WHERE ptw_id = p_ptw_id AND peran = 'pengawas' AND aktif_sampai IS NULL
  ) AND NOT EXISTS (
    SELECT 1 FROM public.ptw_field_assignments
    WHERE ptw_id = p_ptw_id AND peran = 'pengawas' AND aktif_sampai IS NULL AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Safety checklist PTW ini hanya bisa diisi oleh Pengawas PTW yang sedang ditugaskan.';
  END IF;

  UPDATE public.ptw SET safety_checklist = p_checklist WHERE id = p_ptw_id;
END;
$$;

-- Di Supabase, REVOKE FROM PUBLIC saja tidak cukup: anon/authenticated
-- mendapat EXECUTE lewat default privileges, jadi dicabut eksplisit.
REVOKE ALL ON FUNCTION public.ptw_user_has_perm(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ptw_assign_field_role(uuid, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ptw_submit_daily_check(uuid, text, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_ptw_safety_checklist(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ptw_assign_field_role(uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ptw_submit_daily_check(uuid, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_ptw_safety_checklist(uuid, jsonb) TO authenticated;
