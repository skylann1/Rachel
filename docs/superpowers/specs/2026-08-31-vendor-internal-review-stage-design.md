# Vendor-Side Internal Review Stage (Fase 3) — Design

## Background

Fase 1 (`docs/superpowers/specs/2026-08-30-multi-tenant-org-foundation-design.md`)
built the organizational foundation — PGN/PGSOL/vendor as symmetric
organizations, multi-user vendor companies. Fase 2
(`docs/superpowers/specs/2026-08-30-per-project-approver-assignment-design.md`)
replaced the old permission-pool model with per-project, per-stage approver
assignment for the internal (PGN/PGSOL) side, backed by a new
`stage_assignments` table and multi-signature approval (all assignees must
approve; one reject vetoes).

This spec is Fase 3: add a **vendor-side internal review stage** in front of
each document type's existing flow. Before a Prosedur/JSA/PTW ever reaches
PGSOL or PGN, the vendor's own staff must review and approve it first — the
vendor admin picks who, per project, reusing the exact same assignment
mechanism Fase 2 built for PGN/PGSOL.

## Current State

Each doc type's first pending status today is an *external* stage:

- **Prosedur** (`lib/procedure-status.ts`): `Draft → Menunggu Review PM → Prosedur Disetujui`. `saveProsedur` (`app/vendor/dashboard/projects/[id]/prosedur/actions.ts`) sets status straight to `Menunggu Review PM` on submit.
- **JSA** (`lib/jsa-status.ts`): `Draft → Review PGSOL → Persetujuan PGN → JSA Disetujui`.
- **PTW** (`lib/ptw-status.ts`): `Draft → Menunggu Approval PM → Review PTW Issuer → Menunggu Penomoran HSSE → PTW Aktif`.

`lib/stage-assignments.ts` already provides a fully generic mechanism keyed
by `(project_id, doc_type, stage_key)`: `getStageAssignments`,
`getEligibleAssignees`, `writeStageAssignment`, `resetStageAssignments`,
`isStageFullyApproved`, and the `STAGE_KEY_PERMISSION` map. Fase 2's
`approveProcedure`/`approveJsa`/`approvePtw` in
`app/dashboard/approval/actions.ts` all follow the same shape: resolve the
caller's pending assignment row, mark it `approved`, re-fetch and check
`isStageFullyApproved`, only then advance the document's own `status`
column. Reject marks the row `rejected`, resets every row for that stage
back to `pending`, and reverts the document to `Draft`.

RLS on `stage_assignments` today only lets `is_internal_user()` (PGN/PGSOL)
write rows; vendor users get a read-only transparency policy plus one narrow
UPDATE policy that lets `resetStageAssignments` reset a stage back to
`pending` on resubmit (`WITH CHECK (status = 'pending' AND decided_at IS
NULL)`) — vendor users cannot currently set a row to `approved`/`rejected`
at all.

The vendor portal has no assignment or reviewer-task concept today.
`app/vendor/dashboard/my-task/actions.ts`'s `getVendorMyTasks()` is
submitter-perspective only (org-wide: rejected docs needing revision, docs
not yet submitted) — there is no notion of "documents waiting on my review"
for a specific vendor staff member.

## Goals

- Insert one new stage, **`Review Internal Vendor`**, as the first pending
  status for all three doc types — before today's first external stage.
- Vendor admin picks, **per project**, which of their own org's staff must
  review at this stage — same per-project assignment model as Fase 2, not
  an org-wide default.
- Multi-signature: the stage completes only once **every** assigned vendor
  reviewer approves. A single reject vetoes immediately, matching Fase 2's
  PGN/PGSOL behavior exactly.
- Fail-closed cutover, same as Fase 2: once this ships, a project with zero
  vendor-internal assignees cannot pass this stage until the vendor admin
  assigns someone. Existing in-flight documents already past `Draft` are
  unaffected (see Non-Goals) — only new submissions/resubmissions hit the
  new gate.
- Candidate pools stay permission-gated: only vendor staff whose role holds
  the relevant `*.review_vendor` permission are selectable, narrowing an
  eligible pool to specific people for one project — exactly Fase 2's
  pattern, not a new concept.
- Reuse `lib/stage-assignments.ts` entirely as-is. No new table.

## Non-Goals

- **Org-wide default assignment** — considered and rejected during
  brainstorming in favor of per-project, for consistency with Fase 2.
- **Retroactively gating documents already past `Draft`** when this ships.
  Only documents that are still in (or return to) `Draft` and get
  (re)submitted after cutover pass through the new stage. A document
  already sitting at `Review PGSOL` the day this ships is not pulled back.
- **PDF/signatory display of the vendor-internal reviewer.** No new column
  is added to `procedures`/`jsa`/`ptw` to record who did the vendor-internal
  review — that stays entirely in `stage_assignments` (queryable) and
  `document_logs` (audit trail). Mirrors Fase 2's identical non-goal for
  PGN/PGSOL signatures — full multi-signer PDF display remains a future
  enhancement, not required here.
- **Closing the known PTW multi-type-concurrent-review gap** documented in
  `supabase/schema_stage_assignments.sql`'s header comment (`stage_assignments`
  has no document identifier, so two PTW types on one project mid-review at
  the exact same stage at the exact same time incorrectly share decision
  state). This spec's new vendor-internal stage inherits the identical
  limitation for the same reason Fase 2 left it — out of scope, needs a
  `doc_id`-bearing schema change to close properly.
- **Fase 2's parked follow-ups** (internal approval UI still gating on the
  old permission pool instead of `stage_assignments`; the same PTW gap
  above) — not touched by this phase.

## Data Model

### `stage_assignments` — no schema change, 3 new `stage_key` values

```
procedure.review_vendor
jsa.review_vendor
ptw.review_vendor
```

`doc_type` stays `procedure`/`jsa`/`ptw` — no new vocabulary. One row = one
vendor staff member's assignment (and, once acted on, decision) for the
vendor-internal stage of one document type on one project. Every generic
helper in `lib/stage-assignments.ts` (`getStageAssignments`,
`getEligibleAssignees`, `writeStageAssignment`, `resetStageAssignments`,
`isStageFullyApproved`) works unchanged — only `STAGE_KEY_PERMISSION` gets 3
new entries:

```ts
export const STAGE_KEY_PERMISSION: Record<string, { module: string; action: string }> = {
  'procedure.review_vendor': { module: 'procedure', action: 'review_vendor' },
  'jsa.review_vendor': { module: 'jsa', action: 'review_vendor' },
  'ptw.review_vendor': { module: 'ptw', action: 'review_vendor' },
  // ...existing PGN/PGSOL entries unchanged
};
```

A new `VENDOR_STAGE_KEYS` constant (parallel to Fase 2's `PGN_STAGE_KEYS`)
whitelists what a vendor admin's assignment action is allowed to write:

```ts
export const VENDOR_STAGE_KEYS = [
  'procedure.review_vendor',
  'jsa.review_vendor',
  'ptw.review_vendor',
] as const;
```

### RLS — new vendor write policies required

Today's policies only cover: `is_internal_user()` full read/write, vendor
read-only (transparency), and vendor UPDATE narrowly scoped to the
resubmit-reset case (`status = 'pending' AND decided_at IS NULL`). Vendor
users now need to:

1. **Manage assignments** (INSERT/UPDATE/DELETE the assignee list) for
   their own projects' 3 vendor-only stage keys.
2. **Record their own decision** (`approved`/`rejected`) when they are the
   assignee acting on a pending row.

New policy, scoped by project ownership **and** stage-key allowlist (RLS
stays a coarse boundary — same split as every other permission check in
this app; fine-grained "does this actor hold `manage_org_staff`" or "is the
assignee from my own org" logic lives in TypeScript, not SQL):

```sql
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

This single policy covers both the admin's assignment writes and the
reviewer's own approve/reject writes — the same permissive-at-RLS,
strict-in-TypeScript split Fase 2 used for `is_internal_user()`. The
existing narrow resubmit-reset UPDATE policy stays as-is (still needed for
the *external* stage keys on resubmit).

### `procedures`/`jsa`/`ptw` — no schema change

Same as Fase 2: no new columns. The document's own `status` column gets one
new value per type (`PROCEDURE_STATUS.reviewInternalVendor`,
`JSA_STATUS.reviewInternalVendor`, `PTW_STATUS.reviewInternalVendor`, all
`'Review Internal Vendor'`), inserted as the new first pending status.

**Important:** this new status must **not** be added to
`PROCEDURE_PENDING_STATUSES` / `JSA_PENDING_STATUSES` /
`PTW_PENDING_STATUSES` — those arrays mean "waiting on internal (PGN/PGSOL)
action" and drive what appears on `/dashboard/my-task` for internal staff.
A document sitting at `Review Internal Vendor` is waiting on the *vendor's
own* staff, not PGN/PGSOL, and must not surface on the internal task list.

## Approval Action — one generic function, not three

Fase 2's `approveProcedure`/`approveJsa`/`approvePtw` are deliberately
separate because each type's *external* stages differ in count and in which
document fields get set on completion (`reviewer_id`/`approver_id` for JSA,
`authority_id`/`issuer_id`/`hsse_id` for PTW, `reviewed_by` for Prosedur).
The vendor-internal stage has none of that per-type variance — it is always
the first stage, always reverts to `Draft` on reject, always advances to
each type's existing first-external-status on full approval, and sets no
document-level actor field. That sameness makes a single, table-driven
function the right shape (avoids the 3x near-duplicate boilerplate a
copy-per-type approach would add):

```ts
// app/vendor/dashboard/approval/actions.ts (new file)

const VENDOR_REVIEW_CONFIG: Record<string, {
  table: string; stageKey: string; docType: string;
  draftStatus: string; nextStatus: string;
  rejectionField: 'content' | 'rejection_note'; // Prosedur appends to content.revisions; JSA/PTW use rejection_note
}> = {
  procedure: { table: 'procedures', stageKey: 'procedure.review_vendor', docType: 'procedure',
    draftStatus: PROCEDURE_STATUS.draft, nextStatus: PROCEDURE_STATUS.menungguReviewPM,
    rejectionField: 'content' },
  jsa: { table: 'jsa', stageKey: 'jsa.review_vendor', docType: 'jsa',
    draftStatus: JSA_STATUS.draft, nextStatus: JSA_STATUS.reviewPgsol,
    rejectionField: 'rejection_note' },
  ptw: { table: 'ptw', stageKey: 'ptw.review_vendor', docType: 'ptw',
    draftStatus: PTW_STATUS.draft, nextStatus: PTW_STATUS.menungguApprovalPM,
    rejectionField: 'rejection_note' },
};

export async function approveVendorInternalReview(docType: keyof typeof VENDOR_REVIEW_CONFIG, docId: string) { /* ... */ }
export async function rejectVendorInternalReview(docType: keyof typeof VENDOR_REVIEW_CONFIG, docId: string, note: string) { /* ... */ }
```

Each function follows the exact `requireAssignedApprover` →
`isStageFullyApproved` → advance-or-wait shape from Fase 2's
`approveProcedure`, reusing `getStageAssignments`/`resetStageAssignments`
unchanged. On full approval: advance `status` to `nextStatus`, call
`notifyAssignees({ ...config, stageKey: <the doc type's first external
stage key> })` so PGN/PGSOL only learn about the document once the vendor's
own review is done — mirrors exactly how `approveJsa` only notifies PGN
once PGSOL's stage completes. On reject: reset the vendor-internal stage's
assignment rows, revert `status` to `draftStatus`, write the rejection note
per `rejectionField`. No notification to PGN/PGSOL on reject — nothing
external has happened yet.

### Submission flow changes

`saveProsedur`, and the equivalent JSA/PTW submit actions, currently set
status straight to the first *external* stage and call
`resetStageAssignments(..., 'procedure.review')` defensively (per the
existing code comment: guards against a leftover non-`pending` row from a
prior cycle, since a first-time submit doesn't go through the reject path).
This spec changes both:

- Initial status becomes `PROCEDURE_STATUS.reviewInternalVendor` (and JSA/PTW
  equivalents) instead of jumping to the external stage.
- The defensive `resetStageAssignments` call targets the new
  `*.review_vendor` stage key instead of the external one.
- `notifyAssignees` on submit targets `*.review_vendor` (notifies the
  vendor's own assigned reviewers), not the external stage.

## Admin Assignment UI

New section on the vendor's existing project detail page
(`app/vendor/dashboard/projects/[id]/page.tsx` →
`VendorProjectClient.tsx`) — 3 slots (Prosedur/JSA/PTW), each a multi-select
of the vendor's own staff whose role holds the matching
`{procedure,jsa,ptw}.review_vendor` permission. Gated by
`masterData.manage_org_staff` — **reused as-is**, not a new permission
(mirrors Fase 2's reuse of PGN's existing `manage_project` for its own
5-slot assignment section, rather than minting a fresh permission for an
authority the org already has). Saving writes/updates the 3
`*.review_vendor` `stage_assignments` rows via `writeStageAssignment` and
the new `VENDOR_STAGE_KEYS` whitelist, same pattern as
`app/dashboard/master-data/project/actions.ts`'s `saveStageAssignment`.
Editing is blocked once any row for that slot is non-`pending`, same rule
as Fase 2.

## Reviewer Task UI

Vendor's existing `/vendor/dashboard/my-task` is submitter-perspective
(org-wide: what needs the vendor's attention as the document owner) — a
different concept from "documents a specific staff member is personally
assigned to review." Add a 6th item type to
`getVendorMyTasks()` in `app/vendor/dashboard/my-task/actions.ts`:
"Menunggu Review Internal Saya" — query `stage_assignments` for `pending`
rows where `assignee_id = <current user>` across the 3 vendor stage keys,
linking to the existing document view pages
(`/vendor/dashboard/projects/[id]/prosedur`,
`/vendor/dashboard/jsa/create/[id]`, `/vendor/dashboard/ptw/create/[id]`).
Approve/Reject controls are added to those same existing pages, shown when
the logged-in user has a `pending` assignment row for that document's
vendor-internal stage — no new standalone review page needed.

## Permissions

3 new permission items added to `allPermissionModules`
(`app/dashboard/master-data/role/constants.ts`), one per existing module:

```
procedure: { key: 'review_vendor', label: 'Review Internal Vendor — Prosedur Kerja' }
jsa:       { key: 'review_vendor', label: 'Review Internal Vendor — JSA' }
ptw:       { key: 'review_vendor', label: 'Review Internal Vendor — PTW' }
```

Granted to the `vendor_admin` role by default via a new migration (same
mechanism as Fase 1's `schema_org_roles.sql` granting `pgsol_admin` its
`manage_org_staff` permission) — a fresh single-admin vendor company can use
this feature immediately without first creating a custom role. Companies
with multiple staff can create a narrower custom role (e.g. "K3 Officer")
via the existing Role & Permission UI and assign it to specific people,
narrowing who's eligible independent of who holds `manage_org_staff`.

## Testing

- `npx tsc --noEmit -p .` and `npm run build` (repo convention — no test
  runner exists, see `[[repo-conventions]]`).
- Manual: assign 2 vendor staff to a project's Prosedur vendor-internal
  stage; submit as vendor — confirm both see it under "Menunggu Review
  Internal Saya"; approve as one — status must stay `Review Internal
  Vendor`; approve as the second — status must advance to `Menunggu Review
  PM` and PM must now see it (not before).
- Manual: reject as one of two assigned reviewers — status must revert to
  `Draft`, revision note recorded, both vendor-internal assignment rows
  back to `pending` on resubmission — and confirm PGSOL/PGN received no
  notification.
- Manual: a project with zero vendor-internal assignees for JSA — confirm
  submission is blocked from ever completing that stage (fail-closed), with
  a clear "not assigned yet" signal rather than a dead-end Approve button.
- Manual: confirm the new `Review Internal Vendor` status does **not**
  appear anywhere on `/dashboard/my-task` (internal PGN/PGSOL task list).
- Manual: confirm a vendor_admin can immediately assign themselves (or
  another staff member) without any extra role setup, given the default
  `vendor_admin` grant.

## Open Decisions (from this session's brainstorming)

- All three doc types get the vendor-internal stage (not a phased subset).
- Assignment is per-project, matching Fase 2 — not an org-wide default,
  despite vendor companies typically being smaller than PGN/PGSOL.
- Multi-signature (all-must-approve) reused as-is from Fase 2, not
  simplified to single-approver, for mechanism consistency across the app.
- Cutover is fail-closed, matching Fase 2 — accepted tradeoff of needing
  every vendor admin to do assignment setup before their projects' first
  submission clears the new stage.
