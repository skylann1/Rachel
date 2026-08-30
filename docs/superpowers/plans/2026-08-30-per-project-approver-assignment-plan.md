# Per-Project Approver Assignment (Fase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the permission-pool model for Prosedur/JSA/PTW internal approval stages with explicit per-project assignment — PGN and PGSOL admins each pick specific staff for their org's stage-slots on a given project, and every assignee must approve before a stage completes (multi-signature); a single reject vetoes immediately.

**Architecture:** One new table, `stage_assignments` (project_id, doc_type, stage_key, assignee_id, status), replaces the `PROCEDURE_STAGE_PERMISSION`/`JSA_STAGE_PERMISSION`/`PTW_STAGE_PERMISSION` lookups at the point of use — not the maps themselves, which stay as the vocabulary of valid `stage_key` strings. A shared `lib/stage-assignments.ts` module provides read/write helpers used by both a new PGN assignment UI (on the existing project detail page) and a new PGSOL assignment UI (new pages under `/pgsol/dashboard`). `app/dashboard/approval/actions.ts`'s six approve/reject functions and `app/dashboard/my-task/actions.ts`'s task-list query are rewritten to check assignment rows instead of permission-pool membership.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase (Postgres + RLS), TypeScript. No test runner in this repo — verification is `npx tsc --noEmit -p .` + `npm run build`.

**Spec:** `docs/superpowers/specs/2026-08-30-per-project-approver-assignment-design.md`

## Global Constraints

- No test framework exists in this repo — every TS task's verification step is `npx tsc --noEmit -p .` (and `npm run build` in the final task).
- No automated DB access — every `supabase/schema_*.sql` file is written here and the user runs it manually in the Supabase SQL editor, in the order these tasks create them.
- Reject = veto: a single rejection from any one assigned approver immediately reverts the document to Draft and resets every assignment row for that stage back to `pending` — never wait for the other assignees to also decide.
- A stage with zero assignment rows can never be approved. Every rewritten approve action must check this and fail with a clear error, not a confusing permission-style rejection.
- `requireDistinctApprover` (JSA reviewer ≠ approver; PTW authority ≠ issuer ≠ hsse) stays as an additional runtime check in every rewritten action — assignment answers "is this person allowed to act on this stage," `requireDistinctApprover` answers "but not if they already acted on the other stage of this same document."
- Follow existing repo conventions: Indonesian comments/copy, Tailwind utility classes matching surrounding style, Server Actions start with `"use server"`.
- Non-goals (do not build in this plan): Fase 3 (vendor-side review stage), multi-signer names on generated PDFs (`reviewer_id`/`approver_id`/`reviewed_by` keep meaning "whichever assignee completed the stage," unchanged), reassignment UI for a stage with partial decisions already recorded.

---

## File Structure

**New SQL migrations:**
- `supabase/schema_stage_assignments.sql` — `stage_assignments` table + RLS
- `supabase/schema_stage_assignment_permissions.sql` — `jsa.manage_assignment_pgsol` permission wiring for `pgsol_admin`

**New app code:**
- `lib/stage-assignments.ts` — shared read/write helpers (`getStageAssignments`, `getEligibleAssignees`, `writeStageAssignment`, `isStageFullyApproved`, `resetStageAssignments`)
- `app/dashboard/master-data/project/[id]/AssignmentPanel.tsx` + wiring into `page.tsx` — PGN assignment UI
- `app/pgsol/dashboard/projects/page.tsx`, `app/pgsol/dashboard/projects/[id]/assign/page.tsx`, `app/pgsol/dashboard/projects/actions.ts` — PGSOL project list + assignment UI

**Modified app code:**
- `app/dashboard/inbox/actions.ts` — new `notifyAssignees` export
- `app/dashboard/approval/actions.ts` — `approveProcedure`/`rejectProcedure`/`approveJsa`/`rejectJsa`/`approvePtw`/`rejectPtw` rewritten to use assignment rows instead of `requirePermission`
- `app/dashboard/my-task/actions.ts` — `getMyTasks` rewritten to filter by assignment rows instead of permission checks
- `app/dashboard/master-data/project/actions.ts` — new `saveStageAssignment` action
- `app/dashboard/master-data/role/constants.ts` — new `manage_assignment_pgsol` permission item under the `jsa` module
- `app/pgsol/dashboard/layout.tsx` — new "Proyek Saya" nav link

---

### Task 1: `stage_assignments` table + RLS

**Files:**
- Create: `supabase/schema_stage_assignments.sql`

**Interfaces:**
- Produces: table `public.stage_assignments(id, project_id, doc_type, stage_key, assignee_id, status, decided_at, note, assigned_by, assigned_at)`. Every later task depends on this existing.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/schema_stage_assignments.sql
--
-- Fase 2: siapa yang harus mereview/approve tahap internal (Prosedur/JSA/PTW)
-- sekarang eksplisit per proyek, bukan lagi "siapa pun yang punya permission
-- ini". Satu baris = satu orang, satu tahap, satu proyek. Lihat
-- docs/superpowers/specs/2026-08-30-per-project-approver-assignment-design.md
-- untuk desain lengkap.
--
-- stage_key memakai vokabuler {module}.{action} yang sudah ada di
-- PROCEDURE_STAGE_PERMISSION/JSA_STAGE_PERMISSION/PTW_STAGE_PERMISSION
-- (lib/procedure-status.ts, lib/jsa-status.ts, lib/ptw-status.ts) — bukan
-- vokabuler baru.

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

-- Internal users (PGN + PGSOL, is_internal_user() sudah mencakup keduanya
-- sejak Fase 1) boleh membaca dan menulis semua baris di sini — pemilahan
-- "boleh assign tahap yang mana" (manage_project vs
-- jsa.manage_assignment_pgsol) dan "assignee harus dari org sendiri"
-- dilakukan di server action (lib/stage-assignments.ts), bukan di RLS —
-- konsisten dengan bagaimana roles.permissions dicek di seluruh aplikasi
-- ini (selalu di TypeScript lewat hasPermissionForUser, tidak pernah di
-- SQL).
CREATE POLICY "Internal users can read stage assignments" ON public.stage_assignments
FOR SELECT USING (public.is_internal_user());

CREATE POLICY "Internal users can write stage assignments" ON public.stage_assignments
FOR ALL USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());

-- Vendor pemilik proyek boleh melihat siapa yang menjadi reviewer/approver
-- tahapnya — transparansi, bukan hak tulis.
CREATE POLICY "Vendors can view assignments for their own projects" ON public.stage_assignments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = public.current_vendor_org_id()
  )
);
```

- [ ] **Step 2: Manual review**

Confirm `is_internal_user()` and `current_vendor_org_id()` are referenced,
not redefined (both already exist from Fase 1's
`schema_org_fix_type_functions.sql` and `schema_org_rls_vendor_scope.sql`).
Confirm the `UNIQUE` constraint columns match exactly what
`writeStageAssignment` (Task 3) will upsert against.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema_stage_assignments.sql
git commit -m "Add stage_assignments table for per-project approver assignment"
```

---

### Task 2: `jsa.manage_assignment_pgsol` permission

**Files:**
- Create: `supabase/schema_stage_assignment_permissions.sql`
- Modify: `app/dashboard/master-data/role/constants.ts`

**Interfaces:**
- Produces: a new permission item `jsa.manage_assignment_pgsol`, granted to the `pgsol_admin` role (created in Fase 1's `schema_org_roles.sql`). Task 10 (PGSOL assignment UI) gates on this.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/schema_stage_assignment_permissions.sql
--
-- pgsol_admin (dibuat di schema_org_roles.sql, Fase 1) belum punya
-- kemampuan menunjuk siapa yang mereview JSA tahap PGSOL untuk proyek
-- tertentu — permission baru ini yang membukanya.
UPDATE public.roles
SET permissions = permissions || '{"jsa": ["manage_assignment_pgsol"]}'::jsonb
WHERE name = 'pgsol_admin';
```

- [ ] **Step 2: Edit `allPermissionModules`**

In `app/dashboard/master-data/role/constants.ts`, the `jsa` module's
`items` array currently reads (lines 51-57):

```ts
      { key: 'view', label: 'Melihat Daftar JSA' },
      { key: 'create', label: 'Membuat Pengajuan JSA Baru' },
      { key: 'review_pgsol', label: 'Review JSA — Tahap PGSOL' },
      { key: 'approve_pgn', label: 'Approve JSA — Tahap PGN' },
      { key: 'delete', label: 'Menghapus Data JSA' },
```

Add one line after `review_pgsol`:

```ts
      { key: 'view', label: 'Melihat Daftar JSA' },
      { key: 'create', label: 'Membuat Pengajuan JSA Baru' },
      { key: 'review_pgsol', label: 'Review JSA — Tahap PGSOL' },
      { key: 'manage_assignment_pgsol', label: 'Menunjuk Reviewer PGSOL per Proyek' },
      { key: 'approve_pgn', label: 'Approve JSA — Tahap PGN' },
      { key: 'delete', label: 'Menghapus Data JSA' },
```

- [ ] **Step 3: Note the existing `masterData.manage_project` permission is reused for PGN, not new**

No code change needed for this — `hasPermissionForUser(supabase, user.id,
'masterData', 'manage_project')` (already checked in
`app/dashboard/master-data/project/actions.ts:12`) is the exact gate Task
9's PGN assignment action reuses. Nothing to add here.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p .
```

- [ ] **Step 5: Commit**

```bash
git add supabase/schema_stage_assignment_permissions.sql app/dashboard/master-data/role/constants.ts
git commit -m "Add jsa.manage_assignment_pgsol permission for pgsol_admin"
```

---

### Task 3: `lib/stage-assignments.ts` shared helpers

**Files:**
- Create: `lib/stage-assignments.ts`

**Interfaces:**
- Consumes: `stage_assignments` table (Task 1), `getRoleNamesWithPermission` (`utils/permissions.ts:47`, already exists).
- Produces: `getStageAssignments`, `getEligibleAssignees`, `writeStageAssignment`, `isStageFullyApproved`, `resetStageAssignments`, `PGN_STAGE_KEYS` — every later task (4-11) depends on these exact names/signatures.

- [ ] **Step 1: Write the file**

```ts
// lib/stage-assignments.ts
//
// Helper bersama untuk baca/tulis stage_assignments — dipakai baik oleh UI
// assignment (PGN di app/dashboard/master-data/project/actions.ts, PGSOL di
// app/pgsol/dashboard/projects/actions.ts) maupun oleh actions approval
// (app/dashboard/approval/actions.ts) dan filter tugas
// (app/dashboard/my-task/actions.ts). Bukan Server Action sendiri (tidak ada
// "use server" di sini) — dipanggil dari dalam file yang sudah "use server".

import { getRoleNamesWithPermission } from '@/utils/permissions';

export interface StageAssignmentRow {
  id: string;
  project_id: string;
  doc_type: string;
  stage_key: string;
  assignee_id: string;
  status: 'pending' | 'approved' | 'rejected';
  decided_at: string | null;
  note: string | null;
}

/** Kelima stage_key yang ditugaskan admin PGN — dipakai untuk membatasi apa yang boleh disimpan lewat saveStageAssignment (masterData.manage_project). */
export const PGN_STAGE_KEYS = [
  'procedure.review',
  'jsa.approve_pgn',
  'ptw.approve_pm',
  'ptw.review_issuer',
  'ptw.numbering_hsse',
] as const;

export async function getStageAssignments(
  supabase: any, projectId: string, docType: string, stageKey: string
): Promise<StageAssignmentRow[]> {
  const { data } = await supabase
    .from('stage_assignments')
    .select('id, project_id, doc_type, stage_key, assignee_id, status, decided_at, note')
    .eq('project_id', projectId).eq('doc_type', docType).eq('stage_key', stageKey);
  return data || [];
}

/** Kandidat yang boleh ditunjuk ke satu stage_key: role-nya harus punya permission {module}.{action} yang bersangkutan. */
export async function getEligibleAssignees(
  supabase: any, module: string, action: string
): Promise<{ id: string; full_name: string }[]> {
  const roleNames = await getRoleNamesWithPermission(supabase, module, action);
  if (roleNames.length === 0) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', roleNames)
    .order('full_name');
  return data || [];
}

/**
 * Menyimpan daftar assignee untuk satu (project, doc_type, stage_key) —
 * full-replace: assignee yang tidak lagi ada di assigneeIds dihapus,
 * assignee baru ditambahkan sebagai 'pending'. Menolak kalau ADA baris
 * existing yang statusnya bukan 'pending' (sudah ada yang mulai
 * memutuskan) — mengedit assignment tahap yang sedang berjalan bukan
 * cakupan Fase 2 (lihat spec, Non-Goals).
 */
export async function writeStageAssignment(
  supabase: any, actorId: string,
  params: { projectId: string; docType: string; stageKey: string; assigneeIds: string[] }
): Promise<{ error?: string }> {
  const { projectId, docType, stageKey, assigneeIds } = params;

  const { data: existing } = await supabase
    .from('stage_assignments')
    .select('id, assignee_id, status')
    .eq('project_id', projectId).eq('doc_type', docType).eq('stage_key', stageKey);

  if ((existing || []).some((row: any) => row.status !== 'pending')) {
    return { error: 'Tahap ini sudah mulai diproses — assignment tidak bisa diubah sampai ditolak dan diajukan ulang.' };
  }

  const { data: actorProfile } = await supabase.from('profiles').select('org_id').eq('id', actorId).single();
  if (!actorProfile?.org_id) return { error: 'Organisasi Anda tidak ditemukan.' };

  if (assigneeIds.length > 0) {
    const { data: assigneeProfiles } = await supabase.from('profiles').select('id, org_id').in('id', assigneeIds);
    const invalid = (assigneeProfiles || []).some((p: any) => p.org_id !== actorProfile.org_id);
    if (invalid || (assigneeProfiles || []).length !== assigneeIds.length) {
      return { error: 'Semua orang yang ditunjuk harus berasal dari organisasi Anda sendiri.' };
    }
  }

  const existingIds = new Set((existing || []).map((r: any) => r.assignee_id));
  const newIds = new Set(assigneeIds);

  const toRemove = (existing || []).filter((r: any) => !newIds.has(r.assignee_id)).map((r: any) => r.id);
  if (toRemove.length > 0) {
    const { error } = await supabase.from('stage_assignments').delete().in('id', toRemove);
    if (error) return { error: error.message };
  }

  const toAdd = assigneeIds.filter(id => !existingIds.has(id));
  if (toAdd.length > 0) {
    const { error } = await supabase.from('stage_assignments').insert(
      toAdd.map(assigneeId => ({
        project_id: projectId, doc_type: docType, stage_key: stageKey,
        assignee_id: assigneeId, status: 'pending', assigned_by: actorId,
      }))
    );
    if (error) return { error: error.message };
  }

  return {};
}

/** True hanya kalau ADA minimal satu baris dan SEMUA baris untuk tahap ini berstatus 'approved'. */
export function isStageFullyApproved(rows: StageAssignmentRow[]): boolean {
  return rows.length > 0 && rows.every(r => r.status === 'approved');
}

/** Dipanggil saat vendor mengajukan ulang setelah reject — semua baris tahap ini kembali 'pending' supaya orang yang sama direview lagi dari nol. */
export async function resetStageAssignments(
  supabase: any, projectId: string, docType: string, stageKey: string
): Promise<void> {
  await supabase
    .from('stage_assignments')
    .update({ status: 'pending', decided_at: null, note: null })
    .eq('project_id', projectId).eq('doc_type', docType).eq('stage_key', stageKey);
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit -p .
```

Expected: passes clean.

- [ ] **Step 3: Commit**

```bash
git add lib/stage-assignments.ts
git commit -m "Add shared stage_assignments read/write helpers"
```

---

### Task 4: `notifyAssignees` in `app/dashboard/inbox/actions.ts`

**Files:**
- Modify: `app/dashboard/inbox/actions.ts`

**Interfaces:**
- Consumes: `stage_assignments` table (Task 1).
- Produces: `notifyAssignees({ projectId, docType, stageKey, type, title, message, link })` — Tasks 5-7 call this in place of `notifyUsersByPermission({...STAGE_PERMISSION[stage], ...})`.

- [ ] **Step 1: Read the file's existing `notifyOrgMembers`**

Read `app/dashboard/inbox/actions.ts` around the `notifyOrgMembers`
function (added in Fase 1's final fix wave, queries `profiles` for a given
`org_id` and batch-inserts one notification per member) — `notifyAssignees`
follows the identical shape, querying `stage_assignments` instead of
`profiles`.

- [ ] **Step 2: Add the function**

```ts
/**
 * Menotifikasi semua orang yang di-assign ke satu tahap (project, doc_type,
 * stage_key) yang statusnya masih 'pending' — menggantikan
 * notifyUsersByPermission untuk approval Fase 2, yang dulu menotifikasi
 * SEMUA pemegang permission, bukan cuma yang benar-benar ditugaskan ke
 * proyek ini.
 */
export async function notifyAssignees({
  projectId, docType, stageKey, type, title, message, link,
}: {
  projectId: string; docType: string; stageKey: string;
  type: string; title: string; message: string; link: string;
}) {
  const supabase = await createClient();
  const { data: assignments } = await supabase
    .from('stage_assignments')
    .select('assignee_id')
    .eq('project_id', projectId).eq('doc_type', docType).eq('stage_key', stageKey)
    .eq('status', 'pending');

  const assigneeIds = (assignments || []).map((a: any) => a.assignee_id);
  if (assigneeIds.length === 0) return;

  await supabase.from('notifications').insert(
    assigneeIds.map((userId: string) => ({ user_id: userId, type, title, message, link }))
  );
}
```

Match the exact `notifications` insert shape (column names) to what
`notifyOrgMembers` already uses in this same file — read it first to
confirm, since the brief above is describing the intent, not guaranteed to
match column-for-column if `notifyOrgMembers`'s shape differs slightly
from what's shown here.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit -p .
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/inbox/actions.ts
git commit -m "Add notifyAssignees for per-project approval notifications"
```

---

### Task 5: Rewrite Prosedur approve/reject

**Files:**
- Modify: `app/dashboard/approval/actions.ts`

**Interfaces:**
- Consumes: `getStageAssignments`/`isStageFullyApproved`/`resetStageAssignments` (Task 3), `notifyAssignees` (Task 4).
- Produces: `approveProcedure`/`rejectProcedure` now assignment-gated. Establishes the pattern Tasks 6-7 repeat for JSA/PTW.

- [ ] **Step 1: Add imports**

At the top of `app/dashboard/approval/actions.ts`, add:

```ts
import { getStageAssignments, isStageFullyApproved, resetStageAssignments } from '@/lib/stage-assignments';
import { notifyAssignees } from '@/app/dashboard/inbox/actions';
```

(`notifyUsersByPermission` stays imported for now — Task 6/7 still use it
until their own rewrite; only remove it from the import line once no
caller remains, in Task 7.)

- [ ] **Step 2: Rewrite `approveProcedure`**

Replace the existing function body (currently
`app/dashboard/approval/actions.ts:189-224`) with:

```ts
export async function approveProcedure(procedureId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: current } = await supabase.from('procedures').select('status, project_id').eq('id', procedureId).single();
  if (current?.status !== PROCEDURE_STATUS.menungguReviewPM) throw new Error("Prosedur tidak dalam tahap yang bisa disetujui.");
  if (!current.project_id) throw new Error("Prosedur ini tidak terhubung ke proyek.");

  const rows = await getStageAssignments(supabase, current.project_id, 'procedure', 'procedure.review');
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk mereview Prosedur Kerja proyek ini.");

  const { error: markError } = await supabase.from('stage_assignments').update({ status: 'approved', decided_at: new Date().toISOString() }).eq('id', myRow.id);
  if (markError) throw new Error(markError.message);

  const updatedRows = rows.map(r => r.id === myRow.id ? { ...r, status: 'approved' as const } : r);
  if (!isStageFullyApproved(updatedRows)) {
    revalidatePath('/dashboard/approval');
    return;
  }

  const { data: profile } = await supabase.from('internal_profiles').select('id').eq('id', user.id).single();
  const { error } = await supabase
    .from('procedures')
    .update({ status: PROCEDURE_STATUS.approved, reviewed_by: profile?.id })
    .eq('id', procedureId);
  if (error) throw new Error(error.message);

  const { data: proc } = await supabase.from('procedures').select('project_id, projects ( name, vendor_id )').eq('id', procedureId).single();
  const proj: any = Array.isArray(proc?.projects) ? proc?.projects[0] : proc?.projects;
  if (proc?.project_id) {
    await logDocumentEvent(supabase, {
      docType: 'procedure', docId: procedureId, projectId: proc.project_id, actorId: user.id,
      action: 'Direview & Disetujui PM',
    });
  }
  if (proj?.vendor_id) {
    await createNotification({
      userId: proj.vendor_id,
      type: 'approval',
      title: `Prosedur Kerja Disetujui`,
      message: `Prosedur Kerja untuk proyek "${proj.name}" telah disetujui. Silakan lanjutkan pengajuan JSA.`,
      link: `/vendor/dashboard/projects/${proc?.project_id}`,
    });
  }
  revalidatePath('/dashboard/approval');
}
```

- [ ] **Step 3: Rewrite `rejectProcedure`**

Replace the existing function body (currently
`app/dashboard/approval/actions.ts:226-278`) with:

```ts
export async function rejectProcedure(procedureId: string, note: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: currentCheck } = await supabase.from('procedures').select('status, project_id').eq('id', procedureId).single();
  if (currentCheck?.status !== PROCEDURE_STATUS.menungguReviewPM) throw new Error("Prosedur tidak dalam tahap yang bisa ditolak.");
  if (!currentCheck.project_id) throw new Error("Prosedur ini tidak terhubung ke proyek.");

  const rows = await getStageAssignments(supabase, currentCheck.project_id, 'procedure', 'procedure.review');
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk mereview Prosedur Kerja proyek ini.");

  await supabase.from('stage_assignments').update({ status: 'rejected', decided_at: new Date().toISOString(), note }).eq('id', myRow.id);
  await resetStageAssignments(supabase, currentCheck.project_id, 'procedure', 'procedure.review');

  const { data: proc } = await supabase.from('procedures').select('content, project_id, projects ( name, vendor_id )').eq('id', procedureId).single();

  let updatedContent = proc?.content || {};
  let revisions = updatedContent.revisions || [];
  revisions.push({ revNo: revisions.length + 1, date: new Date().toLocaleDateString('id-ID'), note: note });
  updatedContent.revisions = revisions;

  const { error } = await supabase
    .from('procedures')
    .update({ status: PROCEDURE_STATUS.draft, content: updatedContent })
    .eq('id', procedureId);
  if (error) throw new Error(error.message);

  if (proc?.project_id) {
    await logDocumentEvent(supabase, {
      docType: 'procedure', docId: procedureId, projectId: proc.project_id, actorId: user.id,
      action: 'Ditolak PM — Revisi Diperlukan', notes: note,
    });
  }

  const proj: any = Array.isArray(proc?.projects) ? proc?.projects[0] : proc?.projects;
  if (proj?.vendor_id) {
    await createNotification({
      userId: proj.vendor_id,
      type: 'warning',
      title: `Prosedur Kerja Ditolak — Revisi Diperlukan`,
      message: `Prosedur untuk proyek "${proj.name}" ditolak. Catatan: "${note}". Silakan perbaiki dan ajukan ulang.`,
      link: `/vendor/dashboard/projects/${proc?.project_id}`,
    });
  }
  revalidatePath('/dashboard/approval');
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p .
```

Expected: passes clean (`requirePermission`/`PROCEDURE_STAGE_PERMISSION`
imports may now be unused if this is the only remaining caller of
`requirePermission` for Prosedur — do not remove the import yet, JSA/PTW
functions in this same file still use `requirePermission` until Tasks
6-7).

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/approval/actions.ts
git commit -m "Rewrite Prosedur approve/reject for per-project multi-signature assignment"
```

---

### Task 6: Rewrite JSA approve/reject

**Files:**
- Modify: `app/dashboard/approval/actions.ts`

**Interfaces:**
- Consumes: same helpers as Task 5, plus `requireDistinctApprover` (existing, in this file).
- Produces: `approveJsa`/`rejectJsa` assignment-gated, two-stage.

- [ ] **Step 1: Rewrite `approveJsa`**

Replace the existing function body (currently
`app/dashboard/approval/actions.ts:280-356`) with:

```ts
export async function approveJsa(jsaId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: current } = await supabase.from('jsa').select('status, reviewer_id, project_id').eq('id', jsaId).single();
  if (!current?.project_id) throw new Error("JSA ini tidak terhubung ke proyek.");

  let stageKey = '';
  let nextStatus = '';

  if (current.status === JSA_STATUS.reviewPgsol) {
    stageKey = 'jsa.review_pgsol';
    nextStatus = JSA_STATUS.approvalPgn;
  } else if (current.status === JSA_STATUS.approvalPgn) {
    stageKey = 'jsa.approve_pgn';
    nextStatus = JSA_STATUS.approved;
    // Pemisahan wewenang: reviewer dan approver wajib dua orang berbeda,
    // terlepas dari siapa yang di-assign ke tahap ini.
    if (current.reviewer_id && current.reviewer_id === user.id) {
      throw new Error("JSA harus disetujui oleh orang yang berbeda dari yang melakukan review. Silakan minta Approver PGN lain untuk menyetujui.");
    }
  } else {
    throw new Error("JSA tidak dalam tahap yang bisa disetujui.");
  }

  const rows = await getStageAssignments(supabase, current.project_id, 'jsa', stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk tahap JSA ini pada proyek ini.");

  await supabase.from('stage_assignments').update({ status: 'approved', decided_at: new Date().toISOString() }).eq('id', myRow.id);

  // Re-fetch (bukan patch lokal dari `rows` yang sudah basi) — dua approver
  // terakhir yang approve nyaris bersamaan sama-sama melihat snapshot awal
  // yang belum mencatat approval satu sama lain kalau ini pakai patch lokal,
  // sehingga dokumen bisa macet permanen walau di DB semua baris sudah
  // approved. Lihat ruling di ledger Task 5 untuk detail race-nya.
  const freshRows = await getStageAssignments(supabase, current.project_id, 'jsa', stageKey);
  const stageComplete = isStageFullyApproved(freshRows);

  const { data: jsa } = await supabase.from('jsa').select('project_id, projects ( name, vendor_id )').eq('id', jsaId).single();
  const proj: any = Array.isArray(jsa?.projects) ? jsa?.projects[0] : jsa?.projects;

  if (!stageComplete) {
    revalidatePath('/dashboard/approval');
    return;
  }

  const updatePayload: any = stageKey === 'jsa.review_pgsol'
    ? { reviewer_id: user.id, reviewed_at: new Date().toISOString(), status: JSA_STATUS.approvalPgn }
    : { approver_id: user.id, approved_at: new Date().toISOString(), status: JSA_STATUS.approved };

  const { error } = await supabase.from('jsa').update(updatePayload).eq('id', jsaId);
  if (error) throw new Error(error.message);

  if (current.project_id) {
    await logDocumentEvent(supabase, {
      docType: 'jsa', docId: jsaId, projectId: current.project_id, actorId: user.id,
      action: nextStatus === JSA_STATUS.approved ? 'Disetujui PGN' : 'Direview PGSOL',
    });
  }

  if (nextStatus === JSA_STATUS.approvalPgn) {
    await notifyAssignees({
      projectId: current.project_id, docType: 'jsa', stageKey: 'jsa.approve_pgn',
      type: 'action_required',
      title: 'JSA Menunggu Persetujuan PGN',
      message: `JSA untuk proyek "${proj?.name}" telah direview PGSOL dan menunggu persetujuan Anda.`,
      link: `/dashboard/projects/${jsa?.project_id}`,
    });
  }

  if (proj?.vendor_id) {
    await createNotification({
      userId: proj.vendor_id,
      type: nextStatus === JSA_STATUS.approved ? 'approval' : 'info',
      title: nextStatus === JSA_STATUS.approved ? `JSA Disetujui — Lanjut ke PTW` : `JSA Telah Direview PGSOL`,
      message: nextStatus === JSA_STATUS.approved
        ? `JSA untuk proyek "${proj.name}" telah disetujui PGN. Anda dapat melanjutkan ke pengajuan PTW.`
        : `JSA untuk proyek "${proj.name}" telah direview PGSOL dan kini menunggu persetujuan PGN.`,
      link: `/vendor/dashboard/projects/${jsa?.project_id}`,
    });
  }
  revalidatePath('/dashboard/approval');
}
```

- [ ] **Step 2: Rewrite `rejectJsa`**

Replace the existing function body (currently
`app/dashboard/approval/actions.ts:358-408`) with:

```ts
export async function rejectJsa(jsaId: string, note: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: current } = await supabase.from('jsa').select('status, project_id').eq('id', jsaId).single();
  if (!current?.project_id) throw new Error("JSA ini tidak terhubung ke proyek.");

  let stageKey = '';
  let penolak = '';
  if (current.status === JSA_STATUS.reviewPgsol) {
    stageKey = 'jsa.review_pgsol';
    penolak = 'PGSOL';
  } else if (current.status === JSA_STATUS.approvalPgn) {
    stageKey = 'jsa.approve_pgn';
    penolak = 'PGN';
  } else {
    throw new Error("JSA tidak dalam tahap yang bisa ditolak.");
  }

  const rows = await getStageAssignments(supabase, current.project_id, 'jsa', stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk tahap JSA ini pada proyek ini.");

  await supabase.from('stage_assignments').update({ status: 'rejected', decided_at: new Date().toISOString(), note }).eq('id', myRow.id);
  await resetStageAssignments(supabase, current.project_id, 'jsa', stageKey);

  const { error } = await supabase
    .from('jsa')
    .update({
      status: JSA_STATUS.reviewPgsol,
      rejection_note: note,
      reviewer_id: null, reviewed_at: null,
      approver_id: null, approved_at: null,
    })
    .eq('id', jsaId);
  if (error) throw new Error(error.message);

  const { data: jsa } = await supabase.from('jsa').select('project_id, projects ( name, vendor_id )').eq('id', jsaId).single();
  const proj: any = Array.isArray(jsa?.projects) ? jsa?.projects[0] : jsa?.projects;
  if (jsa?.project_id) {
    await logDocumentEvent(supabase, {
      docType: 'jsa', docId: jsaId, projectId: jsa.project_id, actorId: user.id,
      action: `Ditolak ${penolak}`, notes: note,
    });
  }
  if (proj?.vendor_id) {
    await createNotification({
      userId: proj.vendor_id,
      type: 'warning',
      title: `JSA Ditolak ${penolak} — Perlu Perbaikan`,
      message: `JSA untuk proyek "${proj.name}" ditolak oleh ${penolak}. Catatan: "${note}". Harap perbaiki dan ajukan ulang.`,
      link: `/vendor/dashboard/projects/${jsa?.project_id}`,
    });
  }
  revalidatePath('/dashboard/approval');
}
```

Note: `rejectJsa` reverts JSA status to `reviewPgsol` regardless of which
stage rejected (existing behavior, unchanged) — but only resets the
`stage_assignments` rows for the stage that actually rejected
(`stageKey`), not both stages. If PGN rejects, PGSOL's already-completed
`review_pgsol` assignment rows stay `'approved'` (they don't need to
re-review — the document goes back to `reviewPgsol` status only because
that's the vendor's resubmission entry point, but the PGSOL sign-off from
before the PGN rejection is not being second-guessed by this change). This
matches current single-actor behavior where `reviewer_id` is cleared on
ANY reject (line `reviewer_id: null` above, from the original code) — so
actually for consistency, re-check this against the spec: the spec says
"reset every assignment row for that (project, doc_type, stage_key)" for
the stage that rejected, and the existing code already clears BOTH
`reviewer_id` and `approver_id` on any reject (full restart). Since the
document status also fully resets to `reviewPgsol`, the PGSOL stage will
run again too — so `resetStageAssignments` should additionally be called
for `'jsa.review_pgsol'` when the rejecting stage was `'jsa.approve_pgn'`,
to keep `stage_assignments` consistent with the document restarting from
PGSOL. Add this: after the `resetStageAssignments(supabase,
current.project_id, 'jsa', stageKey)` call above, if `stageKey ===
'jsa.approve_pgn'`, also call `await resetStageAssignments(supabase,
current.project_id, 'jsa', 'jsa.review_pgsol')`.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit -p .
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/approval/actions.ts
git commit -m "Rewrite JSA approve/reject for per-project multi-signature assignment"
```

---

### Task 7: Rewrite PTW approve/reject

**Files:**
- Modify: `app/dashboard/approval/actions.ts`

**Interfaces:**
- Consumes: same helpers as Tasks 5-6.
- Produces: `approvePtw`/`rejectPtw` assignment-gated, three-stage. This is the last caller of `requirePermission`/`notifyUsersByPermission` in this file — clean up those imports if nothing else uses them (grep the file first to confirm).

- [ ] **Step 1: Rewrite `approvePtw`**

Replace the existing function body (currently
`app/dashboard/approval/actions.ts:410-515`) with:

```ts
export async function approvePtw(ptwId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: current } = await supabase.from('ptw').select('status, authority_id, issuer_id, project_id').eq('id', ptwId).single();
  if (!current?.project_id) throw new Error("PTW ini tidak terhubung ke proyek.");

  let stageKey = '';
  let updatePayloadIfComplete: any = {};

  if (current.status === PTW_STATUS.menungguApprovalPM) {
    stageKey = 'ptw.approve_pm';
    updatePayloadIfComplete = { authority_id: user.id, authority_approved_at: new Date().toISOString(), status: PTW_STATUS.reviewPtwIssuer };
  } else if (current.status === PTW_STATUS.reviewPtwIssuer) {
    stageKey = 'ptw.review_issuer';
    requireDistinctApprover(current.authority_id, user.id, "PTW Authority (PM)");
    updatePayloadIfComplete = { issuer_id: user.id, issuer_approved_at: new Date().toISOString(), status: PTW_STATUS.menungguPenomoranHSSE };
  } else if (current.status === PTW_STATUS.menungguPenomoranHSSE) {
    stageKey = 'ptw.numbering_hsse';
    requireDistinctApprover(current.authority_id, user.id, "PTW Authority (PM)");
    requireDistinctApprover(current.issuer_id, user.id, "PTW Issuer");
  } else {
    throw new Error("PTW tidak dalam tahap yang bisa disetujui.");
  }

  const rows = await getStageAssignments(supabase, current.project_id, 'ptw', stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk tahap PTW ini pada proyek ini.");

  await supabase.from('stage_assignments').update({ status: 'approved', decided_at: new Date().toISOString() }).eq('id', myRow.id);

  // Re-fetch (bukan patch lokal dari `rows` yang sudah basi) — lihat catatan
  // yang sama di Task 5/6: dua approver terakhir yang approve nyaris
  // bersamaan bisa sama-sama melihat snapshot awal yang belum mencatat
  // approval satu sama lain kalau ini pakai patch lokal, sehingga PTW bisa
  // macet permanen walau di DB semua baris sudah approved.
  const freshRows = await getStageAssignments(supabase, current.project_id, 'ptw', stageKey);
  if (!isStageFullyApproved(freshRows)) {
    revalidatePath('/dashboard/approval');
    return;
  }

  if (stageKey === 'ptw.numbering_hsse') {
    const year = new Date().getFullYear();
    const { count } = await supabase.from('ptw').select('*', { count: 'exact', head: true }).like('ptw_number', `PTW-${year}-%`);
    const nextNum = String((count || 0) + 1).padStart(3, '0');
    updatePayloadIfComplete = { hsse_id: user.id, ptw_number: `PTW-${year}-${nextNum}`, status: PTW_STATUS.aktif };
  }

  // .eq('status', current.status) tetap jadi optimistic lock terakhir:
  // kalau dua orang yang sama-sama assignee terakhir suatu tahap
  // menyelesaikan approval mereka nyaris bersamaan, hanya satu yang boleh
  // memajukan status dokumen (dan menomori PTW). Unique index pada
  // ptw_number tetap jaring pengaman lapis kedua.
  const { data: updated, error } = await supabase
    .from('ptw')
    .update(updatePayloadIfComplete)
    .eq('id', ptwId)
    .eq('status', current.status)
    .select('id');
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) {
    throw new Error("PTW ini baru saja diproses oleh pengguna lain. Muat ulang halaman untuk melihat status terbaru.");
  }

  const { data: ptw } = await supabase.from('ptw').select('project_id, status, ptw_number, projects ( name, vendor_id )').eq('id', ptwId).single();
  const proj: any = Array.isArray(ptw?.projects) ? ptw?.projects[0] : ptw?.projects;

  if (ptw?.project_id) {
    const stageAction = updatePayloadIfComplete.status === PTW_STATUS.aktif
      ? `Nomor PTW Diterbitkan & Aktif (${updatePayloadIfComplete.ptw_number})`
      : updatePayloadIfComplete.status === PTW_STATUS.reviewPtwIssuer
        ? 'Disetujui PTW Authority (PM)'
        : 'Disetujui PTW Issuer';
    await logDocumentEvent(supabase, {
      docType: 'ptw', docId: ptwId, projectId: ptw.project_id, actorId: user.id,
      action: stageAction,
    });
  }

  if (proj?.vendor_id) {
    const isPtwActive = ptw?.status === PTW_STATUS.aktif;
    await createNotification({
      userId: proj.vendor_id,
      type: isPtwActive ? 'approval' : 'info',
      title: isPtwActive ? `PTW Diterbitkan: ${ptw?.ptw_number}` : `PTW: Tahap ${ptw?.status}`,
      message: isPtwActive
        ? `Selamat! PTW ${ptw?.ptw_number} untuk proyek "${proj.name}" telah aktif. Pekerjaan bisa dimulai.`
        : `PTW untuk proyek "${proj.name}" telah memasuki tahap ${ptw?.status}.`,
      link: `/vendor/dashboard/projects/${ptw?.project_id}`,
    });
  }

  if (updatePayloadIfComplete.status === PTW_STATUS.reviewPtwIssuer) {
    await notifyAssignees({
      projectId: ptw!.project_id, docType: 'ptw', stageKey: 'ptw.review_issuer',
      type: 'action_required', title: 'PTW Menunggu Review Issuer',
      message: `PTW untuk proyek "${proj?.name}" telah disetujui PTW Authority dan menunggu review Anda.`,
      link: `/dashboard/projects/${ptw?.project_id}`,
    });
  } else if (updatePayloadIfComplete.status === PTW_STATUS.menungguPenomoranHSSE) {
    await notifyAssignees({
      projectId: ptw!.project_id, docType: 'ptw', stageKey: 'ptw.numbering_hsse',
      type: 'action_required', title: 'PTW Menunggu Penomoran HSSE',
      message: `PTW untuk proyek "${proj?.name}" telah direview PTW Issuer dan menunggu penomoran Anda.`,
      link: `/dashboard/projects/${ptw?.project_id}`,
    });
  }

  if (updatePayloadIfComplete.status === PTW_STATUS.aktif) {
    const { data: jsaData } = await supabase.from('jsa').select('reviewer_id').eq('project_id', ptw?.project_id).single();
    if (jsaData?.reviewer_id) {
      await supabase.from('projects').update({ assigned_inspector: jsaData.reviewer_id }).eq('id', ptw?.project_id);
      await createNotification({
        userId: jsaData.reviewer_id,
        type: 'info',
        title: 'Tugas Pengawasan Baru',
        message: `PTW ${updatePayloadIfComplete.ptw_number} telah diterbitkan. Anda ditugaskan sebagai pengawas utama.`,
        link: '/dashboard/my-task'
      });
    }
  }
  revalidatePath('/dashboard/approval');
}
```

- [ ] **Step 2: Rewrite `rejectPtw`**

Replace the existing function body (currently
`app/dashboard/approval/actions.ts:517` onward — read the file to find
where it ends, since it wasn't fully shown during planning research) with
the same pattern as `rejectProcedure`/`rejectJsa`: resolve
`current.project_id` and the stage's `stageKey` from `current.status`
(`menungguApprovalPM` → `ptw.approve_pm`, `reviewPtwIssuer` →
`ptw.review_issuer`, `menungguPenomoranHSSE` → `ptw.numbering_hsse`), find
`myRow` via `getStageAssignments`, mark it `rejected` with the note, call
`resetStageAssignments` for that `stageKey`, then apply the EXISTING
status/field-reset update (`status: PTW_STATUS.draft, rejection_note:
note, authority_id: null, authority_approved_at: null, issuer_id: null,
issuer_approved_at: null` — read the current function body first to copy
the exact update payload and the notification logic that follows it,
since only the permission-check portion at the top changes; the specific
notification message strings after the update are unaffected by this
task and must be preserved verbatim). Since rejecting at any of PTW's 3
stages reverts all the way to Draft (unlike JSA, which only reverts to its
first stage), also call `resetStageAssignments` for the OTHER two PTW
stage keys the rejected one didn't cover, so all three are `pending`
again when the vendor resubmits (mirroring the `savePtw` resubmission
flow already resetting the document to `menungguApprovalPM`).

- [ ] **Step 3: Clean up now-unused imports**

Grep the file for remaining uses of `requirePermission`,
`notifyUsersByPermission`, `PROCEDURE_STAGE_PERMISSION`,
`JSA_STAGE_PERMISSION`, `PTW_STAGE_PERMISSION`. If none remain (expected,
since this task is the last of the three doc-type rewrites), remove their
imports and the now-dead `requirePermission` function definition itself
(`app/dashboard/approval/actions.ts:170-175` per the pre-task line
numbers — re-locate it after your edits, line numbers will have shifted).
Do NOT remove `requireDistinctApprover` — it's still used throughout.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p .
```

Expected: passes clean, no unused-import warnings (this repo's `tsc`
config may or may not flag unused imports as errors — if it doesn't,
still remove them for cleanliness per Step 3).

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/approval/actions.ts
git commit -m "Rewrite PTW approve/reject for per-project multi-signature assignment"
```

---

### Task 8: Rewrite `getMyTasks` filtering

**Files:**
- Modify: `app/dashboard/my-task/actions.ts`

**Interfaces:**
- Consumes: `stage_assignments` table (Task 1).
- Produces: task-list entries now come from "do I have a pending assignment row for this document's project+stage," not "do I hold this permission."

- [ ] **Step 1: Replace the Procedure/JSA/PTW sections' filtering logic**

The three blocks (`app/dashboard/my-task/actions.ts:62-171` per the
pre-task line numbers) each currently gate on `can(module, action)` (a
permission check) before/while iterating documents. Replace this
approach: instead of checking permission then fetching ALL pending
documents of that type, fetch the current user's `pending`
`stage_assignments` rows first, then only fetch/list documents whose
`(project_id, doc_type, stage_key)` matches one of those rows. Concretely,
replace the Procedure block with:

```ts
  // 1. Fetch Procedures — hanya proyek yang stage_assignments-nya
  // menugaskan user ini ke procedure.review dengan status pending.
  {
    const { data: myAssignments } = await supabase
      .from('stage_assignments')
      .select('project_id')
      .eq('doc_type', 'procedure').eq('stage_key', 'procedure.review')
      .eq('assignee_id', user.id).eq('status', 'pending');
    const projectIds = (myAssignments || []).map((a: any) => a.project_id);

    if (projectIds.length > 0) {
      const { data: procedures } = await supabase
        .from('procedures')
        .select(`
          id, status, created_at, project_id,
          projects ( name, vendor_profiles ( company_name ) )
        `)
        .in('project_id', projectIds)
        .in('status', ['Submitted', PROCEDURE_STATUS.menungguReviewPM, PROCEDURE_STATUS.draft]);

      if (procedures) {
        procedures.forEach((proc: any) => {
          const proj = Array.isArray(proc.projects) ? proc.projects[0] : proc.projects;
          const vendor = proj?.vendor_profiles;
          const companyName = Array.isArray(vendor) ? vendor[0]?.company_name : vendor?.company_name;
          tasks.push({
            id: proc.id, title: `Review Prosedur Kerja`, type: 'Prosedur',
            projectName: proj?.name || 'Unknown Project', vendorName: companyName || 'Internal',
            date: proc.created_at, url: `/dashboard/projects/${proc.project_id}`,
            status: proc.status, urgency: getUrgency(proc.created_at),
            timeInQueue: formatTimeInQueue(proc.created_at)
          });
        });
      }
    }
  }
```

Apply the same restructuring to the JSA block (query `stage_assignments`
for `doc_type = 'jsa'` and BOTH `stage_key IN ('jsa.review_pgsol',
'jsa.approve_pgn')` in one query, then match each fetched `jsa` row's
CURRENT `status` to the matching `stage_key` — `JSA_STAGE_PERMISSION`'s
existing `status → {module,action}` mapping tells you which `stage_key`
corresponds to which JSA status, reuse that lookup table purely for the
status-to-stage_key translation, not for permission checking; keep the
existing `sudahDireviewOlehSaya` self-review exclusion logic unchanged)
and to the PTW block (same pattern, `PTW_STAGE_PERMISSION`'s keys give you
the three `stage_key` values to match against `ptw.status`). The
`can()`/`permissions` variable and its `getUserPermissionsForUser` call
(lines 44-60 per pre-task numbering) become unused once all three blocks
are converted — remove them, but leave the Incident block's `role ===
'admin' || role === 'hse'` check and the Monitoring block entirely
untouched (neither uses the permission-pool pattern this task replaces).

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit -p .
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/my-task/actions.ts
git commit -m "Rewrite getMyTasks to filter by stage_assignments instead of permission pool"
```

---

### Task 9: PGN assignment UI

**Files:**
- Modify: `app/dashboard/master-data/project/actions.ts`
- Create: `app/dashboard/master-data/project/[id]/AssignmentPanel.tsx`
- Modify: `app/dashboard/master-data/project/[id]/page.tsx`

**Interfaces:**
- Consumes: `getStageAssignments`/`getEligibleAssignees`/`writeStageAssignment`/`PGN_STAGE_KEYS` (Task 3).
- Produces: a working assignment UI for all 5 PGN stage-slots on the existing project detail page.

- [ ] **Step 1: Add `saveStageAssignment` to `app/dashboard/master-data/project/actions.ts`**

Read the file first — it already has `requireManageProject`-equivalent
gating (per earlier research, `hasPermissionForUser(supabase, user.id,
'masterData', 'manage_project')` at line 12 inside some existing guard
function; confirm its exact name before reusing it). Add:

```ts
import { writeStageAssignment, PGN_STAGE_KEYS } from '@/lib/stage-assignments';

export async function saveStageAssignment(projectId: string, stageKey: string, assigneeIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const allowed = await hasPermissionForUser(supabase, user.id, 'masterData', 'manage_project');
  if (!allowed) return { error: 'Anda tidak memiliki izin untuk mengelola assignment proyek.' };

  if (!(PGN_STAGE_KEYS as readonly string[]).includes(stageKey)) {
    return { error: 'Tahap ini bukan tahap yang dikelola admin PGN.' };
  }

  const result = await writeStageAssignment(supabase, user.id, { projectId, docType: stageKey.split('.')[0], stageKey, assigneeIds });
  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/master-data/project/${projectId}`);
  return { success: true };
}
```

(`stageKey.split('.')[0]` derives `doc_type` from the stage key —
`'procedure.review'` → `'procedure'`, `'ptw.approve_pm'` → `'ptw'`,
`'jsa.approve_pgn'` → `'jsa'` — matches the `doc_type` values already used
throughout Tasks 5-7 and the `stage_assignments` schema.)

- [ ] **Step 2: Create `AssignmentPanel.tsx`**

A client component rendering the 5 PGN stage-slots. Fetch eligible
candidates and current assignments server-side in `page.tsx` (Step 3) and
pass them as props — this component only handles the multi-select UI and
calls `saveStageAssignment` on save, following the existing modal/form
patterns already used elsewhere in `app/dashboard/master-data/account/`
(checkbox list + save button, no need for a full modal since this renders
inline on the page, not as an overlay):

```tsx
'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { saveStageAssignment } from '../actions';

interface Candidate { id: string; full_name: string; }
interface StageSlot {
  stageKey: string;
  label: string;
  candidates: Candidate[];
  currentAssigneeIds: string[];
  locked: boolean; // true kalau ada baris non-pending, tidak bisa diedit
}

export default function AssignmentPanel({ projectId, slots }: { projectId: string; slots: StageSlot[] }) {
  const [selections, setSelections] = useState<Record<string, string[]>>(
    Object.fromEntries(slots.map(s => [s.stageKey, s.currentAssigneeIds]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [savedStageKey, setSavedStageKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(stageKey: string) {
    setSaving(stageKey);
    setError(null);
    const result = await saveStageAssignment(projectId, stageKey, selections[stageKey] || []);
    setSaving(null);
    if (result.error) {
      setError(result.error);
    } else {
      setSavedStageKey(stageKey);
      setTimeout(() => setSavedStageKey(null), 2000);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>
      )}
      {slots.map(slot => (
        <div key={slot.stageKey} className="border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-800">{slot.label}</h4>
            {slot.locked && (
              <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Sedang diproses — terkunci</span>
            )}
          </div>
          <div className="space-y-2">
            {slot.candidates.length === 0 && (
              <p className="text-xs text-slate-400">Tidak ada staff dengan izin untuk tahap ini.</p>
            )}
            {slot.candidates.map(c => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  disabled={slot.locked}
                  checked={(selections[slot.stageKey] || []).includes(c.id)}
                  onChange={(e) => {
                    setSelections(prev => {
                      const cur = prev[slot.stageKey] || [];
                      return {
                        ...prev,
                        [slot.stageKey]: e.target.checked ? [...cur, c.id] : cur.filter(id => id !== c.id),
                      };
                    });
                  }}
                />
                {c.full_name}
              </label>
            ))}
          </div>
          {!slot.locked && (
            <button
              onClick={() => handleSave(slot.stageKey)}
              disabled={saving === slot.stageKey}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
            >
              {saving === slot.stageKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : savedStageKey === slot.stageKey ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
              Simpan
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Wire into `page.tsx`**

In `app/dashboard/master-data/project/[id]/page.tsx`, add the fetch logic
and render `AssignmentPanel` as a new section after the existing Timeline
section (before the closing `</div>` of the right column, around what was
line 172 in the pre-task file). Add:

```tsx
import AssignmentPanel from './AssignmentPanel';
import { getStageAssignments, getEligibleAssignees, PGN_STAGE_KEYS } from '@/lib/stage-assignments';

const STAGE_LABELS: Record<string, string> = {
  'procedure.review': 'Review Prosedur Kerja (PM)',
  'jsa.approve_pgn': 'Persetujuan JSA (PGN)',
  'ptw.approve_pm': 'Approval PTW — PTW Authority (PM)',
  'ptw.review_issuer': 'Review PTW — PTW Issuer',
  'ptw.numbering_hsse': 'Penomoran PTW (HSSE)',
};

const STAGE_PERMISSION_LOOKUP: Record<string, { module: string; action: string }> = {
  'procedure.review': { module: 'procedure', action: 'review' },
  'jsa.approve_pgn': { module: 'jsa', action: 'approve_pgn' },
  'ptw.approve_pm': { module: 'ptw', action: 'approve_pm' },
  'ptw.review_issuer': { module: 'ptw', action: 'review_issuer' },
  'ptw.numbering_hsse': { module: 'ptw', action: 'numbering_hsse' },
};
```

Inside `EditProjectPage`, after the existing `project`/`vendors` fetches,
add:

```tsx
  const slots = await Promise.all(PGN_STAGE_KEYS.map(async (stageKey) => {
    const docType = stageKey.split('.')[0];
    const [candidates, assignments] = await Promise.all([
      getEligibleAssignees(supabase, STAGE_PERMISSION_LOOKUP[stageKey].module, STAGE_PERMISSION_LOOKUP[stageKey].action),
      getStageAssignments(supabase, projectId, docType, stageKey),
    ]);
    return {
      stageKey,
      label: STAGE_LABELS[stageKey],
      candidates,
      currentAssigneeIds: assignments.map(a => a.assignee_id),
      locked: assignments.some(a => a.status !== 'pending'),
    };
  }));
```

Then render, as a new section following the same header/card style as
"Seksi 3: Timeline Proyek" above it in the same file:

```tsx
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-6 pt-6 border-t border-slate-100">
                <Users className="w-5 h-5 text-primary" />
                Assignment Approval PGN
              </h2>
              <AssignmentPanel projectId={project.id} slots={slots} />
```

(`Users` icon is already imported in this file per the existing import
line — confirm before assuming, add it to the import list if not.)

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p .
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/master-data/project/actions.ts app/dashboard/master-data/project/[id]/AssignmentPanel.tsx app/dashboard/master-data/project/[id]/page.tsx
git commit -m "Add PGN approver assignment UI to project detail page"
```

---

### Task 10: PGSOL assignment UI

**Files:**
- Create: `app/pgsol/dashboard/projects/page.tsx`
- Create: `app/pgsol/dashboard/projects/actions.ts`
- Create: `app/pgsol/dashboard/projects/[id]/assign/page.tsx`
- Modify: `app/pgsol/dashboard/layout.tsx`

**Interfaces:**
- Consumes: `getStageAssignments`/`getEligibleAssignees`/`writeStageAssignment` (Task 3), `jsa.manage_assignment_pgsol` permission (Task 2).
- Produces: a PGSOL-side project list + single-slot assignment page, mirroring Task 9's PGN pattern at 1/5th the scope.

- [ ] **Step 1: `app/pgsol/dashboard/projects/actions.ts`**

```ts
'use server';

import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { writeStageAssignment } from '@/lib/stage-assignments';
import { revalidatePath } from 'next/cache';

export async function getPgsolProjects() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id, name, status, created_at,
      vendor_profiles ( company_name ),
      jsa ( id, status )
    `)
    .order('created_at', { ascending: false });
  if (error) { console.error('getPgsolProjects error:', error.message); return []; }
  // Hanya proyek yang sudah punya JSA (tahap PGSOL baru relevan sejak JSA diajukan).
  return (data || []).filter((p: any) => {
    const jsaRows = Array.isArray(p.jsa) ? p.jsa : (p.jsa ? [p.jsa] : []);
    return jsaRows.length > 0;
  });
}

export async function savePgsolAssignment(projectId: string, assigneeIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const allowed = await hasPermissionForUser(supabase, user.id, 'jsa', 'manage_assignment_pgsol');
  if (!allowed) return { error: 'Anda tidak memiliki izin untuk menunjuk reviewer PGSOL.' };

  const result = await writeStageAssignment(supabase, user.id, {
    projectId, docType: 'jsa', stageKey: 'jsa.review_pgsol', assigneeIds,
  });
  if (result.error) return { error: result.error };

  revalidatePath(`/pgsol/dashboard/projects/${projectId}/assign`);
  return { success: true };
}
```

- [ ] **Step 2: `app/pgsol/dashboard/projects/page.tsx`**

```tsx
import Link from 'next/link';
import { getPgsolProjects } from './actions';

export default async function PgsolProjectsPage() {
  const projects = await getPgsolProjects();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Proyek</h1>
        <p className="text-sm text-slate-500 mt-1">Kelola siapa yang mereview JSA tahap PGSOL untuk tiap proyek.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Proyek</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor</th>
              <th className="relative px-6 py-4"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {projects.map((p: any) => {
              const vendor = Array.isArray(p.vendor_profiles) ? p.vendor_profiles[0] : p.vendor_profiles;
              return (
                <tr key={p.id} className="hover:bg-slate-50/80">
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">{p.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{vendor?.company_name || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/pgsol/dashboard/projects/${p.id}/assign`} className="text-primary text-sm font-semibold hover:underline">
                      Kelola Reviewer
                    </Link>
                  </td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr><td colSpan={3} className="px-6 py-12 text-center text-sm text-slate-500">Belum ada proyek dengan JSA diajukan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `app/pgsol/dashboard/projects/[id]/assign/page.tsx`**

```tsx
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { getStageAssignments, getEligibleAssignees } from '@/lib/stage-assignments';
import AssignPgsolPanel from './AssignPgsolPanel';

export default async function PgsolAssignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase.from('projects').select('id, name').eq('id', projectId).single();
  const [candidates, assignments] = await Promise.all([
    getEligibleAssignees(supabase, 'jsa', 'review_pgsol'),
    getStageAssignments(supabase, projectId, 'jsa', 'jsa.review_pgsol'),
  ]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/pgsol/dashboard/projects" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reviewer PGSOL — {project?.name}</h1>
          <p className="text-sm text-slate-500 mt-1">Semua yang ditunjuk di sini harus menyetujui sebelum JSA lanjut ke tahap PGN.</p>
        </div>
      </div>
      <AssignPgsolPanel
        projectId={projectId}
        candidates={candidates}
        currentAssigneeIds={assignments.map(a => a.assignee_id)}
        locked={assignments.some(a => a.status !== 'pending')}
      />
    </div>
  );
}
```

- [ ] **Step 4: `app/pgsol/dashboard/projects/[id]/assign/AssignPgsolPanel.tsx`**

Same shape as Task 9's `AssignmentPanel.tsx`, but for a single stage
(no `slots` array — just one candidate list, one checkbox group, one save
button calling `savePgsolAssignment(projectId, selectedIds)` from
`../../actions`):

```tsx
'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { savePgsolAssignment } from '../../actions';

interface Candidate { id: string; full_name: string; }

export default function AssignPgsolPanel({
  projectId, candidates, currentAssigneeIds, locked,
}: {
  projectId: string; candidates: Candidate[]; currentAssigneeIds: string[]; locked: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(currentAssigneeIds);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await savePgsolAssignment(projectId, selected);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
      {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>}
      {locked && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          Tahap ini sedang diproses — assignment terkunci sampai ditolak/diajukan ulang.
        </div>
      )}
      <div className="space-y-2">
        {candidates.length === 0 && <p className="text-sm text-slate-400">Tidak ada staff PGSOL dengan izin review JSA.</p>}
        {candidates.map(c => (
          <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              disabled={locked}
              checked={selected.includes(c.id)}
              onChange={(e) => setSelected(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))}
            />
            {c.full_name}
          </label>
        ))}
      </div>
      {!locked && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : null}
          Simpan
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add nav link in `app/pgsol/dashboard/layout.tsx`**

Add, after the existing "Review JSA" link (`app/pgsol/dashboard/layout.tsx:23-25`):

```tsx
          <Link href="/pgsol/dashboard/projects" className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            Proyek Saya
          </Link>
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit -p .
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add app/pgsol/dashboard/projects app/pgsol/dashboard/layout.tsx
git commit -m "Add PGSOL approver assignment UI"
```

---

### Task 11: Final verification

**Files:**
- Create: `supabase/README_stage_assignment_migration_order.md`

**Interfaces:**
- Consumes: everything from Tasks 1-10.
- Produces: a full clean `tsc`/`build` run and a manual verification checklist covering the multi-signature/veto behavior no automated test can cover.

- [ ] **Step 1: Full type-check and build**

```bash
npx tsc --noEmit -p .
npm run build
```

Expected: zero errors, all routes (including
`/pgsol/dashboard/projects`, `/pgsol/dashboard/projects/[id]/assign`)
registered.

- [ ] **Step 2: Write the migration + verification checklist**

```markdown
# Urutan Migrasi Fase 2 — Per-Project Approver Assignment

Jalankan di Supabase SQL editor, SATU PER SATU, setelah semua migrasi
Fase 1 (`supabase/README_org_migration_order.md`) sudah dijalankan:

1. `schema_stage_assignments.sql`
2. `schema_stage_assignment_permissions.sql`

## Verifikasi manual

- [ ] Sebagai admin PGN, buka detail proyek, assign 2 orang ke tahap
      "Persetujuan JSA (PGN)". Simpan — pastikan checkbox terkunci untuk
      tahap yang sudah punya assignment aktif hanya SETELAH salah satu
      approve, bukan langsung setelah disimpan.
- [ ] Sebagai admin PGSOL, buka `/pgsol/dashboard/projects`, assign 2
      reviewer ke satu proyek. Approve sebagai reviewer pertama — status
      JSA proyek itu harus TETAP di "Review PGSOL" (belum semua approve).
      Approve sebagai reviewer kedua — status harus maju ke "Persetujuan
      PGN", dan kedua PGN approver yang ditugaskan harus menerima
      notifikasi.
- [ ] Reject JSA sebagai salah satu dari 2 approver PGN yang ditugaskan —
      status harus langsung balik ke Draft (tidak menunggu approver PGN
      kedua memutuskan), dan SEMUA baris assignment tahap PGSOL maupun PGN
      untuk JSA itu harus kembali ke `pending`.
- [ ] Proyek dengan 0 orang ditugaskan ke `ptw.approve_pm` — pastikan PTW
      tidak bisa di-approve sama sekali (pesan error jelas, bukan crash).
- [ ] Login sebagai seseorang yang ditugaskan sebagai reviewer JSA tahap
      PGSOL — pastikan tugas itu muncul di `/dashboard/my-task`, dan
      TIDAK muncul di situ untuk staff lain yang punya permission
      `jsa.review_pgsol` yang sama tapi tidak ditugaskan ke proyek ini.
- [ ] Konfirmasi `requireDistinctApprover` masih mencegah 1 orang yang
      kebetulan ditugaskan ke `ptw.approve_pm` DAN `ptw.review_issuer`
      pada proyek yang sama dari menyetujui kedua tahap itu sendirian.
```

- [ ] **Step 3: Commit**

```bash
git add supabase/README_stage_assignment_migration_order.md
git commit -m "Add Fase 2 migration order and manual verification checklist"
```

---

## Self-Review Notes

- **Spec coverage:** data model, RLS split (coarse-in-SQL /
  fine-in-TypeScript), veto-reject semantics, PGN and PGSOL assignment
  UIs, `requireDistinctApprover` preservation, and the multi-signature
  gate on every approve action are each covered by a task above.
- **Placeholder scan:** Task 7's `rejectPtw` step intentionally describes
  a pattern to follow (copy the existing update payload/notification
  logic) rather than giving verbatim code, because that function's exact
  current body wasn't read in full during planning — this is flagged
  explicitly in the step text as something the implementer must read
  first, not a silently skipped requirement. Every other task gives
  complete code.
- **Type consistency:** `getStageAssignments`/`writeStageAssignment`/
  `isStageFullyApproved`/`resetStageAssignments`/`getEligibleAssignees`/
  `PGN_STAGE_KEYS` (Task 3) are defined once and only ever imported by
  Tasks 4-10, never redeclared. `StageAssignmentRow`'s `status` union
  (`'pending' | 'approved' | 'rejected'`) is used consistently everywhere
  a row's status is compared.
- **Known follow-up embedded in Task 6:** the JSA reject handler needs an
  extra `resetStageAssignments` call for the PGSOL stage when PGN is the
  one rejecting, since the document fully restarts from `reviewPgsol` —
  this is spelled out inline in Task 6 rather than left implicit, since a
  reviewer or implementer skimming just the "replace this function" code
  block could otherwise miss it.
