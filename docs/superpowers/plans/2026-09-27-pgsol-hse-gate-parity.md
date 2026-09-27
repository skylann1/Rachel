# PGSOL HSE Gate + PTW Approval Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split PGSOL's existing single "Reviewer" approval stage into two sequential stages (Reviewer PGSOL, then HSE PGSOL) across Prosedur Kerja, JSA, and PTW, and give PTW a PGSOL gate it never had — so all three document types share the same approval shape: Vendor → Reviewer PGSOL → HSE PGSOL → PGN.

**Architecture:** Pure application-layer change reusing the existing `stage_assignments` table and the established per-status `{module, action}` permission-map pattern (`PROCEDURE_STAGE_PERMISSION` / `JSA_STAGE_PERMISSION` / `PTW_STAGE_PERMISSION`). Two new stage-key strings (`hse_pgsol` for all three doc types, plus `review_pgsol`/`hse_pgsol` fresh for PTW) slot into the same `writeStageAssignment`/multi-signature/single-reject-veto machinery Fase 2/3/3.1 already built. No new tables, columns, or constraints.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (Postgres + Auth), Tailwind v4. No test runner in this repo — verification is `npx tsc --noEmit` per task and `npm run build` at the end (see `AGENTS.md`).

**Spec:** `docs/superpowers/specs/2026-09-27-pgsol-hse-gate-parity-design.md`

## Global Constraints

- Never rename or repurpose the existing `procedure.review_pgsol` / `jsa.review_pgsol` stage keys — production already has `stage_assignments` rows and role grants keyed on those exact strings. They keep meaning "Reviewer PGSOL," unchanged.
- No SQL migration file. `stage_key`/`doc_type`/`status` columns are plain `TEXT` with no constraint (verified against `supabase/schema_stage_assignments.sql` and `supabase/schema.sql`). New string values are pure code.
- No auto-grant of the new permissions to any role — self-service via the existing Role & Permission UI, per explicit user decision during brainstorming.
- Verify every task with `npx tsc --noEmit` (fast, catches the majority of mistakes in this codebase's server-action-heavy style). Run `npm run build` only at the final task (slow, ~2 min).
- Follow existing code style exactly: Indonesian comments/copy, `any` typing on Supabase row shapes (matches surrounding code), no new abstractions — this plan is a horizontal extension of an established pattern, not a redesign.

---

## Task 1: Status enum, pending-list, and stage-key/permission model

**Files:**
- Modify: `lib/procedure-status.ts`
- Modify: `lib/jsa-status.ts`
- Modify: `lib/ptw-status.ts`
- Modify: `lib/stage-assignments.ts`

**Interfaces:**
- Produces: `PROCEDURE_STATUS.reviewHsePgsol`, `JSA_STATUS.reviewHsePgsol`, `PTW_STATUS.reviewPgsol`, `PTW_STATUS.reviewHsePgsol` (string constants); updated `PROCEDURE_PENDING_STATUSES`/`JSA_PENDING_STATUSES`/`PTW_PENDING_STATUSES` arrays; updated `PROCEDURE_STAGE_PERMISSION`/`JSA_STAGE_PERMISSION`/`PTW_STAGE_PERMISSION` maps; updated `PGSOL_STAGE_KEYS` (6 entries) and `STAGE_KEY_PERMISSION` in `lib/stage-assignments.ts`. All later tasks import these.

- [ ] **Step 1: Add the new status to `lib/procedure-status.ts`**

Replace the whole file's status/pending/permission section:

```ts
export const PROCEDURE_STATUS = {
  draft: 'Draft',
  reviewInternalVendor: 'Review Internal Vendor',
  reviewPgsol: 'Review PGSOL',
  reviewHsePgsol: 'Review HSE PGSOL',
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
  PROCEDURE_STATUS.reviewHsePgsol,
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
  [PROCEDURE_STATUS.reviewHsePgsol]: { module: 'procedure', action: 'hse_pgsol' },
  [PROCEDURE_STATUS.menungguReviewPM]: { module: 'procedure', action: 'review' },
};
```

Also update the file's top doc-comment (the flow diagram) to:

```ts
/**
 * Alur persetujuan Prosedur Kerja — vendor -> PGSOL (Reviewer, lalu HSE) ->
 * PGN, sama polanya dengan JSA dan PTW.
 *
 *   Draft -> Review Internal Vendor -> Review PGSOL -> Review HSE PGSOL ->
 *   Menunggu Review PM -> Prosedur Disetujui
 *
 * Review Internal Vendor tidak pernah nyampe pihak PGN/PGSOL — staff vendor
 * sendiri (ditugaskan admin vendor per proyek, lihat Fase 3) harus
 * menyetujui dulu sebelum PGSOL melihatnya. Review PGSOL -> Review HSE
 * PGSOL: dua orang PGSOL berbeda, berurutan — verifikasi teknis lalu
 * verifikasi HSE — sebelum diteruskan ke PM (PGN) untuk persetujuan akhir.
 * Reject di tahap manapun mengembalikan status ke Draft; vendor merevisi
 * lalu mengajukan ulang (balik ke Review Internal Vendor).
 */
```

- [ ] **Step 2: Add the new status to `lib/jsa-status.ts`**

```ts
export const JSA_STATUS = {
  draft: 'Draft',
  reviewInternalVendor: 'Review Internal Vendor',
  reviewPgsol: 'Review PGSOL',
  reviewHsePgsol: 'Review HSE PGSOL',
  approvalPgn: 'Persetujuan PGN',
  approved: 'JSA Disetujui',
} as const;

/**
 * Status yang berarti JSA sedang menunggu tindakan pihak INTERNAL
 * (PGN/PGSOL) — dipakai untuk /dashboard/my-task. `reviewInternalVendor`
 * SENGAJA tidak masuk sini: tahap itu menunggu staff vendor sendiri.
 */
export const JSA_PENDING_STATUSES: string[] = [
  JSA_STATUS.reviewPgsol,
  JSA_STATUS.reviewHsePgsol,
  JSA_STATUS.approvalPgn,
];

export function isJsaPending(status: string | null | undefined): boolean {
  return !!status && JSA_PENDING_STATUSES.includes(status);
}

/**
 * Permission yang berhak bertindak pada tiap tahap — dicocokkan lewat
 * roles.permissions (lihat utils/permissions.ts), bukan role slug yang
 * di-hardcode. Role apa pun yang dikasih permission ini dari halaman
 * Role & Permission otomatis bisa bertindak di tahap tersebut.
 */
export const JSA_STAGE_PERMISSION: Record<string, { module: string; action: string }> = {
  [JSA_STATUS.reviewPgsol]: { module: 'jsa', action: 'review_pgsol' },
  [JSA_STATUS.reviewHsePgsol]: { module: 'jsa', action: 'hse_pgsol' },
  [JSA_STATUS.approvalPgn]: { module: 'jsa', action: 'approve_pgn' },
};
```

Update the file's top doc-comment flow diagram to insert `Review HSE PGSOL` between `Review PGSOL` and `Persetujuan PGN`, mirroring the Prosedur comment above (same wording style, adapted to JSA's nouns — "bahaya sudah teridentifikasi, mitigasi memadai" for the Reviewer step description stays; add one sentence for the HSE step: `Review HSE PGSOL : verifikasi aspek keselamatan kerja oleh orang PGSOL yang berbeda dari Reviewer, sebelum diteruskan ke PGN.`).

- [ ] **Step 3: Add the two new statuses to `lib/ptw-status.ts`**

```ts
export const PTW_STATUS = {
  draft: 'Draft',
  reviewInternalVendor: 'Review Internal Vendor',
  reviewPgsol: 'Review PGSOL',
  reviewHsePgsol: 'Review HSE PGSOL',
  menungguApprovalPM: 'Menunggu Approval PM',
  reviewPtwIssuer: 'Review PTW Issuer',
  menungguPenomoranHSSE: 'Menunggu Penomoran HSSE',
  aktif: 'PTW Aktif',
  expired: 'Expired',
  stoppedSwa: 'Dihentikan (SWA)',
} as const;

/**
 * Status yang berarti PTW sedang menunggu tindakan pihak INTERNAL
 * (PGN/PGSOL) — dipakai untuk /dashboard/my-task. `reviewInternalVendor`
 * SENGAJA tidak masuk sini: tahap itu menunggu staff vendor sendiri.
 */
export const PTW_PENDING_STATUSES: string[] = [
  PTW_STATUS.reviewPgsol,
  PTW_STATUS.reviewHsePgsol,
  PTW_STATUS.menungguApprovalPM,
  PTW_STATUS.reviewPtwIssuer,
  PTW_STATUS.menungguPenomoranHSSE,
];

export function isPtwPending(status: string | null | undefined): boolean {
  return !!status && PTW_PENDING_STATUSES.includes(status);
}

/**
 * Permission yang berhak bertindak pada tiap tahap — dicocokkan lewat
 * roles.permissions (lihat utils/permissions.ts), bukan role slug yang
 * di-hardcode. Role apa pun yang dikasih permission ini dari halaman
 * Role & Permission otomatis bisa bertindak di tahap tersebut.
 */
export const PTW_STAGE_PERMISSION: Record<string, { module: string; action: string }> = {
  [PTW_STATUS.reviewPgsol]: { module: 'ptw', action: 'review_pgsol' },
  [PTW_STATUS.reviewHsePgsol]: { module: 'ptw', action: 'hse_pgsol' },
  [PTW_STATUS.menungguApprovalPM]: { module: 'ptw', action: 'approve_pm' },
  [PTW_STATUS.reviewPtwIssuer]: { module: 'ptw', action: 'review_issuer' },
  [PTW_STATUS.menungguPenomoranHSSE]: { module: 'ptw', action: 'numbering_hsse' },
};
```

Update the file's top doc-comment flow diagram:

```ts
/**
 * Alur persetujuan PTW — review internal vendor, lalu PGSOL (Reviewer,
 * lalu HSE), lalu tiga tahap internal PGN.
 *
 *   Review Internal Vendor -> Review PGSOL -> Review HSE PGSOL ->
 *   Menunggu Approval PM -> Review PTW Issuer -> Menunggu Penomoran HSSE
 *   -> PTW Aktif
 *
 * Review Internal Vendor tidak pernah nyampe PM — staff vendor sendiri
 * (ditugaskan admin vendor per proyek, lihat Fase 3) harus menyetujui dulu.
 * Review PGSOL -> Review HSE PGSOL: dua orang PGSOL berbeda, berurutan,
 * sama polanya dengan Prosedur Kerja dan JSA.
 * Reject di tahap manapun mengembalikan status ke Draft; vendor merevisi
 * lalu mengajukan ulang (balik ke Review Internal Vendor).
 */
```

- [ ] **Step 4: Extend `lib/stage-assignments.ts`'s stage-key lists**

Replace:

```ts
/** Kedua stage_key yang ditugaskan admin PGSOL — dipakai untuk membatasi apa yang boleh disimpan lewat savePgsolAssignment (jsa.manage_assignment_pgsol). */
export const PGSOL_STAGE_KEYS = [
  'jsa.review_pgsol',
  'procedure.review_pgsol',
] as const;
```

with:

```ts
/** Keenam stage_key yang ditugaskan admin PGSOL (Reviewer + HSE, untuk Prosedur/JSA/PTW) — dipakai untuk membatasi apa yang boleh disimpan lewat savePgsolAssignment (jsa.manage_assignment_pgsol). */
export const PGSOL_STAGE_KEYS = [
  'procedure.review_pgsol',
  'procedure.hse_pgsol',
  'jsa.review_pgsol',
  'jsa.hse_pgsol',
  'ptw.review_pgsol',
  'ptw.hse_pgsol',
] as const;
```

Replace:

```ts
export const STAGE_KEY_PERMISSION: Record<string, { module: string; action: string }> = {
  'procedure.review_vendor': { module: 'procedure', action: 'review_vendor' },
  'procedure.review_pgsol': { module: 'procedure', action: 'review_pgsol' },
  'procedure.review': { module: 'procedure', action: 'review' },
  'jsa.review_vendor': { module: 'jsa', action: 'review_vendor' },
  'jsa.review_pgsol': { module: 'jsa', action: 'review_pgsol' },
  'jsa.approve_pgn': { module: 'jsa', action: 'approve_pgn' },
  'ptw.review_vendor': { module: 'ptw', action: 'review_vendor' },
  'ptw.approve_pm': { module: 'ptw', action: 'approve_pm' },
  'ptw.review_issuer': { module: 'ptw', action: 'review_issuer' },
  'ptw.numbering_hsse': { module: 'ptw', action: 'numbering_hsse' },
};
```

with:

```ts
export const STAGE_KEY_PERMISSION: Record<string, { module: string; action: string }> = {
  'procedure.review_vendor': { module: 'procedure', action: 'review_vendor' },
  'procedure.review_pgsol': { module: 'procedure', action: 'review_pgsol' },
  'procedure.hse_pgsol': { module: 'procedure', action: 'hse_pgsol' },
  'procedure.review': { module: 'procedure', action: 'review' },
  'jsa.review_vendor': { module: 'jsa', action: 'review_vendor' },
  'jsa.review_pgsol': { module: 'jsa', action: 'review_pgsol' },
  'jsa.hse_pgsol': { module: 'jsa', action: 'hse_pgsol' },
  'jsa.approve_pgn': { module: 'jsa', action: 'approve_pgn' },
  'ptw.review_vendor': { module: 'ptw', action: 'review_vendor' },
  'ptw.review_pgsol': { module: 'ptw', action: 'review_pgsol' },
  'ptw.hse_pgsol': { module: 'ptw', action: 'hse_pgsol' },
  'ptw.approve_pm': { module: 'ptw', action: 'approve_pm' },
  'ptw.review_issuer': { module: 'ptw', action: 'review_issuer' },
  'ptw.numbering_hsse': { module: 'ptw', action: 'numbering_hsse' },
};
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (these 4 files have no other consumers yet in this task — later tasks wire them up).

- [ ] **Step 6: Commit**

```bash
git add lib/procedure-status.ts lib/jsa-status.ts lib/ptw-status.ts lib/stage-assignments.ts
git commit -m "Add HSE PGSOL stage to Prosedur/JSA and PGSOL gate to PTW status model"
```

---

## Task 2: Permission catalog (3 role-constants files)

**Files:**
- Modify: `app/dashboard/master-data/role/constants.ts`
- Modify: `app/pgsol/dashboard/role/constants.ts`
- Modify: `app/vendor/dashboard/role/constants.ts`

**Interfaces:**
- Consumes: nothing new from Task 1 (this is a UI-only catalog, independent of the lib status files).
- Produces: `hse_pgsol` selectable in the Role & Permission UI for `procedure`/`jsa` modules, `review_pgsol`+`hse_pgsol` selectable for `ptw` — required before any PGSOL admin can grant these permissions to a role, which Task 7's assignment UI depends on to find eligible candidates.

These three files are kept byte-identical at this section (verified — the last uncommitted change in this repo added `edit_safety_checklist` to all three in lockstep). Apply the same edit to all three.

- [ ] **Step 1: Edit all three files' `procedure`, `jsa`, and `ptw` modules**

In each of the 3 files, find:

```ts
      { key: 'view', label: 'Melihat Daftar Prosedur Kerja', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'review_vendor', label: 'Review Internal Vendor — Prosedur Kerja', allowedTypes: ['vendor'] },
      { key: 'review_pgsol', label: 'Review Prosedur Kerja — Tahap PGSOL', allowedTypes: ['pgsol'] },
      { key: 'review', label: 'Review & Approve Prosedur Kerja', allowedTypes: ['pgn', 'pgsol'] },
```

replace with:

```ts
      { key: 'view', label: 'Melihat Daftar Prosedur Kerja', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'review_vendor', label: 'Review Internal Vendor — Prosedur Kerja', allowedTypes: ['vendor'] },
      { key: 'review_pgsol', label: 'Review Prosedur Kerja — Tahap Reviewer PGSOL', allowedTypes: ['pgsol'] },
      { key: 'hse_pgsol', label: 'Review Prosedur Kerja — Tahap HSE PGSOL', allowedTypes: ['pgsol'] },
      { key: 'review', label: 'Review & Approve Prosedur Kerja', allowedTypes: ['pgn', 'pgsol'] },
```

then find:

```ts
      { key: 'view', label: 'Melihat Daftar JSA', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'create', label: 'Membuat Pengajuan JSA Baru', allowedTypes: ['vendor'] },
      { key: 'review_vendor', label: 'Review Internal Vendor — JSA', allowedTypes: ['vendor'] },
      { key: 'review_pgsol', label: 'Review JSA — Tahap PGSOL', allowedTypes: ['pgsol'] },
      { key: 'manage_assignment_pgsol', label: 'Menunjuk Reviewer PGSOL per Proyek', allowedTypes: ['pgsol'] },
      { key: 'approve_pgn', label: 'Approve JSA — Tahap PGN', allowedTypes: ['pgn'] },
      { key: 'delete', label: 'Menghapus Data JSA', allowedTypes: ['pgn'] },
```

replace with:

```ts
      { key: 'view', label: 'Melihat Daftar JSA', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'create', label: 'Membuat Pengajuan JSA Baru', allowedTypes: ['vendor'] },
      { key: 'review_vendor', label: 'Review Internal Vendor — JSA', allowedTypes: ['vendor'] },
      { key: 'review_pgsol', label: 'Review JSA — Tahap Reviewer PGSOL', allowedTypes: ['pgsol'] },
      { key: 'hse_pgsol', label: 'Review JSA — Tahap HSE PGSOL', allowedTypes: ['pgsol'] },
      { key: 'manage_assignment_pgsol', label: 'Menunjuk Reviewer/HSE PGSOL per Proyek', allowedTypes: ['pgsol'] },
      { key: 'approve_pgn', label: 'Approve JSA — Tahap PGN', allowedTypes: ['pgn'] },
      { key: 'delete', label: 'Menghapus Data JSA', allowedTypes: ['pgn'] },
```

then find (inside the `ptw` module, right after the `edit_safety_checklist` line each file already has from the prior uncommitted change):

```ts
      { key: 'view', label: 'Melihat Daftar PTW', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'edit_safety_checklist', label: 'Mengisi & Mengedit Safety Checklist PTW', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'review_vendor', label: 'Review Internal Vendor — PTW', allowedTypes: ['vendor'] },
      { key: 'approve_pm', label: 'Approval Tahap PM (PTW Authority)', allowedTypes: ['pgn'] },
```

replace with:

```ts
      { key: 'view', label: 'Melihat Daftar PTW', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'edit_safety_checklist', label: 'Mengisi & Mengedit Safety Checklist PTW', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'review_vendor', label: 'Review Internal Vendor — PTW', allowedTypes: ['vendor'] },
      { key: 'review_pgsol', label: 'Review PTW — Tahap Reviewer PGSOL', allowedTypes: ['pgsol'] },
      { key: 'hse_pgsol', label: 'Review PTW — Tahap HSE PGSOL', allowedTypes: ['pgsol'] },
      { key: 'approve_pm', label: 'Approval Tahap PM (PTW Authority)', allowedTypes: ['pgn'] },
```

Apply all three replacements identically to `app/dashboard/master-data/role/constants.ts`, `app/pgsol/dashboard/role/constants.ts`, and `app/vendor/dashboard/role/constants.ts`.

Also update the `ptw` module's `description` field (currently "tiga tahap approval berurutan") in all three files to "lima tahap approval berurutan" — find:

```ts
    description: 'Hak akses terkait manajemen Surat Izin Kerja Aman — tiga tahap approval berurutan.',
```

replace with:

```ts
    description: 'Hak akses terkait manajemen Surat Izin Kerja Aman — lima tahap approval berurutan.',
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/master-data/role/constants.ts app/pgsol/dashboard/role/constants.ts app/vendor/dashboard/role/constants.ts
git commit -m "Add hse_pgsol and PTW review_pgsol/hse_pgsol to the permission catalog"
```

---

## Task 3: Rewire Prosedur Kerja approve/reject for the HSE stage

**Files:**
- Modify: `app/dashboard/approval/actions.ts` (functions `approveProcedure`, `rejectProcedure`)

**Interfaces:**
- Consumes: `PROCEDURE_STATUS.reviewHsePgsol` (Task 1).
- Produces: `approveProcedure`/`rejectProcedure` now branch on 3 external stages instead of 2. Task 8 (AdminProjectClient UI) depends on this being correct to show the right copy at the right time.

- [ ] **Step 1: Edit `approveProcedure`'s stage branch**

Find:

```ts
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
```

Replace with:

```ts
  let stageKey = '';
  let nextStatus = '';

  if (current.status === PROCEDURE_STATUS.reviewPgsol) {
    stageKey = 'procedure.review_pgsol';
    nextStatus = PROCEDURE_STATUS.reviewHsePgsol;
  } else if (current.status === PROCEDURE_STATUS.reviewHsePgsol) {
    stageKey = 'procedure.hse_pgsol';
    nextStatus = PROCEDURE_STATUS.menungguReviewPM;
  } else if (current.status === PROCEDURE_STATUS.menungguReviewPM) {
    stageKey = 'procedure.review';
    nextStatus = PROCEDURE_STATUS.approved;
  } else {
    throw new Error("Prosedur tidak dalam tahap yang bisa disetujui.");
  }
```

- [ ] **Step 2: Edit `approveProcedure`'s update payload**

Find:

```ts
  const { data: profile } = await supabase.from('internal_profiles').select('id').eq('id', user.id).single();
  const updatePayload: any = stageKey === 'procedure.review_pgsol'
    ? { status: PROCEDURE_STATUS.menungguReviewPM }
    : { status: PROCEDURE_STATUS.approved, reviewed_by: profile?.id };
```

Replace with:

```ts
  const { data: profile } = await supabase.from('internal_profiles').select('id').eq('id', user.id).single();
  const updatePayload: any = stageKey === 'procedure.review_pgsol'
    ? { status: PROCEDURE_STATUS.reviewHsePgsol }
    : stageKey === 'procedure.hse_pgsol'
      ? { status: PROCEDURE_STATUS.menungguReviewPM }
      : { status: PROCEDURE_STATUS.approved, reviewed_by: profile?.id };
```

- [ ] **Step 3: Edit `approveProcedure`'s notifications**

**Note (discovered during execution):** this file's committed HEAD uses `createNotification({userId: ...})` for vendor-facing notifications, not `notifyOrgMembers({orgId: ...})` (that helper belongs to unrelated, still-uncommitted work elsewhere) — the Find/Replace below already reflects the real, correct function.

Find:

```ts
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
```

Replace with:

```ts
  if (nextStatus === PROCEDURE_STATUS.reviewHsePgsol) {
    await notifyAssignees({
      projectId: current.project_id, docType: 'procedure', stageKey: 'procedure.hse_pgsol',
      type: 'action_required',
      title: 'Prosedur Kerja Menunggu Review HSE PGSOL',
      message: `Prosedur Kerja untuk proyek "${proj?.name}" telah direview PGSOL dan menunggu review HSE Anda.`,
      link: `/dashboard/projects/${proc?.project_id}`,
    });
  }
  if (nextStatus === PROCEDURE_STATUS.menungguReviewPM) {
    await notifyAssignees({
      projectId: current.project_id, docType: 'procedure', stageKey: 'procedure.review',
      type: 'action_required',
      title: 'Prosedur Kerja Menunggu Review PM',
      message: `Prosedur Kerja untuk proyek "${proj?.name}" telah direview HSE PGSOL dan menunggu review Anda.`,
      link: `/dashboard/projects/${proc?.project_id}`,
    });
  }

  if (proj?.vendor_id) {
    const vendorTitle = nextStatus === PROCEDURE_STATUS.approved ? `Prosedur Kerja Disetujui`
      : nextStatus === PROCEDURE_STATUS.reviewHsePgsol ? `Prosedur Kerja Telah Direview PGSOL`
      : `Prosedur Kerja Telah Direview HSE PGSOL`;
    const vendorMessage = nextStatus === PROCEDURE_STATUS.approved
      ? `Prosedur Kerja untuk proyek "${proj.name}" telah disetujui. Silakan lanjutkan pengajuan JSA.`
      : nextStatus === PROCEDURE_STATUS.reviewHsePgsol
        ? `Prosedur Kerja untuk proyek "${proj.name}" telah direview PGSOL dan kini menunggu review HSE PGSOL.`
        : `Prosedur Kerja untuk proyek "${proj.name}" telah direview HSE PGSOL dan kini menunggu review PM.`;
    await createNotification({
      userId: proj.vendor_id,
      type: nextStatus === PROCEDURE_STATUS.approved ? 'approval' : 'info',
      title: vendorTitle,
      message: vendorMessage,
      link: `/vendor/dashboard/projects/${proc?.project_id}`,
    });
  }
```

- [ ] **Step 4: Edit `rejectProcedure`'s stage branch and reset cascade**

Find:

```ts
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
```

Replace with:

```ts
  let stageKey = '';
  let penolak = '';
  if (currentCheck.status === PROCEDURE_STATUS.reviewPgsol) {
    stageKey = 'procedure.review_pgsol';
    penolak = 'PGSOL';
  } else if (currentCheck.status === PROCEDURE_STATUS.reviewHsePgsol) {
    stageKey = 'procedure.hse_pgsol';
    penolak = 'HSE PGSOL';
  } else if (currentCheck.status === PROCEDURE_STATUS.menungguReviewPM) {
    stageKey = 'procedure.review';
    penolak = 'PM';
  } else {
    throw new Error("Prosedur tidak dalam tahap yang bisa ditolak.");
  }
```

Find:

```ts
  await supabase.from('stage_assignments').update({ status: 'rejected', decided_at: new Date().toISOString(), note }).eq('id', myRow.id);
  await resetStageAssignments(supabase, currentCheck.project_id, 'procedure', stageKey);
  if (stageKey === 'procedure.review') {
    // Reject di tahap PM (kedua) mengembalikan Prosedur sampai ke Draft
    // (bukan cuma ke tahap PGSOL), jadi tahap review_pgsol ikut di-reset
    // supaya konsisten dengan restart penuh — pola sama dengan rejectPtw
    // mereset ketiga tahapnya.
    await resetStageAssignments(supabase, currentCheck.project_id, 'procedure', 'procedure.review_pgsol');
  }
```

Replace with:

```ts
  await supabase.from('stage_assignments').update({ status: 'rejected', decided_at: new Date().toISOString(), note }).eq('id', myRow.id);
  await resetStageAssignments(supabase, currentCheck.project_id, 'procedure', stageKey);
  // Reject mengembalikan Prosedur sampai ke Draft, jadi SETIAP tahap
  // eksternal yang sudah lolos sebelum tahap yang menolak ini harus ikut
  // di-reset — kalau tidak, resubmission akan langsung dianggap "sudah
  // approved" di tahap itu dan meloncatinya.
  if (stageKey === 'procedure.hse_pgsol' || stageKey === 'procedure.review') {
    await resetStageAssignments(supabase, currentCheck.project_id, 'procedure', 'procedure.review_pgsol');
  }
  if (stageKey === 'procedure.review') {
    await resetStageAssignments(supabase, currentCheck.project_id, 'procedure', 'procedure.hse_pgsol');
  }
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/approval/actions.ts
git commit -m "Wire Prosedur Kerja approve/reject through the new HSE PGSOL stage"
```

---

## Task 4: Rewire JSA approve/reject for the HSE stage

**Files:**
- Modify: `app/dashboard/approval/actions.ts` (functions `approveJsa`, `rejectJsa`)

**Interfaces:**
- Consumes: `JSA_STATUS.reviewHsePgsol` (Task 1).
- Produces: `approveJsa` now sets `reviewer_id`/`reviewed_at` when the HSE stage (not the Reviewer stage) completes — this is what the existing "you already reviewed this, someone else must approve PGN" UI check (`jsaSudahDireviewOlehSaya` in `AdminProjectClient.tsx`, unchanged in Task 8) and the existing distinct-approver guard both key off.

- [ ] **Step 1: Edit `approveJsa`'s stage branch**

Find:

```ts
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
```

Replace with:

```ts
  let stageKey = '';
  let nextStatus = '';

  if (current.status === JSA_STATUS.reviewPgsol) {
    stageKey = 'jsa.review_pgsol';
    nextStatus = JSA_STATUS.reviewHsePgsol;
  } else if (current.status === JSA_STATUS.reviewHsePgsol) {
    stageKey = 'jsa.hse_pgsol';
    nextStatus = JSA_STATUS.approvalPgn;
  } else if (current.status === JSA_STATUS.approvalPgn) {
    stageKey = 'jsa.approve_pgn';
    nextStatus = JSA_STATUS.approved;
    // Pemisahan wewenang: reviewer (HSE PGSOL, orang PGSOL terakhir yang
    // menyentuh JSA sebelum PGN) dan approver PGN wajib dua orang berbeda,
    // terlepas dari siapa yang di-assign ke tahap ini.
    if (current.reviewer_id && current.reviewer_id === user.id) {
      throw new Error("JSA harus disetujui oleh orang yang berbeda dari yang melakukan review HSE PGSOL. Silakan minta Approver PGN lain untuk menyetujui.");
    }
  } else {
    throw new Error("JSA tidak dalam tahap yang bisa disetujui.");
  }
```

- [ ] **Step 2: Edit `approveJsa`'s update payload**

Find:

```ts
  const updatePayload: any = stageKey === 'jsa.review_pgsol'
    ? { reviewer_id: user.id, reviewed_at: new Date().toISOString(), status: JSA_STATUS.approvalPgn }
    : { approver_id: user.id, approved_at: new Date().toISOString(), status: JSA_STATUS.approved };
```

Replace with:

```ts
  const updatePayload: any = stageKey === 'jsa.review_pgsol'
    ? { status: JSA_STATUS.reviewHsePgsol }
    : stageKey === 'jsa.hse_pgsol'
      ? { reviewer_id: user.id, reviewed_at: new Date().toISOString(), status: JSA_STATUS.approvalPgn }
      : { approver_id: user.id, approved_at: new Date().toISOString(), status: JSA_STATUS.approved };
```

- [ ] **Step 3: Edit `approveJsa`'s notifications**

**Note (discovered during Task 3's execution):** this file's committed HEAD uses `createNotification({userId: ...})` for vendor-facing notifications, not `notifyOrgMembers({orgId: ...})` (that helper belongs to unrelated, still-uncommitted work elsewhere) — the Find/Replace below already reflects the real, correct function.

Find:

```ts
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
```

Replace with:

```ts
  if (nextStatus === JSA_STATUS.reviewHsePgsol) {
    await notifyAssignees({
      projectId: current.project_id, docType: 'jsa', stageKey: 'jsa.hse_pgsol',
      type: 'action_required',
      title: 'JSA Menunggu Review HSE PGSOL',
      message: `JSA untuk proyek "${proj?.name}" telah direview PGSOL dan menunggu review HSE Anda.`,
      link: `/dashboard/projects/${jsa?.project_id}`,
    });
  }
  if (nextStatus === JSA_STATUS.approvalPgn) {
    await notifyAssignees({
      projectId: current.project_id, docType: 'jsa', stageKey: 'jsa.approve_pgn',
      type: 'action_required',
      title: 'JSA Menunggu Persetujuan PGN',
      message: `JSA untuk proyek "${proj?.name}" telah direview HSE PGSOL dan menunggu persetujuan Anda.`,
      link: `/dashboard/projects/${jsa?.project_id}`,
    });
  }

  if (proj?.vendor_id) {
    const vendorTitle = nextStatus === JSA_STATUS.approved ? `JSA Disetujui — Lanjut ke PTW`
      : nextStatus === JSA_STATUS.reviewHsePgsol ? `JSA Telah Direview PGSOL`
      : `JSA Telah Direview HSE PGSOL`;
    const vendorMessage = nextStatus === JSA_STATUS.approved
      ? `JSA untuk proyek "${proj.name}" telah disetujui PGN. Anda dapat melanjutkan ke pengajuan PTW.`
      : nextStatus === JSA_STATUS.reviewHsePgsol
        ? `JSA untuk proyek "${proj.name}" telah direview PGSOL dan kini menunggu review HSE PGSOL.`
        : `JSA untuk proyek "${proj.name}" telah direview HSE PGSOL dan kini menunggu persetujuan PGN.`;
    await createNotification({
      userId: proj.vendor_id,
      type: nextStatus === JSA_STATUS.approved ? 'approval' : 'info',
      title: vendorTitle,
      message: vendorMessage,
      link: `/vendor/dashboard/projects/${jsa?.project_id}`,
    });
  }
```

- [ ] **Step 4: Edit `rejectJsa`'s stage branch and reset cascade**

Find:

```ts
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
```

Replace with:

```ts
  let stageKey = '';
  let penolak = '';
  if (current.status === JSA_STATUS.reviewPgsol) {
    stageKey = 'jsa.review_pgsol';
    penolak = 'PGSOL';
  } else if (current.status === JSA_STATUS.reviewHsePgsol) {
    stageKey = 'jsa.hse_pgsol';
    penolak = 'HSE PGSOL';
  } else if (current.status === JSA_STATUS.approvalPgn) {
    stageKey = 'jsa.approve_pgn';
    penolak = 'PGN';
  } else {
    throw new Error("JSA tidak dalam tahap yang bisa ditolak.");
  }
```

Find:

```ts
  await supabase.from('stage_assignments').update({ status: 'rejected', decided_at: new Date().toISOString(), note }).eq('id', myRow.id);
  await resetStageAssignments(supabase, current.project_id, 'jsa', stageKey);
  if (stageKey === 'jsa.approve_pgn') {
    // Penolakan PGN mengembalikan dokumen sampai ke tahap review PGSOL (di
    // bawah), sehingga tahap review_pgsol akan berjalan lagi juga — reset
    // baris assignment-nya supaya konsisten dengan status dokumen yang
    // restart penuh, bukan cuma tahap approve_pgn.
    await resetStageAssignments(supabase, current.project_id, 'jsa', 'jsa.review_pgsol');
  }
```

Replace with:

```ts
  await supabase.from('stage_assignments').update({ status: 'rejected', decided_at: new Date().toISOString(), note }).eq('id', myRow.id);
  await resetStageAssignments(supabase, current.project_id, 'jsa', stageKey);
  // Reject mengembalikan JSA sampai ke Draft, jadi SETIAP tahap eksternal
  // yang sudah lolos sebelum tahap yang menolak ini harus ikut di-reset —
  // kalau tidak, resubmission akan langsung dianggap "sudah approved" di
  // tahap itu dan meloncatinya.
  if (stageKey === 'jsa.hse_pgsol' || stageKey === 'jsa.approve_pgn') {
    await resetStageAssignments(supabase, current.project_id, 'jsa', 'jsa.review_pgsol');
  }
  if (stageKey === 'jsa.approve_pgn') {
    await resetStageAssignments(supabase, current.project_id, 'jsa', 'jsa.hse_pgsol');
  }
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/approval/actions.ts
git commit -m "Wire JSA approve/reject through the new HSE PGSOL stage"
```

---

## Task 5: Add PTW's PGSOL gate to approve/reject

**Files:**
- Modify: `app/dashboard/approval/actions.ts` (functions `approvePtw`, `rejectPtw`)

**Interfaces:**
- Consumes: `PTW_STATUS.reviewPgsol`, `PTW_STATUS.reviewHsePgsol` (Task 1).
- Produces: `approvePtw`/`rejectPtw` now handle 5 external stages instead of 3. Task 6 (`VENDOR_REVIEW_CONFIG.ptw`) depends on `PTW_STATUS.reviewPgsol` being a real, handled stage here — vendor-internal-review's approve will start routing PTWs into it.

- [ ] **Step 1: Edit `approvePtw`'s stage branch**

Find:

```ts
  let stageKey = '';
  let updatePayloadIfComplete: any = {};

  if (current.status === PTW_STATUS.menungguApprovalPM) {
    stageKey = 'ptw.approve_pm';
    updatePayloadIfComplete = { authority_id: user.id, authority_approved_at: new Date().toISOString(), status: PTW_STATUS.reviewPtwIssuer };
  } else if (current.status === PTW_STATUS.reviewPtwIssuer) {
```

Replace with:

```ts
  let stageKey = '';
  let updatePayloadIfComplete: any = {};

  if (current.status === PTW_STATUS.reviewPgsol) {
    stageKey = 'ptw.review_pgsol';
    updatePayloadIfComplete = { status: PTW_STATUS.reviewHsePgsol };
  } else if (current.status === PTW_STATUS.reviewHsePgsol) {
    stageKey = 'ptw.hse_pgsol';
    updatePayloadIfComplete = { status: PTW_STATUS.menungguApprovalPM };
  } else if (current.status === PTW_STATUS.menungguApprovalPM) {
    stageKey = 'ptw.approve_pm';
    updatePayloadIfComplete = { authority_id: user.id, authority_approved_at: new Date().toISOString(), status: PTW_STATUS.reviewPtwIssuer };
  } else if (current.status === PTW_STATUS.reviewPtwIssuer) {
```

(The `reviewPtwIssuer` and `menungguPenomoranHSSE` branches below stay exactly as they are — only the branch chain above them changes.)

- [ ] **Step 2: Edit the `logDocumentEvent` stage-action text**

Find:

```ts
  if (ptw?.project_id) {
    const stageAction = updatePayloadIfComplete.status === PTW_STATUS.aktif
      ? `Nomor PTW Diterbitkan & Aktif (${updatePayloadIfComplete.ptw_number})`
      : updatePayloadIfComplete.status === PTW_STATUS.reviewPtwIssuer
        ? 'Disetujui PTW Authority (PM)'
        : 'Disetujui PTW Issuer';
```

Replace with:

```ts
  if (ptw?.project_id) {
    const stageAction = updatePayloadIfComplete.status === PTW_STATUS.aktif
      ? `Nomor PTW Diterbitkan & Aktif (${updatePayloadIfComplete.ptw_number})`
      : updatePayloadIfComplete.status === PTW_STATUS.reviewHsePgsol
        ? 'Direview PGSOL'
        : updatePayloadIfComplete.status === PTW_STATUS.menungguApprovalPM
          ? 'Direview HSE PGSOL'
          : updatePayloadIfComplete.status === PTW_STATUS.reviewPtwIssuer
            ? 'Disetujui PTW Authority (PM)'
            : 'Disetujui PTW Issuer';
```

- [ ] **Step 3: Edit the stage-completion notifications**

Find:

```ts
  if (updatePayloadIfComplete.status === PTW_STATUS.reviewPtwIssuer) {
    await notifyAssignees({
      projectId: ptw!.project_id, docType: 'ptw', stageKey: 'ptw.review_issuer',
      type: 'action_required', title: 'PTW Menunggu Review Issuer',
      message: `PTW untuk proyek "${proj?.name}" telah disetujui PTW Authority dan menunggu review Anda.`,
      link: `/dashboard/projects/${ptw?.project_id}`,
    });
  } else if (updatePayloadIfComplete.status === PTW_STATUS.menungguPenomoranHSSE) {
```

Replace with:

```ts
  if (updatePayloadIfComplete.status === PTW_STATUS.reviewHsePgsol) {
    await notifyAssignees({
      projectId: ptw!.project_id, docType: 'ptw', stageKey: 'ptw.hse_pgsol',
      type: 'action_required', title: 'PTW Menunggu Review HSE PGSOL',
      message: `PTW untuk proyek "${proj?.name}" telah direview PGSOL dan menunggu review HSE Anda.`,
      link: `/dashboard/projects/${ptw?.project_id}`,
    });
  } else if (updatePayloadIfComplete.status === PTW_STATUS.menungguApprovalPM) {
    await notifyAssignees({
      projectId: ptw!.project_id, docType: 'ptw', stageKey: 'ptw.approve_pm',
      type: 'action_required', title: 'PTW Menunggu Persetujuan PM',
      message: `PTW untuk proyek "${proj?.name}" telah direview HSE PGSOL dan menunggu persetujuan Anda.`,
      link: `/dashboard/projects/${ptw?.project_id}`,
    });
  } else if (updatePayloadIfComplete.status === PTW_STATUS.reviewPtwIssuer) {
    await notifyAssignees({
      projectId: ptw!.project_id, docType: 'ptw', stageKey: 'ptw.review_issuer',
      type: 'action_required', title: 'PTW Menunggu Review Issuer',
      message: `PTW untuk proyek "${proj?.name}" telah disetujui PTW Authority dan menunggu review Anda.`,
      link: `/dashboard/projects/${ptw?.project_id}`,
    });
  } else if (updatePayloadIfComplete.status === PTW_STATUS.menungguPenomoranHSSE) {
```

(Leave the rest of that `else if` chain — the `menungguPenomoranHSSE` branch's body — untouched; only the branch header changes because a preceding `if` became `else if`.)

- [ ] **Step 4: Edit `rejectPtw`'s stage branch and reset array**

Find:

```ts
  let stageKey = '';
  if (current.status === PTW_STATUS.menungguApprovalPM) {
    stageKey = 'ptw.approve_pm';
  } else if (current.status === PTW_STATUS.reviewPtwIssuer) {
    stageKey = 'ptw.review_issuer';
  } else if (current.status === PTW_STATUS.menungguPenomoranHSSE) {
    stageKey = 'ptw.numbering_hsse';
  } else {
    throw new Error("PTW tidak dalam tahap yang bisa ditolak.");
  }
```

Replace with:

```ts
  let stageKey = '';
  if (current.status === PTW_STATUS.reviewPgsol) {
    stageKey = 'ptw.review_pgsol';
  } else if (current.status === PTW_STATUS.reviewHsePgsol) {
    stageKey = 'ptw.hse_pgsol';
  } else if (current.status === PTW_STATUS.menungguApprovalPM) {
    stageKey = 'ptw.approve_pm';
  } else if (current.status === PTW_STATUS.reviewPtwIssuer) {
    stageKey = 'ptw.review_issuer';
  } else if (current.status === PTW_STATUS.menungguPenomoranHSSE) {
    stageKey = 'ptw.numbering_hsse';
  } else {
    throw new Error("PTW tidak dalam tahap yang bisa ditolak.");
  }
```

Find:

```ts
  const otherStageKeys = ['ptw.approve_pm', 'ptw.review_issuer', 'ptw.numbering_hsse'].filter(k => k !== stageKey);
```

Replace with:

```ts
  const otherStageKeys = ['ptw.review_pgsol', 'ptw.hse_pgsol', 'ptw.approve_pm', 'ptw.review_issuer', 'ptw.numbering_hsse'].filter(k => k !== stageKey);
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/approval/actions.ts
git commit -m "Add PTW review_pgsol/hse_pgsol stages to approve/reject"
```

---

## Task 6: Route vendor-internal-review completion into the new PGSOL gate

**Files:**
- Modify: `app/vendor/dashboard/approval/actions.ts` (`VENDOR_REVIEW_CONFIG.ptw`)

**Interfaces:**
- Consumes: `PTW_STATUS.reviewPgsol` (Task 1), `ptw.review_pgsol` stage key now handled by `approvePtw`/`rejectPtw` (Task 5).
- Produces: the single point where a PTW that just finished vendor-internal-review starts routing to PGSOL instead of straight to PM. **This exact class of change (a config table that produces a status transition, living outside any per-doc-type approve/reject function) is what Fase 3.1's final review caught as a plan gap for Prosedur — verify this task actually lands, don't assume Task 5 covered it.**

- [ ] **Step 1: Edit `VENDOR_REVIEW_CONFIG.ptw`**

Find:

```ts
  ptw: {
    table: 'ptw',
    stageKey: 'ptw.review_vendor',
    externalStageKey: 'ptw.approve_pm',
    reviewVendorStatus: PTW_STATUS.reviewInternalVendor,
    draftStatus: PTW_STATUS.draft,
    nextStatus: PTW_STATUS.menungguApprovalPM,
    nextStatusLabel: 'PTW Menunggu Persetujuan',
  },
```

Replace with:

```ts
  ptw: {
    table: 'ptw',
    stageKey: 'ptw.review_vendor',
    externalStageKey: 'ptw.review_pgsol',
    reviewVendorStatus: PTW_STATUS.reviewInternalVendor,
    draftStatus: PTW_STATUS.draft,
    nextStatus: PTW_STATUS.reviewPgsol,
    nextStatusLabel: 'PTW Menunggu Review PGSOL',
  },
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/vendor/dashboard/approval/actions.ts
git commit -m "Route PTW vendor-internal-review completion to the new PGSOL gate"
```

---

## Task 7: PGSOL assignment UI — extend to 6 slots across 3 doc types

**Files:**
- Modify: `app/pgsol/dashboard/projects/actions.ts` (`savePgsolAssignment`, `getPgsolProjects`)
- Modify: `app/pgsol/dashboard/projects/[id]/assign/AssignPgsolPanel.tsx` (prop type only)
- Modify: `app/pgsol/dashboard/projects/[id]/assign/page.tsx` (data fetch + render)
- Modify: `app/pgsol/dashboard/projects/page.tsx` (copy only)

**Interfaces:**
- Consumes: `PGSOL_STAGE_KEYS` (Task 1), `hse_pgsol`/PTW `review_pgsol` permissions (Task 2).
- Produces: a PGSOL admin can now assign a Reviewer and an HSE person, separately, for Prosedur Kerja, JSA, and PTW (6 total assignment slots per project instead of 2).

- [ ] **Step 1: Widen `savePgsolAssignment`'s `docType` parameter**

In `app/pgsol/dashboard/projects/actions.ts`, find:

```ts
export async function savePgsolAssignment(
  projectId: string, docType: 'procedure' | 'jsa', stageKey: string, assigneeIds: string[]
) {
```

Replace with:

```ts
export async function savePgsolAssignment(
  projectId: string, docType: 'procedure' | 'jsa' | 'ptw', stageKey: string, assigneeIds: string[]
) {
```

- [ ] **Step 2: Include PTW in `getPgsolProjects`**

In the same file, find:

```ts
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
```

Replace with:

```ts
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id, name, status, created_at,
      vendor_profiles ( company_name ),
      procedures ( id, status ),
      jsa ( id, status ),
      ptw ( id, status )
    `)
    .order('created_at', { ascending: false });
  if (error) { console.error('getPgsolProjects error:', error.message); return []; }
  // Proyek relevan buat PGSOL begitu punya Prosedur Kerja, JSA, ATAU PTW —
  // tahap PGSOL sekarang ada di ketiga jenis dokumen.
  return (data || []).filter((p: any) => {
    const procRows = Array.isArray(p.procedures) ? p.procedures : (p.procedures ? [p.procedures] : []);
    const jsaRows = Array.isArray(p.jsa) ? p.jsa : (p.jsa ? [p.jsa] : []);
    const ptwRows = Array.isArray(p.ptw) ? p.ptw : (p.ptw ? [p.ptw] : []);
    return procRows.length > 0 || jsaRows.length > 0 || ptwRows.length > 0;
  });
```

- [ ] **Step 3: Widen `AssignPgsolPanel`'s `docType` prop type**

In `app/pgsol/dashboard/projects/[id]/assign/AssignPgsolPanel.tsx`, find:

```tsx
export default function AssignPgsolPanel({
  projectId, docType, stageKey, candidates, currentAssigneeIds, locked,
}: {
  projectId: string; docType: 'procedure' | 'jsa'; stageKey: string;
  candidates: Candidate[]; currentAssigneeIds: string[]; locked: boolean;
}) {
```

Replace with:

```tsx
export default function AssignPgsolPanel({
  projectId, docType, stageKey, candidates, currentAssigneeIds, locked,
}: {
  projectId: string; docType: 'procedure' | 'jsa' | 'ptw'; stageKey: string;
  candidates: Candidate[]; currentAssigneeIds: string[]; locked: boolean;
}) {
```

- [ ] **Step 4: Rewrite the assign page's data fetch and render**

In `app/pgsol/dashboard/projects/[id]/assign/page.tsx`, find:

```tsx
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

Replace with:

```tsx
  const { data: project } = await supabase.from('projects').select('id, name').eq('id', projectId).single();
  const [
    procReviewCandidates, procReviewAssignments, procHseCandidates, procHseAssignments,
    jsaReviewCandidates, jsaReviewAssignments, jsaHseCandidates, jsaHseAssignments,
    ptwReviewCandidates, ptwReviewAssignments, ptwHseCandidates, ptwHseAssignments,
  ] = await Promise.all([
    // Dibatasi ke org PGSOL milik admin ini — tanpa itu admin PGN (yang
    // memegang semua permission) ikut muncul sebagai kandidat reviewer.
    getEligibleAssignees(supabase, 'procedure', 'review_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'procedure', 'procedure.review_pgsol'),
    getEligibleAssignees(supabase, 'procedure', 'hse_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'procedure', 'procedure.hse_pgsol'),
    getEligibleAssignees(supabase, 'jsa', 'review_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'jsa', 'jsa.review_pgsol'),
    getEligibleAssignees(supabase, 'jsa', 'hse_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'jsa', 'jsa.hse_pgsol'),
    getEligibleAssignees(supabase, 'ptw', 'review_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'ptw', 'ptw.review_pgsol'),
    getEligibleAssignees(supabase, 'ptw', 'hse_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'ptw', 'ptw.hse_pgsol'),
  ]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/pgsol/dashboard/projects" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reviewer & HSE PGSOL — {project?.name}</h1>
          <p className="text-sm text-slate-500 mt-1">Reviewer dan HSE adalah dua tahap berurutan — semua yang ditunjuk di satu tahap harus menyetujui sebelum dokumen lanjut.</p>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">Prosedur Kerja</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Reviewer</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="procedure"
              stageKey="procedure.review_pgsol"
              candidates={procReviewCandidates}
              currentAssigneeIds={procReviewAssignments.map(a => a.assignee_id)}
              locked={procReviewAssignments.some(a => a.status !== 'pending')}
            />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">HSE</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="procedure"
              stageKey="procedure.hse_pgsol"
              candidates={procHseCandidates}
              currentAssigneeIds={procHseAssignments.map(a => a.assignee_id)}
              locked={procHseAssignments.some(a => a.status !== 'pending')}
            />
          </div>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">JSA</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Reviewer</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="jsa"
              stageKey="jsa.review_pgsol"
              candidates={jsaReviewCandidates}
              currentAssigneeIds={jsaReviewAssignments.map(a => a.assignee_id)}
              locked={jsaReviewAssignments.some(a => a.status !== 'pending')}
            />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">HSE</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="jsa"
              stageKey="jsa.hse_pgsol"
              candidates={jsaHseCandidates}
              currentAssigneeIds={jsaHseAssignments.map(a => a.assignee_id)}
              locked={jsaHseAssignments.some(a => a.status !== 'pending')}
            />
          </div>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">PTW (Permit to Work)</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Reviewer</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="ptw"
              stageKey="ptw.review_pgsol"
              candidates={ptwReviewCandidates}
              currentAssigneeIds={ptwReviewAssignments.map(a => a.assignee_id)}
              locked={ptwReviewAssignments.some(a => a.status !== 'pending')}
            />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">HSE</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="ptw"
              stageKey="ptw.hse_pgsol"
              candidates={ptwHseCandidates}
              currentAssigneeIds={ptwHseAssignments.map(a => a.assignee_id)}
              locked={ptwHseAssignments.some(a => a.status !== 'pending')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update the project-list page copy**

In `app/pgsol/dashboard/projects/page.tsx`, find:

```tsx
        <p className="text-sm text-slate-500 mt-1">Kelola siapa yang mereview Prosedur Kerja & JSA tahap PGSOL untuk tiap proyek.</p>
```

Replace with:

```tsx
        <p className="text-sm text-slate-500 mt-1">Kelola siapa yang mereview Prosedur Kerja, JSA, & PTW tahap PGSOL untuk tiap proyek.</p>
```

Find:

```tsx
              <tr><td colSpan={3} className="px-6 py-12 text-center text-sm text-slate-500">Belum ada proyek dengan Prosedur Kerja atau JSA diajukan.</td></tr>
```

Replace with:

```tsx
              <tr><td colSpan={3} className="px-6 py-12 text-center text-sm text-slate-500">Belum ada proyek dengan Prosedur Kerja, JSA, atau PTW diajukan.</td></tr>
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/pgsol/dashboard/projects/actions.ts app/pgsol/dashboard/projects/[id]/assign/AssignPgsolPanel.tsx app/pgsol/dashboard/projects/[id]/assign/page.tsx app/pgsol/dashboard/projects/page.tsx
git commit -m "Extend PGSOL assignment UI to 6 slots (Reviewer+HSE x Prosedur/JSA/PTW)"
```

---

## Task 8: Internal approval UI — 3-way copy and a latent status-bucketing bug fix

**Files:**
- Modify: `app/dashboard/projects/[id]/AdminProjectClient.tsx`

**Interfaces:**
- Consumes: `PROCEDURE_STAGE_PERMISSION`/`JSA_STAGE_PERMISSION`/`PTW_STAGE_PERMISSION` (Task 1) — the approve/reject button visibility and multi-signature progress indicator are ALREADY fully generic against these maps and `stageAssignments[stageKey]` (verified by reading the file; no code change needed there). This task only touches hardcoded per-stage COPY (badge text, description, button label, modal title/desc) and one pre-existing bug.
- Produces: correct "Tahap N — ..." labels for the new HSE stage; a fixed top-of-page status badge for Prosedur Kerja (see bug note in Step 1).

**Note on PTW:** the PTW approval card (around where `ptwVisibleRows`/`canApprovePtwRow` render) uses generic, stage-agnostic copy already ("Setujui PTW"/"Tolak PTW", no "Tahap N" label) — confirmed by reading the file. It needs **no changes** for this task; the new `ptw.review_pgsol`/`ptw.hse_pgsol` stages render correctly through the existing generic code.

**Note on why this is the right file for PGSOL, not just PGN:** despite `AGENTS.md`'s realm summary calling `/dashboard/*` "internal PGN app," `utils/supabase/middleware.ts` (around line 92-102) explicitly carves out an exception letting `type === 'pgsol'` users into `/dashboard/approval` and onward, with a comment stating this is deliberate: it's literally where the PGSOL approve/reject buttons live. There is no separate PGSOL-specific approval page anywhere in `app/pgsol/` (confirmed: no file under `app/pgsol/` imports or references `AdminProjectClient`). So this one task is a complete fix for BOTH PGN's and PGSOL's approval-card experience — no additional PGSOL-side approval-card task is needed.

**Note on `VendorProjectClient.tsx` and PDFs — confirmed to need NO changes:**
- `app/vendor/dashboard/projects/[id]/VendorProjectClient.tsx`'s status badges (`prosedurStatus`/`jsaStatus`/per-row PTW `rowStatus`) already bucket any status not explicitly `Approved`/`Rejected`/`Expired`/`Stopped`/`Draft` into a generic `'Pending'` badge that displays the raw status string as `detailedStatus` — confirmed by reading the file. The new `Review HSE PGSOL` and PTW's `Review PGSOL`/`Review HSE PGSOL` statuses fall through to this generic bucket correctly with zero code changes.
- None of `components/ptw/PtwPDF.tsx`, `ProsedurPDF`, or `JsaPDF` mention PGSOL at all (confirmed via grep across every `*PDF.tsx` file) — Fase 3.1 never added a PGSOL signatory block to any PDF, so there is nothing to extend for the HSE stage either. No PDF task in this plan.

- [ ] **Step 1: Fix a pre-existing bug in the Prosedur status bucket, and import `isProcedurePending`**

`prosedurStatus` (used for the page's top summary badge) currently checks only `PROCEDURE_STATUS.menungguReviewPM` for its 'Pending' bucket — it never checked `PROCEDURE_STATUS.reviewPgsol` either, so a Prosedur sitting in "Review PGSOL" already incorrectly shows as "Draft" in this one summary badge today (the detailed approval card below it is unaffected — that one already reads `PROCEDURE_STAGE_PERMISSION` correctly). Left unfixed, the new "Review HSE PGSOL" status would have the same bug. Fix both by switching to the existing `isProcedurePending` helper (JSA's equivalent line already uses `isJsaPending` the same way).

Find (import line):

```ts
import { PROCEDURE_STATUS, PROCEDURE_STAGE_PERMISSION } from '@/lib/procedure-status';
```

Replace with:

```ts
import { PROCEDURE_STATUS, PROCEDURE_STAGE_PERMISSION, isProcedurePending } from '@/lib/procedure-status';
```

Find:

```ts
  const prosedurStatus = prosedur?.status === PROCEDURE_STATUS.approved ? 'Approved' : prosedur?.status === PROCEDURE_STATUS.menungguReviewPM ? 'Pending' : (prosedur?.status === PROCEDURE_STATUS.draft && prosedurLastNote) ? 'Rejected' : prosedur ? 'Draft' : 'Draft';
```

Replace with:

```ts
  const prosedurStatus = prosedur?.status === PROCEDURE_STATUS.approved ? 'Approved' : isProcedurePending(prosedur?.status) ? 'Pending' : (prosedur?.status === PROCEDURE_STATUS.draft && prosedurLastNote) ? 'Rejected' : prosedur ? 'Draft' : 'Draft';
```

- [ ] **Step 2: Add the HSE-stage boolean for Prosedur and JSA**

Find:

```ts
  const isProsedurTahapPgsol = prosedur?.status === PROCEDURE_STATUS.reviewPgsol;
  const procPerm = PROCEDURE_STAGE_PERMISSION[prosedur?.status];
```

Replace with:

```ts
  const isProsedurTahapReviewPgsol = prosedur?.status === PROCEDURE_STATUS.reviewPgsol;
  const isProsedurTahapHsePgsol = prosedur?.status === PROCEDURE_STATUS.reviewHsePgsol;
  const procPerm = PROCEDURE_STAGE_PERMISSION[prosedur?.status];
```

Find:

```ts
  const isTahapReviewPgsol = jsa?.status === JSA_STATUS.reviewPgsol;
  const jsaPerm = JSA_STAGE_PERMISSION[jsa?.status];
```

Replace with:

```ts
  const isTahapReviewPgsol = jsa?.status === JSA_STATUS.reviewPgsol;
  const isTahapHsePgsol = jsa?.status === JSA_STATUS.reviewHsePgsol;
  const jsaPerm = JSA_STAGE_PERMISSION[jsa?.status];
```

- [ ] **Step 3: Add `APPROVE_LABELS` entries for the HSE stage**

Find:

```ts
const APPROVE_LABELS: Record<string, { title: string; desc: string }> = {
  'prosedur-review': {
    title: 'Selesaikan Review PGSOL?',
    desc: 'Anda menyatakan Prosedur Kerja sudah sesuai standar kerja aman. Dokumen akan diteruskan ke PM untuk persetujuan akhir.',
  },
  prosedur: { title: 'Setujui Prosedur Kerja?', desc: 'Dokumen SOP akan ditandai disetujui dan vendor dapat melanjutkan ke tahap JSA.' },
  jsa: { title: 'Setujui Job Safety Analysis?', desc: 'JSA akan ditandai disetujui pada tahap ini dan lanjut ke tahap berikutnya.' },
  'jsa-review': {
    title: 'Selesaikan Review PGSOL?',
    desc: 'Anda menyatakan JSA sudah benar secara teknis. JSA akan diteruskan ke PGN untuk persetujuan akhir oleh orang yang berbeda.',
  },
  'jsa-approve': {
    title: 'Setujui JSA sebagai PGN?',
    desc: 'Persetujuan akhir: Anda menerima risiko sisa dan mengizinkan pekerjaan berjalan. Vendor dapat lanjut ke pengajuan PTW.',
  },
  ptw: { title: 'Setujui Permit to Work?', desc: 'PTW akan ditandai disetujui pada tahap ini dan lanjut ke tahap berikutnya.' },
};
```

Replace with:

```ts
const APPROVE_LABELS: Record<string, { title: string; desc: string }> = {
  'prosedur-review': {
    title: 'Selesaikan Review PGSOL?',
    desc: 'Anda menyatakan Prosedur Kerja sudah sesuai standar kerja aman. Dokumen akan diteruskan ke HSE PGSOL untuk verifikasi lanjutan.',
  },
  'prosedur-hse': {
    title: 'Selesaikan Review HSE PGSOL?',
    desc: 'Anda menyatakan aspek HSE Prosedur Kerja sudah memadai. Dokumen akan diteruskan ke PM untuk persetujuan akhir.',
  },
  prosedur: { title: 'Setujui Prosedur Kerja?', desc: 'Dokumen SOP akan ditandai disetujui dan vendor dapat melanjutkan ke tahap JSA.' },
  jsa: { title: 'Setujui Job Safety Analysis?', desc: 'JSA akan ditandai disetujui pada tahap ini dan lanjut ke tahap berikutnya.' },
  'jsa-review': {
    title: 'Selesaikan Review PGSOL?',
    desc: 'Anda menyatakan JSA sudah benar secara teknis. JSA akan diteruskan ke HSE PGSOL untuk verifikasi lanjutan.',
  },
  'jsa-hse': {
    title: 'Selesaikan Review HSE PGSOL?',
    desc: 'Anda menyatakan aspek HSE JSA sudah memadai. JSA akan diteruskan ke PGN untuk persetujuan akhir oleh orang yang berbeda.',
  },
  'jsa-approve': {
    title: 'Setujui JSA sebagai PGN?',
    desc: 'Persetujuan akhir: Anda menerima risiko sisa dan mengizinkan pekerjaan berjalan. Vendor dapat lanjut ke pengajuan PTW.',
  },
  ptw: { title: 'Setujui Permit to Work?', desc: 'PTW akan ditandai disetujui pada tahap ini dan lanjut ke tahap berikutnya.' },
};
```

- [ ] **Step 4: Update the approve-modal `labelKey` selection**

Find:

```tsx
          labelKey={
            approveTarget.type === 'jsa'
              ? (isTahapReviewPgsol ? 'jsa-review' : 'jsa-approve')
              : approveTarget.type === 'prosedur'
                ? (isProsedurTahapPgsol ? 'prosedur-review' : 'prosedur')
                : approveTarget.type
          }
```

Replace with:

```tsx
          labelKey={
            approveTarget.type === 'jsa'
              ? (isTahapReviewPgsol ? 'jsa-review' : isTahapHsePgsol ? 'jsa-hse' : 'jsa-approve')
              : approveTarget.type === 'prosedur'
                ? (isProsedurTahapReviewPgsol ? 'prosedur-review' : isProsedurTahapHsePgsol ? 'prosedur-hse' : 'prosedur')
                : approveTarget.type
          }
```

- [ ] **Step 5: Update the Prosedur Kerja card's stage badge, description, and button text**

Find:

```tsx
                           <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                             {isProsedurTahapPgsol ? 'Tahap 1 — Review PGSOL' : 'Tahap 2 — Menunggu Review PM'}
                           </span>
                         </div>
                         <p className="text-amber-700 text-sm">
                           {isProsedurTahapPgsol
                             ? 'Verifikasi teknis: pastikan SOP sudah sesuai standar kerja aman sebelum diteruskan ke PM.'
                             : 'Vendor telah mengajukan Prosedur Kerja. Silakan review dokumen di bawah ini.'}
                         </p>
```

Replace with:

```tsx
                           <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                             {isProsedurTahapReviewPgsol ? 'Tahap 1 — Review PGSOL' : isProsedurTahapHsePgsol ? 'Tahap 2 — Review HSE PGSOL' : 'Tahap 3 — Menunggu Review PM'}
                           </span>
                         </div>
                         <p className="text-amber-700 text-sm">
                           {isProsedurTahapReviewPgsol
                             ? 'Verifikasi teknis: pastikan SOP sudah sesuai standar kerja aman sebelum diteruskan ke HSE PGSOL.'
                             : isProsedurTahapHsePgsol
                               ? 'Verifikasi HSE: pastikan aspek keselamatan kerja pada SOP sudah memadai sebelum diteruskan ke PM.'
                               : 'Vendor telah mengajukan Prosedur Kerja. Silakan review dokumen di bawah ini.'}
                         </p>
```

Find:

```tsx
                             {isProsedurTahapPgsol ? 'Review & Teruskan ke PM' : 'Setujui SOP'}
```

Replace with:

```tsx
                             {isProsedurTahapReviewPgsol ? 'Review & Teruskan ke HSE PGSOL' : isProsedurTahapHsePgsol ? 'Review & Teruskan ke PM' : 'Setujui SOP'}
```

- [ ] **Step 6: Update the JSA card's stage badge, description, and button text**

Find:

```tsx
                           <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                             {isTahapReviewPgsol ? 'Tahap 1 — Review PGSOL' : 'Tahap 2 — Persetujuan PGN'}
                           </span>
                         </div>
                         <p className="text-amber-700 text-sm">
                           {isTahapReviewPgsol
                             ? 'Verifikasi teknis: pastikan bahaya sudah teridentifikasi, mitigasi memadai, dan nilai risiko wajar.'
                             : 'Otorisasi akhir: JSA sudah direview PGSOL. Persetujuan Anda menerima risiko sisa dan mengizinkan pekerjaan berjalan.'}
                         </p>
```

Replace with:

```tsx
                           <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                             {isTahapReviewPgsol ? 'Tahap 1 — Review PGSOL' : isTahapHsePgsol ? 'Tahap 2 — Review HSE PGSOL' : 'Tahap 3 — Persetujuan PGN'}
                           </span>
                         </div>
                         <p className="text-amber-700 text-sm">
                           {isTahapReviewPgsol
                             ? 'Verifikasi teknis: pastikan bahaya sudah teridentifikasi, mitigasi memadai, dan nilai risiko wajar.'
                             : isTahapHsePgsol
                               ? 'Verifikasi HSE: pastikan aspek keselamatan kerja pada JSA ini sudah memadai sebelum diteruskan ke PGN.'
                               : 'Otorisasi akhir: JSA sudah direview PGSOL. Persetujuan Anda menerima risiko sisa dan mengizinkan pekerjaan berjalan.'}
                         </p>
```

Find:

```tsx
                               {isTahapReviewPgsol ? 'Review & Teruskan ke PGN' : 'Setujui JSA'}
```

Replace with:

```tsx
                               {isTahapReviewPgsol ? 'Review & Teruskan ke HSE PGSOL' : isTahapHsePgsol ? 'Review & Teruskan ke PGN' : 'Setujui JSA'}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/dashboard/projects/[id]/AdminProjectClient.tsx
git commit -m "Add HSE PGSOL stage copy to the internal approval UI, fix Prosedur status-bucket bug"
```

---

## Task 9: `/dashboard/my-task` title copy for the new HSE stage

**Files:**
- Modify: `app/dashboard/my-task/actions.ts`

**Interfaces:**
- Consumes: `PROCEDURE_PENDING_STATUSES`/`JSA_PENDING_STATUSES`/`PTW_PENDING_STATUSES`, `*_STAGE_PERMISSION` (Task 1) — the filter (`.in('status', ...)`) and stage-key matching are already fully generic; only two hardcoded title strings need a third branch. PTW's task title is already a single generic constant (`'Approval Permit to Work (PTW)'`) regardless of stage — confirmed by reading the file — and needs **no change**.

- [ ] **Step 1: Add the HSE branch to the Prosedur task title**

Find:

```ts
              title: proc.status === PROCEDURE_STATUS.reviewPgsol
                ? `Review Prosedur Kerja (PGSOL)`
                : `Review Prosedur Kerja (PM)`,
```

Replace with:

```ts
              title: proc.status === PROCEDURE_STATUS.reviewPgsol
                ? `Review Prosedur Kerja (PGSOL)`
                : proc.status === PROCEDURE_STATUS.reviewHsePgsol
                  ? `Review Prosedur Kerja (HSE PGSOL)`
                  : `Review Prosedur Kerja (PM)`,
```

- [ ] **Step 2: Add the HSE branch to the JSA task title**

Find:

```ts
              title: jsa.status === JSA_STATUS.reviewPgsol
                ? `Review JSA (PGSOL)`
                : `Persetujuan JSA (PGN)`,
```

Replace with:

```ts
              title: jsa.status === JSA_STATUS.reviewPgsol
                ? `Review JSA (PGSOL)`
                : jsa.status === JSA_STATUS.reviewHsePgsol
                  ? `Review JSA (HSE PGSOL)`
                  : `Persetujuan JSA (PGN)`,
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/my-task/actions.ts
git commit -m "Add HSE PGSOL task title for Prosedur/JSA in the my-task list"
```

---

## Task 10: Full verification pass

**Files:** none (verification only).

**Interfaces:** N/A — this task confirms Tasks 1–9 compose correctly.

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full production build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no route errors, `/api/ai/hse-assistant` and all `/dashboard`, `/pgsol/dashboard`, `/vendor/dashboard` routes still listed in the route table.

- [ ] **Step 3: Manual QA checklist (write this down, run it against a real/dev Supabase project if time allows — no test runner exists in this repo to automate it)**

1. As a PGSOL admin with `jsa.manage_assignment_pgsol`, open `/pgsol/dashboard/projects/<id>/assign` — confirm 6 panels render (Prosedur Reviewer/HSE, JSA Reviewer/HSE, PTW Reviewer/HSE), each independently save-able.
2. Grant a PGSOL role `procedure.hse_pgsol`, `jsa.hse_pgsol`, `ptw.review_pgsol`, `ptw.hse_pgsol` via `/pgsol/dashboard/role` (or `/dashboard/master-data/role`) — confirm those staff now appear as candidates on the assign page for the matching slot.
3. Walk one PTW through: vendor submits (Review Internal Vendor) → vendor-internal reviewer approves → status should become `Review PGSOL` (not `Menunggu Approval PM`) → PGSOL Reviewer approves → status becomes `Review HSE PGSOL` → PGSOL HSE approves → status becomes `Menunggu Approval PM` → confirm existing PM/Issuer/Numbering stages still work unchanged from there.
4. Reject a JSA at the new `Review HSE PGSOL` stage — confirm it returns to `Draft`, and that the `jsa.review_pgsol` stage_assignments rows reset to `pending` (query `stage_assignments` directly, or resubmit and confirm the Reviewer is asked again rather than the document jumping straight to `Review HSE PGSOL`).
5. Confirm `AdminProjectClient.tsx`'s Prosedur Kerja summary badge (top of page, not the detailed approval card) shows "Pending"/"Dalam Review" rather than "Draft" while status is `Review PGSOL` or `Review HSE PGSOL` (this was the pre-existing bug fixed in Task 8, Step 1).
6. Confirm a vendor user does NOT see the "Cek JSA dengan AI" button anywhere (this was fixed in the earlier, already-shipped AI-gating change — regression check only, not new work).

- [ ] **Step 4: Update the approval-chain progress memory**

This isn't a code step — after manual QA (or after confirming the automated checks are clean, if manual QA is deferred), update the `project_approval_chain_revision_progress` memory file (`C:\Users\Asus\.claude\projects\D--journey-SIPERMIT-K3-SIPERMIT-K3-APP\memory\project_approval_chain_revision_progress.md`) with a new dated section recording this phase's completion, mirroring how Fase 3/3.1 were recorded — do this in the executing session, not as a plan task with code.
