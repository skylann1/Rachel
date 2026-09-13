-- SIPERMIT K3: Isian Safety Checklist PTW selama masa aktif
-- Jalankan script ini di Supabase SQL Editor
--
-- "E. SAFETY CHECKLIST" pada tiap tipe PTW (lib/ptw-types.ts) selama ini
-- hanya tercetak kosong di PDF — tidak ada tempat menyimpan status
-- Sudah/Belum per hari (Hari ke-1 s/d ke-7) atau catatan Keterangan yang
-- semestinya diisi selama PTW aktif di lapangan. Kolom ini menyimpannya.
--
-- Format: objek JSON, key = id butir checklist (atau "id.indexSubItem" untuk
-- sub-butir — lihat flattenSafetyChecklist di lib/ptw-types.ts, SATU-
-- SATUNYA tempat yang boleh menghasilkan key ini), value =
-- { "days": [boolean|null, ...tujuh slot], "keterangan": string }.

ALTER TABLE public.ptw
ADD COLUMN IF NOT EXISTS safety_checklist JSONB DEFAULT '{}'::jsonb;

-- Internal users (PGN/PGSOL) sudah punya UPDATE tanpa batasan status lewat
-- policy "Internal users can update all PTW" (lihat schema_update_rls_policies.sql).
--
-- Vendor sebelumnya HANYA boleh UPDATE saat status Draft/Menunggu Approval
-- PM (lihat schema_ptw_vendor_update_policy.sql) — sengaja tidak
-- menyertakan 'PTW Aktif' supaya vendor tidak bisa mengubah PTW yang sudah
-- terbit. Policy tambahan ini TIDAK melonggarkan itu (policy UPDATE untuk
-- role/command yang sama di-OR-kan oleh Postgres): vendor hanya boleh
-- menyentuh baris yang statusnya SUDAH 'PTW Aktif', dan hasil akhirnya
-- harus tetap 'PTW Aktif' — jadi policy ini tidak bisa dipakai untuk
-- mengubah status atau menyentuh PTW yang belum/tidak aktif.
CREATE POLICY "Vendors can update safety checklist on active PTW"
ON public.ptw FOR UPDATE
TO authenticated
USING (
  status = 'PTW Aktif'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = auth.uid()
  )
)
WITH CHECK (
  status = 'PTW Aktif'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = auth.uid()
  )
);
