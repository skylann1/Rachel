-- =====================================================================
-- MIGRASI GABUNGAN — Fase 1 (fondasi multi-tenant) + Fase 2
-- (per-project approver assignment) + Fase 3 (vendor internal review
-- stage), SIPERMIT K3
--
-- File ini adalah gabungan dari 14 file schema_*.sql yang sebelumnya
-- harus dijalankan satu-satu (lihat README_org_migration_order.md dan
-- README_stage_assignment_migration_order.md untuk isi & alasan tiap
-- bagian secara terpisah — file ini tidak menggantikan dokumen itu,
-- cuma menggabungkan isinya jadi satu paste-dan-jalankan). Fase 3's dua
-- file (schema_stage_assignments_vendor_review.sql,
-- schema_vendor_review_permissions.sql) ditambahkan di TRANSAKSI 5 di
-- bawah — keduanya tidak menyentuh enum, jadi tidak perlu BEGIN/COMMIT
-- tersendiri seperti transaksi 1-4.
--
-- KENAPA ADA BEGIN;/COMMIT; DI TENGAH-TENGAH, BUKAN SATU TRANSAKSI BESAR:
-- Postgres tidak mengizinkan sebuah nilai enum baru (ATAU nama enum yang
-- baru di-rename) dipakai di statement yang sama transaksinya dengan
-- statement ALTER TYPE yang menambah/mengubahnya. Supabase SQL editor
-- mengirim satu kali paste sebagai satu transaksi implisit KECUALI ada
-- BEGIN/COMMIT eksplisit di dalamnya — jadi 4 blok transaksi di bawah ini
-- WAJIB ada supaya seluruh file bisa di-paste dan dijalankan SEKALI SAJA
-- tanpa error "unsafe use of new value of enum type".
--
-- ⚠️ WAJIB DICEK SEBELUM MENJALANKAN FILE INI:
-- Buka Supabase Table Editor > tabel `vendor_profiles` > tab Constraints
-- (atau jalankan `\d vendor_profiles` kalau pakai psql), lalu cari nama
-- constraint FK pada kolom `id`. Transaksi 2 di bawah mengasumsikan
-- namanya `vendor_profiles_id_fkey` (konvensi penamaan default Postgres).
-- Kalau namanya berbeda, sesuaikan baris `DROP CONSTRAINT` di Transaksi 2
-- SEBELUM menjalankan file ini.
--
-- Setelah semua transaksi di bawah selesai, ikuti checklist verifikasi
-- manual di kedua README di atas (assignment PGN/PGSOL per proyek yang
-- sedang berjalan HARUS diisi sebelum dokumen-dokumen itu bisa di-approve
-- lagi — fail-closed, disengaja).
-- =====================================================================


-- =====================================================================
-- TRANSAKSI 1 — fondasi organisasi + label enum 'pgsol'
-- (schema_organizations.sql + schema_org_add_pgsol_type.sql)
-- =====================================================================
BEGIN;

-- --- schema_organizations.sql ---
-- Fondasi multi-tenant: PGN, PGSOL, dan tiap vendor company jadi baris
-- `organizations` yang setara. `profiles.org_id` menautkan tiap user ke
-- organisasinya.
CREATE TYPE org_kind AS ENUM ('pgn', 'pgsol', 'vendor');

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind org_kind NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (true);

ALTER TABLE public.profiles ADD COLUMN org_id UUID REFERENCES public.organizations(id);

-- --- schema_org_add_pgsol_type.sql ---
-- Menambah label enum baru SEBELUM label lama di-rename (Transaksi 3).
-- Value 'pgsol' baru bisa DIPAKAI di transaksi SETELAH ini (Transaksi 2).
ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'pgsol';

COMMIT;


-- =====================================================================
-- TRANSAKSI 2 — backfill organisasi PGN/PGSOL/vendor
-- (schema_org_backfill_internal.sql + schema_org_backfill_vendor.sql)
-- Label enum 'internal'/'external' MASIH VALID di sini — rename baru
-- terjadi di Transaksi 3. Aman dijalankan hanya SEKALI (lihat catatan
-- di dalam blok DO di bawah).
-- =====================================================================
BEGIN;

-- --- schema_org_backfill_internal.sql ---
DO $$
DECLARE
  pgn_org_id UUID;
  pgsol_org_id UUID;
BEGIN
  INSERT INTO public.organizations (kind, name) VALUES ('pgn', 'PGN')
  RETURNING id INTO pgn_org_id;

  INSERT INTO public.organizations (kind, name) VALUES ('pgsol', 'PGSOL')
  RETURNING id INTO pgsol_org_id;

  UPDATE public.profiles
  SET org_id = pgsol_org_id, type = 'pgsol'
  WHERE type = 'internal' AND role = 'pgsol_reviewer';

  UPDATE public.profiles
  SET org_id = pgn_org_id
  WHERE type = 'internal' AND role <> 'pgsol_reviewer';
END $$;

-- --- schema_org_backfill_vendor.sql ---
-- Trik kunci: id organisasi vendor baru DIPAKAI ULANG dari
-- vendor_profiles.id yang sudah ada (dulu = id user vendor). Karena setiap
-- FK lain yang menunjuk vendor_profiles(id) — projects.vendor_id,
-- vendor_workers.vendor_id, vendor_equipment.vendor_id,
-- vendor_materials.vendor_id, vendor_documents.vendor_id — hanya peduli
-- pada NILAI id-nya, semua kolom itu otomatis jadi kolom org-id yang
-- valid tanpa UPDATE apa pun.
INSERT INTO public.organizations (id, kind, name)
SELECT id, 'vendor', company_name FROM public.vendor_profiles;

-- ⚠️ Nama constraint di bawah ini asumsi konvensi penamaan default
-- Postgres — SUDAH DICEK sesuai peringatan di awal file ini, kan?
ALTER TABLE public.vendor_profiles DROP CONSTRAINT vendor_profiles_id_fkey;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_org_id_fkey
  FOREIGN KEY (id) REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.profiles p
SET org_id = p.id
WHERE p.type = 'external' AND p.id IN (SELECT id FROM public.vendor_profiles);

COMMIT;


-- =====================================================================
-- TRANSAKSI 3 — rename label enum (internal→pgn, external→vendor)
-- (schema_org_rename_type_labels.sql)
-- SENGAJA cuma berisi rename — supaya label baru 'pgn'/'vendor' aman
-- dipakai di Transaksi 4.
-- =====================================================================
BEGIN;

ALTER TYPE user_type RENAME VALUE 'internal' TO 'pgn';
ALTER TYPE user_type RENAME VALUE 'external' TO 'vendor';

COMMIT;


-- =====================================================================
-- TRANSAKSI 4 — semuanya yang memakai label baru pgn/pgsol/vendor +
-- RLS assignment (Fase 2), tidak ada lagi kendala urutan enum setelah
-- titik ini.
-- (schema_org_fix_type_functions.sql, schema_org_rls_vendor_scope.sql,
--  schema_org_roles.sql, schema_org_fix_vendor_trigger_and_policies.sql,
--  schema_stage_assignments.sql, schema_stage_assignment_permissions.sql)
-- =====================================================================
BEGIN;

-- --- schema_org_fix_type_functions.sql ---
-- is_internal_user() sekarang true untuk pgn MAUPUN pgsol, supaya semua
-- policy "Internal users can view/update all X" tetap berlaku untuk
-- staff PGSOL tanpa diubah satu per satu.
CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND type IN ('pgn', 'pgsol'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_external_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND type = 'vendor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (Definisi handle_new_user() di sini akan ditimpa lagi oleh versi final
-- di bawah — dipertahankan supaya urutan persis sama dengan menjalankan
-- 11 file aslinya satu-satu; hasil akhirnya identik.)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_type public.user_type;
  new_role TEXT;
BEGIN
  new_type := COALESCE((new.raw_user_meta_data->>'type')::public.user_type, 'vendor'::public.user_type);
  new_role := COALESCE(new.raw_user_meta_data->>'role', 'vendor');

  INSERT INTO public.profiles (id, full_name, role, type)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new_role,
    new_type
  );

  IF new_type = 'vendor' THEN
    INSERT INTO public.vendor_profiles (id, company_name)
    VALUES (new.id, COALESCE(new.raw_user_meta_data->>'company_name', 'Nama Perusahaan Belum Diisi'));
  ELSE
    INSERT INTO public.internal_profiles (id, nip)
    VALUES (new.id, new.raw_user_meta_data->>'nip');
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- --- schema_org_rls_vendor_scope.sql ---
-- Setiap policy vendor yang tadinya membandingkan vendor_id = auth.uid()
-- diganti memakai current_vendor_org_id() — supaya SEMUA staff di
-- company vendor yang sama (bukan cuma 1 akun) bisa mengakses data
-- proyek/asetnya.
CREATE OR REPLACE FUNCTION public.current_vendor_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ===== projects =====
DROP POLICY IF EXISTS "External users can view their own projects" ON public.projects;
CREATE POLICY "Vendor org members can view their own projects" ON public.projects
FOR SELECT USING (vendor_id = public.current_vendor_org_id());

DROP POLICY IF EXISTS "External users can insert their own projects" ON public.projects;
CREATE POLICY "Vendor org members can insert their own projects" ON public.projects
FOR INSERT WITH CHECK (vendor_id = public.current_vendor_org_id());

-- ===== procedures =====
DROP POLICY IF EXISTS "Vendors can insert procedures for their projects" ON public.procedures;
CREATE POLICY "Vendors can insert procedures for their projects"
ON public.procedures FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can update procedures for their projects" ON public.procedures;
CREATE POLICY "Vendors can update procedures for their projects"
ON public.procedures FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can view their own procedures" ON public.procedures;
CREATE POLICY "Vendors can view their own procedures"
ON public.procedures FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()));

-- ===== jsa =====
DROP POLICY IF EXISTS "Vendors can insert JSA for their projects" ON public.jsa;
CREATE POLICY "Vendors can insert JSA for their projects"
ON public.jsa FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can update JSA for their projects" ON public.jsa;
CREATE POLICY "Vendors can update JSA for their projects"
ON public.jsa FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can view their own JSA" ON public.jsa;
CREATE POLICY "Vendors can view their own JSA"
ON public.jsa FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()));

-- ===== jsa_steps =====
DROP POLICY IF EXISTS "Vendors can insert JSA steps" ON public.jsa_steps;
CREATE POLICY "Vendors can insert JSA steps"
ON public.jsa_steps FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.jsa j JOIN public.projects p ON p.id = j.project_id
  WHERE j.id = jsa_id AND p.vendor_id = public.current_vendor_org_id()
));

DROP POLICY IF EXISTS "Vendors can update JSA steps" ON public.jsa_steps;
CREATE POLICY "Vendors can update JSA steps"
ON public.jsa_steps FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.jsa j JOIN public.projects p ON p.id = j.project_id
  WHERE j.id = jsa_id AND p.vendor_id = public.current_vendor_org_id()
));

DROP POLICY IF EXISTS "Vendors can delete JSA steps" ON public.jsa_steps;
CREATE POLICY "Vendors can delete JSA steps"
ON public.jsa_steps FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.jsa j JOIN public.projects p ON p.id = j.project_id
  WHERE j.id = jsa_id AND p.vendor_id = public.current_vendor_org_id()
));

-- ===== ptw =====
DROP POLICY IF EXISTS "Vendors can insert PTW for their projects" ON public.ptw;
CREATE POLICY "Vendors can insert PTW for their projects"
ON public.ptw FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can view their own PTW" ON public.ptw;
CREATE POLICY "Vendors can view their own PTW"
ON public.ptw FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can update PTW for their projects" ON public.ptw;
CREATE POLICY "Vendors can update PTW for their projects"
ON public.ptw FOR UPDATE TO authenticated
USING (
  status IN ('Draft', 'Menunggu Approval PM')
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id())
)
WITH CHECK (
  status IN ('Draft', 'Menunggu Approval PM')
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id())
);

-- ===== incidents =====
DROP POLICY IF EXISTS "Vendors can insert incidents for their projects" ON incidents;
CREATE POLICY "Vendors can insert incidents for their projects" ON incidents
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM projects WHERE vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can view incidents for their projects" ON incidents;
CREATE POLICY "Vendors can view incidents for their projects" ON incidents
FOR SELECT USING (project_id IN (SELECT id FROM projects WHERE vendor_id = public.current_vendor_org_id()));

-- ===== vendor_documents =====
DROP POLICY IF EXISTS "Vendors can insert their own documents" ON public.vendor_documents;
CREATE POLICY "Vendors can insert their own documents"
ON public.vendor_documents FOR INSERT TO authenticated
WITH CHECK (vendor_id = public.current_vendor_org_id() OR public.is_internal_user());

DROP POLICY IF EXISTS "Vendors can delete their own documents" ON public.vendor_documents;
CREATE POLICY "Vendors can delete their own documents"
ON public.vendor_documents FOR DELETE TO authenticated
USING (vendor_id = public.current_vendor_org_id() OR public.is_internal_user());

-- ===== vendor_workers / vendor_equipment =====
DROP POLICY IF EXISTS "Vendors can manage their own workers" ON vendor_workers;
CREATE POLICY "Vendors can manage their own workers" ON vendor_workers
FOR ALL USING (vendor_id = public.current_vendor_org_id()) WITH CHECK (vendor_id = public.current_vendor_org_id());

DROP POLICY IF EXISTS "Vendors can manage their own equipment" ON vendor_equipment;
CREATE POLICY "Vendors can manage their own equipment" ON vendor_equipment
FOR ALL USING (vendor_id = public.current_vendor_org_id()) WITH CHECK (vendor_id = public.current_vendor_org_id());

-- ===== vendor_worker_competencies / vendor_equipment_documents / vendor_materials / vendor_material_documents =====
DROP POLICY IF EXISTS "Vendors manage own worker competencies" ON public.vendor_worker_competencies;
CREATE POLICY "Vendors manage own worker competencies"
ON public.vendor_worker_competencies FOR ALL
USING (EXISTS (SELECT 1 FROM public.vendor_workers w WHERE w.id = worker_id AND w.vendor_id = public.current_vendor_org_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_workers w WHERE w.id = worker_id AND w.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors manage own equipment documents" ON public.vendor_equipment_documents;
CREATE POLICY "Vendors manage own equipment documents"
ON public.vendor_equipment_documents FOR ALL
USING (EXISTS (SELECT 1 FROM public.vendor_equipment e WHERE e.id = equipment_id AND e.vendor_id = public.current_vendor_org_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_equipment e WHERE e.id = equipment_id AND e.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can manage their own materials" ON public.vendor_materials;
CREATE POLICY "Vendors can manage their own materials"
ON public.vendor_materials FOR ALL
USING (vendor_id = public.current_vendor_org_id())
WITH CHECK (vendor_id = public.current_vendor_org_id());

DROP POLICY IF EXISTS "Vendors manage own material documents" ON public.vendor_material_documents;
CREATE POLICY "Vendors manage own material documents"
ON public.vendor_material_documents FOR ALL
USING (EXISTS (SELECT 1 FROM public.vendor_materials m WHERE m.id = material_id AND m.vendor_id = public.current_vendor_org_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_materials m WHERE m.id = material_id AND m.vendor_id = public.current_vendor_org_id()));

-- ===== toolbox_meetings / site_checkins =====
DROP POLICY IF EXISTS "Vendors can read their own toolbox meetings" ON public.toolbox_meetings;
CREATE POLICY "Vendors can read their own toolbox meetings" ON public.toolbox_meetings
FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = toolbox_meetings.project_id AND p.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can log their own toolbox meetings" ON public.toolbox_meetings;
CREATE POLICY "Vendors can log their own toolbox meetings" ON public.toolbox_meetings
FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = toolbox_meetings.project_id AND p.vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can read their own site checkins" ON public.site_checkins;
CREATE POLICY "Vendors can read their own site checkins" ON public.site_checkins
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.ptw t JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = site_checkins.ptw_id AND p.vendor_id = public.current_vendor_org_id()
));

-- --- schema_org_roles.sql ---
-- roles.type sudah TEXT bebas, jadi ini murni migrasi DATA. Urutan
-- penting: pgsol_reviewer dipindah duluan supaya tidak ikut tersapu
-- UPDATE generik 'internal'.
UPDATE public.roles SET type = 'pgsol' WHERE name = 'pgsol_reviewer';
UPDATE public.roles SET type = 'pgn' WHERE type = 'internal';
UPDATE public.roles SET type = 'vendor' WHERE type = 'external';

INSERT INTO public.roles (name, description, is_system, type, permissions) VALUES
  (
    'vendor_admin',
    'Admin perusahaan vendor — mengelola staff vendor sendiri.',
    false,
    'vendor',
    '{"dashboard": ["view"], "masterData": ["manage_org_staff"]}'
  ),
  (
    'pgsol_admin',
    'Admin PGSOL — mengelola staff PGSOL sendiri.',
    false,
    'pgsol',
    '{"dashboard": ["view"], "masterData": ["manage_org_staff"]}'
  )
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description, type = EXCLUDED.type, permissions = EXCLUDED.permissions;

-- --- schema_org_fix_vendor_trigger_and_policies.sql ---
-- 1. handle_new_user(): hapus INSERT ke vendor_profiles (baris company
--    sekarang dibuat aplikasi pada id ORGANISASI, bukan oleh trigger pada
--    id user). Ini VERSI FINAL, menimpa definisi sebelumnya di atas.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_type public.user_type;
  new_role TEXT;
BEGIN
  new_type := COALESCE((new.raw_user_meta_data->>'type')::public.user_type, 'vendor'::public.user_type);
  new_role := COALESCE(new.raw_user_meta_data->>'role', 'vendor');

  INSERT INTO public.profiles (id, full_name, role, type)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new_role,
    new_type
  );

  IF new_type <> 'vendor' THEN
    INSERT INTO public.internal_profiles (id, nip)
    VALUES (new.id, new.raw_user_meta_data->>'nip');
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Anggota organisasi boleh membaca profil rekan satu organisasi
--    (tanpa ini, /vendor/dashboard/staff dan /pgsol/dashboard/staff
--    cuma menampilkan diri sendiri).
DROP POLICY IF EXISTS "Org members can read their own organization's profiles" ON public.profiles;
CREATE POLICY "Org members can read their own organization's profiles" ON public.profiles
FOR SELECT USING (org_id = public.current_vendor_org_id());

-- 3. Self-update vendor_profiles memakai id ORGANISASI, bukan auth.uid().
DROP POLICY IF EXISTS "Vendors can update their own vendor profile" ON public.vendor_profiles;
CREATE POLICY "Vendors can update their own vendor profile"
ON public.vendor_profiles FOR UPDATE
USING (id = public.current_vendor_org_id())
WITH CHECK (id = public.current_vendor_org_id());

-- --- schema_stage_assignments.sql (Fase 2) ---
-- Siapa yang harus mereview/approve tahap internal (Prosedur/JSA/PTW)
-- sekarang eksplisit per proyek. Satu baris = satu orang, satu tahap,
-- satu proyek.
--
-- PERINGATAN CUTOVER: begitu tabel ini ada, approval tidak lagi memakai
-- permission sebagai gerbang melainkan keberadaan baris di sini. Tabelnya
-- kosong tepat setelah migrasi, jadi SEMUA dokumen yang sedang berjalan
-- langsung tidak bisa di-approve sampai admin mengisi assignment-nya
-- (fail-closed, disengaja). Lihat README_stage_assignment_migration_order.md
-- untuk langkah pengisian pra/pasca-cutover.
--
-- KETERBATASAN YANG DIKETAHUI: kunci baris ini TIDAK memuat identitas
-- dokumen. Saat ini hanya PTW yang bisa punya lebih dari satu dokumen per
-- proyek (beberapa ptw_type), dan itu aman selama tipe-tipe itu diajukan
-- BERURUTAN; kalau dua tipe mengambang di tahap yang sama secara
-- bersamaan, keduanya keliru berbagi state keputusan. Perbaikannya butuh
-- kolom identitas dokumen di tabel ini — di luar cakupan Fase 2.
CREATE TABLE public.stage_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  doc_type TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  assignee_id UUID REFERENCES public.profiles(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_at TIMESTAMP WITH TIME ZONE,
  note TEXT,
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (project_id, doc_type, stage_key, assignee_id)
);

ALTER TABLE public.stage_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can read stage assignments" ON public.stage_assignments
FOR SELECT USING (public.is_internal_user());

CREATE POLICY "Internal users can write stage assignments" ON public.stage_assignments
FOR ALL USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());

CREATE POLICY "Vendors can view assignments for their own projects" ON public.stage_assignments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()
  )
);

-- Vendor perlu bisa me-reset baris assignment miliknya sendiri ke
-- 'pending' saat submit ulang dokumen setelah ditolak. WITH CHECK
-- dikunci HANYA pada status='pending' DAN decided_at IS NULL — persis
-- apa yang selalu ditulis oleh resetStageAssignments — supaya vendor
-- tidak bisa memakai policy ini untuk memalsukan keputusan (mis. men-set
-- status jadi 'approved' lewat panggilan API langsung).
CREATE POLICY "Vendors can reset stage assignments for their own projects" ON public.stage_assignments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()
  )
)
WITH CHECK (
  status = 'pending' AND decided_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()
  )
);

-- --- schema_stage_assignment_permissions.sql (Fase 2) ---
-- pgsol_admin belum punya kemampuan menunjuk siapa yang mereview JSA
-- tahap PGSOL untuk proyek tertentu — permission baru ini membukanya.
UPDATE public.roles
SET permissions = permissions || '{"jsa": ["manage_assignment_pgsol"]}'::jsonb
WHERE name = 'pgsol_admin';

COMMIT;


-- =====================================================================
-- TRANSAKSI 5 — Fase 3: vendor internal review stage
-- (schema_stage_assignments_vendor_review.sql + schema_vendor_review_permissions.sql)
-- Tidak menyentuh enum, jadi cukup jalan sebagai statement biasa —
-- tidak perlu BEGIN/COMMIT eksplisit seperti transaksi 1-4 di atas.
-- =====================================================================

-- --- schema_stage_assignments_vendor_review.sql (Fase 3) ---
-- Vendor sekarang perlu menulis (bukan cuma baca) baris stage_assignments
-- untuk tahap internalnya sendiri — admin vendor menugaskan reviewer, dan
-- reviewer itu sendiri mencatat approve/reject. Policy existing hanya
-- izinkan is_internal_user() menulis apa pun, dan vendor cuma boleh baca
-- (transparansi) atau reset ke pending saat resubmit.
--
-- Sama seperti sisi internal: RLS di sini cuma jaga batas kasar (proyek
-- miliknya sendiri + stage_key vendor-only). Siapa yang boleh assign
-- (manage_org_staff) vs siapa yang boleh approve (baris pending miliknya)
-- tetap dicek di TypeScript (app/vendor/dashboard/projects/[id]/assignment-actions.ts
-- dan app/vendor/dashboard/approval/actions.ts) — konsisten dengan
-- is_internal_user() yang juga permisif di RLS dan ketat di TypeScript.
CREATE POLICY "Vendors can manage their own internal-review stage assignments"
ON public.stage_assignments
FOR ALL
USING (
  stage_key IN ('procedure.review_vendor', 'jsa.review_vendor', 'ptw.review_vendor')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()
  )
)
WITH CHECK (
  stage_key IN ('procedure.review_vendor', 'jsa.review_vendor', 'ptw.review_vendor')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()
  )
);

-- --- schema_vendor_review_permissions.sql (Fase 3) ---
-- vendor_admin butuh izin default untuk jadi kandidat reviewer internal
-- (procedure/jsa/ptw . review_vendor) supaya perusahaan vendor dengan satu
-- admin saja bisa langsung pakai fitur ini tanpa harus bikin role custom
-- dulu lewat halaman Role & Permission. Merge (bukan replace penuh)
-- supaya tidak menimpa perubahan permission vendor_admin yang mungkin
-- sudah dilakukan admin PGN lewat UI sejak Fase 1. Guarded dengan
-- `NOT ... ? 'review_vendor'` supaya aman dijalankan ulang tanpa
-- menduplikasi entri array.
UPDATE public.roles
SET permissions = jsonb_set(
  permissions, '{procedure}',
  COALESCE(permissions->'procedure', '[]'::jsonb) || '["review_vendor"]'::jsonb
)
WHERE name = 'vendor_admin'
  AND NOT COALESCE(permissions->'procedure', '[]'::jsonb) ? 'review_vendor';

UPDATE public.roles
SET permissions = jsonb_set(
  permissions, '{jsa}',
  COALESCE(permissions->'jsa', '[]'::jsonb) || '["review_vendor"]'::jsonb
)
WHERE name = 'vendor_admin'
  AND NOT COALESCE(permissions->'jsa', '[]'::jsonb) ? 'review_vendor';

UPDATE public.roles
SET permissions = jsonb_set(
  permissions, '{ptw}',
  COALESCE(permissions->'ptw', '[]'::jsonb) || '["review_vendor"]'::jsonb
)
WHERE name = 'vendor_admin'
  AND NOT COALESCE(permissions->'ptw', '[]'::jsonb) ? 'review_vendor';

-- ============================================================
-- TRANSAKSI 6 — Fase 3.1: Gerbang PGSOL untuk Prosedur Kerja
-- ============================================================
-- Tidak ada perubahan enum di sini, jadi tidak perlu BEGIN/COMMIT khusus.

-- --- schema_procedure_pgsol_permission.sql ---
UPDATE public.roles
SET permissions = jsonb_set(
  permissions, '{procedure}',
  COALESCE(permissions->'procedure', '[]'::jsonb) || '["review_pgsol"]'::jsonb
)
WHERE name = 'pgsol_reviewer'
  AND NOT COALESCE(permissions->'procedure', '[]'::jsonb) ? 'review_pgsol';

-- =====================================================================
-- SELESAI. Verifikasi:
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public'
--   AND ((tablename = 'profiles' AND policyname LIKE 'Org members%')
--     OR (tablename = 'vendor_profiles' AND cmd = 'UPDATE')
--     OR tablename = 'stage_assignments')
-- ORDER BY tablename, policyname;
--
-- Lanjut ke checklist verifikasi manual di README_org_migration_order.md
-- dan README_stage_assignment_migration_order.md.
-- =====================================================================
