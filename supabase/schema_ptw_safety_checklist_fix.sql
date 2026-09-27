-- SIPERMIT K3: Perbaikan policy vendor untuk safety_checklist PTW
-- Jalankan script ini di Supabase SQL Editor
--
-- schema_ptw_safety_checklist.sql menambahkan policy UPDATE untuk vendor
-- yang membandingkan `p.vendor_id = auth.uid()`. Ini SALAH: sejak migrasi
-- org-foundation, `projects.vendor_id` menyimpan id ORGANISASI vendor,
-- bukan id user (lihat schema_org_rls_vendor_scope.sql — semua policy
-- vendor lain pada `ptw` sudah dipindah memakai
-- `public.current_vendor_org_id()`). Akibatnya policy itu:
--
--   1. Diam-diam tidak berlaku untuk hampir semua akun vendor (id user
--      mereka tidak sama dengan id organisasi), jadi isian checklist
--      gagal tersimpan tanpa pesan error yang jelas.
--   2. Untuk sebagian kecil akun lama yang KEBETULAN id user-nya sama
--      dengan id organisasi vendor, policy ini malah jadi celah keamanan:
--      Postgres meng-OR-kan semua policy permissive UPDATE untuk role +
--      command yang sama, dan mengevaluasi USING (baris LAMA) & WITH
--      CHECK (baris BARU) secara independen. Maka baris lama yang lolos
--      USING policy "Vendors can update PTW for their projects" (status
--      Draft/Menunggu Approval PM) bisa dikombinasikan dengan WITH CHECK
--      policy checklist ini (status berakhir 'PTW Aktif') dalam SATU
--      UPDATE — dan karena tidak ada policy yang membatasi kolom apa saja
--      yang boleh berubah, vendor bisa mempromosikan PTW miliknya sendiri
--      langsung ke 'PTW Aktif' (sekaligus mengisi ptw_number,
--      authority_approved_at, dst.), melompati seluruh alur approval
--      PGN/PGSOL.
--
-- Perbaikan: hapus policy tambahan itu, ganti dengan satu fungsi
-- SECURITY DEFINER khusus untuk menulis safety_checklist saja. Fungsi ini
-- tidak menyentuh kolom lain sama sekali, jadi tidak ada jalan untuk
-- menaikkan status/menomori PTW lewat sini seperti pada policy lama.

DROP POLICY IF EXISTS "Vendors can update safety checklist on active PTW" ON public.ptw;

-- Catatan: pengecekan status = 'PTW Aktif' dan kepemilikan di bawah ini
-- SENGAJA diulang di layer DB meskipun server action pemanggilnya
-- (lib/ptw-safety-checklist.ts) juga sudah mengecek hal yang sama —
-- defense in depth. Pengecekan di sinilah yang benar-benar mencegah
-- panggilan RPC/API langsung yang melewati aplikasi Next.js.
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

  UPDATE public.ptw SET safety_checklist = p_checklist WHERE id = p_ptw_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_ptw_safety_checklist(uuid, jsonb) TO authenticated;
