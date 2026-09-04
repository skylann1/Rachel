# Prosedur Kerja PGSOL Gate + Stage-Assignment-Aware Approval UI — Design

## Context

The approval-chain revision (Fase 1-3, already live) built a multi-signature,
per-project assignment system (`stage_assignments`) for Prosedur Kerja, JSA,
and PTW. JSA already has three parties in its chain — vendor (internal),
PGSOL (technical review), PGN (formal authorization). Prosedur Kerja only has
two — vendor and PGN — because PGSOL was never inserted as a party for that
document type.

The project owner wants Prosedur Kerja to match JSA's three-party pattern.
While reviewing the code to design that change, two more problems surfaced
that are addressed in the same pass because they intersect directly with it:

1. **`rejectJsa` bug**: rejecting JSA at either PGSOL or PGN sends the
   document back to `Review PGSOL` instead of `Draft` — skipping the
   vendor-internal review gate entirely on every JSA rejection. This predates
   Fase 3's vendor-gate insertion; `rejectJsa` (in
   `app/dashboard/approval/actions.ts`) was never updated to route back
   through `Draft` the way `rejectProcedure` and `rejectPtw` already do.
2. **Internal approval UI is permission-gated, not assignment-gated**: in
   `AdminProjectClient.tsx`, Approve/Reject buttons are shown to anyone
   holding the relevant permission (e.g. `jsa.review_pgsol`), not to the
   specific person(s) assigned to that stage on that project. The server
   actions already reject an unassigned caller correctly — this is a UX gap,
   not a security hole — but it gets worse the moment Prosedur Kerja gains a
   third gate, since there's now one more stage where an unassigned
   permission-holder can be confused by a button that doesn't work for them.
   There is also no multi-signature progress indicator anywhere ("1 of 3
   already approved").

**Migrations for Fase 1-3 are live in production as of 2026-08-31** — this
work adds to a running system, not a design-time-only codebase. New
migrations here must be additive and must not silently break existing role
grants (see the `jsa.manage_assignment_pgsol` decision in the PGSOL section
below).

## Goals

1. Prosedur Kerja gains a "Review PGSOL" gate between vendor-internal review
   and the existing PGN gate, structurally identical to JSA's pattern
   (multi-signature, all assignees must approve, single reject vetoes).
2. `rejectJsa` is fixed to route back to `Draft`, matching
   `rejectProcedure`/`rejectPtw`.
3. `/dashboard/my-task`'s Prosedur Kerja block filters on the correct,
   current status set (mirroring how the JSA/PTW blocks already do it).
4. The Prosedur Kerja approval card in `AdminProjectClient.tsx` gets a
   per-stage badge, matching JSA's "Tahap 1 / Tahap 2" treatment, so
   reviewers know which gate they're looking at.
5. Approve/Reject buttons across Prosedur Kerja, JSA, and PTW cards are
   gated on the current user's actual `stage_assignments` row for that
   project's active stage — not just on holding the permission.
6. Every multi-signature stage shows an approval-count indicator ("N dari M
   sudah menyetujui"), visible to everyone who holds the stage's permission
   (assigned or not) so reviewers on the same stage can see each other's
   progress.

## Non-Goals

- No change to PTW's own chain (already agreed out of scope — see prior
  discussion; PTW stays vendor → PM → Issuer → HSSE, no PGSOL).
- No change to JSA's own gate structure (already matches the target pattern).
- No display of *who specifically* has/hasn't approved (just counts) — full
  assignee-name lists are a natural follow-up but not required for this pass;
  adding it later needs a `profiles` join this design doesn't require.
- No schema changes. Everything reuses `stage_assignments` exactly as built
  in Fase 2/3.

## Architecture

### 1. Prosedur Kerja gains a PGSOL gate

New flow: `Draft → Review Internal Vendor → Review PGSOL → Menunggu Review PM → Prosedur Disetujui`.

- `lib/procedure-status.ts`: add `reviewPgsol: 'Review PGSOL'` to
  `PROCEDURE_STATUS` (reuses JSA's exact label text for consistency); add it
  to `PROCEDURE_PENDING_STATUSES`; add `[PROCEDURE_STATUS.reviewPgsol]: { module: 'procedure', action: 'review_pgsol' }`
  to `PROCEDURE_STAGE_PERMISSION`. Update the file's header flow comment.
  `Menunggu Review PM` keeps its existing label — no rename, to avoid
  touching unrelated display/notification strings for no functional gain.
- `lib/stage-assignments.ts`: add `'procedure.review_pgsol': { module: 'procedure', action: 'review_pgsol' }`
  to `STAGE_KEY_PERMISSION`. Add a new exported constant
  `PGSOL_STAGE_KEYS = ['jsa.review_pgsol', 'procedure.review_pgsol'] as const;`
  (mirrors the existing `PGN_STAGE_KEYS`/`VENDOR_STAGE_KEYS` shape).
- `app/dashboard/approval/actions.ts`: `approveProcedure`/`rejectProcedure`
  become multi-stage, following `approveJsa`/`rejectJsa`'s existing branch
  pattern:
  - `current.status === PROCEDURE_STATUS.reviewPgsol` → stage key
    `procedure.review_pgsol`; on full approval, advance to
    `PROCEDURE_STATUS.menungguReviewPM`.
  - `current.status === PROCEDURE_STATUS.menungguReviewPM` → stage key
    `procedure.review` (unchanged); on full approval, advance to
    `PROCEDURE_STATUS.approved` (unchanged final step).
  - Reject: **keep Procedure's own existing behavior** — always route back
    to `Draft`, regardless of which stage rejected. Do not adopt JSA's old
    reject-to-`reviewPgsol` pattern (see the `rejectJsa` fix below — that
    pattern is being removed, not propagated).
- `app/dashboard/my-task/actions.ts`: the Prosedur Kerja block (currently
  single-stage) becomes multi-stage, mirroring the existing JSA block exactly
  — fetch `stage_assignments` for both `procedure.review_pgsol` and
  `procedure.review` per project, match against
  `PROCEDURE_STAGE_PERMISSION[status]`, and title the task per stage
  (`Review Prosedur Kerja (PGSOL)` / `Review Prosedur Kerja (PM)`). This
  replaces the current single hardcoded `procedure.review` query.

### 2. PGSOL assignment: generalize from JSA-only to multi-doc-type

`app/pgsol/dashboard/projects/actions.ts` is currently hardcoded to
`docType: 'jsa'` throughout. It needs the same generalization already done
for the PGN-side (`saveStageAssignment`) and vendor-side
(`saveVendorStageAssignment`) actions in Fase 2/3:

- `getPgsolProjects()`: also select `procedures ( id, status )`; broaden the
  filter from "has JSA" to "has a procedure OR a JSA" (a project needs PGSOL
  attention as soon as its Prosedur Kerja is submitted, before JSA exists).
- `savePgsolAssignment(projectId, assigneeIds)` becomes
  `savePgsolAssignment(projectId, docType: 'procedure' | 'jsa', stageKey, assigneeIds)`,
  validated against the new `PGSOL_STAGE_KEYS` whitelist (same shape as
  `saveVendorStageAssignment`'s validation).

**Permission decision — keep `jsa.manage_assignment_pgsol` as the sole gate,
do not introduce a new permission for "who may assign PGSOL reviewers".**
This permission is already granted to live PGSOL roles in the production
database. Renaming or replacing it would require a data migration to move
existing grants and risks silently revoking assignment ability from roles
that already have it. The permission's name becoming slightly stale (it now
gates both `jsa` and `procedure` assignment, not just `jsa`) is an accepted,
documented trade-off — a rename is a valid future cleanup but out of scope
here (YAGNI: nothing forces it now).

A **new** permission item **is** needed for *eligibility* to be assigned as a
reviewer (separate concept from *who can assign*): `procedure.review_pgsol`,
added to `allPermissionModules` in all three role-constants files
(`app/dashboard/master-data/role/constants.ts`,
`app/pgsol/dashboard/role/constants.ts`,
`app/vendor/dashboard/role/constants.ts` — confirmed these three currently
share an identical catalog, each filtering display by `allowedTypes`), under
the existing `procedure` module block:
`{ key: 'review_pgsol', label: 'Review Prosedur Kerja — Tahap PGSOL', allowedTypes: ['pgsol'] }`.

- `app/pgsol/dashboard/projects/[id]/assign/page.tsx`: render a second
  assignment panel for `procedure.review_pgsol` alongside the existing
  `jsa.review_pgsol` one — same `getEligibleAssignees`/`getStageAssignments`
  calls, parameterized by doc type.

### 3. `rejectJsa` fix

In `app/dashboard/approval/actions.ts`, `rejectJsa`'s final status update
changes `status: JSA_STATUS.reviewPgsol` to `status: JSA_STATUS.draft`. No
other change needed — `saveJsa`'s resubmit path (rewired in Fase 3 Task 6)
already resets `jsa.review_vendor` assignments when the vendor resubmits from
`Draft`, so the vendor-internal gate correctly re-runs on the next
submission. This is a one-line functional fix inside a function that already
has the right shape (stage key branching, assignment reset, notification).

### 4. Stage-assignment-aware gating + progress indicator

**Data flow.** `app/dashboard/projects/[id]/page.tsx` (Server Component)
computes the set of currently-active `{docType, stageKey}` pairs for this
project's documents — Prosedur Kerja's current status if pending, JSA's
current status if pending, and each PTW row's current status if pending,
translated via the existing `*_STAGE_PERMISSION` maps. It calls
`getStageAssignments` (already exists, unchanged signature) once per active
stage in parallel, and assembles the results into
`stageAssignments: Record<string, StageAssignmentRow[]>` keyed by
`` `${docType}.${stageKey}` `` (e.g. `"procedure.review_pgsol"`,
`"ptw.approve_pm"`). This is passed to `AdminProjectClient` as a new prop.
PTW's multiple concurrent rows sharing one stage key is an already-documented
limitation (see `supabase/README_stage_assignment_migration_order.md`) and is
not addressed by this design — the key is still `docType.stageKey`, not
per-document, consistent with existing behavior.

**Gating.** In `AdminProjectClient.tsx`, each `canApprove*` becomes: the
active stage's assignment rows contain one with
`assignee_id === currentUserId && status === 'pending'`. This replaces the
current `permissions?.[module]?.includes(action)` check. The permission
check is **not deleted** — it still gates whether the card is shown at all
(so someone with no permission for this module never sees the card, matching
current behavior); it's the *button* visibility inside an already-visible
card that switches from permission-only to assignment-aware.

**Non-assignee view (per the earlier decision).** A permission holder who is
not assigned to this project's current stage still sees the full card —
document preview, stage badge, progress indicator — but not the
Setujui/Tolak buttons. This preserves the existing transparency (anyone with
the permission could already see pending documents) while removing the
confusing non-functional buttons.

**Progress indicator.** A small counts-only display — "N dari M sudah
menyetujui" — computed from the stage's assignment rows
(`rows.filter(r => r.status === 'approved').length` / `rows.length`),
rendered in the same card, visible to everyone who can see the card (i.e.
holds the permission, assigned or not). No assignee names — see Non-Goals.

**Scope of the gating/progress change.** Applies uniformly to all three
document types' cards in `AdminProjectClient.tsx` (Prosedur Kerja, JSA, each
PTW row), since they share the same underlying pattern and the same
component. This was the explicit decision to fold the two known UX issues
into this pass rather than defer them.

### 5. Prosedur Kerja per-stage badge

The Prosedur Kerja approval card gets the same treatment JSA's card already
has (see `AdminProjectClient.tsx`'s existing JSA block): a small badge
reading "Tahap 1 — Review PGSOL" or "Tahap 2 — Menunggu Review PM" depending
on `prosedur.status`, plus a stage-appropriate description line and button
label (`"Review & Teruskan ke PGN"` vs `"Setujui SOP"`), mirroring JSA's
`isTahapReviewPgsol` ternary pattern exactly.

## Migration

Two additive SQL changes, following the exact pattern of
`supabase/schema_vendor_review_permissions.sql`:

1. Grant `review_pgsol` under `procedure` to the `pgsol_reviewer` role —
   confirmed (via `schema_permission_driven_approval.sql`) as the role that
   already holds `jsa.review_pgsol` by default. Same reviewers should
   default to reviewing Prosedur Kerja too, consistent with how Fase 3
   defaulted `vendor_admin` into `review_vendor` for all three doc types.
   Guarded with the same `NOT ... ? 'review_pgsol'` idempotency check.
   `pgsol_admin` (the separate role holding `manage_assignment_pgsol`) is
   not touched by this grant — it doesn't need `review_pgsol` itself, only
   the ability to assign others to it, which it already has via the reused
   `jsa.manage_assignment_pgsol` permission (see the Section 2 decision).
2. No RLS policy changes needed — the existing internal-write policy already
   permits any `is_internal_user()` (which includes PGSOL) to write
   `stage_assignments`; `procedure.review_pgsol` is just a new `stage_key`
   value, not a new access path.

Both get appended to `supabase/RUN_ALL_migrations_2026-08-30.sql` as a new
transaction section, and `supabase/README_stage_assignment_migration_order.md`
gets a short new section documenting the cutover (same fail-closed pattern as
prior phases: existing in-flight Prosedur Kerja documents at `Menunggu Review
PM` are unaffected; only new submissions reaching the new `Review PGSOL`
gate need PGSOL assignments filled in first).

## Testing

No test runner in this repo (see `repo_conventions` memory) — verification is
`npx tsc --noEmit -p .` and `npm run build`, as with every prior phase.
Manual verification checklist (new items, appended to the existing
`README_stage_assignment_migration_order.md` checklist):

- [ ] Assign 2 PGSOL reviewers to `procedure.review_pgsol` on a project;
      submit Prosedur Kerja as vendor — status lands on `Review PGSOL`, not
      `Menunggu Review PM`.
- [ ] Approve as one of the two — status stays `Review PGSOL`; approve as
      the second — status advances to `Menunggu Review PM`, and PGN sees it
      only now.
- [ ] Reject JSA as a PGSOL or PGN reviewer — status returns to `Draft` (not
      `Review PGSOL`), and resubmitting as vendor correctly re-triggers
      `Review Internal Vendor` before PGSOL sees it again.
- [ ] As a user who holds `jsa.review_pgsol` but is NOT assigned to a given
      project, open that project — the JSA card is visible, but no
      Setujui/Tolak buttons appear, and a "N dari M" progress line is shown.
- [ ] `/dashboard/my-task` for a PGSOL reviewer shows a Prosedur Kerja task
      only while genuinely assigned to `procedure.review_pgsol` with a
      pending row — no phantom entries while the document sits in `Draft`.
