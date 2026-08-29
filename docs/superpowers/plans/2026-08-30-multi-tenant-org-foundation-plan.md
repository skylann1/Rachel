# Multi-Tenant Organization Foundation (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give PGN, PGSOL, and every vendor company a symmetric `organizations` model — multi-user per org, PGSOL split into its own portal, and org-scoped admins who manage their own staff — as the foundation Fase 2 (per-project approver assignment) and Fase 3 (vendor-side review stage) will build on.

**Architecture:** New `organizations` table (`kind`: pgn/pgsol/vendor) with `profiles.org_id` pointing at it. `vendor_profiles.id` is repointed from `profiles(id)` to `organizations(id)` reusing the *same* UUID values, so every existing FK that already targets `vendor_profiles(id)` (`projects.vendor_id`, `vendor_workers.vendor_id`, `vendor_equipment.vendor_id`, `vendor_materials.vendor_id`, `vendor_documents.vendor_id`) becomes a valid org-id column automatically, with zero data migration on those tables. RLS policies swap `auth.uid()` for a new `current_vendor_org_id()` helper. `user_type` enum gets a `pgsol` value and its `internal`/`external` labels renamed to `pgn`/`vendor`. Account creation/management is extended with an org-scoped permission (`manage_org_staff`) alongside the existing cross-org `manage_account`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase (Postgres + Auth), TypeScript, no test runner in this repo — verification is `npx tsc --noEmit -p .` + `npm run build` (see Global Constraints).

**Spec:** `docs/superpowers/specs/2026-08-30-multi-tenant-org-foundation-design.md`

## Global Constraints

- No test framework exists in this repo (`package.json` has no `test` script, no `.test.ts`/`.spec.ts` files anywhere). Every TS task's verification step is `npx tsc --noEmit -p .` (and `npm run build` at the very end in Task 16) — never invent a Jest/Vitest test.
- This project has **no automated DB access** — every `supabase/schema_*.sql` file is written here and the user runs it manually in the Supabase SQL editor, one file at a time, in the exact order the tasks below create them. Never claim a SQL migration "passed" — only that it was written and reviewed.
- `ALTER TYPE ... ADD VALUE` and `ALTER TYPE ... RENAME VALUE` must each be the **only** enum-touching statement run in their transaction/file — Postgres forbids using a new enum label in the same transaction that added it. Tasks 2 and 5 are intentionally single-statement files for this reason; do not merge them into neighboring files.
- Every rewritten RLS policy must use `DROP POLICY IF EXISTS "<name>" ON <table>;` before its `CREATE POLICY`, so the migration is safe to run even if the user's live DB state doesn't exactly match what's in git (e.g. `schema_ptw_vendor_update_policy.sql`, committed earlier this session, may or may not have been run yet).
- Follow existing repo conventions: Indonesian comments/copy, Tailwind utility classes matching surrounding style, Server Actions start with `"use server"`, CRLF warnings on `git add` are harmless (see `[[repo-conventions]]`).
- Non-goals (do not build in this plan): per-project approver assignment/multi-signature (Fase 2), the vendor-side internal review stage (Fase 3), any new UI for PGSOL to review JSA (they get access to the *existing* `/dashboard/approval` page instead — see Task 10).

---

## File Structure

**New SQL migrations (run manually, in this exact order):**
- `supabase/schema_organizations.sql` — `organizations` table, `org_kind` enum, `profiles.org_id`
- `supabase/schema_org_add_pgsol_type.sql` — adds `'pgsol'` to `user_type` enum (own transaction)
- `supabase/schema_org_backfill_internal.sql` — seeds PGN + PGSOL orgs, backfills `profiles.org_id` for existing internal users
- `supabase/schema_org_backfill_vendor.sql` — turns each `vendor_profiles` row into an `organizations` row (same id), backfills `profiles.org_id` for vendor users
- `supabase/schema_org_rename_type_labels.sql` — renames `internal`→`pgn`, `external`→`vendor` (own transaction)
- `supabase/schema_org_fix_type_functions.sql` — updates `is_internal_user()`, `is_external_user()`, `handle_new_user()` for the new labels
- `supabase/schema_org_rls_vendor_scope.sql` — `current_vendor_org_id()` helper + rewrite of all 27 vendor-ownership RLS policies
- `supabase/schema_org_roles.sql` — `roles.type` data rename, new `manage_org_staff` permission wiring, new `vendor_admin`/`pgsol_admin` roles

**Modified app code:**
- `lib/roles.ts` — `isPgn`/`isPgsol`/`isVendor` helpers, new `ROLE_LABELS` entries
- `utils/supabase/middleware.ts` — 3-way portal routing + PGSOL carve-out to `/dashboard/approval`
- `app/auth/login/actions.ts`, `app/vendor/dashboard/projects/[id]/actions.ts`, `app/dashboard/master-data/role/page.tsx`, `app/dashboard/master-data/role/[id]/RolePermissionsClient.tsx`, `app/dashboard/master-data/role/AddRoleModal.tsx` — sweep remaining `'internal'`/`'external'` literals
- `app/dashboard/master-data/role/constants.ts` — new `manage_org_staff` permission item
- `app/dashboard/master-data/account/actions.ts` — `requireAccountAccess` helper (replaces `requireManageAccount`), org creation/join logic in `addAccount`, org-scoping in `updateAccount`/`suspendAccount`/`deleteAccount`/`resetAccountPassword`
- `app/dashboard/master-data/account/AddAccountModal.tsx`, `EditAccountModal.tsx` — add `pgsol` type option (Task 12); add `lockedType` prop for org-scoped staff pages (Task 15)
- `utils/supabase/server.ts` — new `getCallerVendorOrgId` helper
- `app/vendor/dashboard/{my-task,material,peralatan,pekerja,incident/create,dokumen}/actions.ts`, `app/vendor/dashboard/projects/[id]/actions.ts`, `app/vendor/dashboard/profile/page.tsx`, `app/vendor/dashboard/actions.ts` — swap `user.id` for the caller's vendor org id in all `vendor_id` reads/writes

**New app code:**
- `app/pgsol/login/page.tsx`, `app/pgsol/login/actions.ts` — PGSOL login
- `app/pgsol/dashboard/layout.tsx`, `app/pgsol/dashboard/page.tsx`, `app/pgsol/dashboard/profile/page.tsx` — PGSOL portal shell
- `components/org/AccountTable.tsx` — shared account-list table extracted from `app/dashboard/master-data/account/page.tsx`
- `app/vendor/dashboard/staff/page.tsx`, `app/pgsol/dashboard/staff/page.tsx` — org-scoped staff management, reusing `AccountTable` + existing `AddAccountButton`/`AccountActions`

---

### Task 1: `organizations` table + `org_kind` enum + `profiles.org_id`

**Files:**
- Create: `supabase/schema_organizations.sql`

**Interfaces:**
- Produces: table `public.organizations(id uuid pk, kind org_kind, name text, created_at timestamptz)`; column `public.profiles.org_id uuid references organizations(id)`. Every later task in this plan depends on both existing.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/schema_organizations.sql
--
-- Fondasi multi-tenant: PGN, PGSOL, dan tiap vendor company jadi baris
-- `organizations` yang setara. `profiles.org_id` menautkan tiap user ke
-- organisasinya. Lihat docs/superpowers/specs/2026-08-30-multi-tenant-org-
-- foundation-design.md untuk desain lengkap dan urutan migrasi berikutnya
-- (file ini harus dijalankan PALING PERTAMA dari seri schema_org_*.sql).

CREATE TYPE org_kind AS ENUM ('pgn', 'pgsol', 'vendor');

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind org_kind NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Semua user login boleh membaca nama organisasi (dipakai untuk tampilan
-- "perusahaan X" di berbagai halaman) — tidak ada data sensitif di sini.
CREATE POLICY "Authenticated users can read organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (true);

ALTER TABLE public.profiles ADD COLUMN org_id UUID REFERENCES public.organizations(id);
```

- [ ] **Step 2: Review for syntax correctness**

There is no local Postgres/Supabase instance to run this against — read the
file back once and confirm: `CREATE TYPE` before its first use, no trailing
comma issues, `ENABLE ROW LEVEL SECURITY` present before the `CREATE
POLICY`. This is a manual review, not an automated check (see Global
Constraints).

- [ ] **Step 3: Commit**

```bash
git add supabase/schema_organizations.sql
git commit -m "Add organizations table and profiles.org_id (Fase 1 foundation)"
```

---

### Task 2: Add `'pgsol'` value to `user_type` enum

**Files:**
- Create: `supabase/schema_org_add_pgsol_type.sql`

**Interfaces:**
- Consumes: `user_type` enum from `supabase/schema.sql:26` (currently `('internal', 'external')`).
- Produces: `user_type` enum now also accepts `'pgsol'`. Task 3 depends on this.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/schema_org_add_pgsol_type.sql
--
-- Menambah label enum baru SEBELUM label lama di-rename (lihat
-- schema_org_rename_type_labels.sql) — Postgres tidak mengizinkan ADD VALUE
-- dan pemakaian value itu di transaksi yang sama, jadi file ini SENGAJA
-- cuma berisi satu statement dan harus dijalankan sebagai file terpisah.
ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'pgsol';
```

- [ ] **Step 2: Manual review**

Confirm this file contains exactly one statement — do not add anything
else here, even something that looks harmless, or the enum addition will
fail at runtime with "unsafe use of new value".

- [ ] **Step 3: Commit**

```bash
git add supabase/schema_org_add_pgsol_type.sql
git commit -m "Add pgsol value to user_type enum"
```

---

### Task 3: Seed PGN + PGSOL organizations, backfill internal `profiles.org_id`

**Files:**
- Create: `supabase/schema_org_backfill_internal.sql`

**Interfaces:**
- Consumes: `organizations` table (Task 1), `'pgsol'` enum value (Task 2).
- Produces: exactly one `organizations` row with `kind='pgn'`, one with
  `kind='pgsol'`; every existing `profiles` row with `type='internal'` gets
  `org_id` set to one of these two, based on whether `role = 'pgsol_reviewer'`.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/schema_org_backfill_internal.sql
--
-- Dijalankan setelah schema_organizations.sql dan
-- schema_org_add_pgsol_type.sql. Label enum 'internal' masih valid di sini
-- (rename terjadi belakangan, lihat schema_org_rename_type_labels.sql).

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
```

- [ ] **Step 2: Manual review**

Confirm the `pgsol_reviewer` branch runs before the catch-all branch (order
matters here since both filter on `type = 'internal'`, and this preserves
that only actual `pgsol_reviewer` accounts move to the PGSOL org). Confirm
this file is safe to run only once — re-running would create a second PGN
and PGSOL org row and orphan the backfill; note this for the user in the
Task 16 run-order checklist.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema_org_backfill_internal.sql
git commit -m "Seed PGN/PGSOL organizations and backfill internal profiles.org_id"
```

---

### Task 4: Migrate `vendor_profiles` into `organizations`, backfill vendor `profiles.org_id`

**Files:**
- Create: `supabase/schema_org_backfill_vendor.sql`

**Interfaces:**
- Consumes: `vendor_profiles(id, company_name)` (`supabase/schema.sql:44`), `organizations` table (Task 1).
- Produces: one `organizations` row per existing vendor company, **reusing
  the existing `vendor_profiles.id` value as the new org id** (see spec —
  this is why `projects.vendor_id` etc. need no data migration at all);
  `vendor_profiles.id`'s FK repointed from `profiles(id)` to
  `organizations(id)`; every vendor `profiles` row gets `org_id` set.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/schema_org_backfill_vendor.sql
--
-- Dijalankan setelah schema_org_backfill_internal.sql. Label enum
-- 'external' masih valid di sini (rename terjadi setelah file ini, lihat
-- schema_org_rename_type_labels.sql).
--
-- Trik kunci: id organisasi vendor baru DIPAKAI ULANG dari
-- vendor_profiles.id yang sudah ada (dulu = id user vendor). Karena setiap
-- FK lain yang menunjuk vendor_profiles(id) — projects.vendor_id,
-- vendor_workers.vendor_id, vendor_equipment.vendor_id,
-- vendor_materials.vendor_id, vendor_documents.vendor_id — hanya peduli
-- pada NILAI id-nya (bukan tabel mana yang jadi target FK-nya), semua
-- kolom itu otomatis jadi kolom org-id yang valid tanpa UPDATE apa pun.

INSERT INTO public.organizations (id, kind, name)
SELECT id, 'vendor', company_name FROM public.vendor_profiles;

ALTER TABLE public.vendor_profiles DROP CONSTRAINT vendor_profiles_id_fkey;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_org_id_fkey
  FOREIGN KEY (id) REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.profiles p
SET org_id = p.id
WHERE p.type = 'external' AND p.id IN (SELECT id FROM public.vendor_profiles);
```

- [ ] **Step 2: Manual review**

Confirm the constraint name `vendor_profiles_id_fkey` matches what Postgres
actually generated for the original `id UUID REFERENCES
public.profiles(id)` column in `supabase/schema.sql:45` — Postgres names
single-column FK constraints `<table>_<column>_fkey` by default, so this
should hold, but the user should run `\d vendor_profiles` (or check the
Supabase table editor's constraints tab) before running this file, and
adjust the `DROP CONSTRAINT` name if it differs. Note this explicitly in
the Task 16 run-order checklist.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema_org_backfill_vendor.sql
git commit -m "Turn vendor_profiles rows into organizations, backfill vendor profiles.org_id"
```

---

### Task 5: Rename `user_type` enum labels (`internal`→`pgn`, `external`→`vendor`)

**Files:**
- Create: `supabase/schema_org_rename_type_labels.sql`

**Interfaces:**
- Consumes: `user_type` enum (currently `internal`/`external`/`pgsol` after Task 2).
- Produces: `user_type` enum is now `pgn`/`pgsol`/`vendor`. Every task from
  here on (6, 7, 8, and all app-code tasks) assumes these are the final
  label names.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/schema_org_rename_type_labels.sql
--
-- Dijalankan SETELAH schema_org_backfill_internal.sql dan
-- schema_org_backfill_vendor.sql selesai (keduanya masih memakai label
-- lama 'internal'/'external'). File ini SENGAJA cuma berisi rename enum —
-- jangan gabung dengan statement lain (lihat Global Constraints).
ALTER TYPE user_type RENAME VALUE 'internal' TO 'pgn';
ALTER TYPE user_type RENAME VALUE 'external' TO 'vendor';
```

- [ ] **Step 2: Manual review**

Confirm every earlier file (Tasks 3–4) has already run before this one —
running this out of order breaks Tasks 3/4's `WHERE type = 'internal'` /
`'external'` clauses (there's no label left for those literals to match).

- [ ] **Step 3: Commit**

```bash
git add supabase/schema_org_rename_type_labels.sql
git commit -m "Rename user_type enum labels: internal->pgn, external->vendor"
```

---

### Task 6: Fix `is_internal_user()`, `is_external_user()`, `handle_new_user()` for new labels

**Files:**
- Create: `supabase/schema_org_fix_type_functions.sql`

**Interfaces:**
- Consumes: renamed `user_type` enum (Task 5).
- Produces: `is_internal_user()` now true for both `pgn` and `pgsol` (so
  every existing "Internal users can view/update all X" RLS policy keeps
  working unchanged for PGSOL staff too); `is_external_user()` true for
  `vendor`; `handle_new_user()` no longer references the dead `'external'`
  literal (would otherwise break every future `auth.admin.createUser` call).

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/schema_org_fix_type_functions.sql
--
-- Tiga fungsi SECURITY DEFINER ini dipakai lewat NAMA di puluhan RLS
-- policy (procedures, jsa, ptw, incidents, vendor_documents,
-- toolbox_meetings, dst.) dan di trigger pembuatan akun — cukup di-REPLACE
-- sekali di sini, semua pemanggilnya otomatis ikut berubah perilaku.
--
-- is_internal_user() sengaja mencakup KEDUA 'pgn' dan 'pgsol': ini yang
-- menjaga approval PGSOL/PGN tetap berjalan seperti sekarang (Non-Goal
-- Fase 1 — lihat spec), staff PGSOL tidak kehilangan akses cuma karena
-- kolam usernya dipisah portal.

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
```

- [ ] **Step 2: Manual review**

`handle_new_user()`'s `ELSE` branch (insert into `internal_profiles`) is
now shared by both `pgn` and `pgsol` — confirm this matches Task 9's
`AddAccountModal` change (PGSOL accounts get an NIP field, same as PGN).
Confirm `SET search_path = public` is preserved from
`schema_fix_handle_new_user_role.sql:48` (needed because this trigger runs
under `auth` schema context) — re-check that file's full tail if unsure.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema_org_fix_type_functions.sql
git commit -m "Update is_internal_user/is_external_user/handle_new_user for renamed enum labels"
```

---

### Task 7: `current_vendor_org_id()` helper + rewrite all vendor-ownership RLS policies

**Files:**
- Create: `supabase/schema_org_rls_vendor_scope.sql`

**Interfaces:**
- Consumes: `profiles.org_id` (Task 1, populated by Tasks 3–4).
- Produces: `current_vendor_org_id()` SQL function; 27 policies across 8
  tables re-created to compare `vendor_id` (or a joined `p.vendor_id`)
  against `current_vendor_org_id()` instead of `auth.uid()` — the actual
  access-control fix that makes multi-user vendor orgs work.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/schema_org_rls_vendor_scope.sql
--
-- Setiap policy vendor yang tadinya membandingkan vendor_id = auth.uid()
-- (baik langsung maupun lewat join ke projects/vendor_workers/
-- vendor_equipment/vendor_materials) diganti memakai
-- current_vendor_org_id() — supaya SEMUA staff di company vendor yang
-- sama (bukan cuma 1 akun) bisa mengakses data proyek/asetnya. Lihat
-- bagian "Helper SQL untuk RLS" di spec untuk penjelasan kenapa ini aman
-- tanpa kolom/join tambahan.

CREATE OR REPLACE FUNCTION public.current_vendor_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ===== projects (schema.sql) =====
DROP POLICY IF EXISTS "External users can view their own projects" ON public.projects;
CREATE POLICY "Vendor org members can view their own projects" ON public.projects
FOR SELECT USING (vendor_id = public.current_vendor_org_id());

DROP POLICY IF EXISTS "External users can insert their own projects" ON public.projects;
CREATE POLICY "Vendor org members can insert their own projects" ON public.projects
FOR INSERT WITH CHECK (vendor_id = public.current_vendor_org_id());

-- ===== procedures (schema_update_rls_policies.sql) =====
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

-- ===== jsa (schema_update_rls_policies.sql) =====
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

-- ===== jsa_steps (schema_update_rls_policies.sql) =====
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

-- ===== ptw (schema_update_rls_policies.sql + schema_ptw_vendor_update_policy.sql) =====
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

-- ===== incidents (schema_update_incidents_rls.sql) =====
DROP POLICY IF EXISTS "Vendors can insert incidents for their projects" ON incidents;
CREATE POLICY "Vendors can insert incidents for their projects" ON incidents
FOR INSERT WITH CHECK (project_id IN (SELECT id FROM projects WHERE vendor_id = public.current_vendor_org_id()));

DROP POLICY IF EXISTS "Vendors can view incidents for their projects" ON incidents;
CREATE POLICY "Vendors can view incidents for their projects" ON incidents
FOR SELECT USING (project_id IN (SELECT id FROM projects WHERE vendor_id = public.current_vendor_org_id()));

-- ===== vendor_documents (schema_update_vendor_documents.sql) =====
DROP POLICY IF EXISTS "Vendors can insert their own documents" ON public.vendor_documents;
CREATE POLICY "Vendors can insert their own documents"
ON public.vendor_documents FOR INSERT TO authenticated
WITH CHECK (vendor_id = public.current_vendor_org_id() OR public.is_internal_user());

DROP POLICY IF EXISTS "Vendors can delete their own documents" ON public.vendor_documents;
CREATE POLICY "Vendors can delete their own documents"
ON public.vendor_documents FOR DELETE TO authenticated
USING (vendor_id = public.current_vendor_org_id() OR public.is_internal_user());

-- ===== vendor_workers / vendor_equipment (schema_vendor_workers_equipment.sql) =====
DROP POLICY IF EXISTS "Vendors can manage their own workers" ON vendor_workers;
CREATE POLICY "Vendors can manage their own workers" ON vendor_workers
FOR ALL USING (vendor_id = public.current_vendor_org_id()) WITH CHECK (vendor_id = public.current_vendor_org_id());

DROP POLICY IF EXISTS "Vendors can manage their own equipment" ON vendor_equipment;
CREATE POLICY "Vendors can manage their own equipment" ON vendor_equipment
FOR ALL USING (vendor_id = public.current_vendor_org_id()) WITH CHECK (vendor_id = public.current_vendor_org_id());

-- ===== vendor_worker_competencies / vendor_equipment_documents / vendor_materials / vendor_material_documents (schema_master_data_detail.sql) =====
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

-- ===== toolbox_meetings / site_checkins (schema_swa_toolbox_checkin.sql) =====
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
```

- [ ] **Step 2: Manual review checklist**

Count the `DROP POLICY` statements above: there should be 27 (2 projects +
3 procedures + 3 jsa + 3 jsa_steps + 3 ptw + 2 incidents + 2
vendor_documents + 2 vendor_workers/equipment + 4 master_data_detail + 3
toolbox/checkins = 27), matching the inventory in this task's research.
Confirm every `USING`/`WITH CHECK` that previously had `OR
public.is_internal_user()` still has it (vendor_documents policies) — do
not drop that clause while doing the substitution.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema_org_rls_vendor_scope.sql
git commit -m "Rewrite vendor-ownership RLS policies to check org membership, not auth.uid()"
```

---

### Task 8: `manage_org_staff` permission + `roles.type` data rename + new org-admin roles

**Files:**
- Create: `supabase/schema_org_roles.sql`
- Modify: `app/dashboard/master-data/role/constants.ts:80-93` (masterData module)

**Interfaces:**
- Consumes: `roles.type` (TEXT, currently `'internal'`/`'external'` — see `supabase/schema_update_role_type.sql`).
- Produces: `roles.type` data uses `pgn`/`pgsol`/`vendor`; two new roles
  `vendor_admin` and `pgsol_admin` exist with `masterData: ["manage_org_staff"]`;
  `allPermissionModules` has a `manage_org_staff` item Task 12's
  `hasPermissionForUser` checks look up.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/schema_org_roles.sql
--
-- roles.type sudah TEXT bebas (lihat schema_update_role_type.sql), jadi
-- ini murni migrasi DATA, bukan skema. Urutan penting: pgsol_reviewer
-- dipindah duluan supaya tidak ikut tersapu UPDATE generik 'internal'.

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
```

- [ ] **Step 2: Edit `allPermissionModules`**

In `app/dashboard/master-data/role/constants.ts`, add a new item to the
`masterData` module's `items` array (right after `manage_account`, line 88):

```ts
      { key: 'manage_account', label: 'Mengelola Data Akun' },
      { key: 'manage_org_staff', label: 'Mengelola Staff Organisasi Sendiri' },
      { key: 'manage_role', label: 'Mengelola Role & Permission' },
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit -p .
```

Expected: no new errors (this file has no type annotations that would break).

- [ ] **Step 4: Commit**

```bash
git add supabase/schema_org_roles.sql app/dashboard/master-data/role/constants.ts
git commit -m "Add manage_org_staff permission and org-scoped admin roles"
```

---

### Task 9: `lib/roles.ts` — `isPgn`/`isPgsol`/`isVendor` helpers + labels

**Files:**
- Modify: `lib/roles.ts`

**Interfaces:**
- Produces: `isPgn(type)`, `isPgsol(type)`, `isVendor(type)` — used by Task 10's sweep and by Tasks 12/13/14/15's server code instead of repeating string-literal comparisons.

- [ ] **Step 1: Add the helpers and new labels**

```ts
export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  pm: 'Project Manager',
  hse: 'HSE Manager',
  pengawas: 'Pengawas Lapangan',
  pgsol_reviewer: 'Reviewer PGSOL',
  pgn_approver: 'Approver PGN',
  asset_manager: 'Asset Manager',
  ptw_authority: 'PTW Authority',
  ptw_issuer: 'PTW Issuer',
  vendor: 'Vendor',
  vendor_admin: 'Admin Vendor',
  pgsol_admin: 'Admin PGSOL',
};
```

(only the two new entries `vendor_admin`/`pgsol_admin` are additions — the
rest of the object and `getRoleLabel` stay exactly as-is.)

Then append, after `getRoleLabel`:

```ts
/**
 * `profiles.type` sekarang ada 3 nilai (pgn/pgsol/vendor) — helper ini
 * menggantikan perbandingan string literal langsung yang tersebar di kode,
 * supaya kalau nanti ada perubahan lagi cukup diubah di satu tempat.
 */
export function isPgn(type: string | null | undefined): boolean {
  return type === 'pgn';
}

export function isPgsol(type: string | null | undefined): boolean {
  return type === 'pgsol';
}

export function isVendor(type: string | null | undefined): boolean {
  return type === 'vendor';
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit -p .
```

Expected: passes clean (pure additions, nothing removed).

- [ ] **Step 3: Commit**

```bash
git add lib/roles.ts
git commit -m "Add isPgn/isPgsol/isVendor helpers to lib/roles.ts"
```

---

### Task 10: Middleware — 3-way portal routing + PGSOL carve-out

**Files:**
- Modify: `utils/supabase/middleware.ts`

**Interfaces:**
- Consumes: `isPgn`/`isPgsol`/`isVendor` (Task 9), renamed `profiles.type` values (Task 5 — **this task's code must not run against a DB where Task 5 hasn't been applied yet**, since it reads `type` and compares against `'pgn'`/`'pgsol'`/`'vendor'`).
- Produces: `/pgsol/*` becomes a real portal boundary; PGSOL accounts get an explicit exception into `/dashboard/approval/**`.

- [ ] **Step 1: Rewrite the file**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPgn, isPgsol, isVendor } from "@/lib/roles";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPath = request.nextUrl.pathname.startsWith("/auth");
  const isVendorPath = request.nextUrl.pathname.startsWith("/vendor");
  const isPgsolPath = request.nextUrl.pathname.startsWith("/pgsol");
  const isDashboardPath = request.nextUrl.pathname.startsWith("/dashboard");
  const isDashboardApprovalPath = request.nextUrl.pathname.startsWith("/dashboard/approval");

  const isAuthLogin = request.nextUrl.pathname === "/auth/login";
  const isVendorLogin = request.nextUrl.pathname === "/vendor/login";
  const isPgsolLogin = request.nextUrl.pathname === "/pgsol/login";

  if (!user) {
    if (isAuthPath && !isAuthLogin) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }
    if (isVendorPath && !isVendorLogin) {
      const url = request.nextUrl.clone();
      url.pathname = "/vendor/login";
      return NextResponse.redirect(url);
    }
    if (isPgsolPath && !isPgsolLogin) {
      const url = request.nextUrl.clone();
      url.pathname = "/pgsol/login";
      return NextResponse.redirect(url);
    }
    if (isDashboardPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }
  } else if (isAuthPath || isVendorPath || isPgsolPath || isDashboardPath) {
    // Tipe portal dibaca dari tabel `profiles`, bukan user_metadata: metadata
    // bisa ditulis sendiri oleh user lewat supabase.auth.updateUser() dari
    // browser, sehingga vendor bisa mengaku 'pgn' dan lolos gate ini.
    // `profiles` adalah sumber kebenaran yang sama dengan yang dipakai ketiga
    // login action. Query hanya dijalankan untuk path yang memang di-gate.
    const { data: profile } = await supabase
      .from('profiles')
      .select('type')
      .eq('id', user.id)
      .single();
    const type = profile?.type; // 'pgn' | 'pgsol' | 'vendor'

    if (isVendor(type)) {
      if (isDashboardPath || isAuthPath || isPgsolPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/vendor/dashboard";
        return NextResponse.redirect(url);
      }
      if (isVendorLogin) {
        const url = request.nextUrl.clone();
        url.pathname = "/vendor/dashboard";
        return NextResponse.redirect(url);
      }
    } else if (isPgsol(type)) {
      // Pengecualian: user PGSOL boleh masuk /dashboard/approval (halaman
      // yang sama dipakai pgsol_reviewer hari ini) meski home-nya /pgsol.
      if ((isDashboardPath && !isDashboardApprovalPath) || isVendorPath || isAuthPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/pgsol/dashboard";
        return NextResponse.redirect(url);
      }
      if (isPgsolLogin) {
        const url = request.nextUrl.clone();
        url.pathname = "/pgsol/dashboard";
        return NextResponse.redirect(url);
      }
    } else if (isPgn(type)) {
      if (isVendorPath || isPgsolPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
      if (isAuthLogin) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    } else {
      // Profil tidak ditemukan / tipe tidak dikenal: jangan biarkan lolos ke
      // portal mana pun. Halaman login masing-masing sengaja dibiarkan
      // lewat supaya tidak terjadi redirect loop.
      if (isDashboardPath || (isAuthPath && !isAuthLogin) || (isVendorPath && !isVendorLogin) || (isPgsolPath && !isPgsolLogin)) {
        const url = request.nextUrl.clone();
        url.pathname = "/auth/login";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit -p .
```

Expected: passes clean. `isPgn`/`isPgsol`/`isVendor` imports must resolve
(depends on Task 9 being committed first).

- [ ] **Step 3: Commit**

```bash
git add utils/supabase/middleware.ts
git commit -m "Add 3-way portal routing for pgn/pgsol/vendor with PGSOL approval carve-out"
```

---

### Task 11: Sweep remaining `'internal'`/`'external'` literals

**Files:**
- Modify: `app/auth/login/actions.ts:28`
- Modify: `app/vendor/dashboard/projects/[id]/actions.ts:13-15`
- Modify: `app/dashboard/master-data/role/page.tsx:136-140`
- Modify: `app/dashboard/master-data/role/[id]/RolePermissionsClient.tsx:13`, `:106-107`
- Modify: `app/dashboard/master-data/role/AddRoleModal.tsx:81-82`

**Interfaces:**
- Consumes: `isPgn`/`isPgsol` (Task 9), renamed enum labels (Task 5).
- Produces: no remaining code compares `profiles.type`/`roles.type` against the dead `'internal'`/`'external'` labels (this is the last task where that string still appears anywhere outside SQL comments).

`app/vendor/login/actions.ts:28` already reads `!== 'external'` and is
handled together with the new `/pgsol/login/actions.ts` in Task 14 — not
repeated here.

- [ ] **Step 1: `app/auth/login/actions.ts`**

```ts
  if (profile?.type !== 'pgn') {
    // Kalau bukan pgn, sign out paksa dan tolak
    await supabase.auth.signOut();
    const debugMsg = `Data profil: ${JSON.stringify(profile) || 'Kosong'}. Error: ${profileError?.message || 'Tidak ada error DB'}`;
    redirect(`/auth/login?error=Akses ditolak. ${debugMsg}`);
  }
```

(replaces the `!== 'internal'` line — this login page stays PGN-only; PGSOL gets its own login in Task 14.)

- [ ] **Step 2: `app/vendor/login/actions.ts`**

```ts
  if (profile?.type !== 'vendor') {
    // Kalau bukan vendor, sign out paksa dan tolak
    await supabase.auth.signOut();
    redirect("/vendor/login?error=Akses ditolak. Akun ini bukan akun Vendor.");
  }
```

- [ ] **Step 3: `app/vendor/dashboard/projects/[id]/actions.ts`**

```ts
import { isPgn, isPgsol } from '@/lib/roles';

async function canAccessProjectDiscussion(supabase: any, userId: string, projectId: string) {
  const { data: profile } = await supabase.from('profiles').select('type').eq('id', userId).single();
  if (isPgn(profile?.type) || isPgsol(profile?.type)) return true;

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('vendor_id', userId)
    .maybeSingle();
  return !!project;
}
```

Note: the `.eq('vendor_id', userId)` line here is intentionally **not**
changed in this task — it's covered by Task 13's `getCallerVendorOrgId`
sweep (this file also appears in that task's file list for that second
edit).

- [ ] **Step 4: `app/dashboard/master-data/role/page.tsx`**

```tsx
                          {role.type === 'vendor' ? (
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">Vendor</span>
                          ) : role.type === 'pgsol' ? (
                            <span className="bg-sky-100 text-sky-700 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">PGSOL</span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">PGN</span>
                          )}
```

- [ ] **Step 5: `app/dashboard/master-data/role/[id]/RolePermissionsClient.tsx`**

Line 13:
```ts
  const [type, setType] = useState(role.type || 'pgn');
```

Lines 106-107 (the `<select name="type">` options):
```tsx
                <option value="pgn">PGN</option>
                <option value="pgsol">PGSOL</option>
                <option value="vendor">Vendor</option>
```

- [ ] **Step 6: `app/dashboard/master-data/role/AddRoleModal.tsx`**

Lines 81-82:
```tsx
                <option value="pgn">PGN</option>
                <option value="pgsol">PGSOL</option>
                <option value="vendor">Vendor</option>
```

- [ ] **Step 7: Verify**

```bash
npx tsc --noEmit -p .
```

Expected: passes clean.

- [ ] **Step 8: Commit**

```bash
git add app/auth/login/actions.ts app/vendor/login/actions.ts app/vendor/dashboard/projects/\[id\]/actions.ts app/dashboard/master-data/role/page.tsx "app/dashboard/master-data/role/[id]/RolePermissionsClient.tsx" app/dashboard/master-data/role/AddRoleModal.tsx
git commit -m "Sweep remaining internal/external type literals to pgn/pgsol/vendor"
```

---

### Task 12: Org-scoped account management (`requireAccountAccess`, `addAccount`, staff CRUD)

**Files:**
- Modify: `app/dashboard/master-data/account/actions.ts`
- Modify: `app/dashboard/master-data/account/AddAccountModal.tsx`
- Modify: `app/dashboard/master-data/account/EditAccountModal.tsx`

**Interfaces:**
- Consumes: `manage_account` (existing, superadmin) and `manage_org_staff` (Task 8) permissions.
- Produces: `requireAccountAccess(targetProfileId?: string)` — the new
  shared gate used by every account-mutating action in this file, and (via
  Task 15) by the new vendor/PGSOL staff pages, without any new server
  action module. `addAccount` creates a **new** vendor `organizations` row
  when called by a `manage_account` holder with a fresh company name, or
  joins the caller's **own** org when called by a `manage_org_staff`
  holder (ignoring any `type`/`companyName` the client sent — this is the
  actual security boundary, not just hidden form fields).

- [ ] **Step 1: Add `requireAccountAccess` and org-resolution helpers**

At the top of `app/dashboard/master-data/account/actions.ts`, replace
`requireManageAccount`:

```ts
'use server';

import { randomInt } from 'crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { revalidatePath } from 'next/cache';
import { sendEmail, passwordResetEmailHtml } from '@/lib/email';

interface AccountActor {
  userId: string;
  orgId: string | null;
  orgKind: 'pgn' | 'pgsol' | 'vendor' | null;
  crossOrg: boolean; // true kalau punya manage_account (superadmin lintas org)
}

/**
 * Gate + konteks tunggal untuk semua aksi kelola akun di file ini.
 * `manage_account` (cuma admin PGN) bebas lintas organisasi. `manage_org_staff`
 * (Task 8) cuma boleh menyentuh akun dengan org_id yang sama dengan aktor
 * sendiri — dicek di sini SEKALI, bukan diulang di tiap action, dan dicek
 * ulang lagi lewat `assertSameOrg` sebelum tiap mutasi supaya org milik
 * target tidak bisa dipalsukan lewat urutan pemanggilan.
 */
async function requireAccountAccess(): Promise<{ error: string | null; actor: AccountActor | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', actor: null };

  const crossOrg = await hasPermissionForUser(supabase, user.id, 'masterData', 'manage_account');
  const orgScoped = crossOrg || await hasPermissionForUser(supabase, user.id, 'masterData', 'manage_org_staff');
  if (!orgScoped) return { error: 'Anda tidak memiliki izin untuk mengelola akun pengguna.', actor: null };

  const { data: profile } = await supabase.from('profiles').select('org_id, type').eq('id', user.id).single();
  return {
    error: null,
    actor: {
      userId: user.id,
      orgId: profile?.org_id ?? null,
      orgKind: (profile?.type as AccountActor['orgKind']) ?? null,
      crossOrg,
    },
  };
}

/** Menolak mutasi kalau target bukan milik org aktor, kecuali aktor superadmin lintas org. */
async function assertSameOrg(adminAuthClient: ReturnType<typeof createAdminClient>, actor: AccountActor, targetId: string): Promise<string | null> {
  if (actor.crossOrg) return null;
  const { data: target } = await adminAuthClient.from('profiles').select('org_id').eq('id', targetId).single();
  if (!target || target.org_id !== actor.orgId) {
    return 'Akun ini bukan bagian dari organisasi Anda.';
  }
  return null;
}
```

- [ ] **Step 2: Rewrite `addAccount`**

```ts
export async function addAccount(formData: FormData) {
  try {
    const { error: permError, actor } = await requireAccountAccess();
    if (permError || !actor) return { error: permError };

    const fullName = formData.get('fullName') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;
    const nip = formData.get('nip') as string;
    const companyName = formData.get('companyName') as string;

    // type/org: superadmin lintas org boleh memilih lewat form; admin org
    // ter-scope SELALU dipaksa ke org & tipe miliknya sendiri, terlepas
    // dari apa yang dikirim client — ini batas keamanan sebenarnya, bukan
    // cuma field yang disembunyikan di modal (lihat Task 15).
    const type = actor.crossOrg ? (formData.get('type') as string) : actor.orgKind;

    if (!fullName || !email || !password || !role || !type) {
      return { error: 'Semua field wajib diisi' };
    }
    if (type !== 'vendor' && !nip) {
      return { error: 'NIP wajib diisi untuk user PGN/PGSOL' };
    }
    if (type === 'vendor' && actor.crossOrg && !companyName) {
      return { error: 'Nama Perusahaan wajib diisi untuk akun vendor baru' };
    }

    const adminAuthClient = createAdminClient();

    // Resolusi org: superadmin bikin org vendor baru (companyName wajib di
    // atas); admin ter-scope selalu memakai org miliknya sendiri.
    let orgId: string;
    if (actor.crossOrg) {
      if (type === 'vendor') {
        const { data: newOrg, error: orgError } = await adminAuthClient
          .from('organizations')
          .insert({ kind: 'vendor', name: companyName })
          .select('id')
          .single();
        if (orgError || !newOrg) return { error: orgError?.message || 'Gagal membuat organisasi vendor baru.' };
        orgId = newOrg.id;
      } else {
        const { data: existingOrg } = await adminAuthClient
          .from('organizations')
          .select('id')
          .eq('kind', type)
          .single();
        if (!existingOrg) return { error: `Organisasi ${type} tidak ditemukan.` };
        orgId = existingOrg.id;
      }
    } else {
      if (!actor.orgId) return { error: 'Organisasi Anda tidak ditemukan.' };
      orgId = actor.orgId;
    }

    const { data, error } = await adminAuthClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: role,
        type: type,
        nip: type !== 'vendor' ? nip : null,
        company_name: type === 'vendor' ? companyName : null,
      }
    });

    if (error) {
      console.error('Error creating user:', error);
      return { error: error.message || 'Terjadi kesalahan tidak diketahui saat membuat akun.' };
    }

    if (data.user) {
      const { error: orgLinkError } = await adminAuthClient.from('profiles').update({ org_id: orgId }).eq('id', data.user.id);
      if (orgLinkError) console.error('Error linking profile to org:', orgLinkError);

      if (type === 'vendor') {
        // vendor_profiles.id sekarang = id organisasi (lihat
        // schema_org_backfill_vendor.sql) — hanya buat baris company baru
        // kalau memang org baru; staff tambahan berbagi org yang sama.
        if (actor.crossOrg) {
          const { error: vendorError } = await adminAuthClient.from('vendor_profiles').upsert({ id: orgId, company_name: companyName });
          if (vendorError) console.error('Error creating vendor profile:', vendorError);
        }
      } else {
        const { error: internalError } = await adminAuthClient.from('internal_profiles').upsert({ id: data.user.id, nip: nip });
        if (internalError) console.error('Error creating internal profile:', internalError);
      }
    }

    revalidatePath('/dashboard/master-data/account');
    revalidatePath('/vendor/dashboard/staff');
    revalidatePath('/pgsol/dashboard/staff');
    return { success: true };
  } catch (error: any) {
    console.error('Server error creating user:', error);
    return { error: 'Terjadi kesalahan pada server saat membuat akun' };
  }
}
```

- [ ] **Step 3: Rewrite `updateAccount`, `suspendAccount`, `deleteAccount`, `resetAccountPassword`**

Each of these four functions currently starts with:
```ts
    const permError = await requireManageAccount();
    if (permError) return { error: permError };
```

Replace that block in all four with:

```ts
    const { error: permError, actor } = await requireAccountAccess();
    if (permError || !actor) return { error: permError };
    const adminAuthClient = createAdminClient();
    const orgError = await assertSameOrg(adminAuthClient, actor, id);
    if (orgError) return { error: orgError };
```

(`id` is already each function's first parameter — `updateAccount(id,
formData)`, `suspendAccount(id, isSuspended)`, `deleteAccount(id)`,
`resetAccountPassword(id)`.) Since `adminAuthClient` is now created here,
remove the now-duplicate `const adminAuthClient = createAdminClient();`
line that follows a few lines down in each function body (each function
had exactly one such line — delete the second occurrence, keep this one).

In `updateAccount`, additionally lock `type` the same way `addAccount`
does — replace:
```ts
    const type = formData.get('type') as string;
```
with:
```ts
    const type = actor.crossOrg ? (formData.get('type') as string) : (actor.orgKind as string);
```
(the rest of `updateAccount`'s body — the `auth.admin.updateUserById` call,
the `profiles` update, and the `vendor_profiles`/`internal_profiles`
upsert/delete pair — stays unchanged, since it already branches on `type
=== 'external'` which Task 11 does **not** cover; fix that one remaining
literal here too: both `type === 'external'` occurrences in this function
become `type === 'vendor'`.)

- [ ] **Step 4: Add `pgsol` option to the two account modals**

`AddAccountModal.tsx:99-107` and `EditAccountModal.tsx:96-111` both have:
```tsx
                <select name="type" ...>
                  <option value="external">External (Vendor)</option>
                  <option value="internal">Internal (PGN)</option>
                </select>
```

Replace with, in both files:
```tsx
                <select name="type" ...>
                  <option value="pgn">PGN</option>
                  <option value="pgsol">PGSOL</option>
                  <option value="vendor">Vendor</option>
                </select>
```

And the default state: `AddAccountModal.tsx:16` `useState('external')` →
`useState('pgn')`. `EditAccountModal.tsx` has no default-string state for
type (reads `account.type` directly), so no change needed there beyond the
option list.

Finally, both files' NIP-vs-companyName branch (`AddAccountModal.tsx:127`,
`EditAccountModal.tsx:133`) currently reads `type === 'internal'` — change
both to `type !== 'vendor'`, so PGSOL accounts get the NIP field (matching
Task 6's `handle_new_user` which routes both `pgn` and `pgsol` into
`internal_profiles`).

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit -p .
```

Expected: passes clean. Watch specifically for: `assertSameOrg`'s
`adminAuthClient` type matches `createAdminClient()`'s return type: import
`ReturnType<typeof createAdminClient>` resolves correctly since
`createAdminClient` is a named export.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/master-data/account/actions.ts app/dashboard/master-data/account/AddAccountModal.tsx app/dashboard/master-data/account/EditAccountModal.tsx
git commit -m "Org-scope account management: manage_org_staff alongside manage_account"
```

---

### Task 13: `getCallerVendorOrgId` helper + sweep vendor app `vendor_id` call sites

**Files:**
- Modify: `utils/supabase/server.ts`
- Modify: `app/vendor/dashboard/my-task/actions.ts:63`
- Modify: `app/vendor/dashboard/material/actions.ts:30,73,93,136`
- Modify: `app/vendor/dashboard/projects/[id]/actions.ts:21`
- Modify: `app/vendor/dashboard/peralatan/actions.ts:35,84,106,150`
- Modify: `app/vendor/dashboard/profile/page.tsx:37,44`
- Modify: `app/vendor/dashboard/pekerja/actions.ts:38,82,102,149`
- Modify: `app/vendor/dashboard/incident/create/actions.ts:95`
- Modify: `app/vendor/dashboard/dokumen/actions.ts:21,47,71,89`
- Modify: `app/vendor/dashboard/actions.ts:50,174`

**Interfaces:**
- Produces: `getCallerVendorOrgId(supabase): Promise<string | null>` — every
  `app/vendor/dashboard/**` server file that filters/inserts by `vendor_id`
  calls this instead of using `user.id` directly. Without this task, Task 7's
  RLS rewrite makes every one of these ~22 call sites start returning empty
  results (or fail inserts) for any vendor staff account that isn't the
  original migrated user, because `vendor_id` now holds an **org** id while
  `user.id` is still a **user** id.

- [ ] **Step 1: Add the helper**

Append to `utils/supabase/server.ts`:

```ts
/**
 * `vendor_id` di projects/vendor_workers/vendor_equipment/vendor_materials/
 * vendor_documents sekarang menyimpan id ORGANISASI vendor (lihat
 * schema_org_backfill_vendor.sql), bukan lagi id user yang login — semua
 * query/insert vendor yang tadinya memakai `user.id` langsung harus lewat
 * sini supaya staff mana pun di company yang sama tetap melihat data yang
 * sama, konsisten dengan RLS di schema_org_rls_vendor_scope.sql.
 */
export async function getCallerVendorOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
  return profile?.org_id ?? null;
}
```

(check the existing `createClient` export signature in this file before
pasting — the `Awaited<ReturnType<typeof createClient>>` type must match
what's already exported there; if `createClient` isn't in this exact file,
adjust the import instead of the type.)

- [ ] **Step 2: Sweep each call site**

For every file/line listed above, the pattern is the same substitution.
Two shapes appear:

Read/filter shape (most common — `.eq('vendor_id', user.id)`):
```ts
// before
const { data: { user } } = await supabase.auth.getUser();
...
.eq('vendor_id', user.id)
// after
const { data: { user } } = await supabase.auth.getUser();
const vendorOrgId = await getCallerVendorOrgId(supabase);
...
.eq('vendor_id', vendorOrgId)
```

Insert shape (`vendor_id: user.id` inside an `.insert({...})` payload):
```ts
// before
vendor_id: user.id,
// after
vendor_id: vendorOrgId,
```

Apply this to all 10 files listed in **Files** above, adding `import {
getCallerVendorOrgId } from '@/utils/supabase/server';` (or extending the
existing `@/utils/supabase/server` import line if one is already present
in that file) and one `const vendorOrgId = await getCallerVendorOrgId(supabase);`
call per function that needs it — do not compute it once at module scope,
each of these is a server action/component invoked per-request.

`app/vendor/dashboard/projects/[id]/actions.ts:21` is a **second**,
separate edit from Task 11's edit to the same file (Task 11 touched
`canAccessProjectDiscussion`'s `profile.type` check; this task touches its
`.eq('vendor_id', userId)` line a few lines below) — both land in the same
file, applied as two distinct changes.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit -p .
```

Expected: passes clean across all 10 modified files.

- [ ] **Step 4: Commit**

```bash
git add utils/supabase/server.ts app/vendor/dashboard
git commit -m "Resolve vendor_id via caller's org, not auth user id, across vendor portal"
```

---

### Task 14: `/pgsol` portal shell (login + dashboard layout + profile)

**Files:**
- Create: `app/pgsol/login/page.tsx`
- Create: `app/pgsol/login/actions.ts`
- Create: `app/pgsol/dashboard/layout.tsx`
- Create: `app/pgsol/dashboard/page.tsx`
- Create: `app/pgsol/dashboard/profile/page.tsx`

**Interfaces:**
- Consumes: middleware routing (Task 10, must be committed first or `/pgsol/*` 404s with no redirect).
- Produces: a working login → dashboard → profile flow for `type='pgsol'` accounts, mirroring `app/vendor/login` and `app/vendor/dashboard/layout.tsx`'s structure exactly (see spec: "mengikuti pola app/vendor/ yang sudah ada").

- [ ] **Step 1: `app/pgsol/login/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { data: authData, error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    redirect("/pgsol/login?error=" + error.message);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('type')
    .eq('id', authData.user.id)
    .single();

  if (profile?.type !== 'pgsol') {
    await supabase.auth.signOut();
    redirect("/pgsol/login?error=Akses ditolak. Akun ini bukan akun PGSOL.");
  }

  revalidatePath("/", "layout");
  redirect("/pgsol/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/pgsol/login");
}
```

- [ ] **Step 2: `app/pgsol/login/page.tsx`**

Read `app/vendor/login/page.tsx` first and copy its structure exactly
(form fields, error-query-param display, styling), changing only: the
import of `login` from `./actions` (already correct relative import — no
change needed there), the page title/copy from "Portal Mitra Kerja" /
vendor branding to "Portal PGSOL", and any hardcoded `/vendor/` path
strings to `/pgsol/`.

- [ ] **Step 3: `app/pgsol/dashboard/layout.tsx`**

```tsx
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { logout } from "@/app/pgsol/login/actions";

export default async function PgsolDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <p className="font-bold text-sm text-primary">Portal PGSOL</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link href="/pgsol/dashboard" className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            Beranda
          </Link>
          <Link href="/dashboard/approval" className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            Review JSA
          </Link>
          <Link href="/pgsol/dashboard/staff" className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            Staff Organisasi
          </Link>
          <Link href="/pgsol/dashboard/profile" className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            Profil Saya
          </Link>
        </nav>
        <form action={logout} className="p-3 border-t border-slate-100">
          <button type="submit" className="w-full px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 text-left">
            Keluar
          </button>
        </form>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30 shrink-0">
          <p className="font-bold text-sm text-primary md:hidden">Portal PGSOL</p>
          <div className="flex items-center gap-2.5 ml-auto">
            <span className="text-sm font-semibold text-slate-700 hidden sm:block">{user?.email}</span>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 relative bg-slate-50">
          {children}
        </div>
      </main>
    </div>
  );
}
```

Link to `/pgsol/dashboard/staff` only makes sense once Task 15 exists —
leave it in now (it'll 404 until Task 15 lands, same repo will have both
tasks committed before anyone uses this in practice, and each task is
independently reviewed/committed per this plan's process).

- [ ] **Step 4: `app/pgsol/dashboard/page.tsx`**

```tsx
import { createClient } from "@/utils/supabase/server";

export default async function PgsolDashboardHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user?.id).single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Selamat datang, {profile?.full_name || 'Reviewer PGSOL'}</h1>
        <p className="text-sm text-slate-500 mt-1">Gunakan menu Review JSA untuk melihat dokumen yang menunggu tindak lanjut Anda.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `app/pgsol/dashboard/profile/page.tsx`**

Read `app/vendor/dashboard/profile/page.tsx` and `EditableVendorProfile.tsx`
first. PGSOL has no company-profile concept (no `vendor_profiles` row) —
build a minimal read-only version showing `full_name`, `email`, and role,
sourced from `profiles` + `internal_profiles` (for `nip`), not a full
editable form. Keep this intentionally small — editable profile fields are
not part of this plan's scope.

```tsx
import { createClient } from "@/utils/supabase/server";
import { getRoleLabel } from "@/lib/roles";

export default async function PgsolProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, internal_profiles(nip)')
    .eq('id', user?.id)
    .single();

  const nip = Array.isArray(profile?.internal_profiles) ? profile?.internal_profiles[0]?.nip : (profile?.internal_profiles as any)?.nip;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Profil Saya</h1>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap</p>
          <p className="text-sm text-slate-800 mt-1">{profile?.full_name}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</p>
          <p className="text-sm text-slate-800 mt-1">{user?.email}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role</p>
          <p className="text-sm text-slate-800 mt-1">{getRoleLabel(profile?.role)}</p>
        </div>
        {nip && (
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">NIP</p>
            <p className="text-sm text-slate-800 mt-1">{nip}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit -p .
```

Expected: passes clean.

- [ ] **Step 7: Commit**

```bash
git add app/pgsol
git commit -m "Add PGSOL portal shell: login, dashboard layout, home, profile"
```

---

### Task 15: Org-scoped staff management pages

**Files:**
- Create: `components/org/AccountTable.tsx` (extracted from `app/dashboard/master-data/account/page.tsx`)
- Modify: `app/dashboard/master-data/account/page.tsx` (use the extracted component)
- Modify: `app/dashboard/master-data/account/AddAccountModal.tsx`, `EditAccountModal.tsx` (add `lockedType` prop)
- Create: `app/vendor/dashboard/staff/page.tsx`
- Create: `app/pgsol/dashboard/staff/page.tsx`

**Interfaces:**
- Consumes: `requireAccountAccess`/`addAccount`/`updateAccount`/etc. (Task 12) — no new server action module, both staff pages call the exact same functions the superadmin page uses.
- Produces: `AccountTable` — a shared server component taking a pre-fetched
  `accounts`/`roles`/pagination props, so the table markup exists once, not
  three times.

- [ ] **Step 1: Extract `AccountTable`**

Create `components/org/AccountTable.tsx` containing everything from
`app/dashboard/master-data/account/page.tsx` lines 79-227 (the `<div
className="space-y-6">...` JSX return block) as a function component:

```tsx
import Link from 'next/link';
import { Search, CheckCircle2, ShieldOff, XCircle } from 'lucide-react';
import AccountFilters from '@/app/dashboard/master-data/account/AccountFilters';
import AddAccountButton from '@/app/dashboard/master-data/account/AddAccountButton';
import AccountActions from '@/app/dashboard/master-data/account/AccountActions';

interface Account {
  id: string; name: string; email: string; role: string; type: string;
  verified: boolean; status: string; companyName: string | null; nip: string | null;
  lastLogin: string; registeredAt: string;
}

export function AccountTable({
  accounts, roles, page, totalPages, totalItems, offset, limit,
  search, role, status, basePath, title, subtitle, lockedType,
}: {
  accounts: Account[]; roles: any[]; page: number; totalPages: number;
  totalItems: number; offset: number; limit: number;
  search: string; role: string; status: string; basePath: string;
  title: string; subtitle: string; lockedType?: 'pgn' | 'pgsol' | 'vendor';
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>
        <AddAccountButton roles={roles} lockedType={lockedType} />
      </div>

      <AccountFilters initialSearch={search} initialRole={role} initialStatus={status} roles={roles} />

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Pengguna</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Role & Tipe</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Verifikasi</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status Akun</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Login Terakhir</th>
                <th scope="col" className="relative px-6 py-4"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {accounts.length > 0 ? accounts.map((account) => (
                <tr key={account.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {account.name.charAt(0)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-bold text-slate-900">{account.name}</div>
                        <div className="text-xs text-slate-500">{account.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center w-fit px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                        {account.role}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{account.type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {account.verified ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Terverifikasi
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <ShieldOff className="w-3.5 h-3.5 mr-1" />Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${account.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                      {account.status === 'Active' ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
                      {account.status === 'Active' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{account.lastLogin}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <AccountActions account={account} roles={roles} lockedType={lockedType} />
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="w-10 h-10 text-slate-300 mb-3" />
                      <p className="text-sm font-medium">Data tidak ditemukan</p>
                      <p className="text-xs mt-1">Cobalah menggunakan filter atau kata kunci lain.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalItems > 0 && (
          <div className="bg-white px-4 py-3 border-t border-slate-200 flex items-center justify-between sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-700">
                  Menampilkan <span className="font-medium">{offset + 1}</span> sampai <span className="font-medium">{Math.min(offset + limit, totalItems)}</span> dari <span className="font-medium">{totalItems}</span> hasil
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <Link href={`${basePath}?page=${page > 1 ? page - 1 : 1}&search=${search}&role=${role}&status=${status}`} className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium ${page <= 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-50'}`}>Previous</Link>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <Link key={i + 1} href={`${basePath}?page=${i + 1}&search=${search}&role=${role}&status=${status}`} className={`relative inline-flex items-center px-4 py-2 border ${page === i + 1 ? 'border-primary bg-primary/10 text-primary z-10' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'} text-sm font-medium`}>{i + 1}</Link>
                  ))}
                  <Link href={`${basePath}?page=${page < totalPages ? page + 1 : totalPages}&search=${search}&role=${role}&status=${status}`} className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium ${page >= totalPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-50'}`}>Next</Link>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `lockedType` prop to `AddAccountModal`/`EditAccountModal`/`AddAccountButton`/`AccountActions`**

In `AddAccountModal.tsx`: add `lockedType?: 'pgn' | 'pgsol' | 'vendor'` to
`AddAccountModalProps`. When set, initialize `type` state from it instead
of `'pgn'`, and render the "Tipe Akun" `<select>` as a disabled, single-option
display (or a plain `<p>` label) instead of the 3-option select — the role
`<select>` below it still filters `roles.filter(r => r.type === type)` as
before. Thread `lockedType` through to `AddAccountButton.tsx` (`{ roles,
lockedType }: { roles: any[]; lockedType?: ... }`, passed straight to
`AddAccountModal`).

In `EditAccountModal.tsx`/`AccountActions.tsx`: same `lockedType` prop
addition, same effect (locks the type select). This is presentation-only —
the actual enforcement already happened server-side in Task 12's
`requireAccountAccess`/`assertSameOrg`; a org-scoped admin submitting a
tampered `type` field is still rejected/ignored server-side regardless of
what the disabled `<select>` shows.

- [ ] **Step 3: Simplify `app/dashboard/master-data/account/page.tsx`**

Replace the file's JSX return block (lines 79-227) with a single call:

```tsx
import { AccountTable } from '@/components/org/AccountTable';
// ... (keep all existing imports/data-fetching logic through line 78 unchanged)

  return (
    <AccountTable
      accounts={accounts}
      roles={availableRoles}
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      offset={offset}
      limit={limit}
      search={search}
      role={role}
      status={status}
      basePath="/dashboard/master-data/account"
      title="Manajemen Akun"
      subtitle="Kelola data pengguna, peran, dan akses sistem."
    />
  );
```

Remove the now-unused `Search`/`Plus`/`MoreVertical`/`ShieldOff`/`CheckCircle2`/`XCircle`
imports and the `AddAccountButton`/`AccountFilters`/`AccountActions` direct
imports from this file (they're used inside `AccountTable` now, not here).

- [ ] **Step 4: `app/vendor/dashboard/staff/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { hasPermission } from '@/utils/permissions';
import { AccountTable } from '@/components/org/AccountTable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function VendorStaffPage(props: { searchParams?: Promise<{ page?: string, search?: string, role?: string, status?: string }> }) {
  const allowed = (await hasPermission('masterData', 'manage_org_staff')) || (await hasPermission('masterData', 'manage_account'));
  if (!allowed) redirect('/vendor/dashboard');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: callerProfile } = await supabase.from('profiles').select('org_id').eq('id', user?.id).single();
  const orgId = callerProfile?.org_id;
  if (!orgId) redirect('/vendor/dashboard');

  const searchParams = await props.searchParams;
  const page = parseInt(searchParams?.page || '1');
  const search = searchParams?.search || '';
  const role = searchParams?.role || '';
  const status = searchParams?.status || '';
  const limit = 5;
  const offset = (page - 1) * limit;

  const { data: roles } = await supabase.from('roles').select('name, is_system, type').eq('type', 'vendor').order('name');
  const availableRoles = roles || [];

  let query = supabase.from('profiles').select(`*, vendor_profiles(company_name), internal_profiles(nip)`, { count: 'exact' }).eq('org_id', orgId);
  if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  if (role) query = query.eq('role', role);
  if (status === 'active') query = query.eq('status', 'Active');
  if (status === 'inactive') query = query.eq('status', 'Inactive');

  const { data: profiles, count } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  const totalItems = count || 0;
  const totalPages = Math.ceil(totalItems / limit);

  const accounts = (profiles || []).map(p => ({
    id: p.id, name: p.full_name, email: p.email || 'Menunggu Sinkronisasi', role: p.role, type: p.type,
    verified: !!p.email_confirmed_at, status: p.status || 'Active',
    companyName: Array.isArray(p.vendor_profiles) ? p.vendor_profiles[0]?.company_name : p.vendor_profiles?.company_name || null,
    nip: Array.isArray(p.internal_profiles) ? p.internal_profiles[0]?.nip : p.internal_profiles?.nip || null,
    lastLogin: p.last_sign_in_at ? new Date(p.last_sign_in_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Belum Pernah Login',
    registeredAt: new Date(p.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }),
  }));

  return (
    <AccountTable
      accounts={accounts} roles={availableRoles} page={page} totalPages={totalPages}
      totalItems={totalItems} offset={offset} limit={limit} search={search} role={role} status={status}
      basePath="/vendor/dashboard/staff" title="Staff Perusahaan" subtitle="Kelola akun staff di perusahaan Anda."
      lockedType="vendor"
    />
  );
}
```

- [ ] **Step 5: `app/pgsol/dashboard/staff/page.tsx`**

Same as Step 4, with these substitutions: redirect target `/pgsol/dashboard`
instead of `/vendor/dashboard`, `.eq('type', 'pgsol')` for the roles query,
`basePath="/pgsol/dashboard/staff"`, `title="Staff PGSOL"`, `lockedType="pgsol"`.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit -p .
npm run build
```

Expected: both pass clean — `npm run build` is the first full build run in
this plan and will surface any route-level issues (missing default export,
etc.) that `tsc` alone wouldn't catch.

- [ ] **Step 7: Commit**

```bash
git add components/org app/dashboard/master-data/account/page.tsx app/dashboard/master-data/account/AddAccountModal.tsx app/dashboard/master-data/account/EditAccountModal.tsx app/dashboard/master-data/account/AddAccountButton.tsx app/dashboard/master-data/account/AccountActions.tsx app/vendor/dashboard/staff app/pgsol/dashboard/staff
git commit -m "Add org-scoped staff management pages for vendor and PGSOL"
```

---

### Task 16: Final verification pass + migration run-order checklist

**Files:**
- Create: `supabase/README_org_migration_order.md`

**Interfaces:**
- Consumes: everything from Tasks 1–15.
- Produces: a full clean `tsc`/`build` run, and a checklist the user runs
  once against their live Supabase project (the one step that can't be
  automated per Global Constraints).

- [ ] **Step 1: Full type-check**

```bash
npx tsc --noEmit -p .
```

Expected: zero errors. If any surface, they're almost always a leftover
`'internal'`/`'external'` literal Task 11 missed, or a prop mismatch in
Task 15's `lockedType` threading — fix in place, don't defer.

- [ ] **Step 2: Full build**

```bash
npm run build
```

Expected: build succeeds. Watch specifically for Next.js route-collision
errors around `/pgsol/*` (new route group) and any `"use client"`/`"use
server"` boundary violations introduced by the `AccountTable` extraction.

- [ ] **Step 3: Write the migration run-order checklist**

```markdown
# Urutan Migrasi Fase 1 — Fondasi Multi-Tenant

Jalankan file-file ini di Supabase SQL editor, SATU PER SATU, PERSIS
urutan ini (lompat urutan akan gagal — beberapa file sengaja harus jadi
transaksi sendiri, lihat komentar di tiap file):

1. `schema_organizations.sql`
2. `schema_org_add_pgsol_type.sql`
3. `schema_org_backfill_internal.sql` — **jangan dijalankan dua kali**,
   akan membuat organisasi PGN/PGSOL duplikat.
4. `schema_org_backfill_vendor.sql` — sebelum menjalankan ini, cek nama
   constraint FK asli lewat `\d vendor_profiles` (Supabase SQL editor,
   tab Table Editor > vendor_profiles > constraints tab juga bisa) dan
   sesuaikan baris `DROP CONSTRAINT vendor_profiles_id_fkey` kalau
   namanya beda dari yang tertulis di file.
5. `schema_org_rename_type_labels.sql`
6. `schema_org_fix_type_functions.sql`
7. `schema_org_rls_vendor_scope.sql`
8. `schema_org_roles.sql`

## Verifikasi manual setelah semua file di atas dijalankan

- [ ] Login sebagai akun vendor lama (pre-migrasi) — pastikan masih bisa
      melihat proyek miliknya seperti biasa.
- [ ] Buat akun vendor staff KEDUA di company yang sama (lewat
      `/dashboard/master-data/account`, pilih company yang sudah ada —
      catatan: form saat ini hanya mendukung membuat company BARU;
      menambah staff ke company existing dilakukan lewat
      `/vendor/dashboard/staff` setelah staff pertamanya login dan
      mengundang staff kedua, ATAU lewat SQL manual untuk pengujian awal:
      `UPDATE profiles SET org_id = '<org id vendor lama>' WHERE id = '<user id staff baru>'`
      setelah staff baru dibuat via `auth.admin.createUser`).
- [ ] Login sebagai staff kedua ini — pastikan BISA melihat proyek yang
      sama dengan staff pertama (ini bukti utama RLS org-scoping bekerja).
- [ ] Login sebagai vendor company LAIN (company B) — pastikan TIDAK BISA
      mengakses proyek company A walau tahu id proyeknya (coba lewat URL
      langsung, bukan cuma dari daftar).
- [ ] Login sebagai akun `pgsol_reviewer` lama — pastikan diarahkan ke
      `/pgsol/login` (bukan lagi `/auth/login`), dan setelah login bisa
      membuka `/dashboard/approval` (tapi tidak bisa membuka
      `/dashboard/master-data` atau path `/dashboard/*` lain).
- [ ] Login sebagai akun PGN (`type='pgn'`) — pastikan tetap bisa
      mengakses seluruh `/dashboard/*` seperti sebelum migrasi ini, tanpa
      regresi.
- [ ] Coba `updateAccount`/`suspendAccount` dari akun vendor_admin company
      A terhadap id staff company B — pastikan ditolak dengan pesan
      "Akun ini bukan bagian dari organisasi Anda." (bukan cuma
      disembunyikan di UI — panggil action-nya, bukan cuma cek tombolnya
      tidak muncul).
```

- [ ] **Step 4: Commit**

```bash
git add supabase/README_org_migration_order.md
git commit -m "Add Fase 1 migration run-order and manual verification checklist"
```

---

## Self-Review Notes

- **Spec coverage:** every section of the spec (`organizations` table,
  `profiles.org_id`, enum rename, `vendor_profiles`/FK-reuse trick,
  `current_vendor_org_id()` + 27-policy rewrite, `is_internal_user`/
  `is_external_user`/`handle_new_user` fix, 3-way middleware + PGSOL
  carve-out, `manage_org_staff` permission, org-scoped account CRUD,
  vendor `vendor_id` call-site sweep, PGSOL portal shell, staff pages) has
  a task above. Testing section is covered by Task 16's manual checklist
  (no automated RLS test is possible without DB access — this matches the
  spec's own Testing section, which already called for manual Supabase
  SQL editor verification).
- **Placeholder scan:** no task step says "add error handling" or "write
  tests for the above" without showing the actual code — every SQL file
  and every TS diff above is complete, copy-pasteable content.
- **Type consistency:** `getCallerVendorOrgId` (Task 13) is defined once
  in `utils/supabase/server.ts` and only ever imported, never redefined.
  `requireAccountAccess`/`assertSameOrg`/`AccountActor` (Task 12) are
  defined once and reused by Tasks 12 and 15 without redeclaration.
  `lockedType` prop type (`'pgn' | 'pgsol' | 'vendor'` or `undefined`) is
  identical across `AccountTable`, `AddAccountModal`, `AddAccountButton`,
  `EditAccountModal`, `AccountActions` (Task 15).
- **Ordering hazard called out explicitly:** Tasks 2 and 5 are the only
  single-statement enum-DDL files, and every task after Task 5 assumes the
  renamed labels — this is stated in Global Constraints and repeated at
  the point of first use (Task 6) so a task executor can't miss it even
  reading tasks out of order.
