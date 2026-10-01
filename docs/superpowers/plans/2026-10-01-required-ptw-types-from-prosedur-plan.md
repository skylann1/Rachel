# Required PTW Types From Prosedur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the vendor mark which of the 10 PTW types a job needs while filling in Prosedur Kerja, then auto-highlight those types on the PTW type-selection page.

**Architecture:** One new document-level field (`content.requiredPtwTypes: PtwType[]`) on the existing Prosedur JSONB `content` — no migration. The Prosedur form gets a new required checklist that writes/reads this field. The PTW type list page gets a new server action that reads it straight from the project's `procedures` row and uses it to sort + badge the existing 10-type grid — no new table, no JSA involvement.

**Tech Stack:** Next.js App Router (client components + server actions), Supabase (Postgres, existing RLS unchanged), TypeScript, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-01-required-ptw-types-from-prosedur-design.md`

## Global Constraints

- No migration — `procedures.content` is already a free-form JSONB column; `requiredPtwTypes` is just a new key in it, same pattern as the existing `hazards`/`tahapanPekerjaan` fields.
- `ProsedurPDF.tsx` is **not touched** — this field is app-only, never printed (same decision as the earlier "sumber bahaya" feature).
- JSA is **not touched** — the PTW list page reads `requiredPtwTypes` directly from the project's `procedures` row (1 row per `project_id`), no intermediate carrying through `jsa_steps`.
- No permission/RLS changes — existing `procedures` and `ptw` access gates are untouched.
- No test framework in this repo — verification is `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/next/dist/bin/next build`, plus the manual steps each task lists. No `npm`/`npx`.
- Required field: Prosedur submit must have at least one PTW type checked, enforced client-side the same way other required-field errors in this form are handled (an `alert()` that stops submission).

---

## File Structure

**Modified files:**
- `app/vendor/dashboard/projects/[id]/prosedur/page.tsx` — new checklist state + UI + validation + payload field.
- `app/vendor/dashboard/ptw/create/[id]/actions.ts` — new `getRequiredPtwTypes` server action.
- `app/vendor/dashboard/ptw/create/[id]/page.tsx` — reads the new action, sorts the type grid, renders a "Wajib" badge.

No new files — both tasks extend existing, already-small files along their existing responsibilities (Prosedur form owns Prosedur's own content; the PTW list page owns its own list-fetch-and-render).

---

### Task 1: "Jenis PTW yang Dibutuhkan" checklist in the Prosedur form

**Files:**
- Modify: `app/vendor/dashboard/projects/[id]/prosedur/page.tsx`

**Interfaces:**
- Consumes: `PTW_TYPES` (array of `{ id: PtwType; title: string; color: string; textColor: string; ... }`) and `PtwType` from `@/lib/ptw-types` (both already exported there, just not yet imported in this file).
- Produces: `content.requiredPtwTypes: PtwType[]` written by `saveProsedur` — Task 2's `getRequiredPtwTypes` reads this exact key from the same `procedures.content` column.

- [ ] **Step 1: Add `PTW_TYPES` and `PtwType` to the existing `lib/ptw-types` import**

Before (`app/vendor/dashboard/projects/[id]/prosedur/page.tsx`, near the top):

```tsx
import { APD_ITEMS, APD_CATEGORY_LABELS, HAZARD_COLUMNS } from '@/lib/ptw-types';
```

After:

```tsx
import { APD_ITEMS, APD_CATEGORY_LABELS, HAZARD_COLUMNS, PTW_TYPES, PtwType } from '@/lib/ptw-types';
```

- [ ] **Step 2: Add the checklist state and toggle function**

Before:

```tsx
  const [docId, setDocId] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
```

After:

```tsx
  const [docId, setDocId] = useState<string | null>(null);

  // Jenis PTW yang Dibutuhkan — checklist level DOKUMEN (bukan per
  // sub-langkah seperti panel "Kebutuhan"), dikonsumsi halaman PTW list
  // untuk menyorot jenis yang wajib diajukan.
  const [requiredPtwTypes, setRequiredPtwTypes] = useState<PtwType[]>([]);

  const togglePtwType = (type: PtwType) => {
    setRequiredPtwTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Fetch initial data
  useEffect(() => {
```

- [ ] **Step 3: Load the field from saved Prosedur content**

Before:

```tsx
          if (content.tahapanPekerjaan) setTahapanPekerjaan(normalizeTahapanPekerjaan(content.tahapanPekerjaan));
          if (content.penyelesaianAkhir) setPenyelesaianAkhir(content.penyelesaianAkhir);
        }
      }
    }
    loadData();
  }, [params.id]);
```

After:

```tsx
          if (content.tahapanPekerjaan) setTahapanPekerjaan(normalizeTahapanPekerjaan(content.tahapanPekerjaan));
          if (content.penyelesaianAkhir) setPenyelesaianAkhir(content.penyelesaianAkhir);
          if (content.requiredPtwTypes) setRequiredPtwTypes(content.requiredPtwTypes);
        }
      }
    }
    loadData();
  }, [params.id]);
```

- [ ] **Step 4: Validate on submit and add the field to the save payload**

Before:

```tsx
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      docNo,
      contractNo,
      submissionDate,
      umum,
      scopeOfWork,
      tools: derivedSections.tools,
      selectedApd: derivedSections.apd,
      perlengkapanLainnya: derivedSections.perlengkapanLainnya,
      tahapanPekerjaan,
      penyelesaianAkhir,
      vendorSignature,
      revisions
    };
```

After:

```tsx
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (requiredPtwTypes.length === 0) {
      alert('Pilih minimal satu jenis PTW yang dibutuhkan untuk pekerjaan ini.');
      return;
    }

    setIsSaving(true);

    const payload = {
      docNo,
      contractNo,
      submissionDate,
      umum,
      scopeOfWork,
      tools: derivedSections.tools,
      selectedApd: derivedSections.apd,
      perlengkapanLainnya: derivedSections.perlengkapanLainnya,
      tahapanPekerjaan,
      penyelesaianAkhir,
      vendorSignature,
      revisions,
      requiredPtwTypes
    };
```

- [ ] **Step 5: Add the checklist UI to Section A**

Before (the end of Section A's administrasi grid):

```tsx
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700 block mb-2">Submission Date <span className="text-rose-500">*</span></label>
              <input 
                required
                type="date" 
                value={submissionDate}
                onChange={(e) => setSubmissionDate(e.target.value)}
                className="w-full md:w-1/2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm font-medium"
              />
            </div>
          </div>
        </section>

        {/* SECTION B: Teknis */}
```

After:

```tsx
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700 block mb-2">Submission Date <span className="text-rose-500">*</span></label>
              <input 
                required
                type="date" 
                value={submissionDate}
                onChange={(e) => setSubmissionDate(e.target.value)}
                className="w-full md:w-1/2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm font-medium"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700 block mb-3">
                Jenis PTW yang Dibutuhkan <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {PTW_TYPES.map(type => {
                  const checked = requiredPtwTypes.includes(type.id);
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => togglePtwType(type.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                        checked ? 'border-transparent' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                      style={checked ? { backgroundColor: type.color, color: type.textColor } : undefined}
                    >
                      <CheckCircle2 className={`w-4 h-4 shrink-0 ${checked ? 'opacity-100' : 'opacity-30'}`} />
                      {type.title.split('(')[0].trim()}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-2">Pilih semua jenis izin kerja yang relevan dengan pekerjaan ini — menentukan jenis PTW mana yang ditandai wajib di halaman pengajuan PTW.</p>
            </div>
          </div>
        </section>

        {/* SECTION B: Teknis */}
```

(`CheckCircle2` is already imported in this file's lucide-react import line — no new icon import needed.)

- [ ] **Step 6: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Manual verification**

Start the dev server (or use a running one), open a project's Prosedur form:
1. On a project whose Prosedur was never saved with this field, confirm the new checklist renders with nothing checked (no crash).
2. Click "Simpan" / submit without checking any PTW type — confirm the alert "Pilih minimal satu jenis PTW yang dibutuhkan untuk pekerjaan ini." appears and the form does not submit.
3. Check 2-3 types (e.g. Panas, Ketinggian), submit successfully, reload the page — confirm the same 2-3 types are still checked.

- [ ] **Step 8: Commit**

```bash
git add app/vendor/dashboard/projects/[id]/prosedur/page.tsx
git commit -m "Add required PTW types checklist to Prosedur form"
```

---

### Task 2: Auto-highlight required PTW types on the PTW list page

**Files:**
- Modify: `app/vendor/dashboard/ptw/create/[id]/actions.ts`
- Modify: `app/vendor/dashboard/ptw/create/[id]/page.tsx`

**Interfaces:**
- Consumes: `content.requiredPtwTypes` written by Task 1 (exact same key, same `procedures.content` column, same `PtwType[]` shape).
- Produces: `getRequiredPtwTypes(projectId: string): Promise<PtwType[]>` — a plain additive server action, not consumed by any other task in this plan.

- [ ] **Step 1: Add the `getRequiredPtwTypes` server action**

Before (`app/vendor/dashboard/ptw/create/[id]/actions.ts`):

```ts
import type { PtwFormDetails } from "@/lib/ptw-types";
```

After:

```ts
import type { PtwFormDetails, PtwType } from "@/lib/ptw-types";
```

Before:

```ts
export async function getPtwList(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('ptw')
    .select('*')
    .eq('project_id', projectId);
  return data ?? [];
}

export async function savePtw(
```

After:

```ts
export async function getPtwList(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('ptw')
    .select('*')
    .eq('project_id', projectId);
  return data ?? [];
}

/**
 * Jenis PTW yang ditandai wajib oleh vendor saat menyusun Prosedur Kerja
 * (checklist "Jenis PTW yang Dibutuhkan", content.requiredPtwTypes) —
 * dipakai halaman list PTW untuk menyorot jenis yang wajib diajukan.
 * Prosedur lama/yang belum pernah menyentuh field ini balik [].
 */
export async function getRequiredPtwTypes(projectId: string): Promise<PtwType[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('procedures')
    .select('content')
    .eq('project_id', projectId)
    .maybeSingle();
  return (data?.content?.requiredPtwTypes as PtwType[]) || [];
}

export async function savePtw(
```

- [ ] **Step 2: Fetch it alongside the PTW list, and sort the type grid**

Before (`app/vendor/dashboard/ptw/create/[id]/page.tsx`):

```tsx
import { getPtwList } from './actions';
import { PTW_TYPES } from '@/lib/ptw-types';
import { PTW_STATUS, isPtwPending } from '@/lib/ptw-status';
```

After:

```tsx
import { getPtwList, getRequiredPtwTypes } from './actions';
import { PTW_TYPES, type PtwType } from '@/lib/ptw-types';
import { PTW_STATUS, isPtwPending } from '@/lib/ptw-status';
```

Before:

```tsx
  const [ptws, setPtws] = useState<PtwRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!projectId) return;
      const data = await getPtwList(projectId);
      setPtws(data as PtwRow[]);
      setIsLoading(false);
    }
    load();
  }, [projectId]);

  const rowFor = (typeId: string) => ptws.find(p => p.ptw_type === typeId);
```

After:

```tsx
  const [ptws, setPtws] = useState<PtwRow[]>([]);
  const [requiredTypes, setRequiredTypes] = useState<PtwType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!projectId) return;
      const [data, required] = await Promise.all([
        getPtwList(projectId),
        getRequiredPtwTypes(projectId),
      ]);
      setPtws(data as PtwRow[]);
      setRequiredTypes(required);
      setIsLoading(false);
    }
    load();
  }, [projectId]);

  const rowFor = (typeId: string) => ptws.find(p => p.ptw_type === typeId);

  // Jenis wajib (ditandai di Prosedur) tampil duluan; urutan asli PTW_TYPES
  // dipertahankan di dalam masing-masing kelompok (Array.sort stabil sejak ES2019).
  const sortedTypes = [...PTW_TYPES].sort((a, b) => {
    const aRequired = requiredTypes.includes(a.id) ? 0 : 1;
    const bRequired = requiredTypes.includes(b.id) ? 0 : 1;
    return aRequired - bRequired;
  });
```

- [ ] **Step 3: Render the "Wajib" badge and switch the map source to `sortedTypes`**

Before:

```tsx
          PTW_TYPES.map(type => {
            const row = rowFor(type.id);
            return (
              <Link
                key={type.id}
                href={`/vendor/dashboard/ptw/create/${encodeURIComponent(projectId)}/${type.id}`}
                className="flex items-center justify-between gap-4 p-5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: `${type.color}20`, color: type.color }}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-800">{type.title.split('(')[0].trim()}</div>
                    <div className="text-xs text-slate-400">{row ? 'Klik untuk lihat / revisi' : 'Klik untuk mengajukan'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {statusBadge(row)}
                  {!row && <Plus className="w-4 h-4 text-slate-400" />}
                </div>
              </Link>
            );
          })
```

After:

```tsx
          sortedTypes.map(type => {
            const row = rowFor(type.id);
            const isRequired = requiredTypes.includes(type.id);
            return (
              <Link
                key={type.id}
                href={`/vendor/dashboard/ptw/create/${encodeURIComponent(projectId)}/${type.id}`}
                className="flex items-center justify-between gap-4 p-5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: `${type.color}20`, color: type.color }}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-800">{type.title.split('(')[0].trim()}</div>
                    <div className="text-xs text-slate-400">{row ? 'Klik untuk lihat / revisi' : 'Klik untuk mengajukan'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {isRequired && (
                    <span
                      className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full"
                      style={{ backgroundColor: `${type.color}20`, color: type.color }}
                    >
                      Wajib
                    </span>
                  )}
                  {statusBadge(row)}
                  {!row && <Plus className="w-4 h-4 text-slate-400" />}
                </div>
              </Link>
            );
          })
```

- [ ] **Step 4: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Using the same project you checked PTW types for in Task 1's manual verification:
1. Open `/vendor/dashboard/ptw/create/[that project's id]` — confirm the types you checked in Prosedur (e.g. Panas, Ketinggian) appear first in the list, each with a "Wajib" badge.
2. Confirm the other (non-required) types still render below, fully clickable, no badge.
3. Open the PTW list page for a different project whose Prosedur was never touched by Task 1's checklist — confirm it renders exactly as before (no "Wajib" badge anywhere, original order).

- [ ] **Step 6: Commit**

```bash
git add app/vendor/dashboard/ptw/create/[id]/actions.ts app/vendor/dashboard/ptw/create/[id]/page.tsx
git commit -m "Auto-highlight required PTW types on the PTW list page"
```

---

## Self-Review Notes

- **Spec coverage:** data model (`content.requiredPtwTypes`) → Task 1 Steps 2-4; Prosedur UI + validation → Task 1 Steps 2, 4, 5; PTW list UI (badge + sort, no hiding) → Task 2 Steps 2-3; "ProsedurPDF/JSA/permission untouched" → no task touches those files, confirmed by the File Structure section listing only 3 files total. Every spec section has a task.
- **Placeholder scan:** no TBD/TODO; every step has literal code.
- **Type consistency:** `requiredPtwTypes: PtwType[]` (Task 1, written) and `getRequiredPtwTypes(): Promise<PtwType[]>` / `requiredTypes: PtwType[]` (Task 2, read) use the same type and the same `content.requiredPtwTypes` key — verified by re-reading both task's code blocks side by side.
