# PTW Safety Checklist Web Fill-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let vendor + internal (PGN/PGSOL) users on a project's detail page mark each PTW safety-checklist item Sudah/Belum per day (plus a Keterangan note) while a PTW is active, persist it, and reflect it in the printed PDF.

**Architecture:** One new JSONB column on `public.ptw` (`safety_checklist`), keyed by a stable per-row key derived from the existing code-defined `PTW_TYPES[...].checklist` structure. A new shared pure-function helper (`flattenSafetyChecklist`) is the single source of truth for that key scheme, consumed by both the PDF renderer and the new fill-in UI so they can never disagree on which row a key refers to. One new shared server action does the write, gated by PTW status. One new shared React client component renders the grid and is mounted on both the internal and vendor project-detail pages.

**Tech Stack:** Next.js (App Router) + TypeScript, Supabase (Postgres + RLS + `@supabase/ssr` server client), Tailwind, `@react-pdf/renderer`.

**Spec:** `docs/superpowers/specs/2026-09-14-ptw-safety-checklist-fill-design.md`

## Global Constraints

- No test runner exists in this repo — verify every task with `npx tsc --noEmit` (must show no new errors) and, where noted, `npm run build`. Do not add a test framework.
- The `lib/ptw-types.ts` file's checklist definitions are copied verbatim from official PGN paper forms and its own header comment says not to "fix" typos/wording without confirming with the form owner — do not touch checklist item text, only add new exported types/functions.
- Checklist row keys MUST be produced only by `flattenSafetyChecklist` (Task 2) — never re-derive `item.id`/sub-index concatenation inline anywhere else, or the PDF and the fill-in UI can silently disagree on which row a saved value belongs to.
- Editable only while a PTW's `status` is exactly `PTW_STATUS.aktif` (`'PTW Aktif'`); read-only (no save affordance) for every other status.
- Follow existing repo conventions: server actions are `"use server"` modules under `lib/` or an `actions.ts` file (see `lib/stage-assignments.ts`, `app/vendor/dashboard/ptw/create/[id]/actions.ts`); client components mutate through those actions then call `router.refresh()` (see `handleResumePtw` in `AdminProjectClient.tsx`) rather than managing server state locally.

---

### Task 1: Database migration — `safety_checklist` column + vendor policy

**Files:**
- Create: `supabase/schema_ptw_safety_checklist.sql`

**Interfaces:**
- Produces: `public.ptw.safety_checklist` (JSONB, default `'{}'::jsonb`) column, readable/writable by internal users always and by vendors only while `status = 'PTW Aktif'`.

- [ ] **Step 1: Write the migration file**

```sql
-- SIPERMIT K3: Isian Safety Checklist PTW selama masa aktif
-- Jalankan script ini di Supabase SQL Editor
--
-- "E. SAFETY CHECKLIST" pada tiap tipe PTW (lib/ptw-types.ts) selama ini
-- hanya tercetak kosong di PDF — tidak ada tempat menyimpan status
-- Sudah/Belum per hari (Hari ke-1 s/d ke-7) atau catatan Keterangan yang
-- semestinya diisi selama PTW aktif di lapangan. Kolom ini menyimpannya.
--
-- Format: objek JSON, key = id butir checklist (atau "id.indexSubItem" untuk
-- sub-butir — lihat flattenSafetyChecklist di lib/ptw-types.ts, SATU-
-- SATUNYA tempat yang boleh menghasilkan key ini), value =
-- { "days": [boolean|null, ...tujuh slot], "keterangan": string }.

ALTER TABLE public.ptw
ADD COLUMN IF NOT EXISTS safety_checklist JSONB DEFAULT '{}'::jsonb;

-- Internal users (PGN/PGSOL) sudah punya UPDATE tanpa batasan status lewat
-- policy "Internal users can update all PTW" (lihat schema_update_rls_policies.sql).
--
-- Vendor sebelumnya HANYA boleh UPDATE saat status Draft/Menunggu Approval
-- PM (lihat schema_ptw_vendor_update_policy.sql) — sengaja tidak
-- menyertakan 'PTW Aktif' supaya vendor tidak bisa mengubah PTW yang sudah
-- terbit. Policy tambahan ini TIDAK melonggarkan itu (policy UPDATE untuk
-- role/command yang sama di-OR-kan oleh Postgres): vendor hanya boleh
-- menyentuh baris yang statusnya SUDAH 'PTW Aktif', dan hasil akhirnya
-- harus tetap 'PTW Aktif' — jadi policy ini tidak bisa dipakai untuk
-- mengubah status atau menyentuh PTW yang belum/tidak aktif.
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

- [ ] **Step 2: Apply the migration to the live Supabase project**

Use the Supabase MCP tool `mcp__plugin_supabase_supabase__apply_migration` with the SQL from Step 1 (name it `ptw_safety_checklist`), targeting the project (there is only one project on this account, confirmed in a prior session: `xudwfhmzlzgmsrifomjm`).

- [ ] **Step 3: Verify**

Run via `mcp__plugin_supabase_supabase__execute_sql`:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ptw' AND column_name = 'safety_checklist';

SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'ptw' AND policyname = 'Vendors can update safety checklist on active PTW';
```

Expected: both queries return exactly one row.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema_ptw_safety_checklist.sql
git commit -m "Add safety_checklist column + vendor active-PTW update policy"
```

---

### Task 2: Shared types + key/date helpers in `lib/ptw-types.ts`

**Files:**
- Modify: `lib/ptw-types.ts` (append near the bottom, after the existing `PtwGasTestEntry` interface at line 507)

**Interfaces:**
- Consumes: existing `PtwType`, `PtwTypeDefinition`, `PtwChecklistSub`, `PTW_MAX_VALID_DAYS` (all already in this file).
- Produces (used by Tasks 3, 4, 5):
  - `interface PtwSafetyChecklistEntry { days: (boolean | null)[]; keterangan: string; }`
  - `type PtwSafetyChecklistData = Record<string, PtwSafetyChecklistEntry>;`
  - `interface PtwSafetyChecklistRow { key: string | null; marker: string; label: string; indent: boolean; bold: boolean; checkable: boolean; }`
  - `function flattenSafetyChecklist(typeDef: PtwTypeDefinition): PtwSafetyChecklistRow[]`
  - `function ptwValidDayDates(validFrom?: string | null, validTo?: string | null): string[]` — returns ISO `YYYY-MM-DD` strings, one per valid day, capped at `PTW_MAX_VALID_DAYS`; empty array if `validFrom` is missing/invalid.

- [ ] **Step 1: Append the types and helpers**

Add at the end of `lib/ptw-types.ts` (after the existing `PtwGasTestEntry` interface):

```ts
/**
 * Satu baris "E. SAFETY CHECKLIST" yang diisi via web selama PTW aktif.
 * `days[i]` = status Hari ke-(i+1): true = Sudah, false = Belum, null =
 * belum ditandai. `keterangan` satu per baris (bukan per hari), sesuai
 * form asli yang cuma punya satu kolom Keterangan per baris.
 */
export interface PtwSafetyChecklistEntry {
  days: (boolean | null)[];
  keterangan: string;
}

/** Key = hasil flattenSafetyChecklist(...).key. Baris yang belum disentuh boleh tidak ada di objek ini. */
export type PtwSafetyChecklistData = Record<string, PtwSafetyChecklistEntry>;

/**
 * Satu baris checklist siap-render/siap-simpan, hasil "meratakan" struktur
 * item + subItems pada PtwTypeDefinition. SATU-SATUNYA tempat yang boleh
 * menghasilkan key checklist — PDF (PtwPDF.tsx) dan form isian web
 * (PtwSafetyChecklistForm.tsx) SAMA-SAMA memakai fungsi ini supaya key
 * yang tersimpan selalu konsisten antara keduanya.
 */
export interface PtwSafetyChecklistRow {
  /** null untuk baris judul kelompok (groupOnly) — tidak checkable, tidak disimpan. */
  key: string | null;
  marker: string;
  label: string;
  indent: boolean;
  bold: boolean;
  checkable: boolean;
}

export function flattenSafetyChecklist(typeDef: PtwTypeDefinition): PtwSafetyChecklistRow[] {
  const rows: PtwSafetyChecklistRow[] = [];
  typeDef.checklist.forEach((item, index) => {
    rows.push({
      key: item.groupOnly ? null : item.id,
      marker: item.groupOnly ? '' : `${String.fromCharCode(97 + index)}.`,
      label: item.label,
      indent: false,
      bold: !!item.groupOnly,
      checkable: !item.groupOnly,
    });
    (item.subItems || []).forEach((s, si) => {
      rows.push({
        key: `${item.id}.${si}`,
        marker: s.marker,
        label: s.label,
        indent: s.indent ?? true,
        bold: false,
        checkable: true,
      });
    });
  });
  return rows;
}

/**
 * Tanggal kalender untuk tiap kolom "Hari ke-N", dibatasi
 * PTW_MAX_VALID_DAYS. Kosong kalau validFrom tidak ada/tidak valid — form
 * isian menampilkan 0 kolom hari untuk PTW lama tanpa masa berlaku
 * tersimpan, bukan menebak rentangnya.
 */
export function ptwValidDayDates(validFrom?: string | null, validTo?: string | null): string[] {
  if (!validFrom) return [];
  const start = new Date(`${validFrom}T00:00:00`);
  if (isNaN(start.getTime())) return [];

  let count = PTW_MAX_VALID_DAYS;
  if (validTo) {
    const end = new Date(`${validTo}T00:00:00`);
    if (!isNaN(end.getTime())) {
      const diffDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
      if (diffDays > 0) count = Math.min(diffDays, PTW_MAX_VALID_DAYS);
    }
  }

  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors (this is additive-only — nothing existing imports these names yet).

- [ ] **Step 3: Commit**

```bash
git add lib/ptw-types.ts
git commit -m "Add safety-checklist types and flatten/date helpers to ptw-types"
```

---

### Task 3: Server action — `updatePtwSafetyChecklist`

**Files:**
- Create: `lib/ptw-safety-checklist.ts`

**Interfaces:**
- Consumes: `PtwSafetyChecklistData` (Task 2), `PTW_STATUS` from `lib/ptw-status.ts`, `createClient` from `@/utils/supabase/server`.
- Produces (used by Task 5): `async function updatePtwSafetyChecklist(ptwId: string, checklist: PtwSafetyChecklistData): Promise<{ error?: string }>`

- [ ] **Step 1: Write the action**

```ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { PTW_STATUS } from "@/lib/ptw-status";
import type { PtwSafetyChecklistData } from "@/lib/ptw-types";

/**
 * Menyimpan seluruh objek safety_checklist (full overwrite, bukan merge —
 * client selalu mengirim state lengkap yang sudah dimuat + diedit, sama
 * seperti savePtw() menyimpan hazards/apd/gas_tests). Hanya boleh selama
 * PTW berstatus Aktif; RLS (lihat schema_ptw_safety_checklist.sql) sudah
 * membatasi ini untuk vendor, tapi dicek ulang di sini supaya errornya
 * jelas ketimbang UPDATE yang diam-diam tidak mengenai baris.
 */
export async function updatePtwSafetyChecklist(
  ptwId: string,
  checklist: PtwSafetyChecklistData
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: ptw, error: fetchError } = await supabase
    .from('ptw')
    .select('status')
    .eq('id', ptwId)
    .maybeSingle();

  if (fetchError || !ptw) {
    return { error: 'PTW tidak ditemukan.' };
  }
  if (ptw.status !== PTW_STATUS.aktif) {
    return { error: 'Safety checklist hanya bisa diisi selama PTW berstatus Aktif.' };
  }

  const { error } = await supabase
    .from('ptw')
    .update({ safety_checklist: checklist })
    .eq('id', ptwId);

  if (error) {
    return { error: error.message };
  }
  return {};
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ptw-safety-checklist.ts
git commit -m "Add updatePtwSafetyChecklist server action"
```

---

### Task 4: Render saved checklist state in `PtwPDF.tsx`

**Files:**
- Modify: `components/ptw/PtwPDF.tsx`
  - imports at lines 3-8
  - `PtwPDFProps` interface, lines 164-193
  - function params, lines 202-226
  - `ChecklistRow` component, lines 297-317
  - render loop at lines 493-505

**Interfaces:**
- Consumes: `flattenSafetyChecklist`, `PtwSafetyChecklistData` (Task 2).
- Produces: `PtwPDF` accepts a new optional `checklistData?: PtwSafetyChecklistData` prop; callers that don't pass it get today's blank-boxes behavior unchanged.

- [ ] **Step 1: Import the new helper/type**

In the existing import block at the top of `components/ptw/PtwPDF.tsx`:

```ts
import {
  PTW_TYPES, APD_ITEMS, PtwType, PTW_GAS_TEST_TYPES, PTW_GAS_FORM_TYPES, GAS_TEST_STANDARDS,
  PtwGasTestEntry, PtwGasTestFrequency, HOT_WORK_JOB_TYPES,
  hazardColumnsFor, APD_CATEGORY_LABELS, APD_OTHERS_LABEL,
  flattenSafetyChecklist, PtwSafetyChecklistData,
} from '@/lib/ptw-types';
```

(`PtwChecklistSub` is dropped from this import — Step 4 below removes its only use.)

- [ ] **Step 2: Add the prop**

In `PtwPDFProps` (after the existing `signatories` field):

```ts
  signatories?: PtwSignatories | null;
  /** Isian Sudah/Belum/Keterangan per hari, kosong kalau belum pernah diisi. */
  checklistData?: PtwSafetyChecklistData;
```

In the function signature/destructuring, add `checklistData = {}` after `signatories,`.

- [ ] **Step 3: Extend `ChecklistRow` to render saved marks**

Replace the whole `ChecklistRow` component (lines 297-317) with:

```tsx
  /** Satu baris checklist: kolom Ceklist, item, 7 pasang Sudah/Belum, keterangan. */
  const ChecklistRow = ({ marker, label, indent = false, bold = false, split = true, days, keterangan }: {
    marker: string; label: string; indent?: boolean; bold?: boolean; split?: boolean;
    days?: (boolean | null)[]; keterangan?: string;
  }) => (
    <View style={styles.tRow}>
      <View style={[styles.tCell, { width: '4%', alignItems: 'center' }]}><Text>{marker}</Text></View>
      <View style={[styles.tCell, { width: '31%' }]}>
        <Text style={{ fontSize: 4, lineHeight: 1.0, paddingLeft: indent ? 6 : 0, fontWeight: bold ? 'bold' : 'normal' }}>{label}</Text>
      </View>
      {[1, 2, 3, 4, 5, 6, 7].map((d) => {
        const dayState = days?.[d - 1];
        return (
          <View key={d} style={[styles.tCell, { width: '8%', padding: 0, flexDirection: 'row' }]}>
            {split ? (
              <>
                <View style={{ flex: 1, borderRightWidth: 1, borderColor: B, alignItems: 'center', justifyContent: 'center' }}>
                  {dayState === true ? <Text style={{ fontSize: 4 }}>{'✓'}</Text> : null}
                </View>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  {dayState === false ? <Text style={{ fontSize: 4 }}>{'✓'}</Text> : null}
                </View>
              </>
            ) : null}
          </View>
        );
      })}
      <View style={[styles.tCell, { width: '9%', borderRightWidth: 0 }]}><Text style={{ fontSize: 4 }}>{keterangan || ''}</Text></View>
    </View>
  );
```

- [ ] **Step 4: Replace the render loop to use the flattened rows**

Replace lines 493-505:

```tsx
              {typeDef.checklist.map((item, index) => (
                <React.Fragment key={item.id}>
                  <ChecklistRow
                    marker={item.groupOnly ? '' : `${String.fromCharCode(97 + index)}.`}
                    label={item.label}
                    bold={item.groupOnly}
                    split={!item.groupOnly}
                  />
                  {(item.subItems || []).map((s: PtwChecklistSub, si) => (
                    <ChecklistRow key={si} marker={s.marker} label={s.label} indent={s.indent ?? true} />
                  ))}
                </React.Fragment>
              ))}
```

with:

```tsx
              {flattenSafetyChecklist(typeDef).map((row, i) => (
                <ChecklistRow
                  key={row.key ?? `hdr-${i}`}
                  marker={row.marker}
                  label={row.label}
                  indent={row.indent}
                  bold={row.bold}
                  split={row.checkable}
                  days={row.key ? checklistData[row.key]?.days : undefined}
                  keterangan={row.key ? checklistData[row.key]?.keterangan : undefined}
                />
              ))}
```

(This removes the only remaining use of `PtwChecklistSub` in this file, matching the import already trimmed in Step 1.)

- [ ] **Step 5: Verify types compile and app builds**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both clean. The build renders every PTW-related page at build time (App Router route list), so a broken `PtwPDF` prop signature would surface here.

- [ ] **Step 6: Commit**

```bash
git add components/ptw/PtwPDF.tsx
git commit -m "Render saved safety-checklist state in PtwPDF"
```

---

### Task 5: New UI component — `PtwSafetyChecklistForm`

**Files:**
- Create: `components/ptw/PtwSafetyChecklistForm.tsx`

**Interfaces:**
- Consumes: `flattenSafetyChecklist`, `ptwValidDayDates`, `PtwSafetyChecklistData`, `PTW_TYPES`, `PtwType` (Task 2 / `lib/ptw-types.ts`); `updatePtwSafetyChecklist` (Task 3).
- Produces (used by Tasks 6, 7):

```ts
export interface PtwSafetyChecklistFormProps {
  ptwId: string;
  ptwType: PtwType;
  validFrom?: string | null;
  validTo?: string | null;
  initialChecklist?: PtwSafetyChecklistData;
  editable: boolean;
}
export default function PtwSafetyChecklistForm(props: PtwSafetyChecklistFormProps): JSX.Element | null
```

- [ ] **Step 1: Write the component**

```tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import {
  PTW_TYPES, PtwType, PtwSafetyChecklistData, flattenSafetyChecklist, ptwValidDayDates,
} from '@/lib/ptw-types';
import { updatePtwSafetyChecklist } from '@/lib/ptw-safety-checklist';

export interface PtwSafetyChecklistFormProps {
  ptwId: string;
  ptwType: PtwType;
  validFrom?: string | null;
  validTo?: string | null;
  initialChecklist?: PtwSafetyChecklistData;
  editable: boolean;
}

const formatDayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
};

export default function PtwSafetyChecklistForm({
  ptwId, ptwType, validFrom, validTo, initialChecklist, editable,
}: PtwSafetyChecklistFormProps) {
  const router = useRouter();
  const [checklist, setChecklist] = useState<PtwSafetyChecklistData>(initialChecklist || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dayDates = ptwValidDayDates(validFrom, validTo);
  const typeDef = PTW_TYPES.find(t => t.id === ptwType) || PTW_TYPES[0];
  const rows = flattenSafetyChecklist(typeDef);

  if (dayDates.length === 0) return null;

  const entryFor = (key: string): { days: (boolean | null)[]; keterangan: string } =>
    checklist[key] || { days: Array(dayDates.length).fill(null), keterangan: '' };

  const toggleDay = (key: string, dayIndex: number, value: boolean) => {
    if (!editable) return;
    setChecklist(prev => {
      const current = entryFor(key);
      const days = [...current.days];
      days[dayIndex] = days[dayIndex] === value ? null : value;
      return { ...prev, [key]: { ...current, days } };
    });
  };

  const setKeterangan = (key: string, value: string) => {
    if (!editable) return;
    setChecklist(prev => {
      const current = entryFor(key);
      return { ...prev, [key]: { ...current, keterangan: value } };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const res = await updatePtwSafetyChecklist(ptwId, checklist);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSavedAt(Date.now());
    router.refresh();
  };

  return (
    <details className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
      <summary className="cursor-pointer px-4 py-3 bg-slate-50 text-sm font-bold text-slate-700 hover:bg-slate-100">
        Safety Checklist Harian {editable ? '' : '(hanya lihat — PTW tidak aktif)'}
      </summary>
      <div className="p-4 space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-2 py-2 font-bold min-w-[220px]">Item</th>
                {dayDates.map((d, i) => (
                  <th key={d} className="px-1 py-2 font-bold text-center min-w-[70px]">
                    Hari {i + 1}
                    <div className="font-normal text-slate-400">{formatDayLabel(d)}</div>
                  </th>
                ))}
                <th className="px-2 py-2 font-bold min-w-[160px]">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.key ?? `hdr-${i}`} className="border-b border-slate-100">
                  <td className={`px-2 py-1.5 ${row.indent ? 'pl-6' : ''} ${row.bold ? 'font-bold' : ''}`}>
                    {row.marker ? `${row.marker} ` : ''}{row.label}
                  </td>
                  {row.checkable ? dayDates.map((_, dayIndex) => {
                    const entry = entryFor(row.key!);
                    const state = entry.days[dayIndex];
                    return (
                      <td key={dayIndex} className="px-1 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={() => toggleDay(row.key!, dayIndex, true)}
                            className={`w-5 h-5 rounded text-[10px] font-bold border ${state === true ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-400 border-slate-200'} disabled:opacity-50`}
                            title="Sudah"
                          >S</button>
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={() => toggleDay(row.key!, dayIndex, false)}
                            className={`w-5 h-5 rounded text-[10px] font-bold border ${state === false ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-400 border-slate-200'} disabled:opacity-50`}
                            title="Belum"
                          >B</button>
                        </div>
                      </td>
                    );
                  }) : dayDates.map((_, dayIndex) => <td key={dayIndex}></td>)}
                  <td className="px-2 py-1.5">
                    {row.checkable ? (
                      <input
                        type="text"
                        disabled={!editable}
                        value={entryFor(row.key!).keterangan}
                        onChange={e => setKeterangan(row.key!, e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 disabled:opacity-50 disabled:bg-slate-50"
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

        {editable && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {saving ? 'Menyimpan...' : 'Simpan Checklist'}
            </button>
            {savedAt && !saving && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Tersimpan
              </span>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ptw/PtwSafetyChecklistForm.tsx
git commit -m "Add PtwSafetyChecklistForm component"
```

---

### Task 6: Wire into the internal (PGN/PGSOL) project-detail page

**Files:**
- Modify: `app/dashboard/projects/[id]/page.tsx` (the `ptw ( ... )` column list, currently lines 34-37)
- Modify: `app/dashboard/projects/[id]/AdminProjectClient.tsx` (import block ~line 17; insert point between the QR check-in button block ending at line 1196 and the `<BlobProvider document={` at line 1197)

**Interfaces:**
- Consumes: `PtwSafetyChecklistForm` (Task 5).

- [ ] **Step 1: Add the column to the query**

In `app/dashboard/projects/[id]/page.tsx`, change:

```ts
      ptw ( id, status, rejection_note, ptw_number, workers, equipment, ptw_type, hazards, apd, gas_tests,
            created_at, authority_id, authority_approved_at, issuer_id, issuer_approved_at, hsse_id,
            valid_from, valid_to, work_start, work_end, hot_work_types, gas_test_frequency,
            field_token, stopped_at, stopped_reason, stopped_by_name ),
```

to:

```ts
      ptw ( id, status, rejection_note, ptw_number, workers, equipment, ptw_type, hazards, apd, gas_tests,
            created_at, authority_id, authority_approved_at, issuer_id, issuer_approved_at, hsse_id,
            valid_from, valid_to, work_start, work_end, hot_work_types, gas_test_frequency,
            field_token, stopped_at, stopped_reason, stopped_by_name, safety_checklist ),
```

- [ ] **Step 2: Import the component**

In `app/dashboard/projects/[id]/AdminProjectClient.tsx`, add alongside the existing `import CheckinQrModal from '@/components/ptw/CheckinQrModal';` line:

```ts
import PtwSafetyChecklistForm from '@/components/ptw/PtwSafetyChecklistForm';
```

- [ ] **Step 3: Mount it in the PTW reference card**

Insert directly after the QR check-in button's closing `)}` (the block starting `{row.field_token && !rowIsStopped && (` that ends just before `<BlobProvider document={`):

```tsx
                             <PtwSafetyChecklistForm
                               ptwId={row.id}
                               ptwType={row.ptw_type || 'dingin'}
                               validFrom={row.valid_from}
                               validTo={row.valid_to}
                               initialChecklist={row.safety_checklist || {}}
                               editable={rowEffective === PTW_STATUS.aktif}
                             />
```

so the card renders: title → description → (stopped notice) → QR button → **checklist form** → PDF button.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` then `npm run build` — both must be clean.

Manual check: start the dev server (`npm run dev`), log in as an internal user, open a project that has a PTW with status `PTW Aktif`, confirm the "Safety Checklist Harian" section appears under that PTW's card, expand it, toggle a few Sudah/Belum cells and type a Keterangan, click "Simpan Checklist", confirm the "Tersimpan" indicator appears and the page's data still shows the same marks after a manual reload (F5, not just `router.refresh()`) — this proves it round-tripped through the database, not just local state.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/projects/\[id\]/page.tsx app/dashboard/projects/\[id\]/AdminProjectClient.tsx
git commit -m "Show safety checklist form on internal project detail page"
```

---

### Task 7: Wire into the vendor project-detail page

**Files:**
- Modify: `app/vendor/dashboard/projects/[id]/page.tsx` (the `ptw ( ... )` column list, currently lines 48-51)
- Modify: `app/vendor/dashboard/projects/[id]/VendorProjectClient.tsx` (import block ~line 15; insert point between the QR check-in button block ending at line 461 and the `<div className="flex gap-3">` at line 463)

**Interfaces:**
- Consumes: `PtwSafetyChecklistForm` (Task 5).

- [ ] **Step 1: Add the column to the query**

Same edit as Task 6 Step 1, applied to `app/vendor/dashboard/projects/[id]/page.tsx`'s `ptw ( ... )` block.

- [ ] **Step 2: Import the component**

In `app/vendor/dashboard/projects/[id]/VendorProjectClient.tsx`, add alongside the existing `import PtwPDF from '@/components/ptw/PtwPDF';` line:

```ts
import PtwSafetyChecklistForm from '@/components/ptw/PtwSafetyChecklistForm';
```

- [ ] **Step 3: Mount it in the PTW row**

Insert directly after the QR check-in button block (the block starting `{row.field_token && rowStatus === 'Approved' && (` that closes just before `<div className="flex gap-3">`):

```tsx
                          <PtwSafetyChecklistForm
                            ptwId={row.id}
                            ptwType={row.ptw_type || 'dingin'}
                            validFrom={row.valid_from}
                            validTo={row.valid_to}
                            initialChecklist={row.safety_checklist || {}}
                            editable={rowStatus === 'Approved'}
                          />
```

(`rowStatus === 'Approved'` is this file's existing local label for `rowEffective === PTW_STATUS.aktif`, computed a few lines above at `const rowStatus = ...`.)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` then `npm run build` — both must be clean.

Manual check: log in as the vendor on the same project used in Task 6, open its project detail page, confirm the same checklist section appears on the vendor side for that PTW, and that the marks saved from the internal side in Task 6 are already visible here (same `ptw` row, same column) before you change anything. Toggle a different cell as the vendor, save, then switch back to the internal login and reload — confirm the vendor's edit is visible there too (single shared row, last-write-wins, matches the spec's concurrency section).

- [ ] **Step 5: Commit**

```bash
git add app/vendor/dashboard/projects/\[id\]/page.tsx app/vendor/dashboard/projects/\[id\]/VendorProjectClient.tsx
git commit -m "Show safety checklist form on vendor project detail page"
```

---

### Task 8: End-to-end verification

**Files:** none (verification only; fix forward in the relevant file above if something fails)

- [ ] **Step 1: Full type + build check**

Run: `npx tsc --noEmit` then `npm run build`. Both must be clean with zero errors.

- [ ] **Step 2: PDF reflects saved state**

From either project-detail page used in Tasks 6/7, click "Buka & Print PTW" for the PTW you filled in. Confirm the opened PDF's "E. SAFETY CHECKLIST" table shows checkmarks in the correct Sudah/Belum sub-columns for the days you marked, and the Keterangan text you typed appears in that row's Keterangan cell. Rows you never touched must still render as blank as before (regression check on Task 4's refactor).

- [ ] **Step 3: Read-only after PTW is no longer active**

Pick (or create, via the Supabase MCP `execute_sql`, a throwaway `UPDATE public.ptw SET status = 'Expired' WHERE id = '<test ptw id>'` — revert after) a PTW whose status is not `PTW Aktif`. Reload its project detail page on both portals and confirm the checklist section still shows previously-saved marks but every toggle/input is disabled and there is no "Simpan Checklist" button.

- [ ] **Step 4: Commit any fixups**

If Steps 1-3 required any code changes, stage exactly those files and commit with a message describing what was fixed; otherwise this task produces no commit.
