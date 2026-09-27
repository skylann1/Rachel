# Prosedur per-step kebutuhan → JSA → PTW prefill — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the vendor attach kebutuhan (pekerja / peralatan / material / APD) to each bullet point ("sub langkah") of a Prosedur Kerja's `tahapanPekerjaan`, carry them through the JSA steps, and auto-prefill (pre-check) workers/equipment/APD on the PTW create form — still fully editable there. A helper, never a constraint.

**Architecture:** Prosedur stays JSONB on `content.tahapanPekerjaan` (no prosedur migration — shape is app-defined; a `normalizeTahapanPekerjaan` normalizer keeps legacy `string[]` points readable). The JSA step is the carrier: one new `jsa_steps.kebutuhan JSONB` column holds each step's aggregated needs. The PTW create form's `loadData()` reads the approved project JSA's steps, aggregates the kebutuhan (new shared pure helpers in `lib/procedure-kebutuhan.ts`), and pre-checks the existing pickers. `savePtw`/`ptw` table untouched.

**Tech Stack:** Next.js (App Router) + TypeScript, Supabase (Postgres, existing RLS), Tailwind, `@react-pdf/renderer`.

**Spec:** `docs/superpowers/specs/2026-09-23-prosedur-kebutuhan-ptw-prefill-design.md`

## Global Constraints

- **Migrations are applied by the user by hand in the Supabase SQL editor** — the agent writes the `schema_*.sql` file + README note and never applies/verifies against the live DB (repo convention, user explicit). `supabase/README_org_migration_order.md` "Migrasi terbaru" list is the runbook; append there.
- No test runner exists — verify with `npx tsc --noEmit` (no new errors), ESLint on the touched files, and `npm run build`.
- Keep legacy data readable: every consumer of `tahapanPekerjaan` must go through `normalizeTahapanPekerjaan` (form load, Prosedur PDF, JSA `getJsa`). Never assume new shape on read.
- `jsa_steps` columns `bahaya`/`risiko`/`tindakan` stay as-is (JSON-in-TEXT pattern). Only the new `kebutuhan` column is added.
- PTW prefill must match against the **fresh** roster by master-data `id`; snapshots in prosedur are `{ id, label }` display-only. Never inject `label` into PTW snapshots.
- Material flows only prosedur → JSA documentation. **Do not** add a material slot to PTW (explicitly out of scope).
- Precedence in PTW `loadData()` seed: existing PTW row > JSA-kebutuhan prefill > sibling-PTW copy > project dates — all existing sibling/date logic must keep working.
- Follow repo conventions: server actions `"use server"`; clients call them then `router.refresh()`; `getWorkers`/`getEquipment`/`getMaterials` actions already exist — reuse, don't duplicate.

---

### Task 1: Migration — `jsa_steps.kebutuhan` column + runbook note

**Files:**
- Create: `supabase/schema_jsa_step_kebutuhan.sql`
- Modify: `supabase/README_org_migration_order.md` (append item under "Migrasi terbaru")

**Interfaces:**
- Produces: `public.jsa_steps.kebutuhan` (JSONB, default `'{}'::jsonb`). No RLS/policy change (existing `jsa_steps` policies already cover the org + internal users).

- [ ] **Step 1: Write the migration file**

```sql
-- SIPERMIT K3: Kebutuhan sumber daya per langkah JSA (asal: prosedur kerja)
-- Jalankan script ini di Supabase SQL Editor
--
-- Setiap sub-langkah TAHAPAN PEKERJAAN pada prosedur kerja (content
-- tahapanPekerjaan[].points[].kebutuhan) sekarang bisa membawa kebutuhan:
-- pekerja, peralatan, material, dan APD. Kebutuhan tiap bagian tahapan
-- diagregat ke satu langkah JSA yang bersangkutan dan disimpan di kolom ini
-- supaya bisa dipakai sebagai prefill (auto-check) form PTW nanti.
--
-- Format: objek StepKebutuhan —
-- { "workers": [{id,label}], "equipment": [{id,label}],
--   "materials": [{id,label}], "apd": {kategori: [butir,...]} }.
-- Material DOKUMEN saja (tidak ikut prefill PTW). Baris lama bernilai {}.

ALTER TABLE public.jsa_steps
ADD COLUMN IF NOT EXISTS kebutuhan JSONB DEFAULT '{}'::jsonb;
```

- [ ] **Step 2: Append to the runbook** — `supabase/README_org_migration_order.md`, under the "Migrasi terbaru" numbered list, add:

```
6. `schema_jsa_step_kebutuhan.sql` — kolom `jsa_steps.kebutuhan` (JSONB,
   default `{}`) untuk kebutuhan sumber daya per langkah JSA (asal prosedur
   kerja, dipakai prefill PTW). Additive — aman dijalankan ulang.
```

- [ ] **Step 3: Verify** — tell the user which file was added and where it sits in the order; they apply it in the SQL editor. After they confirm, optionally sanity-check with:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'jsa_steps' AND column_name = 'kebutuhan';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/schema_jsa_step_kebutuhan.sql supabase/README_org_migration_order.md
git commit -m "Add jsa_steps.kebutuhan column for prosedur resource carry-over"
```

---

### Task 2: Shared types + normalizers in `lib/procedure-kebutuhan.ts`

**Files:**
- Create: `lib/procedure-kebutuhan.ts`

**Interfaces:**
- Produces (used by Tasks 3–7):
  - `interface KebutuhanResource { id: string; label: string }`
  - `type StepKebutuhan = { workers: KebutuhanResource[]; equipment: KebutuhanResource[]; materials: KebutuhanResource[]; apd: Record<string, string[]> }`
  - `type TahapanPoint = { text: string; kebutuhan?: StepKebutuhan }`
  - `type TahapanSection = { title: string; points: TahapanPoint[] }`
  - `function emptyKebutuhan(): StepKebutuhan`
  - `function normalizeTahapanPekerjaan(raw: unknown): TahapanSection[]` — legacy `points: string[]` → `TahapanPoint[]`; passes new shape through; tolerates missing `tahapanPekerjaan`.
  - `function aggregatePointNeeds(points: TahapanPoint[]): StepKebutuhan` — union by id and by `(category, apdItem)`, de-duped.
  - `function aggregateStepNeeds(steps: Array<{ kebutuhan?: Partial<StepKebutuhan> }>): StepKebutuhan`

- [ ] **Step 1: Write the module** (pure functions, no `"use server"`, no Supabase imports).

- [ ] **Step 2: Verify** — `npx tsc --noEmit`.

---

### Task 3: Prosedur per-point kebutuhan UI

**Files:**
- Modify: `app/vendor/dashboard/projects/[id]/prosedur/page.tsx`

**Interfaces:**
- Consumes: `normalizeTahapanPekerjaan`, `emptyKebutuhan`, `TahapanPoint`, `TahapanSection` (Task 2); `getWorkers`/`WorkerItem` (`app/vendor/dashboard/pekerja/actions`), `getEquipment`/`EquipmentItem` (`.../peralatan/actions`), `getMaterials` (`.../material/actions`); `APD_ITEMS`, `APD_CATEGORY_LABELS` (`lib/ptw-types`).
- Produces: state `TahapanPekerjaan: TahapanSection[]`; payload to `saveProsedur` unchanged field name (`tahapanPekerjaan`), now holding the new object shape.

- [ ] **Step 1:** Change `tahapanPekerjaan` state type to `TahapanSection[]`; update defaults (`addTahapanSection` → `{ title, points: [] }`, `addTahapanPoint` → `{ text: '', kebutuhan: emptyKebutuhan() }`).
- [ ] **Step 2:** In the load effect, `setTahapanPekerjaan(normalizeTahapanPekerjaan(content.tahapanPekerjaan))` instead of direct assignment.
- [ ] **Step 3:** Fetch master lists on load (`useEffect` alongside existing `loadData`) and hold in state (`rosterPekerja`, `rosterPeralatan`, `rosterMaterial`).
- [ ] **Step 4:** Point row UI: keep text textarea; add a compact "Kebutuhan" toggle (default closed) revealing four blocks — Pekerja chips, Peralatan chips, Material chips (all checkbox-chip toggle by master `id`, storing `{id, label}` in `point.kebutuhan`), and APD grouped checkboxes (`APD_ITEMS`/`APD_CATEGORY_LABELS` storing category→items).
- [ ] **Step 5:** Update `updateTahapanPoint` to edit `point.text`; add handlers `toggleKebutuhanWorker/Equipment/Material(apdItem)` per point.
- [ ] **Step 6:** Verify — `npx tsc --noEmit`; `npm run build`; manual: legacy prosedur loads, new kebutuhan saves+reloads.

---

### Task 4: Prosedur PDF renders points + kebutuhan

**Files:**
- Modify: `app/vendor/dashboard/projects/[id]/prosedur/ProsedurPDF.tsx`

**Interfaces:**
- Consumes: `normalizeTahapanPekerjaan`, `StepKebutuhan` (Task 2).
- Produces: unchanged `ProsedurPDFProps` (keep props type tolerant; normalize inside).

- [ ] **Step 1:** Update `tahapanPekerjaan` prop type to accept both legacy (`points: string[]`) and new (`TahapanPoint[]`) via a union.
- [ ] **Step 2:** In the "6. TAHAPAN PEKERJAAN" render (around line 344), map through `normalizeTahapanPekerjaan(data.tahapanPekerjaan)`; each bullet prints `point.text`.
- [ ] **Step 3:** Below a bullet with non-empty `kebutuhan`, print one small line: `Kebutuhan: Pekerja — a, b · Peralatan — x, y · Material — m · APD — …, …` (join labels; skip empty groups).
- [ ] **Step 4:** Verify — `npx tsc --noEmit`; `npm run build`; open the prosedur PDF for a legacy prosedur (no crash) and for a new one (kebutuhan visible).

---

### Task 5: JSA actions — carry kebutuhan on getJsa/saveJsa

**Files:**
- Modify: `app/vendor/dashboard/jsa/create/[id]/actions.ts`

**Interfaces:**
- Consumes: `normalizeTahapanPekerjaan`, `aggregatePointNeeds` (Task 2).
- Produces: `getJsa` returns `procedureSections: TahapanSection[]` (in addition to today's `procedureSteps: string[]`, unchanged); `saveJsa` writes `kebutuhan` on each inserted `jsa_steps` row.

- [ ] **Step 1:** In `getJsa`, when building `procedureSteps` also build `procedureSections` via `normalizeTahapanPekerjaan(proc?.content?.tahapanPekerjaan)`, and include it in both return branches.
- [ ] **Step 2:** In `saveJsa`, extend `stepsToInsert` map with `kebutuhan: step.kebutuhan ?? {}` (value is the step's `StepKebutuhan`).
- [ ] **Step 3:** Verify — `npx tsc --noEmit`.

---

### Task 6: JSA form + PDF — seed & display kebutuhan

**Files:**
- Modify: `app/vendor/dashboard/jsa/create/[id]/page.tsx`
- Modify: `app/vendor/dashboard/jsa/create/[id]/JsaPDF.tsx`

**Interfaces:**
- Consumes: `procedureSections` (Task 5), `JsaStepData` (this file), `aggregatePointNeeds`, `StepKebutuhan` (Task 2).
- Produces: `JsaStepData.kebutuhan?: StepKebutuhan`; seed per step; read-only chips UI; include kebutuhan when saving.

- [ ] **Step 1:** Add `kebutuhan?: StepKebutuhan` to `JsaStepData` (or keep `any`-typed step rows as this file already does — use a local interface).
- [ ] **Step 2:** In the steps-building effect: when creating steps from `procedureSteps`, map each index to the matching `procedureSections[idx]` and set `kebutuhan: aggregatePointNeeds(section.points)`. Keep the "only if procedur sections exist" behavior.
- [ ] **Step 3:** When loading an existing JSA (`data.steps` path), parse each stored step's `kebutuhan` column into the step state.
- [ ] **Step 4:** Render a read-only chips row per step (Pekerja/Peralatan/Material/APD labels). No new inputs.
- [ ] **Step 5:** `saveJsa` call already passes `jsaSteps`; ensure `kebutuhan` survives into the payload (`jsaData.steps`). Inspect how `handleAjukan` builds `jsaData` and include it.
- [ ] **Step 6:** JSA PDF — render the kebutuhan chips under each step row.
- [ ] **Step 7:** Verify — `npx tsc --noEmit`; `npm run build`; reopen a saved JSA → kebutuhan persist.

---

### Task 7: PTW create — prefill from JSA kebutuhan

**Files:**
- Modify: `app/vendor/dashboard/ptw/create/[id]/actions.ts` (add `getJsaPrefillNeeds`)
- Modify: `app/vendor/dashboard/ptw/create/[id]/[type]/page.tsx`

**Interfaces:**
- Consumes: `aggregateStepNeeds`, `StepKebutuhan` (Task 2); `savePtw`/`getPtw`/`getPtwList`/`getProjectPeriod` (this actions file).
- Produces: `getJsaPrefillNeeds(projectId): Promise<StepKebutuhan | null>`; loadData prefill (workers/equipment ids + apd categories).

- [ ] **Step 1:** Add `getJsaPrefillNeeds(projectId)`:
  - `select('id, status')` on `jsa` where `project_id = projectId` and status is approved (`APPROVED_JSA`, `lib/project-stage`); if none, return `null`.
  - `select('kebutuhan')` on `jsa_steps` for that jsa, ordered by `step_number`; map `steps.map(s => ({ kebutuhan: s.kebutuhan }))`.
  - return `aggregateStepNeeds(rows)`.
- [ ] **Step 2:** In the page, add `getJsaPrefillNeeds(projectId)` to the `Promise.all` in `loadData()`.
- [ ] **Step 3:** Seed precedence — after the `if (data) {...}` (revision) block and **before** the `else if (siblings...)` block:
  ```
  else if (prefill && (prefill.workers.length || prefill.equipment.length || hasApd)) {
    setSelectedPekerja(prefill.workers.map(w => w.id));
    setSelectedPeralatan(prefill.equipment.map(e => e.id));
    setSelectedApd({ ...selectedApd, ...prefill.apd });
    // valid dates still fall through to the project-date block below
  }
  ```
  (Make sure the sibling-copy and project-date fallbacks below remain reachable when prefill is empty.)
- [ ] **Step 4:** Ensure `savePtw` and `handleAjukan` are untouched; only initial checkbox state changed.
- [ ] **Step 5:** Verify — `npx tsc --noEmit`; `npm run build`.

---

### Task 8: Final verification & QA pass

**Files:** none (verification only).

- [ ] **Step 1:** `npx tsc --noEmit` — zero new errors.
- [ ] **Step 2:** ESLint on every touched file — no new violations beyond the file's pre-existing ones.
- [ ] **Step 3:** `npm run build`.
- [ ] **Step 4:** Manual QA (documented in the spec's Testing section): legacy prosedur renders; kebutuhan saves through prosedur → JSA → PTW prefill; PTW edits stick on revision; cross-org vendor sees empty pickers.
- [ ] **Step 5:** Remind the user to run `supabase/schema_jsa_step_kebutuhan.sql` in the SQL editor before testing the JSA/PTW carry-over (code tolerates the missing column only at the type level — reads of a nonexistent column will error, so migration must run first).