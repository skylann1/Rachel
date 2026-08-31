# Prosedur Kerja PGSOL Gate + Stage-Assignment-Aware Approval UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Prosedur Kerja a third approval gate (vendor → PGSOL → PGN, matching JSA's existing pattern), fix a live bug in JSA's reject flow, and make the internal approval UI gate buttons on actual `stage_assignments` rows instead of raw permission — with a multi-signature progress indicator — across all three document types.

**Architecture:** Everything reuses the existing `stage_assignments` table and helpers from `lib/stage-assignments.ts` (no schema change). Server Components fetch assignment rows and pass them as props to the existing client components; no new client-side data fetching is introduced.

**Tech Stack:** Next.js App Router, Server Actions, Supabase (Postgres + RLS), TypeScript, Tailwind CSS, lucide-react.

**Spec:** `docs/superpowers/specs/2026-08-31-procedure-pgsol-gate-and-approval-ui-design.md`

## Global Constraints

- No schema changes. No new tables, no new columns. Everything is a new `stage_key` value (`procedure.review_pgsol`) plus code changes.
- No RLS policy changes — the existing `"Internal users can write stage assignments"` policy (`is_internal_user()`, covers PGN + PGSOL) already permits writes to any new `stage_key` value under `procedure`.
- Permission `jsa.manage_assignment_pgsol` stays exactly as-is and is reused (not renamed, not replaced) to gate "who may assign PGSOL reviewers" for *both* `jsa` and `procedure` — do not introduce a new permission for this. This is a deliberate migration-safety decision (see spec).
- `Menunggu Review PM` keeps its existing label — do not rename it to match JSA's "Persetujuan PGN" wording.
- Migrations for Fase 1-3 are already live in production — any new migration SQL must be additive/idempotent (guarded with `NOT ... ? 'key'` checks), matching the pattern in `supabase/schema_vendor_review_permissions.sql`.
- Verification throughout: `npx tsc --noEmit -p .` (no test runner exists in this repo — see repo conventions). Run `npm run build` at the end of the plan (Task 11), not after every task, to avoid redundant full builds.

---

### Task 1: Add `Review PGSOL` status to Prosedur Kerja

**Files:**
- Modify: `lib/procedure-status.ts` (whole file — it's 44 lines)

**Interfaces:**
- Produces: `PROCEDURE_STATUS.reviewPgsol` (string constant `'Review PGSOL'`), used by Tasks 5, 6, 9, 10.
- Produces: `PROCEDURE_STAGE_PERMISSION['Review PGSOL']` → `{ module: 'procedure', action: 'review_pgsol' }`, used by Tasks 6, 9, 10.

- [ ] **Step 1: Replace the whole file**

```typescript
/**
 * Alur persetujuan Prosedur Kerja — vendor -> PGSOL -> PGN, sama polanya
 * dengan JSA.
 *
 *   Draft -> Review Internal Vendor -> Review PGSOL -> Menunggu Review PM -> Prosedur Disetujui
 *
 * Review Internal Vendor tidak pernah nyampe pihak PGN/PGSOL — staff vendor
 * sendiri (ditugaskan admin vendor per proyek, lihat Fase 3) harus
 * menyetujui dulu sebelum PGSOL melihatnya. Review PGSOL: verifikasi teknis
 * sebelum diteruskan ke PM (PGN) untuk persetujuan akhir. Reject di tahap
 * manapun mengembalikan status ke Draft; vendor merevisi lalu mengajukan
 * ulang (balik ke Review Internal Vendor).
 */

export const PROCEDURE_STATUS = {
  draft: 'Draft',
  reviewInternalVendor: 'Review Internal Vendor',
  reviewPgsol: 'Review PGSOL',
  menungguReviewPM: 'Menunggu Review PM',
  approved: 'Prosedur Disetujui',
} as const;

/**
 * Status yang berarti Prosedur sedang menunggu tindakan pihak INTERNAL
 * (PGN/PGSOL) — dipakai untuk /dashboard/my-task. `reviewInternalVendor`
 * SENGAJA tidak masuk sini: tahap itu menunggu staff vendor sendiri, bukan
 * pihak internal, dan tidak boleh muncul di task list internal.
 */
export const PROCEDURE_PENDING_STATUSES: string[] = [
  PROCEDURE_STATUS.reviewPgsol,
  PROCEDURE_STATUS.menungguReviewPM,
];

export function isProcedurePending(status: string | null | undefined): boolean {
  return !!status && PROCEDURE_PENDING_STATUSES.includes(status);
}

/**
 * Permission yang berhak bertindak pada tiap tahap — dicocokkan lewat
 * roles.permissions (lihat utils/permissions.ts), bukan role slug yang
 * di-hardcode. Siapa pun boleh dikasih permission dari halaman Role &
 * Permission, tidak harus role bernama persis tertentu.
 */
export const PROCEDURE_STAGE_PERMISSION: Record<string, { module: string; action: string }> = {
  [PROCEDURE_STATUS.reviewPgsol]: { module: 'procedure', action: 'review_pgsol' },
  [PROCEDURE_STATUS.menungguReviewPM]: { module: 'procedure', action: 'review' },
};
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no new errors referencing `procedure-status.ts` (other files that import `PROCEDURE_STATUS`/`PROCEDURE_STAGE_PERMISSION` still compile since only new keys were added, nothing removed).

- [ ] **Step 3: Commit**

```bash
git add lib/procedure-status.ts
git commit -m "Add Review PGSOL status to Prosedur Kerja flow"
```

---

### Task 2: Register the new stage key in `lib/stage-assignments.ts`

**Files:**
- Modify: `lib/stage-assignments.ts:23-89`

**Interfaces:**
- Consumes: nothing new.
- Produces: `PGSOL_STAGE_KEYS` (new exported const, `readonly string[]`), used by Task 7. `STAGE_KEY_PERMISSION['procedure.review_pgsol']`, used by `writeStageAssignment` (already generic) and by Task 9/10 indirectly via `getStageAssignments`.

- [ ] **Step 1: Add `PGSOL_STAGE_KEYS` and extend `STAGE_KEY_PERMISSION`**

Insert this new constant right after the existing `VENDOR_STAGE_KEYS` block (after line 37, before `export async function getStageAssignments`):

```typescript
/** Kedua stage_key yang ditugaskan admin PGSOL — dipakai untuk membatasi apa yang boleh disimpan lewat savePgsolAssignment (jsa.manage_assignment_pgsol). */
export const PGSOL_STAGE_KEYS = [
  'jsa.review_pgsol',
  'procedure.review_pgsol',
] as const;
```

Then edit the `STAGE_KEY_PERMISSION` object to add one entry. Find:

```typescript
export const STAGE_KEY_PERMISSION: Record<string, { module: string; action: string }> = {
  'procedure.review_vendor': { module: 'procedure', action: 'review_vendor' },
  'procedure.review': { module: 'procedure', action: 'review' },
```

Replace with:

```typescript
export const STAGE_KEY_PERMISSION: Record<string, { module: string; action: string }> = {
  'procedure.review_vendor': { module: 'procedure', action: 'review_vendor' },
  'procedure.review_pgsol': { module: 'procedure', action: 'review_pgsol' },
  'procedure.review': { module: 'procedure', action: 'review' },
```

(Everything else in the file — `getStageAssignments`, `getEligibleAssignees`, `writeStageAssignment`, `isStageFullyApproved`, `resetStageAssignments` — is unchanged; they're already generic over `stageKey`.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/stage-assignments.ts
git commit -m "Register procedure.review_pgsol stage key"
```

---

### Task 3: Add `review_pgsol` to the Prosedur Kerja permission catalog (3 files)

**Files:**
- Modify: `app/dashboard/master-data/role/constants.ts:39-47`
- Modify: `app/pgsol/dashboard/role/constants.ts:39-47`
- Modify: `app/vendor/dashboard/role/constants.ts:39-47`

**Interfaces:**
- Consumes: nothing.
- Produces: the `procedure.review_pgsol` permission becomes visible/grantable on the Role & Permission UI. No code interface — this is data only.

All three files currently have byte-identical content (confirmed while researching this plan). Apply the same edit to each.

- [ ] **Step 1: Edit `app/dashboard/master-data/role/constants.ts`**

Find:

```typescript
  {
    id: 'procedure',
    title: 'Modul Prosedur Kerja',
    description: 'Hak akses terkait dokumen Prosedur Kerja vendor — tahap pertama alur Prosedur → JSA → PTW.',
    items: [
      { key: 'view', label: 'Melihat Daftar Prosedur Kerja', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'review_vendor', label: 'Review Internal Vendor — Prosedur Kerja', allowedTypes: ['vendor'] },
      { key: 'review', label: 'Review & Approve Prosedur Kerja', allowedTypes: ['pgn', 'pgsol'] },
    ]
  },
```

Replace with:

```typescript
  {
    id: 'procedure',
    title: 'Modul Prosedur Kerja',
    description: 'Hak akses terkait dokumen Prosedur Kerja vendor — tahap pertama alur Prosedur → JSA → PTW.',
    items: [
      { key: 'view', label: 'Melihat Daftar Prosedur Kerja', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'review_vendor', label: 'Review Internal Vendor — Prosedur Kerja', allowedTypes: ['vendor'] },
      { key: 'review_pgsol', label: 'Review Prosedur Kerja — Tahap PGSOL', allowedTypes: ['pgsol'] },
      { key: 'review', label: 'Review & Approve Prosedur Kerja', allowedTypes: ['pgn', 'pgsol'] },
    ]
  },
```

- [ ] **Step 2: Apply the identical edit to `app/pgsol/dashboard/role/constants.ts`**

Same find/replace as Step 1.

- [ ] **Step 3: Apply the identical edit to `app/vendor/dashboard/role/constants.ts`**

Same find/replace as Step 1.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/master-data/role/constants.ts app/pgsol/dashboard/role/constants.ts app/vendor/dashboard/role/constants.ts
git commit -m "Add procedure.review_pgsol to the permission catalog"
```

---

### Task 4: Migration SQL — grant `review_pgsol` to `pgsol_reviewer`

**Files:**
- Create: `supabase/schema_procedure_pgsol_permission.sql`
- Modify: `supabase/RUN_ALL_migrations_2026-08-30.sql` (append near the end, before the final verification block)
- Modify: `supabase/README_stage_assignment_migration_order.md` (append a new section)

**Interfaces:** none (SQL/docs only).

- [ ] **Step 1: Create the new migration file**

```sql
-- supabase/schema_procedure_pgsol_permission.sql
--
-- Prosedur Kerja mendapat gerbang PGSOL baru (menyamakan pola dengan JSA:
-- vendor -> PGSOL -> PGN). Role pgsol_reviewer sudah pegang jsa.review_pgsol
-- (lihat schema_permission_driven_approval.sql) — orang yang sama harus
-- otomatis jadi kandidat review Prosedur Kerja juga, tanpa admin PGSOL perlu
-- setup role baru dulu lewat halaman Role & Permission. Merge (bukan
-- replace penuh) dan di-guard idempoten, pola sama seperti
-- schema_vendor_review_permissions.sql. Tidak ada perubahan RLS di sini —
-- policy "Internal users can write stage assignments" (is_internal_user(),
-- sudah mencakup PGSOL) sudah otomatis mengizinkan stage_key baru ini.
UPDATE public.roles
SET permissions = jsonb_set(
  permissions, '{procedure}',
  COALESCE(permissions->'procedure', '[]'::jsonb) || '["review_pgsol"]'::jsonb
)
WHERE name = 'pgsol_reviewer'
  AND NOT COALESCE(permissions->'procedure', '[]'::jsonb) ? 'review_pgsol';
```

- [ ] **Step 2: Read the tail of `RUN_ALL_migrations_2026-08-30.sql` to find the insertion point**

Run (find the final verification block's start line):

```bash
grep -n "SELESAI" "supabase/RUN_ALL_migrations_2026-08-30.sql"
```

Read the file from ~40 lines before that line number to the end, to see exactly how the prior "TRANSAKSI 5" section was appended (it ends with a comment banner before the `SELESAI` verification queries).

- [ ] **Step 3: Append a new "TRANSAKSI 6" section**

Insert, immediately before the `SELESAI` verification block, following the exact banner-comment style used by the existing "TRANSAKSI 5" section (a `-- ============...` banner line, a title comment, then the full file content pasted verbatim):

```sql
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
```

Also update the file's header comment (near the top, wherever it says how many `schema_*.sql` files are combined — e.g. "13 file schema_*.sql") to say 14.

- [ ] **Step 4: Append a new section to the README**

Append to the end of `supabase/README_stage_assignment_migration_order.md`:

```markdown
---

# Urutan Migrasi Fase 3.1 — Gerbang PGSOL untuk Prosedur Kerja

Jalankan setelah semua migrasi Fase 1, Fase 2, dan Fase 3 di atas sudah
selesai:

1. `schema_procedure_pgsol_permission.sql`

Tidak ada perubahan enum atau RLS di file ini — bisa langsung paste, atau
pakai `RUN_ALL_migrations_2026-08-30.sql` yang sudah menyertakannya di
Transaksi 6.

## ⚠️ Cutover — pola fail-closed yang sama, lingkup lebih sempit lagi

File ini HANYA menambah permission `procedure.review_pgsol` ke role
`pgsol_reviewer` — tidak mengosongkan atau mereset baris apa pun. Prosedur
Kerja yang sudah lewat tahap `Draft` sebelum migrasi ini tetap jalan seperti
biasa. Yang fail-closed adalah alur submit baru: begitu kode aplikasi
(harus di-deploy bersamaan dengan atau sebelum migrasi ini) mengarahkan
Prosedur Kerja ke status `Review PGSOL`, dokumen itu macet di situ sampai
admin PGSOL mengisi assignment `procedure.review_pgsol` untuk proyek yang
bersangkutan.

- [ ] Sebelum atau segera setelah deploy: umumkan ke admin PGSOL bahwa
      halaman `/pgsol/dashboard/projects/{id}/assign` sekarang punya dua
      panel assignment (Prosedur Kerja dan JSA), dan Prosedur Kerja proyek
      aktif butuh diisi sebelum vendor bisa lanjut ke tahap PM.

## Verifikasi manual — Fase 3.1

- [ ] Assign 2 PGSOL reviewer ke `procedure.review_pgsol` sebuah proyek.
      Ajukan Prosedur Kerja sebagai vendor — status harus `Review PGSOL`
      (bukan langsung `Menunggu Review PM`).
- [ ] Approve sebagai reviewer pertama — status tetap `Review PGSOL`.
      Approve sebagai reviewer kedua — status maju ke `Menunggu Review PM`,
      dan PM (sisi PGN) baru sekarang melihat dokumennya.
- [ ] Reject JSA sebagai reviewer PGSOL atau PGN — pastikan status balik ke
      `Draft` (BUKAN `Review PGSOL`), dan submit ulang sebagai vendor benar
      memicu `Review Internal Vendor` lagi sebelum PGSOL melihatnya.
- [ ] Login sebagai pemegang `jsa.review_pgsol` yang TIDAK ditugaskan ke
      suatu proyek — buka proyek itu, kartu approval Prosedur/JSA tetap
      terlihat (transparansi) tapi tombol Setujui/Tolak tidak muncul, dan
      ada indikator "N dari M sudah menyetujui".
- [ ] `/dashboard/my-task` untuk reviewer PGSOL menampilkan tugas Prosedur
      Kerja hanya selagi benar ditugaskan dengan baris pending — tidak ada
      entri phantom selagi dokumen masih `Draft`.
```

- [ ] **Step 5: Commit**

```bash
git add supabase/schema_procedure_pgsol_permission.sql supabase/RUN_ALL_migrations_2026-08-30.sql supabase/README_stage_assignment_migration_order.md
git commit -m "Add migration for procedure.review_pgsol permission grant"
```

---

### Task 5: Rewire `approveProcedure`/`rejectProcedure` to be multi-stage; fix `rejectJsa`

**Files:**
- Modify: `app/dashboard/approval/actions.ts:191-305` (`approveProcedure`, `rejectProcedure`)
- Modify: `app/dashboard/approval/actions.ts:441-449` (inside `rejectJsa`)

**Interfaces:**
- Consumes: `PROCEDURE_STATUS.reviewPgsol` (Task 1), `getStageAssignments`/`isStageFullyApproved`/`resetStageAssignments`/`notifyAssignees` (already imported in this file, unchanged signatures).
- Produces: `approveProcedure(procedureId: string)` and `rejectProcedure(procedureId: string, note: string)` keep their existing exported signatures — callers in `AdminProjectClient.tsx` (Task 10) need no changes to call sites.

- [ ] **Step 1: Replace `approveProcedure`**

Find the entire existing `approveProcedure` function (lines 191-255) and replace it with:

```typescript
export async function approveProcedure(procedureId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: current } = await supabase.from('procedures').select('status, project_id').eq('id', procedureId).single();
  if (!current?.project_id) throw new Error("Prosedur ini tidak terhubung ke proyek.");

  let stageKey = '';
  let nextStatus = '';

  if (current.status === PROCEDURE_STATUS.reviewPgsol) {
    stageKey = 'procedure.review_pgsol';
    nextStatus = PROCEDURE_STATUS.menungguReviewPM;
  } else if (current.status === PROCEDURE_STATUS.menungguReviewPM) {
    stageKey = 'procedure.review';
    nextStatus = PROCEDURE_STATUS.approved;
  } else {
    throw new Error("Prosedur tidak dalam tahap yang bisa disetujui.");
  }

  const rows = await getStageAssignments(supabase, current.project_id, 'procedure', stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk tahap Prosedur Kerja ini pada proyek ini.");

  const { error: markError } = await supabase.from('stage_assignments').update({ status: 'approved', decided_at: new Date().toISOString() }).eq('id', myRow.id);
  if (markError) throw new Error(markError.message);

  // Re-fetch fresh dari DB (bukan patch lokal dari `rows`) — lihat catatan
  // yang sama di approveJsa/approvePtw: dua approver terakhir yang approve
  // nyaris bersamaan bisa sama-sama melihat snapshot awal yang belum
  // mencatat approval satu sama lain, sehingga dokumen bisa macet permanen
  // walau di DB semua baris sudah approved.
  const freshRows = await getStageAssignments(supabase, current.project_id, 'procedure', stageKey);
  if (!isStageFullyApproved(freshRows)) {
    revalidatePath('/dashboard/approval');
    return;
  }

  const { data: profile } = await supabase.from('internal_profiles').select('id').eq('id', user.id).single();
  const updatePayload: any = stageKey === 'procedure.review_pgsol'
    ? { status: PROCEDURE_STATUS.menungguReviewPM }
    : { status: PROCEDURE_STATUS.approved, reviewed_by: profile?.id };

  // .eq('status', current.status) jadi optimistic lock terakhir (pola sama
  // dengan approveJsa/approvePtw): kalau seseorang menolak dokumen ini
  // persis di sela-sela antara pembacaan status di atas dan update ini,
  // penolakan itu akan diam-diam ditimpa oleh approve yang balapan.
  const { data: updated, error } = await supabase
    .from('procedures')
    .update(updatePayload)
    .eq('id', procedureId)
    .eq('status', current.status)
    .select('id');
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) {
    throw new Error("Prosedur ini baru saja diproses oleh pengguna lain. Muat ulang halaman untuk melihat status terbaru.");
  }

  const { data: proc } = await supabase.from('procedures').select('project_id, projects ( name, vendor_id )').eq('id', procedureId).single();
  const proj: any = Array.isArray(proc?.projects) ? proc?.projects[0] : proc?.projects;
  if (proc?.project_id) {
    await logDocumentEvent(supabase, {
      docType: 'procedure', docId: procedureId, projectId: proc.project_id, actorId: user.id,
      action: nextStatus === PROCEDURE_STATUS.approved ? 'Direview & Disetujui PM' : 'Direview PGSOL',
    });
  }

  if (nextStatus === PROCEDURE_STATUS.menungguReviewPM) {
    await notifyAssignees({
      projectId: current.project_id, docType: 'procedure', stageKey: 'procedure.review',
      type: 'action_required',
      title: 'Prosedur Kerja Menunggu Review PM',
      message: `Prosedur Kerja untuk proyek "${proj?.name}" telah direview PGSOL dan menunggu review Anda.`,
      link: `/dashboard/projects/${proc?.project_id}`,
    });
  }

  if (proj?.vendor_id) {
    await createNotification({
      userId: proj.vendor_id,
      type: nextStatus === PROCEDURE_STATUS.approved ? 'approval' : 'info',
      title: nextStatus === PROCEDURE_STATUS.approved ? `Prosedur Kerja Disetujui` : `Prosedur Kerja Telah Direview PGSOL`,
      message: nextStatus === PROCEDURE_STATUS.approved
        ? `Prosedur Kerja untuk proyek "${proj.name}" telah disetujui. Silakan lanjutkan pengajuan JSA.`
        : `Prosedur Kerja untuk proyek "${proj.name}" telah direview PGSOL dan kini menunggu review PM.`,
      link: `/vendor/dashboard/projects/${proc?.project_id}`,
    });
  }
  revalidatePath('/dashboard/approval');
}
```

- [ ] **Step 2: Replace `rejectProcedure`**

Find the entire existing `rejectProcedure` function (lines 257-305) and replace it with:

```typescript
export async function rejectProcedure(procedureId: string, note: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: currentCheck } = await supabase.from('procedures').select('status, project_id').eq('id', procedureId).single();
  if (!currentCheck?.project_id) throw new Error("Prosedur ini tidak terhubung ke proyek.");

  let stageKey = '';
  let penolak = '';
  if (currentCheck.status === PROCEDURE_STATUS.reviewPgsol) {
    stageKey = 'procedure.review_pgsol';
    penolak = 'PGSOL';
  } else if (currentCheck.status === PROCEDURE_STATUS.menungguReviewPM) {
    stageKey = 'procedure.review';
    penolak = 'PM';
  } else {
    throw new Error("Prosedur tidak dalam tahap yang bisa ditolak.");
  }

  const rows = await getStageAssignments(supabase, currentCheck.project_id, 'procedure', stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk tahap Prosedur Kerja ini pada proyek ini.");

  await supabase.from('stage_assignments').update({ status: 'rejected', decided_at: new Date().toISOString(), note }).eq('id', myRow.id);
  await resetStageAssignments(supabase, currentCheck.project_id, 'procedure', stageKey);
  if (stageKey === 'procedure.review') {
    // Reject di tahap PM (kedua) mengembalikan Prosedur sampai ke Draft
    // (bukan cuma ke tahap PGSOL), jadi tahap review_pgsol ikut di-reset
    // supaya konsisten dengan restart penuh — pola sama dengan rejectPtw
    // mereset ketiga tahapnya.
    await resetStageAssignments(supabase, currentCheck.project_id, 'procedure', 'procedure.review_pgsol');
  }

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
      action: `Ditolak ${penolak} — Revisi Diperlukan`, notes: note,
    });
  }

  const proj: any = Array.isArray(proc?.projects) ? proc?.projects[0] : proc?.projects;
  if (proj?.vendor_id) {
    await createNotification({
      userId: proj.vendor_id,
      type: 'warning',
      title: `Prosedur Kerja Ditolak ${penolak} — Revisi Diperlukan`,
      message: `Prosedur untuk proyek "${proj.name}" ditolak oleh ${penolak}. Catatan: "${note}". Silakan perbaiki dan ajukan ulang.`,
      link: `/vendor/dashboard/projects/${proc?.project_id}`,
    });
  }
  revalidatePath('/dashboard/approval');
}
```

- [ ] **Step 3: Fix `rejectJsa`'s reject-destination bug**

Inside `rejectJsa` (further down the same file), find:

```typescript
  // Kembali ke awal: vendor harus memperbaiki, lalu direview ulang dari tahap PGSOL.
  const { error } = await supabase
    .from('jsa')
    .update({
      status: JSA_STATUS.reviewPgsol,
      rejection_note: note,
      reviewer_id: null, reviewed_at: null,
      approver_id: null, approved_at: null,
    })
    .eq('id', jsaId);
```

Replace with:

```typescript
  // Kembali ke Draft (bukan langsung ke Review PGSOL) — vendor harus lolos
  // Review Internal Vendor lagi sebelum PGSOL/PGN melihatnya ulang, sama
  // seperti rejectProcedure dan rejectPtw. Ini memperbaiki bug: sebelumnya
  // status di-set langsung ke reviewPgsol, yang skip gerbang vendor-internal
  // sepenuhnya pada setiap reject JSA. saveJsa (jalur resubmit, Fase 3)
  // sudah mereset assignment jsa.review_vendor saat vendor mengajukan ulang
  // dari Draft, jadi tidak ada reset tambahan yang perlu ditambahkan di sini.
  const { error } = await supabase
    .from('jsa')
    .update({
      status: JSA_STATUS.draft,
      rejection_note: note,
      reviewer_id: null, reviewed_at: null,
      approver_id: null, approved_at: null,
    })
    .eq('id', jsaId);
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/approval/actions.ts
git commit -m "Make Prosedur Kerja approval multi-stage; fix rejectJsa reject destination"
```

---

### Task 6: Fix `/dashboard/my-task`'s Prosedur Kerja block

**Files:**
- Modify: `app/dashboard/my-task/actions.ts:5` (import line)
- Modify: `app/dashboard/my-task/actions.ts:53-88` (Prosedur Kerja block)

**Interfaces:**
- Consumes: `PROCEDURE_STATUS`, `PROCEDURE_STAGE_PERMISSION`, `PROCEDURE_PENDING_STATUSES` from `lib/procedure-status.ts` (Task 1).

- [ ] **Step 1: Update the import**

Find:

```typescript
import { PROCEDURE_STATUS } from "@/lib/procedure-status";
```

Replace with:

```typescript
import { PROCEDURE_STATUS, PROCEDURE_STAGE_PERMISSION, PROCEDURE_PENDING_STATUSES } from "@/lib/procedure-status";
```

- [ ] **Step 2: Replace the Prosedur Kerja block**

Find the whole block starting at `// 1. Fetch Procedures —` (the comment) through its closing `}` (right before `// 2. Fetch JSA`), and replace it with:

```typescript
  // 1. Fetch Procedures — dua tahap: Review PGSOL, lalu Menunggu Review PM.
  // Pola sama seperti blok JSA di bawah: ambil dulu stage_assignments
  // pending user ini untuk kedua stage_key Prosedur, per proyek, baru
  // cocokkan ke status Prosedur saat ini lewat PROCEDURE_STAGE_PERMISSION.
  // Filter status memakai PROCEDURE_PENDING_STATUSES secara presisi
  // (bukan hardcode string lepas) supaya PM/PGSOL tidak melihat entri
  // phantom saat dokumen masih Draft menunggu vendor merevisi.
  {
    const procStageKeys = Object.values(PROCEDURE_STAGE_PERMISSION).map(p => `${p.module}.${p.action}`);
    const { data: myAssignments } = await supabase
      .from('stage_assignments')
      .select('project_id, stage_key')
      .eq('doc_type', 'procedure').in('stage_key', procStageKeys)
      .eq('assignee_id', user.id).eq('status', 'pending');

    const myStageKeysByProject = new Map<string, Set<string>>();
    (myAssignments || []).forEach((a: any) => {
      if (!myStageKeysByProject.has(a.project_id)) myStageKeysByProject.set(a.project_id, new Set());
      myStageKeysByProject.get(a.project_id)!.add(a.stage_key);
    });
    const projectIds = Array.from(myStageKeysByProject.keys());

    if (projectIds.length > 0) {
      const { data: procedures } = await supabase
        .from('procedures')
        .select(`
          id, status, created_at, project_id,
          projects ( name, vendor_profiles ( company_name ) )
        `)
        .in('project_id', projectIds)
        .in('status', PROCEDURE_PENDING_STATUSES);

      if (procedures) {
        procedures.forEach((proc: any) => {
          const perm = PROCEDURE_STAGE_PERMISSION[proc.status];
          const stageKey = perm ? `${perm.module}.${perm.action}` : null;
          const myStageKeys = myStageKeysByProject.get(proc.project_id);
          const isMyTask = !!stageKey && !!myStageKeys?.has(stageKey);

          if (isMyTask) {
            const proj = Array.isArray(proc.projects) ? proc.projects[0] : proc.projects;
            const vendor = proj?.vendor_profiles;
            const companyName = Array.isArray(vendor) ? vendor[0]?.company_name : vendor?.company_name;
            tasks.push({
              id: proc.id,
              title: proc.status === PROCEDURE_STATUS.reviewPgsol
                ? `Review Prosedur Kerja (PGSOL)`
                : `Review Prosedur Kerja (PM)`,
              type: 'Prosedur',
              projectName: proj?.name || 'Unknown Project', vendorName: companyName || 'Internal',
              date: proc.created_at, url: `/dashboard/projects/${proc.project_id}`,
              status: proc.status, urgency: getUrgency(proc.created_at),
              timeInQueue: formatTimeInQueue(proc.created_at)
            });
          }
        });
      }
    }
  }
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/my-task/actions.ts
git commit -m "Fix Prosedur Kerja my-task filter to use precise pending statuses"
```

---

### Task 7: Generalize PGSOL assignment actions to cover Prosedur Kerja

**Files:**
- Modify: `app/pgsol/dashboard/projects/actions.ts` (whole file — 49 lines)

**Interfaces:**
- Consumes: `PGSOL_STAGE_KEYS` from `lib/stage-assignments.ts` (Task 2).
- Produces: `savePgsolAssignment(projectId: string, docType: 'procedure' | 'jsa', stageKey: string, assigneeIds: string[])` — signature change from the current `savePgsolAssignment(projectId, assigneeIds)`. Task 8's `AssignPgsolPanel.tsx` is the only caller and is updated in the same plan.

- [ ] **Step 1: Replace the whole file**

```typescript
'use server';

import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { writeStageAssignment, PGSOL_STAGE_KEYS } from '@/lib/stage-assignments';
import { revalidatePath } from 'next/cache';

export async function getPgsolProjects() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id, name, status, created_at,
      vendor_profiles ( company_name ),
      procedures ( id, status ),
      jsa ( id, status )
    `)
    .order('created_at', { ascending: false });
  if (error) { console.error('getPgsolProjects error:', error.message); return []; }
  // Proyek relevan buat PGSOL begitu punya Prosedur Kerja ATAU JSA — bukan
  // cuma JSA lagi, karena tahap PGSOL sekarang juga ada di Prosedur Kerja.
  return (data || []).filter((p: any) => {
    const procRows = Array.isArray(p.procedures) ? p.procedures : (p.procedures ? [p.procedures] : []);
    const jsaRows = Array.isArray(p.jsa) ? p.jsa : (p.jsa ? [p.jsa] : []);
    return procRows.length > 0 || jsaRows.length > 0;
  });
}

export async function savePgsolAssignment(
  projectId: string, docType: 'procedure' | 'jsa', stageKey: string, assigneeIds: string[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // Satu permission menggerbangi kemampuan menugaskan reviewer PGSOL untuk
  // KEDUA doc_type (jsa & procedure) — sengaja tidak dipecah jadi permission
  // baru per doc_type supaya grant yang sudah ada di production (Fase 2)
  // tidak perlu dimigrasikan ulang. Lihat spec untuk keputusan ini.
  const allowed = await hasPermissionForUser(supabase, user.id, 'jsa', 'manage_assignment_pgsol');
  if (!allowed) return { error: 'Anda tidak memiliki izin untuk menunjuk reviewer PGSOL.' };

  if (!(PGSOL_STAGE_KEYS as readonly string[]).includes(stageKey)) {
    return { error: 'Tahap ini tidak dikenali.' };
  }

  // Permission saja tidak cukup: role `admin` (PGN) mendapat SELURUH permission
  // lewat fullAccessPermissions(), jadi tanpa cek tipe org ini admin PGN bisa
  // ikut muncul sebagai kandidat reviewer PGSOL.
  const { data: actorProfile } = await supabase.from('profiles').select('type').eq('id', user.id).single();
  if (actorProfile?.type !== 'pgsol') return { error: 'Aksi ini hanya untuk admin PGSOL.' };

  const result = await writeStageAssignment(supabase, user.id, {
    projectId, docType, stageKey, assigneeIds,
  });
  if (result.error) return { error: result.error };

  revalidatePath(`/pgsol/dashboard/projects/${projectId}/assign`);
  return { success: true };
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: this will show an error in `app/pgsol/dashboard/projects/[id]/assign/AssignPgsolPanel.tsx` (calls `savePgsolAssignment` with the old 2-argument signature) — that's expected and fixed in Task 8. Confirm no *other* errors appear.

- [ ] **Step 3: Commit**

```bash
git add app/pgsol/dashboard/projects/actions.ts
git commit -m "Generalize PGSOL assignment actions to cover Prosedur Kerja and JSA"
```

---

### Task 8: Two assignment panels on the PGSOL assign page

**Files:**
- Modify: `app/pgsol/dashboard/projects/[id]/assign/page.tsx` (whole file — 50 lines)
- Modify: `app/pgsol/dashboard/projects/[id]/assign/AssignPgsolPanel.tsx` (whole file — 66 lines)

**Interfaces:**
- Consumes: `savePgsolAssignment(projectId, docType, stageKey, assigneeIds)` (Task 7).

- [ ] **Step 1: Replace `AssignPgsolPanel.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { savePgsolAssignment } from '../../actions';

interface Candidate { id: string; full_name: string; }

export default function AssignPgsolPanel({
  projectId, docType, stageKey, candidates, currentAssigneeIds, locked,
}: {
  projectId: string; docType: 'procedure' | 'jsa'; stageKey: string;
  candidates: Candidate[]; currentAssigneeIds: string[]; locked: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(currentAssigneeIds);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await savePgsolAssignment(projectId, docType, stageKey, selected);
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
        {candidates.length === 0 && <p className="text-sm text-slate-400">Tidak ada staff PGSOL dengan izin review tahap ini.</p>}
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

- [ ] **Step 2: Replace `page.tsx`**

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { hasPermission } from '@/utils/permissions';
import { getStageAssignments, getEligibleAssignees } from '@/lib/stage-assignments';
import AssignPgsolPanel from './AssignPgsolPanel';

export default async function PgsolAssignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  // Gerbang yang sama dengan savePgsolAssignment — pgsol_reviewer biasa tidak
  // boleh membuka layar penunjukan sama sekali (mengikuti pola halaman
  // /pgsol/dashboard/staff).
  if (!(await hasPermission('jsa', 'manage_assignment_pgsol'))) redirect('/pgsol/dashboard');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: actorProfile } = await supabase.from('profiles').select('org_id').eq('id', user?.id).single();
  if (!actorProfile?.org_id) redirect('/pgsol/dashboard');

  const { data: project } = await supabase.from('projects').select('id, name').eq('id', projectId).single();
  const [procCandidates, procAssignments, jsaCandidates, jsaAssignments] = await Promise.all([
    // Dibatasi ke org PGSOL milik admin ini — tanpa itu admin PGN (yang
    // memegang semua permission) ikut muncul sebagai kandidat reviewer.
    getEligibleAssignees(supabase, 'procedure', 'review_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'procedure', 'procedure.review_pgsol'),
    getEligibleAssignees(supabase, 'jsa', 'review_pgsol', actorProfile.org_id),
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
          <p className="text-sm text-slate-500 mt-1">Semua yang ditunjuk di sini harus menyetujui sebelum dokumen lanjut ke tahap berikutnya.</p>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">Prosedur Kerja</h2>
        <AssignPgsolPanel
          projectId={projectId}
          docType="procedure"
          stageKey="procedure.review_pgsol"
          candidates={procCandidates}
          currentAssigneeIds={procAssignments.map(a => a.assignee_id)}
          locked={procAssignments.some(a => a.status !== 'pending')}
        />
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">JSA</h2>
        <AssignPgsolPanel
          projectId={projectId}
          docType="jsa"
          stageKey="jsa.review_pgsol"
          candidates={jsaCandidates}
          currentAssigneeIds={jsaAssignments.map(a => a.assignee_id)}
          locked={jsaAssignments.some(a => a.status !== 'pending')}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p .`
Expected: clean — this resolves the expected error from Task 7's Step 2.

- [ ] **Step 4: Commit**

```bash
git add app/pgsol/dashboard/projects/[id]/assign/page.tsx app/pgsol/dashboard/projects/[id]/assign/AssignPgsolPanel.tsx
git commit -m "Add Prosedur Kerja assignment panel to PGSOL assign page"
```

---

### Task 9: Fetch active-stage assignments in the project detail page

**Files:**
- Modify: `app/dashboard/projects/[id]/page.tsx`

**Interfaces:**
- Consumes: `getStageAssignments`, `StageAssignmentRow` from `lib/stage-assignments.ts`; `PROCEDURE_STAGE_PERMISSION` (Task 1); `JSA_STAGE_PERMISSION` from `lib/jsa-status.ts` (unchanged, already exists); `PTW_STAGE_PERMISSION` from `lib/ptw-status.ts` (unchanged, already exists).
- Produces: new prop `stageAssignments: Record<string, StageAssignmentRow[]>` on `<AdminProjectClient />`, keyed by the exact `stage_key` string (e.g. `"procedure.review_pgsol"`, `"jsa.approve_pgn"`, `"ptw.approve_pm"`). Consumed by Task 10.

- [ ] **Step 1: Add imports**

Find:

```tsx
import AdminProjectClient from './AdminProjectClient';
import { getJsaSignatories } from '@/lib/jsa-signatories';
import { getPtwSignatories } from '@/lib/ptw-signatories';
import { worstExpiry } from '@/lib/document-expiry';
import { getDocumentLogs } from '@/app/dashboard/approval/actions';
```

Replace with:

```tsx
import AdminProjectClient from './AdminProjectClient';
import { getJsaSignatories } from '@/lib/jsa-signatories';
import { getPtwSignatories } from '@/lib/ptw-signatories';
import { worstExpiry } from '@/lib/document-expiry';
import { getDocumentLogs } from '@/app/dashboard/approval/actions';
import { getStageAssignments, StageAssignmentRow } from '@/lib/stage-assignments';
import { PROCEDURE_STAGE_PERMISSION } from '@/lib/procedure-status';
import { JSA_STAGE_PERMISSION } from '@/lib/jsa-status';
import { PTW_STAGE_PERMISSION } from '@/lib/ptw-status';
```

- [ ] **Step 2: Compute active stage keys and fetch their assignments**

Find (right after the `documentLogs` line and before the "Tab 'Status Lapangan'" comment):

```tsx
  const documentLogs = await getDocumentLogs(projectId);
```

Replace with:

```tsx
  const documentLogs = await getDocumentLogs(projectId);

  // Baris stage_assignments untuk SETIAP tahap aktif dokumen proyek ini —
  // dipakai AdminProjectClient untuk menggerbangi tombol Setujui/Tolak ke
  // orang yang benar ditugaskan (bukan cuma permission), dan untuk
  // indikator progress "N dari M sudah menyetujui". Key-nya persis
  // stage_key (mis. "procedure.review_pgsol", "ptw.approve_pm") karena
  // stage_key sendiri sudah unik lintas doc_type (diawali nama modulnya).
  // Reuse jsaRow/ptws yang sudah dihitung di atas untuk signatories — cuma
  // procedures yang belum punya variabel sendiri di file ini.
  const procRowForStages = Array.isArray(project.procedures) ? project.procedures[0] : project.procedures;

  const activeStageKeys = new Set<string>();
  const procStagePerm = PROCEDURE_STAGE_PERMISSION[procRowForStages?.status];
  if (procStagePerm) activeStageKeys.add(`${procStagePerm.module}.${procStagePerm.action}`);
  const jsaStagePerm = JSA_STAGE_PERMISSION[jsaRow?.status];
  if (jsaStagePerm) activeStageKeys.add(`${jsaStagePerm.module}.${jsaStagePerm.action}`);
  for (const row of ptws) {
    const ptwStagePerm = PTW_STAGE_PERMISSION[row.status];
    if (ptwStagePerm) activeStageKeys.add(`${ptwStagePerm.module}.${ptwStagePerm.action}`);
  }

  const stageAssignmentEntries = await Promise.all(
    Array.from(activeStageKeys).map(async (stageKey) => {
      const [docType] = stageKey.split('.');
      const rows = await getStageAssignments(supabase, projectId, docType, stageKey);
      return [stageKey, rows] as const;
    })
  );
  const stageAssignments: Record<string, StageAssignmentRow[]> = Object.fromEntries(stageAssignmentEntries);
```

- [ ] **Step 3: Pass the new prop down**

Find:

```tsx
      <AdminProjectClient
        project={project}
        currentUserId={user.id}
        jsaSignatories={jsaSignatories}
        ptwSignatories={ptwSignatories}
        workerExpiry={workerExpiry}
        equipmentExpiry={equipmentExpiry}
        documentLogs={documentLogs}
        permissions={permissions}
        siteCheckins={siteCheckins ?? []}
        toolboxMeetings={toolboxMeetings ?? []}
      />
```

Replace with:

```tsx
      <AdminProjectClient
        project={project}
        currentUserId={user.id}
        jsaSignatories={jsaSignatories}
        ptwSignatories={ptwSignatories}
        workerExpiry={workerExpiry}
        equipmentExpiry={equipmentExpiry}
        documentLogs={documentLogs}
        permissions={permissions}
        siteCheckins={siteCheckins ?? []}
        toolboxMeetings={toolboxMeetings ?? []}
        stageAssignments={stageAssignments}
      />
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p .`
Expected: an error in `AdminProjectClient.tsx` ("Property 'stageAssignments' does not exist...") is expected here — fixed in Task 10. Confirm no other errors appear, and that `page.tsx` itself compiles (the error will be attributed to the client component's prop types, not to this file's own syntax).

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/projects/[id]/page.tsx
git commit -m "Fetch per-stage assignment rows for the project detail page"
```

---

### Task 10: Assignment-aware gating, progress indicator, and Prosedur Kerja stage badge in `AdminProjectClient.tsx`

**Files:**
- Modify: `app/dashboard/projects/[id]/AdminProjectClient.tsx`

**Interfaces:**
- Consumes: `stageAssignments` prop (Task 9), `PROCEDURE_STATUS.reviewPgsol` (Task 1).
- Produces: no new exports — this is a leaf client component.

This task touches several non-adjacent regions of one file. Apply each step in order.

- [ ] **Step 1: Add the `StageAssignmentRow` import and a small `StageProgress` component**

Find:

```tsx
import { JSA_STATUS, JSA_STAGE_PERMISSION, isJsaPending } from '@/lib/jsa-status';
import { PROCEDURE_STATUS, PROCEDURE_STAGE_PERMISSION } from '@/lib/procedure-status';
```

Replace with:

```tsx
import { JSA_STATUS, JSA_STAGE_PERMISSION, isJsaPending } from '@/lib/jsa-status';
import { PROCEDURE_STATUS, PROCEDURE_STAGE_PERMISSION } from '@/lib/procedure-status';
import { StageAssignmentRow } from '@/lib/stage-assignments';
```

Then find the `DocumentModal` function (right before `RejectModal`) and insert a new component right after it (before `// Reuse RejectModal`):

```tsx
/** Indikator progress multi-signature satu tahap — "N dari M sudah menyetujui", atau peringatan kalau belum ada yang ditugaskan sama sekali. */
function StageProgress({ approved, total }: { approved: number; total: number }) {
  if (total === 0) {
    return (
      <div className="flex items-center gap-2 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5 w-fit mt-2">
        <AlertTriangle className="w-3.5 h-3.5" /> Belum ada reviewer yang ditugaskan
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg px-3 py-1.5 w-fit mt-2">
      <Users className="w-3.5 h-3.5" /> {approved} dari {total} sudah menyetujui
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: same pre-existing errors as end of Task 9 (missing `stageAssignments` prop type) — `StageAssignmentRow` and `StageProgress` themselves compile cleanly since both `AlertTriangle` and `Users` icons are already imported at the top of this file.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/projects/[id]/AdminProjectClient.tsx
git commit -m "Add StageProgress component to AdminProjectClient"
```

- [ ] **Step 4: Add the `stageAssignments` prop and gating helpers**

Find the component's prop type declaration:

```tsx
export default function AdminProjectClient({
  project, currentUserId, jsaSignatories, ptwSignatories, workerExpiry, equipmentExpiry, documentLogs, permissions,
  siteCheckins, toolboxMeetings,
}: {
  project: any, currentUserId: string, jsaSignatories?: any, ptwSignatories?: Record<string, any>,
  /** worker_id / equipment_id -> 'expired' | 'expiring' | 'valid' | 'unknown', computed server-side against live master data. */
  workerExpiry?: Record<string, string>,
  equipmentExpiry?: Record<string, string>,
  /** Full Prosedur/JSA/PTW audit trail for this project, newest first — see document_logs. */
  documentLogs?: any[],
  /** roles.permissions milik user saat ini — sumber kebenaran gerbang approve/reject, lihat utils/permissions.ts. */
  permissions?: Record<string, string[]> | null,
  /** Riwayat check-in lapangan (site_checkins) lintas semua PTW proyek ini, terbaru dulu. */
  siteCheckins?: any[],
  /** Riwayat toolbox meeting (toolbox_meetings) lintas semua PTW proyek ini, terbaru dulu. */
  toolboxMeetings?: any[],
}) {
```

Replace with:

```tsx
export default function AdminProjectClient({
  project, currentUserId, jsaSignatories, ptwSignatories, workerExpiry, equipmentExpiry, documentLogs, permissions,
  siteCheckins, toolboxMeetings, stageAssignments,
}: {
  project: any, currentUserId: string, jsaSignatories?: any, ptwSignatories?: Record<string, any>,
  /** worker_id / equipment_id -> 'expired' | 'expiring' | 'valid' | 'unknown', computed server-side against live master data. */
  workerExpiry?: Record<string, string>,
  equipmentExpiry?: Record<string, string>,
  /** Full Prosedur/JSA/PTW audit trail for this project, newest first — see document_logs. */
  documentLogs?: any[],
  /** roles.permissions milik user saat ini — sumber kebenaran VISIBILITY kartu approval (bukan lagi tombolnya), lihat utils/permissions.ts. */
  permissions?: Record<string, string[]> | null,
  /** Riwayat check-in lapangan (site_checkins) lintas semua PTW proyek ini, terbaru dulu. */
  siteCheckins?: any[],
  /** Riwayat toolbox meeting (toolbox_meetings) lintas semua PTW proyek ini, terbaru dulu. */
  toolboxMeetings?: any[],
  /** stage_assignments untuk tiap tahap AKTIF dokumen proyek ini, key = stage_key persis (mis. "procedure.review_pgsol"). Sumber kebenaran gerbang tombol Setujui/Tolak dan indikator progress. */
  stageAssignments?: Record<string, StageAssignmentRow[]>,
}) {
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit -p .`
Expected: the `stageAssignments` prop-mismatch error from Task 9 is now gone.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/projects/[id]/AdminProjectClient.tsx
git commit -m "Add stageAssignments prop to AdminProjectClient"
```

- [ ] **Step 7: Add gating helper functions and rewrite the three `canApprove*` blocks**

Find:

```tsx
  // Check if current user can approve specific docs — dibaca dari
  // roles.permissions (lihat utils/permissions.ts), bukan role slug yang
  // di-hardcode, supaya admin bisa atur ulang siapa yang berhak lewat
  // halaman Role & Permission tanpa perlu ubah kode.
  const procPerm = PROCEDURE_STAGE_PERMISSION[prosedur?.status];
  const canApproveProsedur = !!procPerm && !!permissions?.[procPerm.module]?.includes(procPerm.action) && prosedurStatus === 'Pending';

  // JSA: dua tahap, dua orang berbeda.
  //   Review PGSOL    -> permission jsa.review_pgsol
  //   Persetujuan PGN -> permission jsa.approve_pgn, DAN bukan orang yang mereview
  const isTahapReviewPgsol = jsa?.status === JSA_STATUS.reviewPgsol;
  const jsaPerm = JSA_STAGE_PERMISSION[jsa?.status];
  const jsaSudahDireviewOlehSaya = jsa?.status === JSA_STATUS.approvalPgn && jsa?.reviewer_id === currentUserId;
  const canApproveJsa =
    !!jsaPerm &&
    !!permissions?.[jsaPerm.module]?.includes(jsaPerm.action) &&
    !jsaSudahDireviewOlehSaya;
  // PTW: permission tiap tahap dicek per baris karena bisa ada beberapa PTW tipe berbeda sekaligus.
  const canApprovePtwRow = (row: any) => {
    const perm = PTW_STAGE_PERMISSION[row.status];
    return !!perm && !!permissions?.[perm.module]?.includes(perm.action);
  };
  const ptwActionableRows = ptws.filter(canApprovePtwRow);
  const canApprovePtw = ptwActionableRows.length > 0;
```

Replace with:

```tsx
  // Gerbang tombol Setujui/Tolak sekarang dua lapis: (1) permission — dibaca
  // dari roles.permissions, dicocokkan lewat *_STAGE_PERMISSION, sama seperti
  // sebelumnya, menentukan apakah KARTU-nya tampil sama sekali; (2)
  // assignment — apakah user ini punya baris stage_assignments 'pending'
  // untuk tahap ini di PROYEK INI, menentukan apakah TOMBOL-nya tampil.
  // Pemegang permission yang tidak ditugaskan tetap melihat kartunya
  // (transparansi) tapi tidak melihat tombolnya.
  const getStageRows = (stageKey: string): StageAssignmentRow[] => stageAssignments?.[stageKey] ?? [];
  const isAssignedPending = (stageKey: string) =>
    getStageRows(stageKey).some(r => r.assignee_id === currentUserId && r.status === 'pending');
  const stageProgress = (stageKey: string) => {
    const rows = getStageRows(stageKey);
    return { approved: rows.filter(r => r.status === 'approved').length, total: rows.length };
  };

  const isProsedurTahapPgsol = prosedur?.status === PROCEDURE_STATUS.reviewPgsol;
  const procPerm = PROCEDURE_STAGE_PERMISSION[prosedur?.status];
  const procStageKey = procPerm ? `${procPerm.module}.${procPerm.action}` : '';
  const hasProsedurPermission = !!procPerm && !!permissions?.[procPerm.module]?.includes(procPerm.action) && prosedurStatus === 'Pending';
  const canApproveProsedur = hasProsedurPermission && isAssignedPending(procStageKey);
  const showProsedurCard = hasProsedurPermission;
  const prosedurProgress = stageProgress(procStageKey);

  // JSA: dua tahap, dua orang berbeda.
  //   Review PGSOL    -> permission jsa.review_pgsol
  //   Persetujuan PGN -> permission jsa.approve_pgn, DAN bukan orang yang mereview
  const isTahapReviewPgsol = jsa?.status === JSA_STATUS.reviewPgsol;
  const jsaPerm = JSA_STAGE_PERMISSION[jsa?.status];
  const jsaStageKey = jsaPerm ? `${jsaPerm.module}.${jsaPerm.action}` : '';
  const jsaSudahDireviewOlehSaya = jsa?.status === JSA_STATUS.approvalPgn && jsa?.reviewer_id === currentUserId;
  const hasJsaPermission =
    !!jsaPerm &&
    !!permissions?.[jsaPerm.module]?.includes(jsaPerm.action) &&
    !jsaSudahDireviewOlehSaya;
  const canApproveJsa = hasJsaPermission && isAssignedPending(jsaStageKey);
  const showJsaCard = hasJsaPermission;
  const jsaProgress = stageProgress(jsaStageKey);

  // PTW: permission & assignment dicek per baris karena bisa ada beberapa PTW tipe berbeda sekaligus.
  const ptwStageKeyForRow = (row: any) => {
    const perm = PTW_STAGE_PERMISSION[row.status];
    return perm ? `${perm.module}.${perm.action}` : '';
  };
  const hasPtwPermissionForRow = (row: any) => {
    const perm = PTW_STAGE_PERMISSION[row.status];
    return !!perm && !!permissions?.[perm.module]?.includes(perm.action);
  };
  const canApprovePtwRow = (row: any) => hasPtwPermissionForRow(row) && isAssignedPending(ptwStageKeyForRow(row));
  const ptwVisibleRows = ptws.filter(hasPtwPermissionForRow);
  const canApprovePtw = ptwVisibleRows.some(canApprovePtwRow);
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit -p .`
Expected: errors referencing `ptwActionableRows` (renamed to `ptwVisibleRows`) further down the file — expected, fixed in the next steps.

- [ ] **Step 9: Commit**

```bash
git add app/dashboard/projects/[id]/AdminProjectClient.tsx
git commit -m "Gate approval buttons on stage_assignments instead of permission alone"
```

- [ ] **Step 10: Update `ApproveModal`'s label map for the two-stage Prosedur card**

Find:

```tsx
const APPROVE_LABELS: Record<string, { title: string; desc: string }> = {
  prosedur: { title: 'Setujui Prosedur Kerja?', desc: 'Dokumen SOP akan ditandai disetujui dan vendor dapat melanjutkan ke tahap JSA.' },
  jsa: { title: 'Setujui Job Safety Analysis?', desc: 'JSA akan ditandai disetujui pada tahap ini dan lanjut ke tahap berikutnya.' },
```

Replace with:

```tsx
const APPROVE_LABELS: Record<string, { title: string; desc: string }> = {
  'prosedur-review': {
    title: 'Selesaikan Review PGSOL?',
    desc: 'Anda menyatakan Prosedur Kerja sudah sesuai standar kerja aman. Dokumen akan diteruskan ke PM untuk persetujuan akhir.',
  },
  prosedur: { title: 'Setujui Prosedur Kerja?', desc: 'Dokumen SOP akan ditandai disetujui dan vendor dapat melanjutkan ke tahap JSA.' },
  jsa: { title: 'Setujui Job Safety Analysis?', desc: 'JSA akan ditandai disetujui pada tahap ini dan lanjut ke tahap berikutnya.' },
```

- [ ] **Step 11: Wire the new label into the modal's `labelKey` selection**

Find:

```tsx
      {approveTarget && (
        <ApproveModal
          labelKey={
            approveTarget.type === 'jsa'
              ? (isTahapReviewPgsol ? 'jsa-review' : 'jsa-approve')
              : approveTarget.type
          }
```

Replace with:

```tsx
      {approveTarget && (
        <ApproveModal
          labelKey={
            approveTarget.type === 'jsa'
              ? (isTahapReviewPgsol ? 'jsa-review' : 'jsa-approve')
              : approveTarget.type === 'prosedur'
                ? (isProsedurTahapPgsol ? 'prosedur-review' : 'prosedur')
                : approveTarget.type
          }
```

- [ ] **Step 12: Verify and commit**

Run: `npx tsc --noEmit -p .` — expect the same pre-existing `ptwActionableRows` errors as Step 8, nothing new.

```bash
git add app/dashboard/projects/[id]/AdminProjectClient.tsx
git commit -m "Add two-stage approve-modal labels for Prosedur Kerja"
```

- [ ] **Step 13: Add the per-stage badge, progress indicator, and button gate to the Prosedur Kerja card**

Find:

```tsx
               {/* JIKA PROSEDUR PENDING */}
               {prosedurStatus === 'Pending' && canApproveProsedur && (
                 <div className="bg-white rounded-3xl border border-amber-200 shadow-xl overflow-hidden ring-4 ring-amber-50">
                    <div className="bg-amber-50 p-4 sm:p-6 border-b border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <div>
                         <div className="flex items-center gap-2 mb-1">
                           <FileSignature className="w-5 h-5 text-amber-600" />
                           <h3 className="text-lg font-bold text-amber-900">Prosedur Kerja (SOP)</h3>
                         </div>
                         <p className="text-amber-700 text-sm">Vendor telah mengajukan Prosedur Kerja. Silakan review dokumen di bawah ini.</p>
                       </div>
                       <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                         <button onClick={() => setRejectTarget({ type: 'prosedur', id: prosedur.id })} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-center text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-xl transition-colors shadow-sm">Tolak SOP</button>
                         <button onClick={() => setApproveTarget({ type: 'prosedur', id: prosedur.id })} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-center text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm shadow-emerald-200">Setujui SOP</button>
                       </div>
                    </div>
```

Replace with:

```tsx
               {/* JIKA PROSEDUR PENDING */}
               {showProsedurCard && (
                 <div className="bg-white rounded-3xl border border-amber-200 shadow-xl overflow-hidden ring-4 ring-amber-50">
                    <div className="bg-amber-50 p-4 sm:p-6 border-b border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <div>
                         <div className="flex items-center gap-2 mb-1 flex-wrap">
                           <FileSignature className="w-5 h-5 text-amber-600" />
                           <h3 className="text-lg font-bold text-amber-900">Prosedur Kerja (SOP)</h3>
                           <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                             {isProsedurTahapPgsol ? 'Tahap 1 — Review PGSOL' : 'Tahap 2 — Menunggu Review PM'}
                           </span>
                         </div>
                         <p className="text-amber-700 text-sm">
                           {isProsedurTahapPgsol
                             ? 'Verifikasi teknis: pastikan SOP sudah sesuai standar kerja aman sebelum diteruskan ke PM.'
                             : 'Vendor telah mengajukan Prosedur Kerja. Silakan review dokumen di bawah ini.'}
                         </p>
                         <StageProgress {...prosedurProgress} />
                       </div>
                       {canApproveProsedur && (
                         <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                           <button onClick={() => setRejectTarget({ type: 'prosedur', id: prosedur.id })} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-center text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-xl transition-colors shadow-sm">Tolak SOP</button>
                           <button onClick={() => setApproveTarget({ type: 'prosedur', id: prosedur.id })} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-center text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm shadow-emerald-200">
                             {isProsedurTahapPgsol ? 'Review & Teruskan ke PM' : 'Setujui SOP'}
                           </button>
                         </div>
                       )}
                    </div>
```

- [ ] **Step 14: Verify and commit**

Run: `npx tsc --noEmit -p .` — same pre-existing `ptwActionableRows` errors, nothing new.

```bash
git add app/dashboard/projects/[id]/AdminProjectClient.tsx
git commit -m "Add per-stage badge and progress indicator to Prosedur Kerja card"
```

- [ ] **Step 15: Add the progress indicator and button gate to the JSA card**

Find:

```tsx
               {/* JIKA JSA PENDING */}
               {jsaStatus === 'Pending' && canApproveJsa && (
                 <div className="bg-white rounded-3xl border border-amber-200 shadow-xl overflow-hidden ring-4 ring-amber-50">
                    <div className="bg-amber-50 p-4 sm:p-6 border-b border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <div>
                         <div className="flex items-center gap-2 mb-1 flex-wrap">
                           <ShieldAlert className="w-5 h-5 text-amber-600" />
                           <h3 className="text-lg font-bold text-amber-900">Job Safety Analysis (JSA)</h3>
                           <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                             {isTahapReviewPgsol ? 'Tahap 1 — Review PGSOL' : 'Tahap 2 — Persetujuan PGN'}
                           </span>
                         </div>
                         <p className="text-amber-700 text-sm">
                           {isTahapReviewPgsol
                             ? 'Verifikasi teknis: pastikan bahaya sudah teridentifikasi, mitigasi memadai, dan nilai risiko wajar.'
                             : 'Otorisasi akhir: JSA sudah direview PGSOL. Persetujuan Anda menerima risiko sisa dan mengizinkan pekerjaan berjalan.'}
                         </p>
                       </div>
                       <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                         <button
                           onClick={handleHseAssistant}
                           disabled={hseLoading || !jsa?.jsa_steps?.length}
                           title="Minta AI memindai langkah kerja berisiko tinggi dengan mitigasi lemah"
                           className="px-5 py-2.5 text-sm font-bold text-center text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                         >
                           {hseLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                           Analisis Anomali AI
                         </button>
                         <button onClick={() => setRejectTarget({ type: 'jsa', id: jsa.id })} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-center text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-xl transition-colors shadow-sm">Tolak JSA</button>
                         <button onClick={() => setApproveTarget({ type: 'jsa', id: jsa.id })} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-center text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm shadow-emerald-200">
                           {isTahapReviewPgsol ? 'Review & Teruskan ke PGN' : 'Setujui JSA'}
                         </button>
                       </div>
                    </div>
```

Replace with:

```tsx
               {/* JIKA JSA PENDING */}
               {showJsaCard && (
                 <div className="bg-white rounded-3xl border border-amber-200 shadow-xl overflow-hidden ring-4 ring-amber-50">
                    <div className="bg-amber-50 p-4 sm:p-6 border-b border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <div>
                         <div className="flex items-center gap-2 mb-1 flex-wrap">
                           <ShieldAlert className="w-5 h-5 text-amber-600" />
                           <h3 className="text-lg font-bold text-amber-900">Job Safety Analysis (JSA)</h3>
                           <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                             {isTahapReviewPgsol ? 'Tahap 1 — Review PGSOL' : 'Tahap 2 — Persetujuan PGN'}
                           </span>
                         </div>
                         <p className="text-amber-700 text-sm">
                           {isTahapReviewPgsol
                             ? 'Verifikasi teknis: pastikan bahaya sudah teridentifikasi, mitigasi memadai, dan nilai risiko wajar.'
                             : 'Otorisasi akhir: JSA sudah direview PGSOL. Persetujuan Anda menerima risiko sisa dan mengizinkan pekerjaan berjalan.'}
                         </p>
                         <StageProgress {...jsaProgress} />
                       </div>
                       <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                         <button
                           onClick={handleHseAssistant}
                           disabled={hseLoading || !jsa?.jsa_steps?.length}
                           title="Minta AI memindai langkah kerja berisiko tinggi dengan mitigasi lemah"
                           className="px-5 py-2.5 text-sm font-bold text-center text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                         >
                           {hseLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                           Analisis Anomali AI
                         </button>
                         {canApproveJsa && (
                           <>
                             <button onClick={() => setRejectTarget({ type: 'jsa', id: jsa.id })} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-center text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-xl transition-colors shadow-sm">Tolak JSA</button>
                             <button onClick={() => setApproveTarget({ type: 'jsa', id: jsa.id })} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-center text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm shadow-emerald-200">
                               {isTahapReviewPgsol ? 'Review & Teruskan ke PGN' : 'Setujui JSA'}
                             </button>
                           </>
                         )}
                       </div>
                    </div>
```

(The "Analisis Anomali AI" button stays visible to any permission-holder — it's a reviewer aid, not a gate, per its own existing doc comment further up the file. Only Tolak/Setujui move inside the `canApproveJsa` guard.)

- [ ] **Step 16: Verify and commit**

Run: `npx tsc --noEmit -p .` — same pre-existing `ptwActionableRows` errors, nothing new.

```bash
git add app/dashboard/projects/[id]/AdminProjectClient.tsx
git commit -m "Add progress indicator and button gate to JSA card"
```

- [ ] **Step 17: Switch the PTW loop to `ptwVisibleRows`, add progress indicator, gate its buttons**

Find:

```tsx
               {/* JIKA ADA PTW PENDING (bisa lebih dari satu tipe sekaligus) */}
               {ptwActionableRows.map(row => {
                 const rowTitle = PTW_TYPES.find(t => t.id === row.ptw_type)?.title.split('(')[0].trim() || row.ptw_type;
                 const safety = getPtwSafetyIssues(row);
                 return (
                   <div key={row.id} className="bg-white rounded-3xl border border-amber-200 shadow-xl overflow-hidden ring-4 ring-amber-50 mb-6">
                      <div className="bg-amber-50 p-4 sm:p-6 border-b border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                         <div>
                           <div className="flex items-center gap-2 mb-1">
                             <Stamp className="w-5 h-5 text-amber-600" />
                             <h3 className="text-lg font-bold text-amber-900">Permit to Work — {rowTitle}</h3>
                           </div>
                           <p className="text-amber-700 text-sm">Vendor telah melengkapi PTW. Silakan review pekerja & peralatan.</p>
                         </div>
                         <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                           <button onClick={() => setRejectTarget({ type: 'ptw', id: row.id })} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-center text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-xl transition-colors shadow-sm">Tolak PTW</button>
                           <button onClick={() => setApproveTarget({ type: 'ptw', id: row.id })} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-center text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm shadow-emerald-200">Setujui PTW</button>
                         </div>
                      </div>
```

Replace with:

```tsx
               {/* JIKA ADA PTW PENDING (bisa lebih dari satu tipe sekaligus) */}
               {ptwVisibleRows.map(row => {
                 const rowTitle = PTW_TYPES.find(t => t.id === row.ptw_type)?.title.split('(')[0].trim() || row.ptw_type;
                 const safety = getPtwSafetyIssues(row);
                 const rowCanApprove = canApprovePtwRow(row);
                 const rowProgress = stageProgress(ptwStageKeyForRow(row));
                 return (
                   <div key={row.id} className="bg-white rounded-3xl border border-amber-200 shadow-xl overflow-hidden ring-4 ring-amber-50 mb-6">
                      <div className="bg-amber-50 p-4 sm:p-6 border-b border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                         <div>
                           <div className="flex items-center gap-2 mb-1">
                             <Stamp className="w-5 h-5 text-amber-600" />
                             <h3 className="text-lg font-bold text-amber-900">Permit to Work — {rowTitle}</h3>
                           </div>
                           <p className="text-amber-700 text-sm">Vendor telah melengkapi PTW. Silakan review pekerja & peralatan.</p>
                           <StageProgress {...rowProgress} />
                         </div>
                         {rowCanApprove && (
                           <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                             <button onClick={() => setRejectTarget({ type: 'ptw', id: row.id })} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-center text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-xl transition-colors shadow-sm">Tolak PTW</button>
                             <button onClick={() => setApproveTarget({ type: 'ptw', id: row.id })} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-center text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm shadow-emerald-200">Setujui PTW</button>
                           </div>
                         )}
                      </div>
```

- [ ] **Step 18: Verify and commit**

Run: `npx tsc --noEmit -p .` — should now be fully clean (no more `ptwActionableRows` references anywhere in the file).

```bash
git add app/dashboard/projects/[id]/AdminProjectClient.tsx
git commit -m "Add progress indicator and button gate to PTW cards"
```

- [ ] **Step 19: Fix the "nothing pending" empty-state condition**

Find:

```tsx
               {/* KALO TIDAK ADA YANG PENDING */}
               {((!canApproveProsedur || prosedurStatus !== 'Pending') &&
                 (!canApproveJsa || jsaStatus !== 'Pending') &&
                 !canApprovePtw) && (
```

Replace with:

```tsx
               {/* KALO TIDAK ADA KARTU YANG TAMPIL (bukan cuma "tidak ada yang BISA saya approve" — pemegang permission yang belum ditugaskan tetap harus melihat kartunya) */}
               {(!showProsedurCard && !showJsaCard && ptwVisibleRows.length === 0) && (
```

- [ ] **Step 20: Verify**

Run: `npx tsc --noEmit -p .`
Expected: clean, no errors anywhere in this file.

- [ ] **Step 21: Commit**

```bash
git add app/dashboard/projects/[id]/AdminProjectClient.tsx
git commit -m "Fix empty-state condition to check card visibility, not just approvability"
```

---

### Task 11: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit -p .`
Expected: exit 0, no output.

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Confirm no leftover references to the old signatures**

Run:

```bash
grep -rn "ptwActionableRows" --include="*.tsx" --include="*.ts" .
grep -rn "savePgsolAssignment(projectId, selected)" --include="*.tsx" .
```

Expected: both commands return no matches (the first confirms the rename in Task 10 is complete everywhere; the second confirms no stale 2-argument call site of `savePgsolAssignment` survived from before Task 8).

- [ ] **Step 4: Update project memory**

This isn't a code step — after this plan finishes, the calling session should update the `project_approval_chain_revision_progress` memory file to record: Prosedur Kerja now has 3 gates matching JSA, the `rejectJsa` bug is fixed, and the new migration (`schema_procedure_pgsol_permission.sql` / RUN_ALL Transaksi 6) has **not yet** been run against the live database — it needs the same manual walkthrough treatment as prior phases before it's safe to assume working in production.

- [ ] **Step 5: Final commit (only if Steps 1-3 needed any fixup commits)**

If everything was already clean from prior task commits, there is nothing to commit here. If Step 1-3 surfaced anything, fix it and commit:

```bash
git add -A
git commit -m "Final verification fixes for Prosedur Kerja PGSOL gate work"
```
