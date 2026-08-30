# Per-Project Approver Assignment + Multi-Signature (Fase 2) — Design

## Background

Fase 1 (`docs/superpowers/specs/2026-08-30-multi-tenant-org-foundation-design.md`,
implemented and merged to `main`) built the organizational foundation —
PGN/PGSOL/vendor as symmetric organizations, PGSOL split into its own
portal, org-scoped admins. It deliberately left the approval-stage logic
itself untouched: `PROCEDURE_STAGE_PERMISSION` / `JSA_STAGE_PERMISSION` /
`PTW_STAGE_PERMISSION` still mean "anyone holding this permission can act
on any project's document at this stage."

This spec is Fase 2: replace that permission-pool model with **per-project,
per-stage approver assignment**, where admins explicitly pick which
specific people must act on a given project's documents, and **all**
assigned people must approve before a stage completes (multi-signature) —
a single reject from any one of them vetoes the stage immediately.

Fase 3 (a new "review internal vendor" stage before documents reach
PGSOL/PGN) stays out of scope here, per the original phase split.

## Current State

Three document types, each with 1-3 internal review stages, all currently
resolved via a fixed lookup from status → `{module, action}` permission:

- **Prosedur** (`lib/procedure-status.ts`): 1 stage, `procedure.review`.
- **JSA** (`lib/jsa-status.ts`): 2 stages, `jsa.review_pgsol` →
  `jsa.approve_pgn`. `jsa.reviewer_id`/`approver_id` record the single
  actor at each stage; `requireDistinctApprover()` in
  `app/dashboard/approval/actions.ts` blocks the same person acting at
  both stages of one JSA.
- **PTW** (`lib/ptw-status.ts`): 3 stages, `ptw.approve_pm` →
  `ptw.review_issuer` → `ptw.numbering_hsse`. One assignment slot set
  applies to every PTW type (Kerja Dingin, Kerja Panas, dst.) on a
  project — there's no per-type distinction in the stage-permission model
  today, and this spec keeps that.

`app/dashboard/approval/actions.ts`'s `approveProcedure`/`rejectProcedure`,
`approveJsa`/`rejectJsa`, `approvePtw`/`rejectPtw` all follow the same
shape: `requirePermission(supabase, user.id, STAGE_PERMISSION[status],
errMsg)` gates the action; a single successful call advances the document
straight to the next status. `app/dashboard/my-task/actions.ts` uses the
same maps to decide whether a pending document shows up in a user's task
list. `notifyUsersByPermission({...STAGE_PERMISSION[stage], ...})`
notifies every permission-holder when a document reaches a stage.

Rejection today always reverts the document to `Draft` / equivalent and
lets the vendor resubmit — `savePtw`, and the equivalent Prosedur/JSA
resubmit actions, reset status back to the first internal stage.

## Goals

- Admin PGN and admin PGSOL each pick, **per project**, which of their own
  org's staff are the assigned approvers for their org's stage-slots on
  that project (PGN: procedure.review, jsa.approve_pgn, ptw.approve_pm,
  ptw.review_issuer, ptw.numbering_hsse — 5 slots; PGSOL: jsa.review_pgsol
  — 1 slot).
- A stage only completes once **every** assigned person for that
  (project, doc_type, stage) has approved. A stage rejects the instant
  **any** assigned person rejects it (veto, not consensus) — matching
  today's single-actor reject behavior.
- Candidate pools for assignment stay permission-gated (only staff whose
  role already holds the relevant permission are selectable) — assignment
  narrows an existing eligible pool down to specific people for one
  project, it doesn't replace the permission system.
- On rejection, all assignment rows for that stage reset to `pending` so
  the same assigned people review again once the vendor resubmits.
- Existing per-action safeguards (`requireDistinctApprover` — reviewer ≠
  approver on JSA) are preserved as a runtime check, independent of
  whatever the admin assigned.

## Non-Goals

- Fase 3 (vendor-side internal review stage) — separate spec, later.
- Changing what a PGSOL/PGN admin's UI looks like beyond adding the new
  assignment screen — Fase 1's portal shells, staff pages, and the
  `/dashboard/approval` carve-out are unchanged.
- Rendering every assigned signer's name/signature on generated PDFs
  (`ProsedurPDF.tsx`, JSA/PTW equivalents, which read `lib/jsa-signatories.ts`
  / `lib/ptw-signatories.ts`). Those currently read the single
  `reviewer_id`/`approver_id`/`reviewed_by` columns on the document row;
  this spec **keeps those columns** and sets them to whichever assignee's
  action completed the stage (the last of the "all must approve" set) —
  full multi-signer PDF display is a future enhancement, not required
  here. This keeps PDF/signatory code entirely untouched in this phase.
- A UI for reassigning/removing an approver mid-review (after some
  assignees have already decided). Fase 2 supports assigning before a
  stage starts being acted on; changing assignments while decisions are
  in flight is out of scope — an admin can still edit assignments for a
  stage that hasn't started yet, but not one with partial decisions
  recorded (see Data Model — editable only while all rows are `pending`).

## Data Model

### `stage_assignments`

```sql
CREATE TABLE public.stage_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  doc_type TEXT NOT NULL,        -- 'procedure' | 'jsa' | 'ptw'
  stage_key TEXT NOT NULL,       -- 'procedure.review' | 'jsa.review_pgsol' | 'jsa.approve_pgn'
                                  -- | 'ptw.approve_pm' | 'ptw.review_issuer' | 'ptw.numbering_hsse'
  assignee_id UUID REFERENCES public.profiles(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  decided_at TIMESTAMP WITH TIME ZONE,
  note TEXT,
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (project_id, doc_type, stage_key, assignee_id)
);
```

One row = one person's assignment (and, once acted on, decision) for one
stage of one document type on one project. `stage_key` values are exactly
the existing `{module}.{action}` strings already used as map keys in
`PROCEDURE_STAGE_PERMISSION`/`JSA_STAGE_PERMISSION`/`PTW_STAGE_PERMISSION`
— no new vocabulary, just persisted instead of derived from a static map.

A stage is **approved** when every row for `(project_id, doc_type,
stage_key)` has `status = 'approved'`. A stage is **rejected** the instant
any row for that tuple has `status = 'rejected'`. A stage with **zero**
assignment rows can never be approved — the UI must block a project from
reaching a stage with no assignees (see UI section), and the approval
action itself re-checks this server-side as a hard stop, not just a UI
nicety.

RLS follows this codebase's existing split (confirmed in Fase 1 and
earlier): RLS enforces coarse boundaries only, never fine-grained
`roles.permissions` checks — those live in TypeScript via
`hasPermissionForUser`, exactly like every other permission check in this
app (`utils/permissions.ts`). So: `SELECT` allowed for `is_internal_user()`
(PGN/PGSOL both need to see assignments) and for the vendor owning the
project (`EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND
p.vendor_id = public.current_vendor_org_id())`, read-only, for
transparency). `INSERT`/`UPDATE`/`DELETE` allowed for `is_internal_user()`
— any internal (PGN or PGSOL) user can write a row at the RLS layer; the
*fine-grained* checks — does this actor hold `manage_project` (PGN
stage-slots) or `jsa.manage_assignment_pgsol` (PGSOL's one slot), and does
the target `assignee_id`'s `profiles.org_id` match the actor's own org —
happen in the TypeScript server action, mirroring Fase 1's
`requireAccountAccess`+`assertSameOrg` pattern exactly (a new
`requireStageAssignmentAccess` helper, same shape).

### `jsa`/`procedures`/`ptw` — no schema change

`reviewer_id`/`approver_id` (JSA), `reviewed_by` (Prosedur) stay as-is,
now meaning "whichever assignee's decision completed this stage" instead
of "the only person who could have decided this stage" — semantically
compatible with existing PDF/signatory code, no migration needed there.

## Approval Action Rewrite

Replace `requirePermission(supabase, user.id, STAGE_PERMISSION[status],
errMsg)` with a new `requireAssignedApprover`:

```ts
async function requireAssignedApprover(
  supabase: any, userId: string, projectId: string,
  docType: string, stageKey: string, errMsg: string
): Promise<string> {
  const { data } = await supabase
    .from('stage_assignments')
    .select('id')
    .eq('project_id', projectId).eq('doc_type', docType)
    .eq('stage_key', stageKey).eq('assignee_id', userId)
    .eq('status', 'pending')
    .maybeSingle();
  if (!data) throw new Error(errMsg);
  return data.id;
}
```

Each `approve*` action becomes: resolve the assignment row id via
`requireAssignedApprover`, update that one row to `status: 'approved',
decided_at: now()`, then check whether every row for that
`(project_id, doc_type, stage_key)` is now `'approved'` — only if so does
the document's own status column advance (existing `nextStatus` logic
unchanged from that point on) and `reviewer_id`/`approver_id`/`reviewed_by`
get set to the current user (the completing assignee). If assignees remain
pending, the document status does **not** change — the UI reflects
progress by reading `stage_assignments` directly (see UI section), not by
a document-status value.

Each `reject*` action becomes: resolve the assignment row via the same
helper, update it to `status: 'rejected', decided_at: now(), note`, revert
the document status to `Draft` (unchanged from today), and reset **every**
row for that `(project_id, doc_type, stage_key)` — including the one that
was just approved by someone else, if any — back to `status: 'pending',
decided_at: null, note: null`, ready for the next resubmission round.

`requireDistinctApprover` (JSA reviewer ≠ approver) stays exactly as-is,
called in addition to `requireAssignedApprover` — it's a runtime identity
check independent of who was assigned.

`notifyUsersByPermission({...STAGE_PERMISSION[stage], ...})` becomes
`notifyAssignees({ projectId, docType, stageKey, ... })`, querying
`stage_assignments` for `status = 'pending'` rows at that stage and
notifying each `assignee_id` — narrower than today's "everyone with this
permission," which is the intended behavior change.

`app/dashboard/my-task/actions.ts`'s `can(module, action)` /
`STAGE_PERMISSION[doc.status]` lookups (deciding whether a pending
document shows up in a user's task list) become "does a `pending` row
exist in `stage_assignments` for `(this project, this doc_type, this
stage, my user id)`" — a per-document, per-user query instead of a global
permission check.

## Admin Assignment UI

**PGN** (`masterData.manage_project` — the exact permission already
gating `app/dashboard/master-data/project/actions.ts`, reused as-is since
Fase 1 kept PGN as a single non-multi-tenant org with its existing
permission system intact): a new section on
`app/dashboard/master-data/project/[id]/page.tsx` (the existing project
edit/setup page this permission already gates — not
`app/dashboard/projects/[id]/AdminProjectClient.tsx`, which is the
internal project-overview page for viewing document stage status, a
different screen) listing the 5 PGN stage-slots, each a multi-select of PGN staff whose role holds
the matching permission (`procedure.review`, `jsa.approve_pgn`,
`ptw.approve_pm`, `ptw.review_issuer`, `ptw.numbering_hsse` respectively).
Saving writes/updates `stage_assignments` rows for those 5 slots. Editing
is blocked (fields disabled, explanatory copy shown) for any slot that
already has a non-`pending` row — i.e. once someone has acted, the
assignee list for that round is locked; the reset-to-`pending` after a
reject reopens editability for the next round if the admin wants to
change who's assigned.

**PGSOL** needs a new page under `/pgsol/dashboard` — Fase 1's PGSOL
portal has no project-list view at all today (its only project-adjacent
capability is the `/dashboard/approval` middleware carve-out for *acting*
on documents, not assigning who acts). Add
`/pgsol/dashboard/projects` (list of projects, reusing whatever query
`getAllProjectsWithRelations` or equivalent already exposes, filtered to
projects that have reached JSA stage or later — a PGSOL admin doesn't need
to see procedure-only projects) and
`/pgsol/dashboard/projects/[id]/assign` (the one-slot equivalent of the
PGN section above, for `jsa.review_pgsol` only). Gated by a new permission
item `jsa.manage_assignment_pgsol`, added to the existing `jsa` module in
`allPermissionModules` (`app/dashboard/master-data/role/constants.ts`,
alongside the existing `review_pgsol`/`approve_pgn` items), held by the
`pgsol_admin` role (added to that role's `permissions` JSON via a new
migration, the same way Fase 1's `schema_org_roles.sql` granted
`pgsol_admin` its `manage_org_staff` permission).

## Testing

- `npx tsc --noEmit -p .` and `npm run build` (repo convention, no test
  runner exists — see `[[repo-conventions]]`).
- Manual: assign 2 PGSOL reviewers to a project's JSA; approve as one —
  status must stay at `Review PGSOL`; approve as the second — status must
  advance to `Persetujuan PGN`. Reject as either of two PGN approvers on a
  different project's PTW — status must revert to Draft, and both PGN
  assignment rows for that stage must show `pending` again on
  resubmission, not just the one who rejected.
- Manual: a project with zero PGN admins assigned to `ptw.approve_pm` —
  confirm the PTW cannot be approved (and ideally the UI signals "not
  assigned yet" rather than presenting an empty approve button that
  errors).
- Manual: confirm `requireDistinctApprover` still blocks the same person
  from reviewing then approving the same JSA, even if that person happens
  to be assigned to both stages.

## Open Decisions (from this session's brainstorming)

- Reject = veto (any one rejection ends the stage), not consensus.
- PGN assignment authority stays with the existing central admin
  permission (PGN is one org, not multi-tenant internally, per Fase 1) —
  no new "project owner" role.
- Assignment happens per project, covering all of that org's stage-slots
  at once (not negotiated stage-by-stage as the document progresses).
