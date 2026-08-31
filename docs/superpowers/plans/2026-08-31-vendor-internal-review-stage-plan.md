# Vendor-Side Internal Review Stage (Fase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert a per-project, multi-signature "Review Internal Vendor" stage as the first pending status of Prosedur/JSA/PTW, before each document type's existing first external (PGSOL/PGN) stage — vendor admin assigns their own staff as reviewers, reusing Fase 2's `stage_assignments` mechanism entirely.

**Architecture:** No new table. Three new `stage_key` values (`procedure.review_vendor`, `jsa.review_vendor`, `ptw.review_vendor`) reuse the existing generic `lib/stage-assignments.ts` helpers. One new status per doc type (`'Review Internal Vendor'`) inserted before the existing first status. A single generic vendor-side approve/reject action pair (table-driven across the 3 doc types, since the new stage is structurally identical in all three) replaces the per-type approach Fase 2 needed for the external stages. New RLS policy lets vendor users write (not just read) `stage_assignments` rows scoped to their own projects and the 3 new stage keys.

**Tech Stack:** Next.js App Router (server actions, "use server"/"use client"), Supabase (Postgres + RLS), TypeScript, Tailwind, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-08-31-vendor-internal-review-stage-design.md`

## Global Constraints

- Repo verification convention: `npx tsc --noEmit -p .` and `npm run build` — there is no test runner in this repo. Every task ends with both commands passing.
- `'Review Internal Vendor'` must **never** be added to `PROCEDURE_PENDING_STATUSES` / `JSA_PENDING_STATUSES` / `PTW_PENDING_STATUSES` — those drive the *internal* (PGN/PGSOL) `/dashboard/my-task` list, and this stage is vendor-only.
- No schema change to `procedures`/`jsa`/`ptw` tables and no new columns on `stage_assignments` — reuse the table exactly as Fase 2 built it.
- SQL migration files are applied manually by the user against the live Supabase project (per this repo's established convention — see `supabase/README_stage_assignment_migration_order.md`), not run automatically by any task in this plan.
- Follow existing code style exactly: Indonesian UI copy and code comments, existing Tailwind class patterns, existing file-per-portal duplication convention (vendor and PGN/PGSOL each get their own small components rather than a shared abstraction — this is how the codebase already handles `AssignmentPanel.tsx` vs. what this plan adds).

---

## File Structure

**New files:**
- `supabase/schema_stage_assignments_vendor_review.sql` — RLS policy for vendor writes
- `supabase/schema_vendor_review_permissions.sql` — grants `*.review_vendor` to `vendor_admin`
- `app/vendor/dashboard/approval/actions.ts` — generic approve/reject + assignment lookup for the vendor-internal stage
- `app/vendor/dashboard/projects/[id]/assignment-actions.ts` — `saveVendorStageAssignment` server action
- `app/vendor/dashboard/projects/[id]/VendorAssignmentPanel.tsx` — admin assignment UI (client component)
- `components/vendor/VendorInternalReviewActions.tsx` — reviewer Approve/Reject widget, embedded in the 3 document pages

**Modified files:**
- `lib/procedure-status.ts`, `lib/jsa-status.ts`, `lib/ptw-status.ts` — new status constant
- `lib/stage-assignments.ts` — 3 new `STAGE_KEY_PERMISSION` entries + `VENDOR_STAGE_KEYS`
- `app/dashboard/master-data/role/constants.ts` — 3 new permission items
- `app/vendor/dashboard/projects/[id]/prosedur/actions.ts` — `saveProsedur`/`getProsedur`
- `app/vendor/dashboard/jsa/create/[id]/actions.ts` — `saveJsa`
- `app/vendor/dashboard/ptw/create/[id]/actions.ts` — `savePtw`
- `app/vendor/dashboard/my-task/actions.ts` — `getVendorMyTasks`
- `app/vendor/dashboard/projects/[id]/page.tsx`, `VendorProjectClient.tsx` — new "Assignment Reviewer" tab
- `app/vendor/dashboard/projects/[id]/prosedur/page.tsx` — embed reviewer widget
- `app/vendor/dashboard/jsa/create/[id]/page.tsx` — embed reviewer widget
- `app/vendor/dashboard/ptw/create/[id]/[type]/page.tsx` — embed reviewer widget

---

### Task 1: Data model — RLS policy and default permission grant

**Files:**
- Create: `supabase/schema_stage_assignments_vendor_review.sql`
- Create: `supabase/schema_vendor_review_permissions.sql`

**Interfaces:**
- Produces: a new RLS policy on `public.stage_assignments` that later tasks' vendor-side writes depend on; a `vendor_admin` role permissions grant that later UI-gating tasks depend on.

- [ ] **Step 1: Write the RLS policy migration**

```sql
-- supabase/schema_stage_assignments_vendor_review.sql
--
-- Fase 3: vendor sekarang perlu menulis (bukan cuma baca) baris
-- stage_assignments untuk tahap internalnya sendiri — admin vendor
-- menugaskan reviewer, dan reviewer itu sendiri mencatat approve/reject.
-- Policy existing hanya izinkan is_internal_user() menulis apa pun, dan
-- vendor cuma boleh baca (transparansi) atau reset ke pending saat resubmit.
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
```

- [ ] **Step 2: Write the default permission grant migration**

```sql
-- supabase/schema_vendor_review_permissions.sql
--
-- Fase 3: vendor_admin butuh izin default untuk jadi kandidat reviewer
-- internal (procedure/jsa/ptw . review_vendor) supaya perusahaan vendor
-- dengan satu admin saja bisa langsung pakai fitur ini tanpa harus bikin
-- role custom dulu lewat halaman Role & Permission. Merge (bukan replace
-- penuh seperti schema_org_roles.sql) supaya tidak menimpa perubahan
-- permission vendor_admin yang mungkin sudah dilakukan admin PGN lewat UI
-- sejak Fase 1. Guarded dengan `NOT ... ? 'review_vendor'` supaya aman
-- dijalankan ulang tanpa menduplikasi entri array.
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
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema_stage_assignments_vendor_review.sql supabase/schema_vendor_review_permissions.sql
git commit -m "Add Fase 3 RLS policy and default permission grant for vendor internal review"
```

---

### Task 2: Status constants — new "Review Internal Vendor" status per doc type

**Files:**
- Modify: `lib/procedure-status.ts`
- Modify: `lib/jsa-status.ts`
- Modify: `lib/ptw-status.ts`

**Interfaces:**
- Produces: `PROCEDURE_STATUS.reviewInternalVendor`, `JSA_STATUS.reviewInternalVendor`, `PTW_STATUS.reviewInternalVendor` — each equal to the string `'Review Internal Vendor'`. Later tasks (5, 6, 9, 11) read these constants; none of them go into the `*_PENDING_STATUSES` arrays.

- [ ] **Step 1: Update `lib/procedure-status.ts`**

Replace the full file content:

```ts
/**
 * Alur persetujuan Prosedur Kerja — satu tahap review internal vendor,
 * lalu satu tahap review PM.
 *
 *   Draft -> Review Internal Vendor -> Menunggu Review PM -> Prosedur Disetujui
 *
 * Review Internal Vendor tidak pernah nyampe pihak PGN/PGSOL — staff vendor
 * sendiri (ditugaskan admin vendor per proyek, lihat Fase 3) harus
 * menyetujui dulu sebelum PM melihatnya. Reject di tahap manapun
 * mengembalikan status ke Draft; vendor merevisi lalu mengajukan ulang
 * (balik ke Review Internal Vendor).
 */

export const PROCEDURE_STATUS = {
  draft: 'Draft',
  reviewInternalVendor: 'Review Internal Vendor',
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
  PROCEDURE_STATUS.menungguReviewPM,
];

export function isProcedurePending(status: string | null | undefined): boolean {
  return !!status && PROCEDURE_PENDING_STATUSES.includes(status);
}

/**
 * Permission yang berhak bertindak pada tiap tahap — dicocokkan lewat
 * roles.permissions (lihat utils/permissions.ts), bukan role slug yang
 * di-hardcode. Siapa pun boleh dikasih permission 'procedure.review' dari
 * halaman Role & Permission, tidak harus role bernama persis 'pm'.
 */
export const PROCEDURE_STAGE_PERMISSION: Record<string, { module: string; action: string }> = {
  [PROCEDURE_STATUS.menungguReviewPM]: { module: 'procedure', action: 'review' },
};
```

- [ ] **Step 2: Update `lib/jsa-status.ts`**

Replace the full file content:

```ts
/**
 * Alur persetujuan JSA — review internal vendor, lalu dua tahap eksternal.
 *
 *   Draft -> Review Internal Vendor -> Review PGSOL -> Persetujuan PGN -> JSA Disetujui
 *
 * Review Internal Vendor : staff vendor sendiri (ditugaskan admin vendor
 *                   per proyek, lihat Fase 3) harus menyetujui dulu
 *                   sebelum JSA nyampe PGSOL.
 * Review PGSOL    : verifikasi teknis oleh Satker Pemberi Kerja (PGSOL).
 *                   Mengecek bahaya sudah teridentifikasi, mitigasi memadai,
 *                   dan nilai risiko wajar. Blok "Direview Oleh" pada form.
 *
 * Persetujuan PGN : otorisasi formal oleh Satker Penanggung Jawab (PGN).
 *                   Menerima risiko sisa dan mengizinkan pekerjaan berjalan.
 *                   Blok "Disetujui Oleh" pada form.
 */

export const JSA_STATUS = {
  draft: 'Draft',
  reviewInternalVendor: 'Review Internal Vendor',
  reviewPgsol: 'Review PGSOL',
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
  [JSA_STATUS.approvalPgn]: { module: 'jsa', action: 'approve_pgn' },
};
```

- [ ] **Step 3: Update `lib/ptw-status.ts`**

Modify just the status flow comment and `PTW_STATUS` object — leave `PTW_PENDING_STATUSES`, `PTW_STAGE_PERMISSION`, `isPtwExpired`, and `getEffectivePtwStatus` untouched:

```ts
/**
 * Alur persetujuan PTW — review internal vendor, lalu tiga tahap internal PGN/PGSOL.
 *
 *   Review Internal Vendor -> Menunggu Approval PM -> Review PTW Issuer -> Menunggu Penomoran HSSE -> PTW Aktif
 *
 * Review Internal Vendor tidak pernah nyampe PM — staff vendor sendiri
 * (ditugaskan admin vendor per proyek, lihat Fase 3) harus menyetujui dulu.
 * Reject di tahap manapun mengembalikan status ke Draft; vendor merevisi
 * lalu mengajukan ulang (balik ke Review Internal Vendor).
 */
export const PTW_STATUS = {
  draft: 'Draft',
  reviewInternalVendor: 'Review Internal Vendor',
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
  PTW_STATUS.menungguApprovalPM,
  PTW_STATUS.reviewPtwIssuer,
  PTW_STATUS.menungguPenomoranHSSE,
];
```

(The rest of the file — `isPtwPending`, `PTW_STAGE_PERMISSION`, `isPtwExpired`, `getEffectivePtwStatus` — stays exactly as-is below this point.)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no new errors (these files have no other consumers that would break from an added enum-like key).

- [ ] **Step 5: Commit**

```bash
git add lib/procedure-status.ts lib/jsa-status.ts lib/ptw-status.ts
git commit -m "Add Review Internal Vendor status to Prosedur/JSA/PTW flows"
```

---

### Task 3: `lib/stage-assignments.ts` — new stage keys

**Files:**
- Modify: `lib/stage-assignments.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `STAGE_KEY_PERMISSION` gains 3 entries; new exported `VENDOR_STAGE_KEYS` constant, consumed by Task 7 (assignment action) and Task 11 (documenting which stage keys drive the reviewer widget).

- [ ] **Step 1: Add the 3 new `STAGE_KEY_PERMISSION` entries**

In `lib/stage-assignments.ts`, find the `STAGE_KEY_PERMISSION` map:

```ts
export const STAGE_KEY_PERMISSION: Record<string, { module: string; action: string }> = {
  'procedure.review': { module: 'procedure', action: 'review' },
  'jsa.review_pgsol': { module: 'jsa', action: 'review_pgsol' },
  'jsa.approve_pgn': { module: 'jsa', action: 'approve_pgn' },
  'ptw.approve_pm': { module: 'ptw', action: 'approve_pm' },
  'ptw.review_issuer': { module: 'ptw', action: 'review_issuer' },
  'ptw.numbering_hsse': { module: 'ptw', action: 'numbering_hsse' },
};
```

Replace with:

```ts
export const STAGE_KEY_PERMISSION: Record<string, { module: string; action: string }> = {
  'procedure.review_vendor': { module: 'procedure', action: 'review_vendor' },
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

- [ ] **Step 2: Add `VENDOR_STAGE_KEYS`**

Right after the existing `PGN_STAGE_KEYS` constant, add:

```ts
/** Ketiga stage_key yang ditugaskan admin vendor — dipakai untuk membatasi apa yang boleh disimpan lewat saveVendorStageAssignment (masterData.manage_org_staff). */
export const VENDOR_STAGE_KEYS = [
  'procedure.review_vendor',
  'jsa.review_vendor',
  'ptw.review_vendor',
] as const;
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/stage-assignments.ts
git commit -m "Add vendor-internal-review stage keys to stage-assignments helpers"
```

---

### Task 4: Permission catalog — 3 new `review_vendor` items

**Files:**
- Modify: `app/dashboard/master-data/role/constants.ts`

**Interfaces:**
- Produces: `procedure.review_vendor`, `jsa.review_vendor`, `ptw.review_vendor` now appear on the Role & Permission UI, selectable by any org type's roles (vendor roles only see them since they're the only roles filtered to `type = 'vendor'` on the vendor staff page — see `app/vendor/dashboard/staff/page.tsx`'s `.eq('type', 'vendor')` query).

- [ ] **Step 1: Add the item to the `procedure` module**

Find:

```ts
  {
    id: 'procedure',
    title: 'Modul Prosedur Kerja',
    description: 'Hak akses terkait dokumen Prosedur Kerja vendor — tahap pertama alur Prosedur → JSA → PTW.',
    items: [
      { key: 'view', label: 'Melihat Daftar Prosedur Kerja' },
      { key: 'review', label: 'Review & Approve Prosedur Kerja' },
    ]
  },
```

Replace with:

```ts
  {
    id: 'procedure',
    title: 'Modul Prosedur Kerja',
    description: 'Hak akses terkait dokumen Prosedur Kerja vendor — tahap pertama alur Prosedur → JSA → PTW.',
    items: [
      { key: 'view', label: 'Melihat Daftar Prosedur Kerja' },
      { key: 'review_vendor', label: 'Review Internal Vendor — Prosedur Kerja' },
      { key: 'review', label: 'Review & Approve Prosedur Kerja' },
    ]
  },
```

- [ ] **Step 2: Add the item to the `jsa` module**

Find:

```ts
  {
    id: 'jsa',
    title: 'Modul JSA (Job Safety Analysis)',
    description: 'Hak akses terkait manajemen Job Safety Analysis. Review PGSOL dan Approve PGN wajib dilakukan oleh dua orang berbeda.',
    items: [
      { key: 'view', label: 'Melihat Daftar JSA' },
      { key: 'create', label: 'Membuat Pengajuan JSA Baru' },
      { key: 'review_pgsol', label: 'Review JSA — Tahap PGSOL' },
      { key: 'manage_assignment_pgsol', label: 'Menunjuk Reviewer PGSOL per Proyek' },
      { key: 'approve_pgn', label: 'Approve JSA — Tahap PGN' },
      { key: 'delete', label: 'Menghapus Data JSA' },
    ]
  },
```

Replace with:

```ts
  {
    id: 'jsa',
    title: 'Modul JSA (Job Safety Analysis)',
    description: 'Hak akses terkait manajemen Job Safety Analysis. Review PGSOL dan Approve PGN wajib dilakukan oleh dua orang berbeda.',
    items: [
      { key: 'view', label: 'Melihat Daftar JSA' },
      { key: 'create', label: 'Membuat Pengajuan JSA Baru' },
      { key: 'review_vendor', label: 'Review Internal Vendor — JSA' },
      { key: 'review_pgsol', label: 'Review JSA — Tahap PGSOL' },
      { key: 'manage_assignment_pgsol', label: 'Menunjuk Reviewer PGSOL per Proyek' },
      { key: 'approve_pgn', label: 'Approve JSA — Tahap PGN' },
      { key: 'delete', label: 'Menghapus Data JSA' },
    ]
  },
```

- [ ] **Step 3: Add the item to the `ptw` module**

Find:

```ts
  {
    id: 'ptw',
    title: 'Modul PTW (Permit to Work)',
    description: 'Hak akses terkait manajemen Surat Izin Kerja Aman — tiga tahap approval berurutan.',
    items: [
      { key: 'view', label: 'Melihat Daftar PTW' },
      { key: 'approve_pm', label: 'Approval Tahap PM (PTW Authority)' },
      { key: 'review_issuer', label: 'Review Tahap PTW Issuer' },
      { key: 'numbering_hsse', label: 'Penomoran & Penerbitan PTW (HSSE)' },
      { key: 'resume_work', label: 'Membatalkan Stop Work Authority (Resume PTW)' },
    ]
  },
```

Replace with:

```ts
  {
    id: 'ptw',
    title: 'Modul PTW (Permit to Work)',
    description: 'Hak akses terkait manajemen Surat Izin Kerja Aman — tiga tahap approval berurutan.',
    items: [
      { key: 'view', label: 'Melihat Daftar PTW' },
      { key: 'review_vendor', label: 'Review Internal Vendor — PTW' },
      { key: 'approve_pm', label: 'Approval Tahap PM (PTW Authority)' },
      { key: 'review_issuer', label: 'Review Tahap PTW Issuer' },
      { key: 'numbering_hsse', label: 'Penomoran & Penerbitan PTW (HSSE)' },
      { key: 'resume_work', label: 'Membatalkan Stop Work Authority (Resume PTW)' },
    ]
  },
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/dashboard/master-data/role/constants.ts"
git commit -m "Add review_vendor permission items to procedure/jsa/ptw modules"
```

---

### Task 5: Generic vendor-internal approve/reject actions

**Files:**
- Create: `app/vendor/dashboard/approval/actions.ts`

**Interfaces:**
- Consumes: `getStageAssignments`, `isStageFullyApproved`, `resetStageAssignments` from `@/lib/stage-assignments` (Task 3, unchanged signatures); `PROCEDURE_STATUS.reviewInternalVendor`/`JSA_STATUS.reviewInternalVendor`/`PTW_STATUS.reviewInternalVendor` (Task 2); `notifyAssignees` from `@/app/dashboard/inbox/actions` (existing, unchanged); `logDocumentEvent` from `@/lib/document-logs` (existing, unchanged).
- Produces: `export type VendorReviewDocType = 'procedure' | 'jsa' | 'ptw'`; `getMyVendorReviewAssignment(projectId: string, docType: VendorReviewDocType): Promise<{ id: string } | null>`; `approveVendorInternalReview(docType: VendorReviewDocType, docId: string): Promise<void>`; `rejectVendorInternalReview(docType: VendorReviewDocType, docId: string, note: string): Promise<void>` — all three consumed by Task 10's `VendorInternalReviewActions` component.

- [ ] **Step 1: Write the file**

```ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { PROCEDURE_STATUS } from "@/lib/procedure-status";
import { JSA_STATUS } from "@/lib/jsa-status";
import { PTW_STATUS } from "@/lib/ptw-status";
import { logDocumentEvent } from "@/lib/document-logs";
import { getStageAssignments, isStageFullyApproved, resetStageAssignments } from "@/lib/stage-assignments";
import { notifyAssignees } from "@/app/dashboard/inbox/actions";

export type VendorReviewDocType = 'procedure' | 'jsa' | 'ptw';

interface VendorReviewConfig {
  table: string;
  stageKey: string;
  externalStageKey: string;
  reviewVendorStatus: string;
  draftStatus: string;
  nextStatus: string;
  nextStatusLabel: string;
}

/**
 * Tahap review-internal-vendor bentuknya identik di ketiga tipe dokumen —
 * selalu tahap pertama, reject selalu balik ke Draft, approve-penuh selalu
 * memajukan ke tahap eksternal pertama yang sudah ada. Beda dari
 * approveProcedure/approveJsa/approvePtw di app/dashboard/approval/actions.ts
 * (yang terpisah karena tahap EKSTERNAL beda jumlah & field per tipe), tahap
 * ini cukup satu fungsi generik, table-driven lewat config di bawah.
 */
const VENDOR_REVIEW_CONFIG: Record<VendorReviewDocType, VendorReviewConfig> = {
  procedure: {
    table: 'procedures',
    stageKey: 'procedure.review_vendor',
    externalStageKey: 'procedure.review',
    reviewVendorStatus: PROCEDURE_STATUS.reviewInternalVendor,
    draftStatus: PROCEDURE_STATUS.draft,
    nextStatus: PROCEDURE_STATUS.menungguReviewPM,
    nextStatusLabel: 'Prosedur Kerja Menunggu Review PM',
  },
  jsa: {
    table: 'jsa',
    stageKey: 'jsa.review_vendor',
    externalStageKey: 'jsa.review_pgsol',
    reviewVendorStatus: JSA_STATUS.reviewInternalVendor,
    draftStatus: JSA_STATUS.draft,
    nextStatus: JSA_STATUS.reviewPgsol,
    nextStatusLabel: 'JSA Menunggu Review PGSOL',
  },
  ptw: {
    table: 'ptw',
    stageKey: 'ptw.review_vendor',
    externalStageKey: 'ptw.approve_pm',
    reviewVendorStatus: PTW_STATUS.reviewInternalVendor,
    draftStatus: PTW_STATUS.draft,
    nextStatus: PTW_STATUS.menungguApprovalPM,
    nextStatusLabel: 'PTW Menunggu Persetujuan',
  },
};

/**
 * Baris stage_assignments 'pending' milik user yang login untuk tahap
 * review-internal-vendor satu dokumen — dipakai widget approve/reject di
 * halaman form vendor untuk memutuskan apakah tombol ditampilkan sama
 * sekali. Return null kalau tidak login atau tidak ditugaskan.
 */
export async function getMyVendorReviewAssignment(projectId: string, docType: VendorReviewDocType): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const config = VENDOR_REVIEW_CONFIG[docType];
  const rows = await getStageAssignments(supabase, projectId, docType, config.stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  return myRow ? { id: myRow.id } : null;
}

export async function approveVendorInternalReview(docType: VendorReviewDocType, docId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const config = VENDOR_REVIEW_CONFIG[docType];
  const { data: current } = await supabase.from(config.table).select('status, project_id').eq('id', docId).single();
  if (!current?.project_id) throw new Error("Dokumen ini tidak terhubung ke proyek.");
  if (current.status !== config.reviewVendorStatus) throw new Error("Dokumen tidak dalam tahap Review Internal Vendor.");

  const rows = await getStageAssignments(supabase, current.project_id, docType, config.stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk mereview dokumen ini.");

  const { error: markError } = await supabase.from('stage_assignments').update({ status: 'approved', decided_at: new Date().toISOString() }).eq('id', myRow.id);
  if (markError) throw new Error(markError.message);

  // Re-fetch fresh dari DB, bukan patch lokal dari `rows` yang sudah basi —
  // dua reviewer terakhir yang approve nyaris bersamaan bisa sama-sama
  // melihat snapshot awal yang belum mencatat approval satu sama lain,
  // sehingga dokumen macet permanen walau di DB semua baris sudah approved.
  // Pola sama dengan approveProcedure di app/dashboard/approval/actions.ts.
  const freshRows = await getStageAssignments(supabase, current.project_id, docType, config.stageKey);
  if (!isStageFullyApproved(freshRows)) {
    revalidatePath(`/vendor/dashboard/projects/${current.project_id}`);
    return;
  }

  // .eq('status', current.status) jadi optimistic lock: kalau reviewer lain
  // menolak dokumen ini persis di sela antara pembacaan status di atas dan
  // update ini, penolakan itu tidak diam-diam ditimpa oleh approve yang
  // balapan.
  const { data: updated, error } = await supabase
    .from(config.table)
    .update({ status: config.nextStatus })
    .eq('id', docId)
    .eq('status', current.status)
    .select('id');
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) {
    throw new Error("Dokumen ini baru saja diproses oleh pengguna lain. Muat ulang halaman untuk melihat status terbaru.");
  }

  await logDocumentEvent(supabase, {
    docType, docId, projectId: current.project_id, actorId: user.id,
    action: 'Direview & Disetujui Internal Vendor',
  });

  const { data: project } = await supabase.from('projects').select('name').eq('id', current.project_id).single();
  await notifyAssignees({
    projectId: current.project_id,
    docType,
    stageKey: config.externalStageKey,
    type: 'action_required',
    title: config.nextStatusLabel,
    message: `Dokumen untuk proyek "${project?.name}" telah direview internal vendor dan menunggu tindakan Anda.`,
    link: `/dashboard/projects/${current.project_id}`,
  });

  revalidatePath(`/vendor/dashboard/projects/${current.project_id}`);
}

export async function rejectVendorInternalReview(docType: VendorReviewDocType, docId: string, note: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const config = VENDOR_REVIEW_CONFIG[docType];
  // select('*') karena kolom rejection-nya beda per tabel (procedures pakai
  // content.revisions, jsa/ptw pakai kolom rejection_note) — lihat di bawah.
  const { data: current } = await supabase.from(config.table).select('*').eq('id', docId).single();
  if (!current?.project_id) throw new Error("Dokumen ini tidak terhubung ke proyek.");
  if (current.status !== config.reviewVendorStatus) throw new Error("Dokumen tidak dalam tahap Review Internal Vendor.");

  const rows = await getStageAssignments(supabase, current.project_id, docType, config.stageKey);
  const myRow = rows.find(r => r.assignee_id === user.id && r.status === 'pending');
  if (!myRow) throw new Error("Anda tidak ditugaskan untuk mereview dokumen ini.");

  await supabase.from('stage_assignments').update({ status: 'rejected', decided_at: new Date().toISOString(), note }).eq('id', myRow.id);
  await resetStageAssignments(supabase, current.project_id, docType, config.stageKey);

  const updatePayload: Record<string, any> = { status: config.draftStatus };
  if (docType === 'procedure') {
    const content = current.content || {};
    const revisions = content.revisions || [];
    revisions.push({ revNo: revisions.length + 1, date: new Date().toLocaleDateString('id-ID'), note });
    updatePayload.content = { ...content, revisions };
  } else {
    updatePayload.rejection_note = note;
  }

  const { error } = await supabase.from(config.table).update(updatePayload).eq('id', docId);
  if (error) throw new Error(error.message);

  await logDocumentEvent(supabase, {
    docType, docId, projectId: current.project_id, actorId: user.id,
    action: 'Ditolak Review Internal Vendor — Revisi Diperlukan', notes: note,
  });

  revalidatePath(`/vendor/dashboard/projects/${current.project_id}`);
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors. If `logDocumentEvent`'s `docType` parameter type rejects `VendorReviewDocType`, check `lib/document-logs.ts`'s `DocLogType` definition — it should already be `'procedure' | 'jsa' | 'ptw'` (the same literals `saveProsedur`/`saveJsa`/`savePtw` already pass today).

- [ ] **Step 3: Commit**

```bash
git add "app/vendor/dashboard/approval/actions.ts"
git commit -m "Add generic vendor-internal-review approve/reject actions"
```

---

### Task 6: Rewire submission actions to target the new vendor-internal stage

**Files:**
- Modify: `app/vendor/dashboard/projects/[id]/prosedur/actions.ts`
- Modify: `app/vendor/dashboard/jsa/create/[id]/actions.ts`
- Modify: `app/vendor/dashboard/ptw/create/[id]/actions.ts`

**Interfaces:**
- Consumes: `PROCEDURE_STATUS.reviewInternalVendor` / `JSA_STATUS.reviewInternalVendor` / `PTW_STATUS.reviewInternalVendor` (Task 2).
- Produces: `getProsedur` now also returns `id` — consumed by Task 11 (prosedur page needs the procedure's own id to pass to the reviewer widget as `docId`).

- [ ] **Step 1: Rewire `saveProsedur` and `getProsedur`**

In `app/vendor/dashboard/projects/[id]/prosedur/actions.ts`, in `saveProsedur`, replace both occurrences of `status: PROCEDURE_STATUS.menungguReviewPM` (the `update` call and the `insert` call) with `status: PROCEDURE_STATUS.reviewInternalVendor`.

Replace:

```ts
  // Dokumen ini baru saja (kembali) masuk tahap `procedure.review`, tapi jalur
  // ini BUKAN lewat rejectProcedure — jadi baris stage_assignments tahap itu
  // bisa saja masih menyimpan keputusan ronde sebelumnya ('approved' dari
  // siklus yang sudah selesai, misalnya). writeStageAssignment menolak
  // menyunting baris non-'pending' dan approver tidak punya baris 'pending'
  // untuk ditindaklanjuti, sehingga ronde baru macet permanen tanpa reset ini.
  await resetStageAssignments(supabase, projectId, 'procedure', 'procedure.review');
```

with:

```ts
  // Dokumen ini baru saja (kembali) masuk tahap `procedure.review_vendor`,
  // tapi jalur ini BUKAN lewat rejectVendorInternalReview — jadi baris
  // stage_assignments tahap itu bisa saja masih menyimpan keputusan ronde
  // sebelumnya. writeStageAssignment menolak menyunting baris non-'pending'
  // dan reviewer tidak punya baris 'pending' untuk ditindaklanjuti, sehingga
  // ronde baru macet permanen tanpa reset ini.
  await resetStageAssignments(supabase, projectId, 'procedure', 'procedure.review_vendor');
```

Replace the `notifyAssignees` call:

```ts
  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
  await notifyAssignees({
    projectId,
    docType: 'procedure',
    stageKey: 'procedure.review',
    type: 'action_required',
    title: 'Prosedur Kerja Menunggu Review',
    message: `Prosedur kerja untuk proyek "${project?.name}" telah diajukan dan menunggu review Anda.`,
    link: `/dashboard/projects/${projectId}`,
  });
}
```

with:

```ts
  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
  await notifyAssignees({
    projectId,
    docType: 'procedure',
    stageKey: 'procedure.review_vendor',
    type: 'action_required',
    title: 'Prosedur Kerja Menunggu Review Internal',
    message: `Prosedur kerja untuk proyek "${project?.name}" telah diajukan dan menunggu review internal Anda sebelum diteruskan ke PM.`,
    link: `/vendor/dashboard/projects/${projectId}/prosedur`,
  });
}
```

In `getProsedur`, add `id` to the select:

```ts
export async function getProsedur(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('procedures')
    .select('id, content, status')
    .eq('project_id', projectId)
    .single();
```

- [ ] **Step 2: Rewire `saveJsa`**

In `app/vendor/dashboard/jsa/create/[id]/actions.ts`, replace both occurrences of `JSA_STATUS.reviewPgsol` used as the *submit* status (the `insert` and the `update` call) with `JSA_STATUS.reviewInternalVendor`:

```ts
  if (!jsaId) {
    const { data: newJsa, error } = await supabase
      .from('jsa')
      .insert({
        project_id: projectId,
        status: JSA_STATUS.reviewInternalVendor
      })
      .select('id')
      .single();
      
    if (error) throw new Error(error.message);
    jsaId = newJsa.id;
  } else {
    await supabase.from('jsa').update({ status: JSA_STATUS.reviewInternalVendor, rejection_note: null }).eq('id', jsaId);
  }
```

Replace the reset call and its comment:

```ts
  // JSA (kembali) berada di tahap `jsa.review_vendor` tanpa melewati
  // rejectVendorInternalReview, jadi baris stage_assignments tahap itu bisa
  // masih memuat keputusan ronde sebelumnya. Tanpa reset ini reviewer
  // internal vendor tidak punya baris 'pending' untuk ditindaklanjuti dan
  // admin pun tidak bisa mengganti assignee (writeStageAssignment menolak
  // menyunting baris non-'pending').
  // `jsa.review_pgsol` sengaja TIDAK direset di sini — tahap itu memang
  // belum dimulai untuk ronde ini (baru dimulai kalau review internal
  // vendor selesai, lihat approveVendorInternalReview).
  await resetStageAssignments(supabase, projectId, 'jsa', 'jsa.review_vendor');
```

Replace the `notifyAssignees` call:

```ts
  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
  await notifyAssignees({
    projectId,
    docType: 'jsa',
    stageKey: 'jsa.review_vendor',
    type: 'action_required',
    title: 'JSA Menunggu Review Internal',
    message: `JSA untuk proyek "${project?.name}" telah diajukan dan menunggu review internal Anda sebelum diteruskan ke PGSOL.`,
    link: `/vendor/dashboard/jsa/create/${projectId}`,
  });
}
```

- [ ] **Step 3: Rewire `savePtw`**

In `app/vendor/dashboard/ptw/create/[id]/actions.ts`, replace both occurrences of `PTW_STATUS.menungguApprovalPM` used as the submit status (`update` and `insert`) with `PTW_STATUS.reviewInternalVendor`:

```ts
  if (existing) {
    const { data: updated, error } = await supabase
      .from('ptw')
      .update({
        workers,
        equipment,
        hazards,
        apd,
        gas_tests: gasTests,
        ...formDetails,
        status: PTW_STATUS.reviewInternalVendor,
        rejection_note: null
      })
      .eq('id', existing.id)
      .select('id');
```

```ts
  } else {
    const { data: created, error } = await supabase
      .from('ptw')
      .insert({
        project_id: projectId,
        workers,
        equipment,
        ptw_type: ptwType,
        hazards,
        apd,
        gas_tests: gasTests,
        ...formDetails,
        status: PTW_STATUS.reviewInternalVendor
      })
      .select('id')
      .single();
```

Replace the reset call, its comment, and the `resetStageAssignments` target:

```ts
  // PTW ini (baik tipe baru maupun pengajuan ulang) sekarang berada di
  // tahap `ptw.review_vendor` tanpa melewati rejectVendorInternalReview,
  // jadi baris stage_assignments tahap itu bisa masih memuat keputusan dari
  // ronde — atau dari tipe PTW — sebelumnya. Tanpa reset ini reviewer tidak
  // punya baris 'pending' untuk ditindaklanjuti dan tahap macet permanen.
  //
  // KETERBATASAN YANG DIKETAHUI: stage_assignments belum menyimpan identitas
  // dokumen (hanya project_id + doc_type + stage_key), jadi dua PTW dengan
  // tipe berbeda pada satu proyek berbagi baris assignment yang sama —
  // termasuk di tahap review_vendor ini, sama seperti keterbatasan yang
  // sudah ada di tahap approve_pm. Reset di sini benar untuk pengajuan yang
  // berurutan; perbaikan penuhnya butuh perubahan skema (kolom identitas
  // dokumen) — lihat catatan di supabase/README_stage_assignment_migration_order.md.
  await resetStageAssignments(supabase, projectId, 'ptw', 'ptw.review_vendor');
```

Replace the `notifyAssignees` call:

```ts
  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
  await notifyAssignees({
    projectId,
    docType: 'ptw',
    stageKey: 'ptw.review_vendor',
    type: 'action_required',
    title: 'PTW Menunggu Review Internal',
    message: `PTW untuk proyek "${project?.name}" telah diajukan dan menunggu review internal Anda sebelum diteruskan ke persetujuan.`,
    link: `/vendor/dashboard/ptw/create/${projectId}/${ptwType}`,
  });
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/vendor/dashboard/projects/[id]/prosedur/actions.ts" "app/vendor/dashboard/jsa/create/[id]/actions.ts" "app/vendor/dashboard/ptw/create/[id]/actions.ts"
git commit -m "Route submissions through the new vendor-internal-review stage first"
```

---

### Task 7: Vendor admin assignment action

**Files:**
- Create: `app/vendor/dashboard/projects/[id]/assignment-actions.ts`

**Interfaces:**
- Consumes: `writeStageAssignment`, `VENDOR_STAGE_KEYS` from `@/lib/stage-assignments` (Task 3); `hasPermissionForUser` from `@/utils/permissions` (existing).
- Produces: `saveVendorStageAssignment(projectId: string, stageKey: string, assigneeIds: string[]): Promise<{ error?: string; success?: true }>`, consumed by Task 8's `VendorAssignmentPanel`.

- [ ] **Step 1: Write the file**

```ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { hasPermissionForUser } from "@/utils/permissions";
import { writeStageAssignment, VENDOR_STAGE_KEYS } from "@/lib/stage-assignments";

export async function saveVendorStageAssignment(projectId: string, stageKey: string, assigneeIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const allowed = await hasPermissionForUser(supabase, user.id, 'masterData', 'manage_org_staff');
  if (!allowed) return { error: 'Anda tidak memiliki izin untuk mengelola assignment proyek.' };

  if (!(VENDOR_STAGE_KEYS as readonly string[]).includes(stageKey)) {
    return { error: 'Tahap ini bukan tahap yang dikelola vendor.' };
  }

  const result = await writeStageAssignment(supabase, user.id, { projectId, docType: stageKey.split('.')[0], stageKey, assigneeIds });
  if (result.error) return { error: result.error };

  revalidatePath(`/vendor/dashboard/projects/${projectId}`);
  return { success: true };
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/vendor/dashboard/projects/[id]/assignment-actions.ts"
git commit -m "Add vendor admin stage-assignment server action"
```

---

### Task 8: Vendor admin assignment UI

**Files:**
- Create: `app/vendor/dashboard/projects/[id]/VendorAssignmentPanel.tsx`
- Modify: `app/vendor/dashboard/projects/[id]/page.tsx`
- Modify: `app/vendor/dashboard/projects/[id]/VendorProjectClient.tsx`

**Interfaces:**
- Consumes: `saveVendorStageAssignment` (Task 7); `getStageAssignments`, `getEligibleAssignees`, `VENDOR_STAGE_KEYS`, `STAGE_KEY_PERMISSION` from `@/lib/stage-assignments` (Task 3); `getCallerVendorOrgId`, `hasPermission` (both existing).
- Produces: a new "Assignment Reviewer" tab on the vendor project detail page, visible only to callers holding `masterData.manage_org_staff`.

- [ ] **Step 1: Create `VendorAssignmentPanel.tsx`**

This mirrors `app/dashboard/master-data/project/[id]/AssignmentPanel.tsx` exactly, pointed at the vendor's own save action — the codebase's established pattern is one small component per portal rather than a shared abstraction (see e.g. `app/vendor/dashboard/my-task` vs `app/dashboard/my-task`).

```tsx
'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { saveVendorStageAssignment } from './assignment-actions';

interface Candidate { id: string; full_name: string; }
interface StageSlot {
  stageKey: string;
  label: string;
  candidates: Candidate[];
  currentAssigneeIds: string[];
  locked: boolean; // true kalau ada baris non-pending, tidak bisa diedit
}

export default function VendorAssignmentPanel({ projectId, slots }: { projectId: string; slots: StageSlot[] }) {
  const [selections, setSelections] = useState<Record<string, string[]>>(
    Object.fromEntries(slots.map(s => [s.stageKey, s.currentAssigneeIds]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [savedStageKey, setSavedStageKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(stageKey: string) {
    setSaving(stageKey);
    setError(null);
    const result = await saveVendorStageAssignment(projectId, stageKey, selections[stageKey] || []);
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
              <p className="text-xs text-slate-400">Tidak ada staff dengan izin untuk tahap ini. Berikan izin lewat halaman Role &amp; Permission.</p>
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

- [ ] **Step 2: Fetch slots and permission flag in `page.tsx`**

In `app/vendor/dashboard/projects/[id]/page.tsx`, add the imports:

```ts
import { hasPermission } from '@/utils/permissions';
import { getStageAssignments, getEligibleAssignees, VENDOR_STAGE_KEYS, STAGE_KEY_PERMISSION } from '@/lib/stage-assignments';
```

After the existing `const { data: { user } } = await supabase.auth.getUser();` line, add:

```ts
  const canManageAssignments = await hasPermission('masterData', 'manage_org_staff');
  const { data: actorProfile } = await supabase.from('profiles').select('org_id').eq('id', user?.id).single();
  const actorOrgId = actorProfile?.org_id ?? '';

  const VENDOR_STAGE_LABELS: Record<string, string> = {
    'procedure.review_vendor': 'Review Internal — Prosedur Kerja',
    'jsa.review_vendor': 'Review Internal — JSA',
    'ptw.review_vendor': 'Review Internal — PTW',
  };

  const assignmentSlots = canManageAssignments ? await Promise.all(VENDOR_STAGE_KEYS.map(async (stageKey) => {
    const docType = stageKey.split('.')[0];
    const permission = STAGE_KEY_PERMISSION[stageKey];
    const [candidates, assignments] = await Promise.all([
      getEligibleAssignees(supabase, permission.module, permission.action, actorOrgId),
      getStageAssignments(supabase, projectId, docType, stageKey),
    ]);
    return {
      stageKey,
      label: VENDOR_STAGE_LABELS[stageKey],
      candidates,
      currentAssigneeIds: assignments.map(a => a.assignee_id),
      locked: assignments.some(a => a.status !== 'pending'),
    };
  })) : [];
```

Then pass both new props to `VendorProjectClient`:

```tsx
    <VendorProjectClient
      project={project}
      currentUserId={user?.id || ''}
      jsaSignatories={jsaSignatories}
      ptwSignatories={ptwSignatories}
      siteCheckins={siteCheckins ?? []}
      toolboxMeetings={toolboxMeetings ?? []}
      canManageAssignments={canManageAssignments}
      assignmentSlots={assignmentSlots}
    />
```

- [ ] **Step 3: Add the new tab to `VendorProjectClient.tsx`**

Add the import:

```ts
import VendorAssignmentPanel from './VendorAssignmentPanel';
```

Update the component's prop type and destructuring:

```tsx
export function VendorProjectClient({ project, currentUserId, jsaSignatories, ptwSignatories, siteCheckins, toolboxMeetings, canManageAssignments, assignmentSlots }: {
  project: any; currentUserId: string; jsaSignatories?: any; ptwSignatories?: Record<string, any>;
  /** Riwayat check-in lapangan (site_checkins) lintas semua PTW proyek ini, terbaru dulu. */
  siteCheckins?: any[];
  /** Riwayat toolbox meeting (toolbox_meetings) lintas semua PTW proyek ini, terbaru dulu. */
  toolboxMeetings?: any[];
  /** true kalau caller punya masterData.manage_org_staff — menentukan apakah tab Assignment Reviewer ditampilkan. */
  canManageAssignments: boolean;
  assignmentSlots: any[];
}) {
```

Update the `tabs` array — conditionally include the new tab:

```ts
  const tabs = [
    { id: 'ringkasan', label: 'Ringkasan Proyek', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'dokumen', label: 'Dokumen K3', icon: <FileText className="w-4 h-4" /> },
    { id: 'lapangan', label: 'Status Lapangan', icon: <Siren className="w-4 h-4" /> },
    { id: 'diskusi', label: 'Diskusi & Notes', icon: <MessageSquare className="w-4 h-4" /> },
    ...(canManageAssignments ? [{ id: 'assignment', label: 'Assignment Reviewer', icon: <Users className="w-4 h-4" /> }] : []),
  ];
```

(`Users` is already imported in this file — it's used by the PGN-side pattern this mirrors; if the lucide-react `Users` icon isn't already imported here, add `Users` to the existing `lucide-react` import line at the top of the file.)

Add the new tab's content block — insert this right after the closing of the `{/* --- TAB: DISKUSI & NOTES --- */}` block (the last existing `activeTab === '...'` block in the file, immediately before the final closing `</div>` of the component's returned JSX):

```tsx
      {/* --- TAB: ASSIGNMENT REVIEWER --- */}
      {activeTab === 'assignment' && canManageAssignments && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5">
            <h3 className="text-blue-800 font-bold mb-1 flex items-center gap-2">
              <Users className="w-4 h-4" /> Assignment Reviewer Internal
            </h3>
            <p className="text-sm text-blue-600/80">
              Tunjuk staff perusahaan Anda untuk mereview setiap dokumen K3 sebelum diajukan ke PGSOL/PGN.
              Kalau lebih dari satu orang ditugaskan pada satu tahap, semuanya harus menyetujui sebelum dokumen lanjut.
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <VendorAssignmentPanel projectId={project.id} slots={assignmentSlots} />
          </div>
        </div>
      )}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors. If `Users` isn't already imported from `lucide-react` in `VendorProjectClient.tsx`, this step will surface it — add it to the existing import line.

- [ ] **Step 5: Manual test**

As a `vendor_admin`, open a project's detail page, confirm the "Assignment Reviewer" tab appears, shows 3 slots (Prosedur/JSA/PTW), and saving an assignee persists after reload. As a non-admin vendor staff member (no `manage_org_staff`), confirm the tab does not appear.

- [ ] **Step 6: Commit**

```bash
git add "app/vendor/dashboard/projects/[id]/VendorAssignmentPanel.tsx" "app/vendor/dashboard/projects/[id]/page.tsx" "app/vendor/dashboard/projects/[id]/VendorProjectClient.tsx"
git commit -m "Add vendor admin assignment UI for the internal review stage"
```

---

### Task 9: Reviewer task list — "Menunggu Review Internal Saya"

**Files:**
- Modify: `app/vendor/dashboard/my-task/actions.ts`

**Interfaces:**
- Consumes: `PTW_STATUS.reviewInternalVendor` (Task 2, already imported in this file as `PTW_STATUS`).
- Produces: `getVendorMyTasks()` now also returns assignee-perspective "pending my review" items.

- [ ] **Step 1: Add the query and item-building block**

Find the end of `getVendorMyTasks`, right before the final `return tasks.sort(...)` line:

```ts
  return tasks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
```

Insert the new block right before that `return`:

```ts
  // 6. Dokumen menunggu review internal SAYA (assignee-perspective — beda
  // dari bullet-bullet di atas yang submitter-perspective/org-wide).
  const { data: myAssignments } = await supabase
    .from('stage_assignments')
    .select('id, project_id, doc_type, assigned_at')
    .eq('assignee_id', user.id)
    .eq('status', 'pending')
    .in('stage_key', ['procedure.review_vendor', 'jsa.review_vendor', 'ptw.review_vendor']);

  (myAssignments || []).forEach((a: any) => {
    const project = (projects || []).find((p: any) => p.id === a.project_id);
    if (!project) return;
    const date = a.assigned_at;

    if (a.doc_type === 'procedure') {
      tasks.push({
        id: `review-vendor-procedure-${a.id}`,
        title: 'Review Internal — Prosedur Kerja',
        type: 'Prosedur',
        projectName: project.name,
        date,
        url: `/vendor/dashboard/projects/${project.id}/prosedur`,
        status: 'Menunggu Review Saya',
        urgency: getUrgency(date),
        timeInQueue: formatTimeInQueue(date),
      });
    } else if (a.doc_type === 'jsa') {
      tasks.push({
        id: `review-vendor-jsa-${a.id}`,
        title: 'Review Internal — JSA',
        type: 'JSA',
        projectName: project.name,
        date,
        url: `/vendor/dashboard/jsa/create/${project.id}`,
        status: 'Menunggu Review Saya',
        urgency: getUrgency(date),
        timeInQueue: formatTimeInQueue(date),
      });
    } else if (a.doc_type === 'ptw') {
      const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
      const pendingPtw = ptws.find((p: any) => p.status === PTW_STATUS.reviewInternalVendor);
      tasks.push({
        id: `review-vendor-ptw-${a.id}`,
        title: `Review Internal — PTW${pendingPtw ? ` (${ptwTypeTitle(pendingPtw.ptw_type)})` : ''}`,
        type: 'PTW',
        projectName: project.name,
        date,
        url: pendingPtw ? `/vendor/dashboard/ptw/create/${project.id}/${pendingPtw.ptw_type}` : `/vendor/dashboard/ptw/create/${project.id}`,
        status: 'Menunggu Review Saya',
        urgency: getUrgency(date),
        timeInQueue: formatTimeInQueue(date),
      });
    }
  });

  return tasks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Manual test**

Assign a vendor staff member to a project's Prosedur `review_vendor` slot (Task 8's UI), submit the Prosedur as that project's vendor (Task 6's rewired flow), then log in as the assigned staff member and confirm "Review Internal — Prosedur Kerja" appears on `/vendor/dashboard/my-task`.

- [ ] **Step 4: Commit**

```bash
git add "app/vendor/dashboard/my-task/actions.ts"
git commit -m "Surface vendor-internal-review assignments on the vendor task list"
```

---

### Task 10: Reviewer Approve/Reject widget

**Files:**
- Create: `components/vendor/VendorInternalReviewActions.tsx`

**Interfaces:**
- Consumes: `getMyVendorReviewAssignment`, `approveVendorInternalReview`, `rejectVendorInternalReview`, `VendorReviewDocType` from `@/app/vendor/dashboard/approval/actions` (Task 5).
- Produces: `<VendorInternalReviewActions projectId={string} docType={VendorReviewDocType} docId={string | null} />`, a self-contained widget (fetches its own data, renders nothing if the current user has no pending assignment) consumed by Task 11's 3 page integrations.

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, ShieldQuestion } from 'lucide-react';
import { getMyVendorReviewAssignment, approveVendorInternalReview, rejectVendorInternalReview, type VendorReviewDocType } from '@/app/vendor/dashboard/approval/actions';

export function VendorInternalReviewActions({ projectId, docType, docId }: {
  projectId: string;
  docType: VendorReviewDocType;
  docId: string | null;
}) {
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!docId) { setLoading(false); return; }
      const assignment = await getMyVendorReviewAssignment(projectId, docType);
      if (!cancelled) {
        setAssignmentId(assignment?.id ?? null);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId, docType, docId]);

  async function handleApprove() {
    if (!docId) return;
    setBusy(true);
    setError(null);
    try {
      await approveVendorInternalReview(docType, docId);
      setDone('approved');
    } catch (err: any) {
      setError(err.message || 'Gagal menyetujui dokumen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!docId || !note.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await rejectVendorInternalReview(docType, docId, note.trim());
      setDone('rejected');
    } catch (err: any) {
      setError(err.message || 'Gagal menolak dokumen.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !docId || (!assignmentId && !done)) return null;

  if (done === 'approved') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3 text-emerald-700">
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        <p className="text-sm font-semibold">Anda telah menyetujui dokumen ini di tahap Review Internal Vendor.</p>
      </div>
    );
  }
  if (done === 'rejected') {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex items-center gap-3 text-rose-700">
        <XCircle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-semibold">Dokumen ditolak dan dikembalikan ke Draft untuk direvisi.</p>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <ShieldQuestion className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800">Menunggu Review Internal Anda</p>
          <p className="text-xs text-amber-700 mt-1">Anda ditugaskan sebagai reviewer internal vendor untuk dokumen ini sebelum diajukan ke PGSOL/PGN.</p>
        </div>
      </div>

      {error && <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</div>}

      {!showRejectForm ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleApprove}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Setujui
          </button>
          <button
            type="button"
            onClick={() => setShowRejectForm(true)}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-rose-600 border border-rose-200 text-sm font-bold rounded-xl hover:bg-rose-50 disabled:opacity-50 transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Tolak
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan revisi untuk vendor..."
            rows={3}
            className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-300"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReject}
              disabled={busy || !note.trim()}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Kirim Penolakan
            </button>
            <button
              type="button"
              onClick={() => { setShowRejectForm(false); setNote(''); }}
              disabled={busy}
              className="px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "components/vendor/VendorInternalReviewActions.tsx"
git commit -m "Add reusable vendor-internal-review Approve/Reject widget"
```

---

### Task 11: Embed the reviewer widget in the 3 document pages

**Files:**
- Modify: `app/vendor/dashboard/projects/[id]/prosedur/page.tsx`
- Modify: `app/vendor/dashboard/jsa/create/[id]/page.tsx`
- Modify: `app/vendor/dashboard/ptw/create/[id]/[type]/page.tsx`

**Interfaces:**
- Consumes: `VendorInternalReviewActions` (Task 10); `getProsedur` now returning `id` (Task 6).

- [ ] **Step 1: Wire into the Prosedur page**

In `app/vendor/dashboard/projects/[id]/prosedur/page.tsx`, add the import:

```ts
import { VendorInternalReviewActions } from '@/components/vendor/VendorInternalReviewActions';
```

Add a state variable for the procedure's own id, next to the other `useState` declarations near the top of the component:

```ts
  const [procedureId, setProcedureId] = useState<string | null>(null);
```

In the `loadData` effect, where `getProsedur` result is consumed, capture the id:

```ts
    async function loadData() {
      if (params.id) {
        const data = await getProsedur(params.id as string);
        if (data && data.content) {
          const content = data.content;
          setDocNo(content.docNo || '');
```

Add, right after `if (params.id) {` and before the existing `const data = await getProsedur(...)` line stays the same — insert one line right after `const data = await getProsedur(params.id as string);`:

```ts
        const data = await getProsedur(params.id as string);
        if (data?.id) setProcedureId(data.id);
        if (data && data.content) {
```

Insert the widget in the JSX, right after the "Header Info" block and before the `<form onSubmit={handleSubmit} ...>` opening tag:

```tsx
      {/* Header Info */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-3xl p-8 border border-primary/10">
        {/* ...unchanged... */}
      </div>

      <VendorInternalReviewActions projectId={params.id as string} docType="procedure" docId={procedureId} />

      <form onSubmit={handleSubmit} className="space-y-8">
```

- [ ] **Step 2: Wire into the JSA page**

In `app/vendor/dashboard/jsa/create/[id]/page.tsx`, add the import:

```ts
import { VendorInternalReviewActions } from '@/components/vendor/VendorInternalReviewActions';
```

Add a state variable next to the other `useState` declarations (around line 48-53):

```ts
  const [jsaId, setJsaId] = useState<string | null>(null);
```

In `loadData`, capture the id — the `getJsa` result shape is `{ jsa: {id, status} | null, steps, procedureSteps }`. Right after `const data = await getJsa(projectId);` add:

```ts
        const data = await getJsa(projectId);
        if (data?.jsa?.id) setJsaId(data.jsa.id);
        let finalSteps: any[] = [];
```

Insert the widget in the JSX, right after the header block's closing `</div>` (the one at line 310 in the pre-edit file, closing the flex header containing the title and the Submit/Cek-Skor buttons) and before the `{gatekeeperError && (...)}` block:

```tsx
        </div>
      </div>

      <VendorInternalReviewActions projectId={projectId} docType="jsa" docId={jsaId} />

      {gatekeeperError && (
```

- [ ] **Step 3: Wire into the PTW type page**

In `app/vendor/dashboard/ptw/create/[id]/[type]/page.tsx`, add the import:

```ts
import { VendorInternalReviewActions } from '@/components/vendor/VendorInternalReviewActions';
```

Add a state variable next to the other `useState` declarations (around line 73):

```ts
  const [ptwId, setPtwId] = useState<string | null>(null);
```

In `loadData`, inside the existing `if (data) { ... }` block, capture the id — add this as the first line inside that block:

```ts
      if (data) {
        setPtwId(data.id);
        // Merevisi PTW tipe ini yang sudah pernah diajukan.
        if (data.workers) setSelectedPekerja(data.workers.map((w: any) => w.id).filter(Boolean));
```

Insert the widget in the JSX, right after the "Top Nav" block's closing `</div>` (the outer one, right before the `<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">` that starts the two-column form layout):

```tsx
        </div>
      </div>

      <VendorInternalReviewActions projectId={projectId} docType="ptw" docId={ptwId} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p .` then `npm run build`
Expected: both pass with no errors.

- [ ] **Step 5: Manual test**

As the vendor staff member assigned in Task 9's manual test, open the Prosedur page for that project — confirm the amber "Menunggu Review Internal Anda" panel appears with Setujui/Tolak buttons. Click Setujui — confirm it switches to the green confirmation state, and (as a separate check) confirm the document's status is now `Menunggu Review PM` in the database / on the project's Ringkasan tab. Repeat with a reject: confirm the amber panel accepts a note, submitting it reverts the document to `Draft` with the revision note recorded, and the vendor's own `/vendor/dashboard/my-task` now shows "Perlu Revisi" for that document (existing bullet #1/#2/#3 logic, unchanged).

- [ ] **Step 6: Commit**

```bash
git add "app/vendor/dashboard/projects/[id]/prosedur/page.tsx" "app/vendor/dashboard/jsa/create/[id]/page.tsx" "app/vendor/dashboard/ptw/create/[id]/[type]/page.tsx"
git commit -m "Embed vendor-internal-review Approve/Reject widget in document pages"
```

---

### Task 12: Full-stack verification

**Files:**
- None (verification only).

**Interfaces:**
- Consumes: everything from Tasks 1–11.

- [ ] **Step 1: Full type-check and build**

Run: `npx tsc --noEmit -p .`
Run: `npm run build`
Expected: both succeed with zero errors.

- [ ] **Step 2: Manual walkthrough — happy path with 2 assignees (multi-signature)**

1. As `vendor_admin`, assign 2 different staff members to a project's Prosedur `review_vendor` slot (Task 8 UI).
2. Submit the Prosedur as the vendor.
3. Confirm both assignees see "Review Internal — Prosedur Kerja" on `/vendor/dashboard/my-task`.
4. Approve as the first assignee — confirm the document status stays `Review Internal Vendor` (not yet advanced) and the second assignee's task item is still there.
5. Approve as the second assignee — confirm the document status advances to `Menunggu Review PM`, and confirm PM (an internal PGN user) now sees it on `/dashboard/approval` / `/dashboard/my-task` (not before this point).

- [ ] **Step 3: Manual walkthrough — reject path**

1. Reject as one of the two assignees, with a note.
2. Confirm the document reverts to `Draft` with the note recorded (visible via the Prosedur form's revision history / rejection_note field depending on doc type).
3. Confirm PGSOL/PGN received **no** notification for this document (only vendor-internal parties were ever involved).
4. Resubmit as the vendor — confirm both assignment rows are back to `pending` (both assignees can act again), not just the one who rejected.

- [ ] **Step 4: Manual walkthrough — fail-closed cutover**

1. Pick a project with **zero** assignees on the JSA `review_vendor` slot.
2. Submit a JSA for that project.
3. Confirm no one can ever approve past `Review Internal Vendor` for this document until a vendor admin assigns someone (the reviewer widget correctly shows nothing to anyone, since no `stage_assignments` row exists yet).

- [ ] **Step 5: Manual walkthrough — internal task list isolation**

Confirm `Review Internal Vendor` never appears on `/dashboard/my-task` (internal PGN/PGSOL) for any of the 3 doc types — that list should behave exactly as it did before this feature shipped.

- [ ] **Step 6: Update the migration run-order documentation**

Read `supabase/README_stage_assignment_migration_order.md`. Add the 2 new Fase 3 SQL files (`supabase/schema_stage_assignments_vendor_review.sql`, `supabase/schema_vendor_review_permissions.sql`) to the documented run order, after the existing Fase 1/2 files. If a combined single-paste file exists (per project memory: `supabase/RUN_ALL_migrations_2026-08-30.sql`), append the 2 new files' contents to it as well, preserving its existing structure and any `BEGIN;`/`COMMIT;` blocks.

- [ ] **Step 7: Final commit**

```bash
git add supabase/README_stage_assignment_migration_order.md
git commit -m "Document Fase 3 migration run order"
```
