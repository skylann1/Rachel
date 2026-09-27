# PGSOL HSE gate + PTW approval parity — design

## Origin

Stakeholder revision from pak Didin (relayed by the user, 2026-09-27),
part of a 4-item revision list checked against the codebase this session.
Two items were already implemented (safety checklist editable only while
PTW is active; per-org admin-assigns-approver via `stage_assignments`).
This spec covers the remaining item:

> tahapan approval dari masing-masing step sama: prosedur kerja -> JSA ->
> PTW. ... PGSOL: admin pgsol assign reviewer dan HSE untuk setiap
> project.

Clarified with the user via three questions during brainstorming:

1. PTW must gain a PGSOL review gate, matching Prosedur/JSA's existing
   3-gate pattern (vendor -> PGSOL -> PGN). This reverses a prior,
   deliberate decision from Fase 3.1 ("PTW stays untouched, user
   explicitly declined adding PGSOL there") — the new stakeholder ask
   supersedes it.
2. "Reviewer" and "HSE" are two distinct, sequential PGSOL approval
   stages (two different people, reviewer approves first, then HSE),
   not two labels for one role.
3. The Reviewer -> HSE split applies uniformly to all three document
   types — Prosedur and JSA's existing single `review_pgsol` stage each
   gain a second `hse_pgsol` stage, and PTW gains both stages fresh.

## Non-goals

- No change to the vendor-internal-review stage (first gate, all three
  doc types) — untouched.
- No change to PGN's own stages (`procedure.review`, `jsa.approve_pgn`,
  `ptw.approve_pm`/`review_issuer`/`numbering_hsse`) beyond PTW's PGN
  stages now starting one step later in the status sequence.
- No new database table, column, or constraint. Confirmed by reading
  `supabase/schema_stage_assignments.sql` and `supabase/schema.sql`:
  `stage_assignments.stage_key`/`doc_type` and every document's
  `status` column are plain `TEXT` with no `CHECK` constraint or
  whitelist — new stage-key/status string values are a pure code
  change, nothing to migrate.
- No auto-grant migration for the new `hse_pgsol`/PTW `review_pgsol`
  permissions. Self-service: PGSOL admin creates/edits a role via the
  existing Role & Permission page and checks the new boxes, same as
  any other new permission item added to the catalog. (Explicit user
  choice — see brainstorming transcript.)
- Never rename or repurpose the existing `procedure.review_pgsol` /
  `jsa.review_pgsol` stage keys — they keep meaning "Reviewer PGSOL"
  unchanged, since production already has `stage_assignments` rows and
  role permissions keyed on those exact strings.

## Architecture

### 1. Status enum additions

`lib/procedure-status.ts`, `lib/jsa-status.ts`, `lib/ptw-status.ts` each
get one or two new status string constants, inserted between the
existing Reviewer-PGSOL-equivalent point and the next stage:

- `PROCEDURE_STATUS.reviewHsePgsol = 'Review HSE PGSOL'` — between
  `reviewPgsol` and `menungguReviewPM`.
- `JSA_STATUS.reviewHsePgsol = 'Review HSE PGSOL'` — between
  `reviewPgsol` and `approvalPgn`.
- `PTW_STATUS.reviewPgsol = 'Review PGSOL'` and
  `PTW_STATUS.reviewHsePgsol = 'Review HSE PGSOL'` — both new, inserted
  between `reviewInternalVendor` and `menungguApprovalPM`.

New PTW flow: `Review Internal Vendor` -> `Review PGSOL` -> `Review HSE
PGSOL` -> `Menunggu Approval PM` -> `Review PTW Issuer` -> `Menunggu
Penomoran HSSE` -> `PTW Aktif`.

Each file's `*_PENDING_STATUSES` array (drives `/dashboard/my-task` and
the PGSOL task list) gains the new status value(s), and each file's
`*_STAGE_PERMISSION` map gains the corresponding `{module, action}`
entries (`hse_pgsol` for Prosedur/JSA, `review_pgsol` + `hse_pgsol` for
PTW).

### 2. Stage-key and permission catalog

`lib/stage-assignments.ts`:
- `PGSOL_STAGE_KEYS` grows from 2 to 6 entries: `procedure.review_pgsol`
  (existing), `procedure.hse_pgsol` (new), `jsa.review_pgsol`
  (existing), `jsa.hse_pgsol` (new), `ptw.review_pgsol` (new),
  `ptw.hse_pgsol` (new).
- `STAGE_KEY_PERMISSION` gains matching entries mapping each new key to
  its `{module, action}` permission.

Each of the 3 role-catalog files (`app/dashboard/master-data/role/
constants.ts`, `app/pgsol/dashboard/role/constants.ts`,
`app/vendor/dashboard/role/constants.ts` — kept in sync, triplicated
per pre-existing pattern) gains:
- `procedure` module: new `hse_pgsol` item, `allowedTypes: ['pgsol']`.
- `jsa` module: new `hse_pgsol` item, `allowedTypes: ['pgsol']`.
- `ptw` module: new `review_pgsol` and `hse_pgsol` items,
  `allowedTypes: ['pgsol']`.

### 3. Approve/reject action rewires

`app/dashboard/approval/actions.ts`:
- `approveProcedure`/`rejectProcedure`: new branch for
  `PROCEDURE_STATUS.reviewHsePgsol` -> stage key `procedure.hse_pgsol`
  -> advances to `menungguReviewPM`. Reset-cascade rule (every reject
  sends the document all the way back to Draft, so every EARLIER
  external stage that already collected approvals must reset back to
  `pending`, or a resubmission would skip straight past it):
  `rejectProcedure`'s existing PM-reject branch (`stageKey ===
  'procedure.review'`) already resets `procedure.review_pgsol` — extend
  it to also reset `procedure.hse_pgsol`. **New**: add the same kind of
  extra reset to the new HSE-reject branch itself (`stageKey ===
  'procedure.hse_pgsol'`) — it must additionally reset
  `procedure.review_pgsol`, since that stage already approved before
  reaching HSE. Reject at `review_pgsol` itself needs no extra reset (no
  earlier external stage exists before it).
- `approveJsa`/`rejectJsa`: same pattern and same cascade rule —
  `JSA_STATUS.reviewHsePgsol` -> `jsa.hse_pgsol` -> advances to
  `approvalPgn`. `rejectJsa`'s PGN-reject branch (`stageKey ===
  'jsa.approve_pgn'`) already resets `jsa.review_pgsol` — extend to also
  reset `jsa.hse_pgsol`. **New**: the HSE-reject branch (`stageKey ===
  'jsa.hse_pgsol'`) must additionally reset `jsa.review_pgsol`.
- `approvePtw`/`rejectPtw`: two new branches before the existing
  `menungguApprovalPM` branch —
  `PTW_STATUS.reviewPgsol` -> `ptw.review_pgsol` -> advances to
  `reviewHsePgsol`; `PTW_STATUS.reviewHsePgsol` -> `ptw.hse_pgsol` ->
  advances to `menungguApprovalPM`. `rejectPtw`'s reset-every-other-stage
  array (currently `['ptw.approve_pm', 'ptw.review_issuer',
  'ptw.numbering_hsse']`) gains `'ptw.review_pgsol'` and
  `'ptw.hse_pgsol'`, and its status-to-stageKey branch gains the two new
  `else if` cases.
- `notifyAssignees` calls follow the existing per-transition pattern
  (notify the next stage's assignees on advance).

`app/vendor/dashboard/approval/actions.ts` — `VENDOR_REVIEW_CONFIG.ptw`:
`externalStageKey` changes from `'ptw.approve_pm'` to
`'ptw.review_pgsol'`; `nextStatus` changes from `PTW_STATUS.
menungguApprovalPM` to `PTW_STATUS.reviewPgsol`; `nextStatusLabel`
updated to reference PGSOL. **This is the exact class of bug Fase 3.1's
final review caught** (the producer of a new external-stage status
living outside the plan's per-stage file list) — must be checked
explicitly during implementation review, not assumed covered by the
per-file task list.

### 4. PGSOL assignment UI

`app/pgsol/dashboard/projects/actions.ts`:
- `savePgsolAssignment`'s `docType` parameter type widens from
  `'procedure' | 'jsa'` to `'procedure' | 'jsa' | 'ptw'`.
- `getPgsolProjects` adds `ptw ( id, status )` to its select and to the
  project-relevance filter (currently `procRows.length > 0 ||
  jsaRows.length > 0`, becomes `|| ptwRows.length > 0`).

`app/pgsol/dashboard/projects/[id]/assign/AssignPgsolPanel.tsx` (and its
parent page) — currently renders 2 assignment slots (Prosedur reviewer,
JSA reviewer); must render 6 (Reviewer + HSE, for each of Prosedur/JSA/
PTW). Exact structure to be read and detailed at implementation-plan
time — not fully explored during brainstorming.

### 5. Internal UI gating, badges, PDFs

- `app/dashboard/projects/[id]/AdminProjectClient.tsx` and
  `app/vendor/dashboard/projects/[id]/VendorProjectClient.tsx`: status
  badge/label handling for the new status values; approve/reject button
  visibility must gate on the caller's actual `stage_assignments` row
  (pattern already established for Prosedur/JSA in Fase 3.1) extended to
  the two new statuses per doc type, plus PTW's card (which never had
  this gating for a PGSOL stage before, since PTW had none).
- `components/ptw/PtwPDF.tsx`, `ProsedurPDF`, `JsaPDF`: check for an
  existing "Direview Oleh (PGSOL)" signatory block; if present, it must
  either add a second "HSE PGSOL" block or the design must confirm PDFs
  don't need to show intermediate PGSOL signoffs. To be resolved at
  implementation-plan time by reading the actual PDF components.
- `app/dashboard/my-task/actions.ts` (and any PGSOL-side task-list
  action) — filters already key off `*_PENDING_STATUSES`, so they pick
  up the new statuses automatically once those arrays are updated (item
  1 above); verify no separate hardcoded status list exists.

## Rollout

No SQL migration file. No schema change. Once code is merged/deployed,
PGSOL admins self-serve: create or edit a role via the existing Role &
Permission page, check the new `hse_pgsol` (and, for PTW, `review_pgsol`
too if no existing PGSOL role has it) permission boxes, assign staff to
those roles, then use the (extended) PGSOL project-assign page to name
specific people per project per stage — identical mechanics to how
`review_pgsol` itself was rolled out for Prosedur/JSA in Fase 3.1.

## Testing

No test runner in this repo (see `AGENTS.md`). Verification is
`npx tsc --noEmit` + `npm run build`, plus — time permitting — a manual
end-to-end walk of one PTW through Review Internal Vendor -> Review
PGSOL -> Review HSE PGSOL -> Menunggu Approval PM against a real/dev
Supabase project, mirroring the Fase 3.1 manual verification (see
[[project_approval_chain_revision_progress]] memory for that precedent
and its login-friction notes if browser automation is used).

## Known risk carried over from Fase 2 (unchanged, not introduced here)

`stage_assignments` has no document-identity column — concurrent
same-`doc_type` documents on one project share assignment/decision
state. This spec does not change or worsen that; PTW already carries
this limitation for its existing stages, and the two new PGSOL stages
inherit it identically. Out of scope, as it was for every prior phase.
