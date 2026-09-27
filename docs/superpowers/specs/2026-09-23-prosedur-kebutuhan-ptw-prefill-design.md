# Prosedur per-step kebutuhan → JSA → PTW prefill — design

Date: 2026-09-23

## Problem

The Prosedur Kerja form (`app/vendor/dashboard/projects/[id]/prosedur/page.tsx`)
models "6. TAHAPAN PEKERJAAN" as `{ title: string, points: string[] }[]` —
section titles + free-text bullet points. The resources actually needed for
work (pekerja, peralatan, material, APD) are currently captured only at PTW
time, from scratch, on the PTW create form. The vendor usually knows these
from the prosedur already. The user wants each sub-langkah (bullet point) in
the prosedur to carry its own "kebutuhan" (workers, equipment, material, APD),
flow that through the JSA steps, and have it **pre-checked (auto-prefill)** into
the PTW create form — still fully editable there. It is explicitly a helper,
never a hard constraint.

## Scope

In scope:
- Per-bullet-point resource pickers (pekerja/equipment/material/APD) in the
  prosedur form, stored in `content.tahapanPekerjaan`.
- Resources shown on the Prosedur PDF.
- Carrying each section's aggregated kebutuhan onto its JSA step (persisted on
  `jsa_steps`), shown read-only on the JSA form + JSA PDF.
- Pre-checking workers / equipment / APD on the PTW create form from the
  project's approved JSA steps (aggregated).

Out of scope (decided during brainstorming):
- **Material does NOT flow into PTW.** PTW has no material slot (no column, no
  UI, no PDF section) and adding one is explicitly deferred. Material is
  captured per point in the prosedur and carried on the JSA step for
  documentation only.
- No new permission key / role gating. The existing gates already apply:
  prosedur editing is stage-gated (`procedure.review_vendor`), PTW creation
  requires an approved JSA, and all master-data pickers stay org-scoped. No new
  RLS policy is needed.
- No new `ptw` column, no change to `savePtw`, no change to approval flow.
- No drag-reorder of points (existing app has no DnD; out of scope).

## Data model

### 1. Prosedur `content.tahapanPekerjaan` (JSONB, app-defined, **no migration**)

Legacy shape (still in DB): `{ title: string, points: string[] }`.

New shape:

```ts
interface KebutuhanResource { id: string; label: string }        // snapshot from master data
type StepKebutuhan = {
  workers: KebutuhanResource[];     // vendor_workers
  equipment: KebutuhanResource[];   // vendor_equipment
  materials: KebutuhanResource[];   // vendor_materials — docs only, not PTW
  apd: Record<string, string[]>;    // PTW APD_ITEMS shape, keyed by category
};
type TahapanPoint = { text: string; kebutuhan?: StepKebutuhan };
type TahapanSection = { title: string; points: TahapanPoint[] };
```

- Referential snapshot: `{ id, label }` copies the master row's id + display
  name so the prosedur stays readable even if the master row is later edited or
  deleted. PTW prefill matches by `id` against the **fresh** roster; missing
  rows are silently skipped (label fallback would be wrong — the PTW must
  snapshot from live master data, same as it does today).
- `apd` reuses PTW's `APD_ITEMS` grouped structure 1:1 so prefill is trivially
  `setSelectedApd({ ...selectedApd, [cat]: [...union] })`.

### 2. `jsa_steps.kebutuhan` (JSONB, **one migration**)

```sql
ALTER TABLE public.jsa_steps
ADD COLUMN IF NOT EXISTS kebutuhan JSONB DEFAULT '{}'::jsonb;
```

- Each JSA step = one prosedur section (`langkah` seeded from `section.title`,
  unchanged). The step's `kebutuhan` = `aggregatePointNeeds(section.points)`
  (union across that section's bullets, de-duped by id/category).
- Legacy rows with no value read back as `{}` → empty prefill, no breakage.
- No RLS change: existing `jsa_steps` policies already let the owning vendor
  org and internal users read/write steps (`schema_update_rls_policies.sql`),
  and all our readers already `SELECT *` the table, so the new column is
  additive.

### 3. PTW — unchanged

Prefill only sets initial checkbox state in the create form; the saved
`workers` / `equipment` / `apd` JSONB snapshots and `savePtw` are untouched.

## Single source of truth — new shared lib

New file `lib/procedure-kebutuhan.ts` (pure functions, no "use server"):

- `normalizeTahapanPekerjaan(raw: unknown): TahapanSection[]` — coerces legacy
  `points: string[]` into `TahapanPoint[]`; passes new shape through. Used by
  the prosedur form load, the Prosedur PDF, and the JSA getJsa, so old rows and
  new rows render identically everywhere.
- `aggregatePointNeeds(points: TahapanPoint[]): StepKebutuhan` — union workers/
  equipment/materials by `id`, union `apd` by category. Used to seed each JSA
  step.
- `aggregateStepNeeds(steps: { kebutuhan?: StepKebutuhan }[]): StepKebutuhan` —
  union across all JSA steps; used by the PTW prefill.
- `emptyKebutuhan(): StepKebutuhan`.

## Access control

No new policies, no new permission keys. Current gates:

- Prosedur content is org-scoped (`procedures` RLS) and editing is
  stage-gated by the existing vendor review flow.
- Master-data pickers (workers/equipment/materials) go through the existing
  server actions `getWorkers` / `getEquipment` / `getMaterials`, all org-scoped
  via `getCallerVendorOrgId()`.
- PTW creation already requires `JSA Disetujui` (`APPROVED_JSA`,
  `lib/project-stage.ts`, enforced in `savePtw`).

## UI

### Prosedur form (`app/vendor/dashboard/projects/[id]/prosedur/page.tsx`)

- `points` state type changes `string[]` → `TahapanPoint[]`; on load run the
  value through `normalizeTahapanPekerjaan`.
- Each point row keeps its **text** textarea. Below it, four small resource
  blocks (rendered only when open/non-empty, keep the row compact):
  - **Pekerja** — checkbox chips from `getWorkers()`.
  - **Peralatan** — checkbox chips from `getEquipment()`.
  - **Material** — checkbox chips from `getMaterials()`.
  - **APD** — grouped checkboxes using PTW's `APD_ITEMS` +
    `APD_CATEGORY_LABELS`.
- Probably: one "Kebutuhan" toggle per point (closed by default) to avoid
  bloating the form; selection stored into `point.kebutuhan` with snapshots
  `{ id, label }`.
- `addTahapanPoint` inserts `{ text: '', kebutuhan: emptyKebutuhan() }`.
- `saveProsedur` is untouched (`payload: any` already persists the whole
  state).

### Prosedur PDF (`.../prosedur/ProsedurPDF.tsx`)

- Points render via `normalizeTahapanPekerjaan` so both string and object
  points display. When `kebutuhan` is non-empty, render a small
  "Kebutuhan: Pekerja — A, B; Peralatan — X, Y; Material — M; APD — kaca
  mata, sepatu" line under that bullet.

### JSA form (`app/vendor/dashboard/jsa/create/[id]/page.tsx`) & JSA PDF

- `getJsa` returns `procedureSections: TahapanSection[]` (normalized) in
  addition to today's `procedureSteps: string[]` (kept for compatibility).
- `JsaStepData` gains optional `kebutuhan: StepKebutuhan`.
- Step seed: `langkah = section.title` (unchanged), `kebutuhan =
  aggregatePointNeeds(section.points)`. When re-loading an existing JSA, parse
  the stored `jsa_steps.kebutuhan` into the step.
- Display: read-only chips under each step row. Editing stays in the prosedur
  (and later, at final contract, the PTW). No new inputs here.
- `saveJsa` insert maps `kebutuhan: step.kebutuhan` into the new column.
- JSA PDF renders the kebutuhan chips under each step.

### PTW create (`app/vendor/dashboard/ptw/create/[id]/[type]/page.tsx`)

- New server action `getJsaPrefillNeeds(projectId)` in
  `app/vendor/dashboard/ptw/create/[id]/actions.ts`: loads the project's
  approved JSA + its steps, returns `aggregateStepNeeds(steps)` (or `null` when
  there's no steps/kebutuhan).
- In `loadData()`, precedence for seed state becomes:
  1. existing PTW row for this type (revision — honored as today, no prefill),
  2. **JSA kebutuhan prefill** (new),
  3. sibling-PTW copy (today's fallback),
  4. project date window (today's fallback).
- Prefill: `setSelectedPekerja(union of workers ids)`,
  `setSelectedPeralatan(union of equipment ids)`,
  `setSelectedApd(union of `apd` by category)`. Ids absent from the fresh
  roster are harmless (filtered by the existing pickers).
- The vendor can then edit freely; `handleAjukan`/`savePtw` unchanged.

## Migration

New file `supabase/schema_jsa_step_kebutuhan.sql`:

```sql
ALTER TABLE public.jsa_steps
ADD COLUMN IF NOT EXISTS kebutuhan JSONB DEFAULT '{}'::jsonb;
```

Applied by hand in the Supabase SQL editor (per repo convention — the user runs
migrations, not the agent), and recorded in
`supabase/README_org_migration_order.md` under the "Migrasi terbaru" list so
the ordering stays auditable.

## Error handling / edge cases

- **Legacy prosedur** (string points): normalized on every read; saved back as
  the new object shape after the vendor next edits the prosedur.
- **Legacy JSA** (no `kebutuhan` column value): `{}` → PTW prefill no-ops.
- **Master row deleted after prosedur saved:** label snapshot keeps the
  prosedur readable; PTW prefill silently skips the id.
- **Duplicate references** across points/steps: union helpers de-dupe by id /
  by `(category, item)`.
- **APD category missing** from a point's kebutuhan: treated as empty, prefill
  leaves that PTW category untouched.
- **JSA not yet approved** when opening PTW create: `savePtw` already blocks;
  prefill just finds no approved JSA needs and yields empty.
- **PTW revision** (row already exists): prefill intentionally skipped — the
  saved row wins.

## Testing

No test runner in this repo — verify with `npx tsc --noEmit`, ESLint on the
touched files, and `npm run build`. Manual pass:
- Edit a prosedur with legacy string points → still renders; add kebutuhan to
  a few bullets of two sections → save → reload → PDF shows the resources.
- Create the JSA → each step shows the aggregated chips → save → reopen → still
  there → JSA PDF shows them.
- Create a PTW on that project → workers/equipment/APD pre-checked → toggle a
  few off → submit → reopen the PTW revision → saved selections come back, no
  re-prefill.
- Vendor in a DIFFERENT org opens the same project → master pickers empty for
  them (no cross-org leak).