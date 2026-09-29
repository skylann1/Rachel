-- SIPERMIT K3: get_next_ptw_number() harus SECURITY DEFINER
-- Jalankan script ini di Supabase SQL Editor
--
-- Ditemukan saat audit DB live 2026-09-29.
--
-- schema_ptw_numbering.sql membuat tabel `ptw_numbering` + fungsi
-- `get_next_ptw_number()` sebagai SECURITY INVOKER (default `LANGUAGE sql`
-- tanpa penanda apa pun). Masalahnya: Supabase meng-ENABLE ROW LEVEL
-- SECURITY secara otomatis pada tabel baru di schema `public`, dan migrasi
-- itu tidak pernah membuat satu policy pun untuk `ptw_numbering`.
--
-- Akibatnya, saat HSSE menyetujui tahap `ptw.numbering_hsse`,
-- `app/dashboard/approval/actions.ts` memanggil
-- `supabase.rpc('get_next_ptw_number')` dengan klien yang TERIKAT RLS.
-- Fungsi itu berjalan sebagai pemanggil, INSERT/UPDATE counter di dalamnya
-- kena RLS "tabel punya RLS, nol policy" = selalu ditolak, dan penomoran
-- gagal. Itu langkah TERAKHIR sebelum PTW jadi Aktif, jadi efeknya: tidak
-- ada PTW yang bisa terbit sama sekali.
--
-- Perbaikan: jadikan fungsinya SECURITY DEFINER dengan search_path yang
-- dipatok, pola yang sama dengan public.update_ptw_safety_checklist()
-- (schema_ptw_safety_checklist_fix.sql). Tabel `ptw_numbering` SENGAJA
-- dibiarkan tanpa policy — tidak ada seorang pun yang boleh menyentuh
-- counter itu langsung; satu-satunya jalan masuk adalah fungsi ini.
--
-- Aman diulang: CREATE OR REPLACE, dan tidak menyentuh nilai counter.

CREATE OR REPLACE FUNCTION public.get_next_ptw_number(p_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number text;
BEGIN
  -- Defense in depth: penomoran HSSE murni urusan internal PGN. Pemanggilnya
  -- (approveStage) sudah menuntut baris stage_assignments `pending` atas nama
  -- user untuk tahap ptw.numbering_hsse, tapi pengecekan di sinilah yang
  -- menahan panggilan RPC langsung yang melewati aplikasi Next.js. Tanpa ini,
  -- SECURITY DEFINER membuat siapa pun yang login bisa membakar nomor PTW
  -- (counter maju, deret berlubang) walau tidak bisa memasangnya ke baris PTW.
  IF NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Penomoran PTW hanya boleh dilakukan oleh pengguna internal.';
  END IF;

  -- Satu statement INSERT ... ON CONFLICT ... RETURNING — dua panggilan
  -- bersamaan diserahkan berurutan oleh Postgres, jadi tidak mungkin dapat
  -- nomor yang sama (alasan tabel counter ini ada sejak awal).
  INSERT INTO public.ptw_numbering ("year", last_number) VALUES (p_year, 1)
  ON CONFLICT ("year")
    DO UPDATE SET last_number = ptw_numbering.last_number + 1
  RETURNING format('PTW-%s-%s', p_year, lpad(last_number::text, 3, '0'))
  INTO v_number;

  RETURN v_number;
END;
$$;

-- anon tidak pernah punya urusan menarik nomor PTW.
REVOKE EXECUTE ON FUNCTION public.get_next_ptw_number(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_next_ptw_number(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_next_ptw_number(integer) TO authenticated;
