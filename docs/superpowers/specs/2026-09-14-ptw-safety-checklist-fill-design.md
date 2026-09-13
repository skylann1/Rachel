# PTW Safety Checklist — web fill-in during active work

Date: 2026-09-14

## Problem

Every PTW type in `lib/ptw-types.ts` (`PTW_TYPES[...].checklist`) defines the
"E. SAFETY CHECKLIST" items from the real PGN paper form — each row has a
Sudah/Belum column per day ("Hari ke-1" through "Hari ke-7", capped by
`PTW_MAX_VALID_DAYS`), plus a Keterangan (notes) column. Today this is
rendered only in `components/ptw/PtwPDF.tsx` as an empty table: nothing in
the app lets anyone actually check these boxes. The paper form is meant to
be filled in daily, on site, while the PTW is active (`PTW_STATUS.aktif`,
i.e. "PTW Aktif") — the user wants that done through the web app instead.

## Scope

In scope:
- Persisting per-day Sudah/Belum + per-row Keterangan for a PTW's safety
  checklist.
- A web UI to fill it in, available on both the internal (PGN/PGSOL) and
  vendor project-detail pages, while the PTW is active.
- Reflecting saved checklist state back into the printed PDF.

Out of scope (explicitly declined during brainstorming):
- Any new permission/role gating beyond "has access to the project page" —
  no new `stage_assignments`-style approval chain for this feature.
- Editing the checklist once the PTW is no longer active (`Expired` /
  `Dihentikan (SWA)`) — read-only past that point.
- Changing which rows are checklist items — reuses the existing
  `PTW_TYPES[...].checklist` definitions as-is.

## Data model

Add one JSONB column to `public.ptw`, following the existing pattern used
for `hazards`/`apd`/`gas_tests` on the same table:

```sql
ALTER TABLE public.ptw
ADD COLUMN IF NOT EXISTS safety_checklist JSONB DEFAULT '{}'::jsonb;
```

Shape — an object keyed by a stable per-row key:

- `"{item.id}"` for a checkable item row (any item where `groupOnly` is not
  true — matches exactly the rows `PtwPDF.tsx` already renders with
  `split={!item.groupOnly}`).
- `"{item.id}.{subIndex}"` for each of that item's `subItems` (0-based
  index into the `subItems` array) — matches the rows `PtwPDF.tsx` already
  renders via `(item.subItems || []).map(...)`, one `ChecklistRow` per
  sub-item, regardless of `groupOnly`.

Each value: `{ "days": [boolean|null, ...7 entries], "keterangan": string }`.
`days[i]` (0-indexed) represents "Hari ke-{i+1}", i.e. the calendar date
`valid_from + i` days. `true` = Sudah, `false` = Belum, `null`/absent =
not yet marked. `keterangan` is one free-text field per row (the paper
form has one Keterangan column per row, not per day).

Rows/keys not present in the object are treated as unmarked (`null`) with
empty `keterangan` — the object only needs to store what's actually been
touched.

This key scheme is derived purely from the existing code-defined
`PTW_TYPES` structure (not from the DB), consistent with how the checklist
content itself is already code-defined rather than DB-defined. If a
checklist definition's row order/composition changes in `lib/ptw-types.ts`
in the future, previously-saved keys for removed/reordered rows become
orphaned data (harmless — they just stop being displayed) rather than
corrupting other rows, since keys are content-addressed by `item.id` /
sub-index, not by array position across the whole list.

## Access control

**Internal users (PGN/PGSOL):** already covered by the existing blanket
policy `"Internal users can update all PTW"` (`USING (public.is_internal_user())`,
no status restriction) — no RLS change needed.

**Vendors:** the existing policy `"Vendors can update PTW for their
projects"` (`supabase/schema_ptw_vendor_update_policy.sql`) restricts
vendor `UPDATE` to `status IN ('Draft', 'Menunggu Approval PM')` —
deliberately excluding `'PTW Aktif'`, since a vendor must not edit an
already-issued PTW's submitted fields. Rather than loosen that policy, add
a second, narrower, purely-additive policy (Postgres RLS `UPDATE` policies
for the same role/command OR together, so this doesn't loosen the existing
one):

```sql
CREATE POLICY "Vendors can update safety checklist on active PTW"
ON public.ptw FOR UPDATE
TO authenticated
USING (
  status = 'PTW Aktif'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = auth.uid()
  )
)
WITH CHECK (
  status = 'PTW Aktif'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.vendor_id = auth.uid()
  )
);
```

`WITH CHECK` pins the resulting row to stay at `status = 'PTW Aktif'`, so
this new policy can't be used to change status or touch a non-active PTW —
same trust model the codebase already uses elsewhere (RLS bounds *which
rows/status* can be touched; the server action layer is trusted for *which
columns* it actually writes, same as the pre-existing vendor PTW update
policy).

The server action itself (below) re-checks `status === PTW_STATUS.aktif`
before writing, as defense in depth and to give a clear error rather than
a silently-dropped RLS-rejected update.

## Server action

New file `lib/ptw-safety-checklist.ts` (`"use server"`, same shape as the
existing `lib/stage-assignments.ts`/`lib/document-logs.ts` shared
server-action modules):

```ts
export async function updatePtwSafetyChecklist(
  ptwId: string,
  checklist: Record<string, { days: (boolean | null)[]; keterangan: string }>
): Promise<{ error?: string }>
```

- Loads the PTW row's `status`; if not `PTW_STATUS.aktif`, returns an error
  without writing (surfaced in the UI as a toast — this only happens if a
  PTW expires while the page is open).
- Otherwise `UPDATE public.ptw SET safety_checklist = :checklist WHERE id = :ptwId`.
- No merge logic needed server-side — the client always sends the full
  current checklist object for that PTW (read-modify-write from the
  already-loaded row), same approach `savePtw` already uses for
  `hazards`/`apd`/`gas_tests`.

## UI

New shared client component `components/ptw/PtwSafetyChecklistForm.tsx`:

- Props: the PTW row (for `id`, `ptw_type`, `valid_from`, `valid_to`,
  `status`, `safety_checklist`).
- Renders a grid: rows = flattened checklist rows for that `ptw_type` from
  `PTW_TYPES` (item rows + sub-item rows, same traversal `PtwPDF.tsx`
  already does), columns = one per valid day (`valid_from` through
  `valid_to`, capped at `PTW_MAX_VALID_DAYS`), each cell a Sudah/Belum
  toggle. Each row also gets one Keterangan text input.
- Column header shows both "Hari ke-N" and the resolved calendar date.
- Read-only (toggles disabled, no save button) when `status !==
  PTW_STATUS.aktif`.
- Local component state holds the in-progress edits; an explicit "Simpan"
  button calls `updatePtwSafetyChecklist` with the full current object
  (no per-keystroke autosave — keeps the write path simple and matches
  this app's existing save-button convention elsewhere, e.g. the JSA/PTW
  create forms).

Mounted inside each active PTW's existing card/section in both
`app/dashboard/projects/[id]/AdminProjectClient.tsx` (internal) and
`app/vendor/dashboard/projects/[id]/VendorProjectClient.tsx` (vendor) —
both already render per-PTW-type cards with the row's data available, so
this is an addition to those cards, not a new page. Visible whenever a
`ptw` row exists for that type (any status), but interactive only while
`PTW Aktif`.

## PDF

`components/ptw/PtwPDF.tsx`'s `ChecklistRow` (and its caller loop at the
"E. SAFETY CHECKLIST" section) gains an optional `checklistData` prop
(the same `Record<string, { days, keterangan }>` shape). When a row's key
is present in the data, its 7 day-cells render a filled Sudah/Belum mark
(instead of two empty boxes) and its Keterangan cell renders the saved
text. Rows/keys absent from the data render exactly as today (empty). No
layout change. Both call sites of `PtwPDF` (internal `AdminProjectClient`,
vendor `VendorProjectClient`, and the create-flow preview in
`app/vendor/dashboard/ptw/create/[id]/[type]/page.tsx`) pass
`row.safety_checklist` (or `{}` where not yet available, e.g. the
create-flow preview before the row exists).

## Error handling / edge cases

- **PTW expires while a user has the form open:** save call re-checks
  status server-side and returns an error toast; client does not
  optimistically clear the form.
- **`valid_from`/`valid_to` missing** (legacy rows predating
  `schema_ptw_form_details.sql`): fall back to showing 0 day columns (just
  the Keterangan/label columns) rather than guessing a range — matches how
  the rest of the app already treats this as an incomplete/legacy PTW.
- **Concurrent edits from two users on the same PTW:** last-write-wins,
  full-object overwrite — acceptable for this feature (same concurrency
  model already used for `hazards`/`apd`/`gas_tests` on this same table;
  no stricter merge exists anywhere else in the codebase for `ptw` either).
- **`groupOnly` items** (only in the `ketinggian` type) never get their own
  row/key — only their `subItems` do, matching the PDF's existing render
  logic exactly.

## Testing

No test runner in this repo (see `repo_conventions` memory) — verify via
`tsc --noEmit` + `npm run build`, plus a manual pass: mark a mix of
Sudah/Belum/Keterangan on an active PTW as both a vendor user and an
internal user, reload to confirm persistence, re-generate the PDF to
confirm it reflects the saved state, and confirm the grid becomes
read-only once the PTW's status is no longer `PTW Aktif`.
