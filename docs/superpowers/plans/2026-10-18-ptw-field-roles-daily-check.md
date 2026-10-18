# PTW Field Roles (Pemegang & Pengawas) + Daily Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-PTW assignment of a vendor *Pemegang* and a PGN *Pengawas* (with switch + history), a daily-check flow for both, My Task reminders, and the filled-in *Verifikasi* box in the PTW PDF.

**Architecture:** Two new tables keyed by `ptw_id` (`ptw_field_assignments`, `ptw_daily_checks`); all writes go through `SECURITY DEFINER` RPCs that re-check permission, realm, org, PTW status and the daily window (same defense-in-depth pattern as `update_ptw_safety_checklist`). One shared `"use server"` file serves both realms; one client panel (`PtwFieldPanel`) is embedded in the existing *Safety Check* tab of both project pages. My Task reuses the existing task queues, so sidebar badges update automatically.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (Postgres RPC + RLS), `@react-pdf/renderer`. **No test framework** (see `AGENTS.md`): pure helpers are verified with a throwaway `node` script, DB rules with rolled-back SQL, everything else with `tsc` + `lint` + `build`.

**Spec:** `docs/superpowers/specs/2026-10-18-ptw-field-roles-daily-check-design.md`

> **Read first (AGENTS.md):** this is *not* the Next.js you know — before writing any Next-specific code skim the relevant guide in `node_modules/next/dist/docs/`. A `"use server"` file may export **only async functions** (types/constants live in `lib/`).

## Global Constraints

- Language of UI text and code comments: **Indonesian**, matching surrounding code.
- Only **one** active person per `(ptw_id, peran)`; roles are exactly `'pemegang'` and `'pengawas'`.
- "Hari ini" is always `todayDateString()` (`lib/site-ops.ts`, Asia/Jakarta); daily window = `PTW_MAX_VALID_DAYS` (7) days from `valid_from`, never past `valid_to`; no back-filling.
- Assignments and daily checks only while PTW status is `'PTW Aktif'` (effective status via `getEffectivePtwStatus`).
- Daily checks are immutable after submit (no UPDATE/DELETE policy; writes only via RPC).
- Fail-closed: permission opens the feature, an **active assignment** opens the action.
- Schema change = new `supabase/schema_*.sql` file applied **by hand** + README note; it must be applied **before** deploying this code because the project pages will embed `ptw_daily_checks`.
- Do not touch `AGENTS.md` (has the user's uncommitted edits), `pnpm-lock.yaml`, or `package-lock.json`.
- Commit only the files of the current task (the working tree contains unrelated uncommitted push-notification work). End each commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
|---|---|
| `supabase/schema_ptw_field_assignments.sql` (new) | tables, indexes, RLS, helper + 2 RPCs, updated `update_ptw_safety_checklist` |
| `supabase/README_org_migration_order.md` (modify) | add migration to the ordered list |
| `lib/ptw-field.ts` (new) | shared types + pure helpers (no imports except `import type`) |
| `app/dashboard/master-data/role/constants.ts`, `app/vendor/dashboard/role/constants.ts` (modify) | 4 new `ptw` permission keys |
| `app/dashboard/ptw-field/actions.ts` (new, `"use server"`) | data fetch, candidates, assign/switch, submit check, pending checks |
| `components/ptw/PtwFieldPanel.tsx` (new) | assignment panel + per-day table + check forms |
| `components/ptw/PtwSafetyCheckTab.tsx` (modify) | embed `PtwFieldPanel` per active PTW |
| `app/dashboard/my-task/{actions.ts,MyTaskClient.tsx}`, `app/vendor/dashboard/my-task/{actions.ts,MyTaskClient.tsx}` (modify) | "Check Harian" tasks |
| `components/ptw/PtwPDF.tsx` (modify) | fill Verifikasi box from `dailyChecks` |
| `app/dashboard/projects/[id]/{page.tsx,AdminProjectClient.tsx}`, `app/vendor/dashboard/projects/[id]/{page.tsx,VendorProjectClient.tsx}` (modify) | embed + pass `ptw_daily_checks` to PDF |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/schema_ptw_field_assignments.sql`
- Modify: `supabase/README_org_migration_order.md` (append item)

**Interfaces:**
- Produces (used by Tasks 3–6): tables `public.ptw_field_assignments(id, ptw_id, peran, user_id, aktif_dari, aktif_sampai, ditugaskan_oleh, alasan)` and `public.ptw_daily_checks(id, ptw_id, hari_ke, tanggal, peran, user_id, diisi_pada, inisial, uraian_pekerjaan)`; RPCs `ptw_assign_field_role(p_ptw_id uuid, p_peran text, p_user_id uuid, p_alasan text default null) returns uuid` and `ptw_submit_daily_check(p_ptw_id uuid, p_uraian text default null, p_required_keys text[] default '{}') returns uuid`; helper `ptw_user_has_perm(p_user uuid, p_action text) returns boolean`.

- [ ] **Step 1: Write the migration file**

Create `supabase/schema_ptw_field_assignments.sql`:

```sql
-- SIPERMIT K3: Pemegang & Pengawas PTW per PTW + daily check
-- Jalankan di Supabase SQL Editor SEBELUM deploy kode fitur ini.
-- Aman dijalankan ulang (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).
--
-- Spec: docs/superpowers/specs/2026-10-18-ptw-field-roles-daily-check-design.md
--
-- Penulisan HANYA lewat RPC SECURITY DEFINER di bawah; tabel tidak punya
-- policy INSERT/UPDATE/DELETE untuk user biasa, jadi daily check terkunci
-- setelah dikirim.

CREATE TABLE IF NOT EXISTS public.ptw_field_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ptw_id          uuid NOT NULL REFERENCES public.ptw(id) ON DELETE CASCADE,
  peran           text NOT NULL CHECK (peran IN ('pemegang', 'pengawas')),
  user_id         uuid NOT NULL REFERENCES public.profiles(id),
  aktif_dari      timestamptz NOT NULL DEFAULT now(),
  aktif_sampai    timestamptz,
  ditugaskan_oleh uuid REFERENCES public.profiles(id),
  alasan          text
);

-- Hanya satu penjabat aktif per peran per PTW.
CREATE UNIQUE INDEX IF NOT EXISTS ptw_field_assignments_active_uidx
  ON public.ptw_field_assignments (ptw_id, peran) WHERE aktif_sampai IS NULL;
CREATE INDEX IF NOT EXISTS ptw_field_assignments_user_active_idx
  ON public.ptw_field_assignments (user_id) WHERE aktif_sampai IS NULL;

CREATE TABLE IF NOT EXISTS public.ptw_daily_checks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ptw_id           uuid NOT NULL REFERENCES public.ptw(id) ON DELETE CASCADE,
  hari_ke          int  NOT NULL CHECK (hari_ke BETWEEN 1 AND 7),
  tanggal          date NOT NULL,
  peran            text NOT NULL CHECK (peran IN ('pemegang', 'pengawas')),
  user_id          uuid NOT NULL REFERENCES public.profiles(id),
  diisi_pada       timestamptz NOT NULL DEFAULT now(),
  inisial          text NOT NULL,
  uraian_pekerjaan text,
  UNIQUE (ptw_id, hari_ke, peran),
  CHECK (peran = 'pengawas' OR length(btrim(coalesce(uraian_pekerjaan, ''))) > 0)
);

ALTER TABLE public.ptw_field_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptw_daily_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users can view PTW field assignments" ON public.ptw_field_assignments;
CREATE POLICY "Internal users can view PTW field assignments"
ON public.ptw_field_assignments FOR SELECT TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS "Vendors can view their PTW field assignments" ON public.ptw_field_assignments;
CREATE POLICY "Vendors can view their PTW field assignments"
ON public.ptw_field_assignments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.ptw t JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = ptw_field_assignments.ptw_id AND p.vendor_id = public.current_vendor_org_id()
));

DROP POLICY IF EXISTS "Internal users can view PTW daily checks" ON public.ptw_daily_checks;
CREATE POLICY "Internal users can view PTW daily checks"
ON public.ptw_daily_checks FOR SELECT TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS "Vendors can view their PTW daily checks" ON public.ptw_daily_checks;
CREATE POLICY "Vendors can view their PTW daily checks"
ON public.ptw_daily_checks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.ptw t JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = ptw_daily_checks.ptw_id AND p.vendor_id = public.current_vendor_org_id()
));

-- Permission modul 'ptw' dari roles.permissions; role 'admin' selalu penuh
-- (sama seperti utils/permissions.ts).
CREATE OR REPLACE FUNCTION public.ptw_user_has_perm(p_user uuid, p_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = p_user
      AND (
        pr.role = 'admin'
        OR EXISTS (
          SELECT 1 FROM public.roles r
          WHERE r.name = pr.role AND jsonb_exists(r.permissions -> 'ptw', p_action)
        )
      )
  );
$$;

-- Tugaskan / ganti penjabat. Atomik: menutup baris aktif lama lalu membuat
-- baris baru dalam satu transaksi.
CREATE OR REPLACE FUNCTION public.ptw_assign_field_role(
  p_ptw_id uuid, p_peran text, p_user_id uuid, p_alasan text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_status      text;
  v_vendor_org  uuid;
  v_caller_type text;
  v_caller_org  uuid;
  v_target_type text;
  v_target_org  uuid;
  v_new_id      uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Silakan login terlebih dahulu.';
  END IF;
  IF p_peran NOT IN ('pemegang', 'pengawas') THEN
    RAISE EXCEPTION 'Peran tidak valid.';
  END IF;

  SELECT t.status, p.vendor_id INTO v_status, v_vendor_org
  FROM public.ptw t JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = p_ptw_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PTW tidak ditemukan.';
  END IF;
  IF v_status <> 'PTW Aktif' THEN
    RAISE EXCEPTION 'Penugasan hanya bisa dibuat selama PTW berstatus Aktif.';
  END IF;

  SELECT type::text, org_id INTO v_caller_type, v_caller_org FROM public.profiles WHERE id = v_caller;
  SELECT type::text, org_id INTO v_target_type, v_target_org FROM public.profiles WHERE id = p_user_id;
  IF v_target_type IS NULL THEN
    RAISE EXCEPTION 'Pengguna yang ditugaskan tidak ditemukan.';
  END IF;

  IF p_peran = 'pengawas' THEN
    IF v_caller_type IS DISTINCT FROM 'pgn' OR NOT public.ptw_user_has_perm(v_caller, 'assign_pengawas') THEN
      RAISE EXCEPTION 'Anda tidak berwenang menugaskan Pengawas PTW.';
    END IF;
    IF v_target_type <> 'pgn' OR NOT public.ptw_user_has_perm(p_user_id, 'field_pengawas') THEN
      RAISE EXCEPTION 'Pengguna ini tidak bisa ditugaskan sebagai Pengawas PTW.';
    END IF;
  ELSE
    IF v_caller_type IS DISTINCT FROM 'vendor'
       OR v_caller_org IS DISTINCT FROM v_vendor_org
       OR NOT public.ptw_user_has_perm(v_caller, 'assign_holder') THEN
      RAISE EXCEPTION 'Anda tidak berwenang menugaskan Pemegang PTW.';
    END IF;
    IF v_target_type <> 'vendor'
       OR v_target_org IS DISTINCT FROM v_vendor_org
       OR NOT public.ptw_user_has_perm(p_user_id, 'field_holder') THEN
      RAISE EXCEPTION 'Pengguna ini tidak bisa ditugaskan sebagai Pemegang PTW.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ptw_field_assignments
    WHERE ptw_id = p_ptw_id AND peran = p_peran AND aktif_sampai IS NULL AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Pengguna ini sudah menjadi penjabat aktif.';
  END IF;

  UPDATE public.ptw_field_assignments SET aktif_sampai = now()
  WHERE ptw_id = p_ptw_id AND peran = p_peran AND aktif_sampai IS NULL;

  INSERT INTO public.ptw_field_assignments (ptw_id, peran, user_id, ditugaskan_oleh, alasan)
  VALUES (p_ptw_id, p_peran, p_user_id, v_caller, NULLIF(btrim(coalesce(p_alasan, '')), ''))
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Kirim daily check hari ini. Peran ditentukan dari penugasan aktif pemanggil.
-- p_required_keys = kunci baris safety checklist yang wajib terjawab hari ini
-- (dihitung server action dari PTW_TYPES; hanya dipakai untuk 'pengawas').
CREATE OR REPLACE FUNCTION public.ptw_submit_daily_check(
  p_ptw_id uuid, p_uraian text DEFAULT NULL, p_required_keys text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller    uuid := auth.uid();
  v_status    text;
  v_from      date;
  v_to        date;
  v_checklist jsonb;
  v_today     date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_hari      int;
  v_peran     text;
  v_inisial   text;
  v_key       text;
  v_id        uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Silakan login terlebih dahulu.';
  END IF;

  SELECT status, valid_from, valid_to, safety_checklist
    INTO v_status, v_from, v_to, v_checklist
  FROM public.ptw WHERE id = p_ptw_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PTW tidak ditemukan.';
  END IF;
  IF v_status <> 'PTW Aktif' THEN
    RAISE EXCEPTION 'Daily check hanya bisa diisi selama PTW berstatus Aktif.';
  END IF;
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'PTW ini belum punya masa berlaku.';
  END IF;

  v_hari := v_today - v_from + 1;
  IF v_hari < 1 OR v_hari > 7 OR (v_to IS NOT NULL AND v_today > v_to) THEN
    RAISE EXCEPTION 'Hari ini di luar masa berlaku PTW.';
  END IF;

  SELECT peran INTO v_peran FROM public.ptw_field_assignments
  WHERE ptw_id = p_ptw_id AND user_id = v_caller AND aktif_sampai IS NULL;
  IF v_peran IS NULL THEN
    RAISE EXCEPTION 'Anda bukan Pemegang/Pengawas aktif untuk PTW ini.';
  END IF;

  IF v_peran = 'pemegang' AND length(btrim(coalesce(p_uraian, ''))) = 0 THEN
    RAISE EXCEPTION 'Uraian pekerjaan hari ini wajib diisi.';
  END IF;

  IF v_peran = 'pengawas' THEN
    FOREACH v_key IN ARRAY p_required_keys LOOP
      IF jsonb_typeof(v_checklist -> v_key -> 'days' -> (v_hari - 1)) IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION 'Safety checklist hari ini belum lengkap — jawab semua baris (Sudah/Belum) dulu.';
      END IF;
    END LOOP;
  END IF;

  -- Inisial = huruf pertama maksimal 3 kata nama, huruf besar.
  SELECT coalesce(nullif(upper(string_agg(left(w.word, 1), '' ORDER BY w.n)), ''), '?')
    INTO v_inisial
  FROM public.profiles pr,
       LATERAL (
         SELECT word, n
         FROM regexp_split_to_table(btrim(coalesce(pr.full_name, '')), '\s+') WITH ORDINALITY AS t(word, n)
         WHERE word <> '' AND n <= 3
       ) w
  WHERE pr.id = v_caller;

  BEGIN
    INSERT INTO public.ptw_daily_checks (ptw_id, hari_ke, tanggal, peran, user_id, inisial, uraian_pekerjaan)
    VALUES (
      p_ptw_id, v_hari, v_today, v_peran, v_caller, coalesce(v_inisial, '?'),
      CASE WHEN v_peran = 'pemegang' THEN btrim(p_uraian) ELSE NULL END
    )
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Daily check hari ini sudah diisi.';
  END;

  RETURN v_id;
END;
$$;

-- Safety checklist: untuk PTW yang SUDAH punya Pengawas aktif, hanya Pengawas
-- aktif itu yang boleh menulis. PTW tanpa penugasan tetap seperti sebelumnya.
-- (Menggantikan fungsi di schema_ptw_safety_checklist_fix.sql; sisanya sama.)
CREATE OR REPLACE FUNCTION public.update_ptw_safety_checklist(p_ptw_id uuid, p_checklist jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.ptw t
    JOIN public.projects p ON p.id = t.project_id
    WHERE t.id = p_ptw_id
      AND t.status = 'PTW Aktif'
      AND (
        public.is_internal_user()
        OR p.vendor_id = public.current_vendor_org_id()
      )
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Safety checklist hanya bisa diisi oleh pihak berwenang selama PTW berstatus Aktif.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ptw_field_assignments
    WHERE ptw_id = p_ptw_id AND peran = 'pengawas' AND aktif_sampai IS NULL
  ) AND NOT EXISTS (
    SELECT 1 FROM public.ptw_field_assignments
    WHERE ptw_id = p_ptw_id AND peran = 'pengawas' AND aktif_sampai IS NULL AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Safety checklist PTW ini hanya bisa diisi oleh Pengawas PTW yang sedang ditugaskan.';
  END IF;

  UPDATE public.ptw SET safety_checklist = p_checklist WHERE id = p_ptw_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ptw_user_has_perm(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ptw_assign_field_role(uuid, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ptw_submit_daily_check(uuid, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ptw_assign_field_role(uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ptw_submit_daily_check(uuid, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_ptw_safety_checklist(uuid, jsonb) TO authenticated;
```

- [ ] **Step 2: Verify the file in a rolled-back transaction**

Use the Supabase MCP `execute_sql` on project `xudwfhmzlzgmsrifomjm` with `BEGIN;` + the **full file contents** + the checks below + `ROLLBACK;` in ONE call (nothing persists). Checks, appended before `ROLLBACK`:

```sql
-- 1) objek ada
SELECT to_regclass('public.ptw_field_assignments') IS NOT NULL AS t1,
       to_regclass('public.ptw_daily_checks') IS NOT NULL AS t2,
       (SELECT count(*) FROM pg_proc WHERE proname IN
         ('ptw_user_has_perm','ptw_assign_field_role','ptw_submit_daily_check')) AS fn_count;

-- 2) unique parsial: dua baris aktif untuk (ptw, peran) harus gagal
DO $$
DECLARE v_ptw uuid; v_user uuid;
BEGIN
  SELECT id INTO v_ptw FROM public.ptw LIMIT 1;
  SELECT id INTO v_user FROM public.profiles LIMIT 1;
  IF v_ptw IS NULL THEN RAISE NOTICE 'tidak ada PTW — lewati cek unique'; RETURN; END IF;
  INSERT INTO public.ptw_field_assignments (ptw_id, peran, user_id) VALUES (v_ptw, 'pengawas', v_user);
  BEGIN
    INSERT INTO public.ptw_field_assignments (ptw_id, peran, user_id) VALUES (v_ptw, 'pengawas', v_user);
    RAISE EXCEPTION 'SEHARUSNYA GAGAL';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK: unique parsial bekerja';
  END;
END $$;
```

Expected: `t1 = true, t2 = true, fn_count = 3`; the `DO` block ends without `SEHARUSNYA GAGAL` (or prints the "lewati" notice). If the whole call errors, fix the SQL and repeat. Also confirm the transaction was rolled back: `SELECT to_regclass('public.ptw_field_assignments');` in a **separate** call returns `NULL`.

- [ ] **Step 3: Verify RPC gating (rolled back, as a real user)**

In one `BEGIN … ROLLBACK` call (file contents first), pick a vendor user and call the RPC while impersonating them; it must be **rejected** (the vendor lacks `assign_holder` until a role is given the permission, and/or PTW is not `PTW Aktif`):

```sql
SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT id::text FROM public.profiles WHERE type = 'vendor' LIMIT 1), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT public.ptw_assign_field_role(
  (SELECT id FROM public.ptw LIMIT 1),
  'pemegang',
  (SELECT id FROM public.profiles WHERE type = 'vendor' LIMIT 1));
```

Expected: an `ERROR` whose message is one of the Indonesian guard messages (e.g. "Penugasan hanya bisa dibuat selama PTW berstatus Aktif." or "Anda tidak berwenang…"). An unexpected success is a bug.

- [ ] **Step 4: Add the README note**

Open `supabase/README_org_migration_order.md`, find the last numbered item (item 7 mentions `schema_announcements_and_audit_photos.sql`) and append a new next-number item in the same style:

```markdown
N. `schema_ptw_field_assignments.sql` — Pemegang/Pengawas PTW per PTW + daily check
   (`ptw_field_assignments`, `ptw_daily_checks`, RPC `ptw_assign_field_role` /
   `ptw_submit_daily_check`, dan versi baru `update_ptw_safety_checklist`).
   Idempotent. **Harus dijalankan SEBELUM deploy kode fitur ini** — halaman proyek
   meng-embed `ptw_daily_checks`, jadi tanpa tabel ini halaman proyek gagal dimuat.
   Spec: `docs/superpowers/specs/2026-10-18-ptw-field-roles-daily-check-design.md`.
```

Replace `N` with the actual next number.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema_ptw_field_assignments.sql supabase/README_org_migration_order.md
git commit -m "Add PTW field assignments + daily checks schema (tables, RLS, RPCs)"
```

> The README already has uncommitted edits from the user (push-notification note). `git add` of that file will include them — if unwanted, use `git add -p supabase/README_org_migration_order.md` and stage only your hunk.

---

### Task 2: Permission keys + pure helpers

**Files:**
- Modify: `app/dashboard/master-data/role/constants.ts` (ptw module, after line with `key: 'resume_work'`)
- Modify: `app/vendor/dashboard/role/constants.ts` (same module, same place)
- Create: `lib/ptw-field.ts`

**Interfaces:**
- Produces (used by Tasks 3–6) from `lib/ptw-field.ts`:
  `FieldPeran`, `FIELD_PERAN_LABEL`, `PtwFieldAssignment`, `PtwDailyCheck`, `PtwFieldViewer`, `PtwFieldData`, `FieldCandidate`, `PendingDailyCheck`,
  `parseDateUtc(s: string): number | null`,
  `dayIndexForDate(validFrom: string | null | undefined, validTo: string | null | undefined, today: string, maxDays: number): number | null`,
  `initialsOf(name: string | null | undefined): string`,
  `formatCheckDate(tanggal: string): string` (DD/MM), `formatCheckTime(iso: string): string` (HH:mm WIB),
  `type DayRowStatus = 'lengkap' | 'sebagian' | 'terlewat' | 'hari_ini' | 'mendatang'`,
  `dayRowStatus(dayDate: string, today: string, filledCount: number): DayRowStatus`.

- [ ] **Step 1: Add the four permission keys to both `constants.ts`**

In both files, inside the `id: 'ptw'` module `items`, add after the `resume_work` line:

```ts
      { key: 'field_pengawas', label: 'Dapat Ditugaskan sebagai Pengawas PTW (daily check & safety checklist)', allowedTypes: ['pgn'] },
      { key: 'assign_pengawas', label: 'Menugaskan / Mengganti Pengawas PTW', allowedTypes: ['pgn'] },
      { key: 'field_holder', label: 'Dapat Ditugaskan sebagai Pemegang PTW (daily check)', allowedTypes: ['vendor'] },
      { key: 'assign_holder', label: 'Menugaskan / Mengganti Pemegang PTW', allowedTypes: ['vendor'] },
```

- [ ] **Step 2: Write `lib/ptw-field.ts`**

```ts
/**
 * Tipe & helper murni untuk Pemegang/Pengawas PTW dan daily check.
 * SENGAJA tanpa import runtime (hanya `import type` bila perlu) supaya bisa
 * dipakai dari server action, komponen client, PDF, dan diverifikasi dengan
 * skrip node biasa. Spec: docs/superpowers/specs/2026-10-18-ptw-field-roles-daily-check-design.md
 */

export type FieldPeran = 'pemegang' | 'pengawas';

export const FIELD_PERAN_LABEL: Record<FieldPeran, string> = {
  pemegang: 'Pemegang PTW',
  pengawas: 'Pengawas PTW',
};

export interface PtwFieldAssignment {
  id: string;
  ptw_id: string;
  peran: FieldPeran;
  user_id: string;
  user_name: string;
  aktif_dari: string;
  /** null = masih aktif */
  aktif_sampai: string | null;
  ditugaskan_oleh_name: string | null;
  alasan: string | null;
}

export interface PtwDailyCheck {
  id: string;
  ptw_id: string;
  hari_ke: number;
  tanggal: string;
  peran: FieldPeran;
  user_id: string;
  user_name: string;
  diisi_pada: string;
  inisial: string;
  uraian_pekerjaan: string | null;
}

export interface PtwFieldViewer {
  userId: string;
  /** Peran aktif pemanggil di PTW ini, bila ada. */
  myPeran: FieldPeran | null;
  /** Peran yang boleh ditugaskan/diganti pemanggil (sisi PGN → pengawas, sisi vendor → pemegang). */
  assignablePeran: FieldPeran | null;
}

export interface PtwFieldData {
  assignments: PtwFieldAssignment[];
  checks: PtwDailyCheck[];
  viewer: PtwFieldViewer;
  /** Tanggal hari ini (WIB), YYYY-MM-DD. */
  today: string;
  /** Hari ke-N hari ini; null bila di luar masa berlaku. */
  todayHari: number | null;
  /** true hanya bila status efektif PTW = Aktif. */
  active: boolean;
}

export interface FieldCandidate {
  id: string;
  name: string;
}

export interface PendingDailyCheck {
  ptwId: string;
  projectId: string;
  projectName: string;
  ptwType: string;
  peran: FieldPeran;
  hari: number;
  /** Awal hari ini (WIB) sebagai ISO — dipakai sebagai "sejak kapan" di My Task. */
  date: string;
}

export function parseDateUtc(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Hari ke-N (1-based) dari validFrom untuk tanggal `today`; null bila di luar masa berlaku. */
export function dayIndexForDate(
  validFrom: string | null | undefined,
  validTo: string | null | undefined,
  today: string,
  maxDays: number,
): number | null {
  if (!validFrom) return null;
  const start = parseDateUtc(validFrom);
  const t = parseDateUtc(today);
  if (start === null || t === null) return null;
  const idx = Math.floor((t - start) / 86_400_000) + 1;
  if (idx < 1 || idx > maxDays) return null;
  if (validTo) {
    const end = parseDateUtc(validTo);
    if (end !== null && t > end) return null;
  }
  return idx;
}

/** Huruf pertama maksimal 3 kata nama, huruf besar; '?' bila kosong. */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
  const out = words.map((w) => w.charAt(0).toUpperCase()).join('');
  return out || '?';
}

/** 'YYYY-MM-DD' → 'DD/MM' (format kolom Tanggal pada form). */
export function formatCheckDate(tanggal: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(tanggal);
  return m ? `${m[2]}/${m[1]}` : '';
}

/** ISO → 'HH:mm' WIB (format kolom Waktu pada form). */
export function formatCheckTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta',
  }).format(d);
}

export type DayRowStatus = 'lengkap' | 'sebagian' | 'terlewat' | 'hari_ini' | 'mendatang';

/** Status satu baris hari pada tabel Daily Check. `filledCount` = jumlah peran yang sudah check (0-2). */
export function dayRowStatus(dayDate: string, today: string, filledCount: number): DayRowStatus {
  if (filledCount >= 2) return 'lengkap';
  if (filledCount === 1) return 'sebagian';
  const d = parseDateUtc(dayDate);
  const t = parseDateUtc(today);
  if (d === null || t === null) return 'mendatang';
  if (d < t) return 'terlewat';
  if (d === t) return 'hari_ini';
  return 'mendatang';
}
```

- [ ] **Step 3: Verify the helpers with a throwaway script (outside the repo)**

Create `C:\Users\Asus\AppData\Local\Temp\claude\D--journey-SIPERMIT-K3-SIPERMIT-K3-APP\0040556f-4c6d-429e-bda7-c9e36eb2f38c\scratchpad\verify-ptw-field.mjs`:

```js
import assert from 'node:assert/strict';
import {
  dayIndexForDate, initialsOf, formatCheckDate, formatCheckTime, dayRowStatus,
} from 'D:/journey/SIPERMIT K3/SIPERMIT-K3-APP/lib/ptw-field.ts';

// dayIndexForDate
assert.equal(dayIndexForDate('2026-10-19', '2026-10-25', '2026-10-19', 7), 1);
assert.equal(dayIndexForDate('2026-10-19', '2026-10-25', '2026-10-21', 7), 3);
assert.equal(dayIndexForDate('2026-10-19', '2026-10-25', '2026-10-25', 7), 7);
assert.equal(dayIndexForDate('2026-10-19', '2026-10-25', '2026-10-18', 7), null); // sebelum mulai
assert.equal(dayIndexForDate('2026-10-19', '2026-10-21', '2026-10-22', 7), null); // lewat valid_to
assert.equal(dayIndexForDate('2026-10-19', null, '2026-10-26', 7), null);        // > maxDays
assert.equal(dayIndexForDate(null, null, '2026-10-19', 7), null);
assert.equal(dayIndexForDate('bukan-tanggal', null, '2026-10-19', 7), null);

// initialsOf
assert.equal(initialsOf('Budi santoso'), 'BS');
assert.equal(initialsOf('Andi Wijaya Kusuma Putra'), 'AWK');
assert.equal(initialsOf('  '), '?');
assert.equal(initialsOf(null), '?');

// format
assert.equal(formatCheckDate('2026-10-19'), '19/10');
assert.equal(formatCheckDate('xx'), '');
assert.equal(formatCheckTime('2026-10-19T01:30:00Z'), '08:30'); // 01:30 UTC = 08:30 WIB
assert.equal(formatCheckTime('bukan'), '');

// dayRowStatus
assert.equal(dayRowStatus('2026-10-19', '2026-10-20', 2), 'lengkap');
assert.equal(dayRowStatus('2026-10-19', '2026-10-20', 1), 'sebagian');
assert.equal(dayRowStatus('2026-10-19', '2026-10-20', 0), 'terlewat');
assert.equal(dayRowStatus('2026-10-20', '2026-10-20', 0), 'hari_ini');
assert.equal(dayRowStatus('2026-10-21', '2026-10-20', 0), 'mendatang');

console.log('ptw-field helpers: OK');
```

Run: `node --experimental-strip-types "<scratchpad>/verify-ptw-field.mjs"` (Node 23 strips types by default; the flag is harmless).
Expected: prints `ptw-field helpers: OK`. If Node refuses the `.ts` import, rerun with `--experimental-default-type=module`. Any assertion failure → fix `lib/ptw-field.ts`, rerun.

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` → no output.

```bash
git add lib/ptw-field.ts app/dashboard/master-data/role/constants.ts app/vendor/dashboard/role/constants.ts
git commit -m "Add PTW field-role permissions and shared helpers"
```

---

### Task 3: Server actions

**Files:**
- Create: `app/dashboard/ptw-field/actions.ts`

**Interfaces:**
- Consumes: everything produced by Task 1 (RPCs, tables) and Task 2 (`lib/ptw-field.ts`), plus existing `createClient` (`@/utils/supabase/server`), `createAdminClient` (`@/utils/supabase/admin`), `hasPermissionForUser` / `getRoleNamesWithPermission` (`@/utils/permissions`), `createNotification` (`@/app/dashboard/inbox/actions`), `getEffectivePtwStatus`, `PTW_STATUS` (`@/lib/ptw-status`), `PTW_TYPES`, `PTW_MAX_VALID_DAYS`, `flattenSafetyChecklist` (`@/lib/ptw-types`), `todayDateString` (`@/lib/site-ops`).
- Produces (used by Tasks 4–5), all `async`:
  - `getPtwFieldData(ptwId: string): Promise<{ data?: PtwFieldData; error?: string }>`
  - `getFieldCandidates(ptwId: string, peran: FieldPeran): Promise<{ data?: FieldCandidate[]; error?: string }>`
  - `assignFieldRole(ptwId: string, peran: FieldPeran, userId: string, alasan?: string): Promise<{ error?: string }>`
  - `submitDailyCheck(ptwId: string, uraian?: string): Promise<{ error?: string }>`
  - `getMyPendingDailyChecks(): Promise<PendingDailyCheck[]>`

- [ ] **Step 1: Write the file**

```ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { hasPermissionForUser, getRoleNamesWithPermission } from "@/utils/permissions";
import { createNotification } from "@/app/dashboard/inbox/actions";
import { getEffectivePtwStatus, PTW_STATUS } from "@/lib/ptw-status";
import { PTW_TYPES, PTW_MAX_VALID_DAYS, flattenSafetyChecklist } from "@/lib/ptw-types";
import { todayDateString } from "@/lib/site-ops";
import {
  dayIndexForDate, FIELD_PERAN_LABEL,
  type FieldPeran, type PtwFieldData, type PtwFieldAssignment, type PtwDailyCheck,
  type FieldCandidate, type PendingDailyCheck,
} from "@/lib/ptw-field";

/** PTW + proyeknya lewat client user (RLS ikut berlaku: PTW org lain tidak terlihat). */
async function loadPtw(supabase: any, ptwId: string) {
  const { data } = await supabase
    .from('ptw')
    .select('id, ptw_type, status, valid_from, valid_to, project_id, projects ( id, name, end_date, vendor_id )')
    .eq('id', ptwId)
    .maybeSingle();
  if (!data) return null;
  const project = Array.isArray(data.projects) ? data.projects[0] : data.projects;
  return { ...data, project } as any;
}

/** Nama untuk id yang sudah lolos RLS di pemanggil; admin client hanya agar profil lintas-pihak terbaca. */
async function loadNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const admin = createAdminClient();
  const { data } = await admin.from('profiles').select('id, full_name').in('id', ids);
  return Object.fromEntries((data ?? []).map((p: any) => [p.id, p.full_name || 'Tanpa nama']));
}

export async function getPtwFieldData(ptwId: string): Promise<{ data?: PtwFieldData; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Silakan login terlebih dahulu.' };

  const ptw = await loadPtw(supabase, ptwId);
  if (!ptw) return { error: 'PTW tidak ditemukan.' };

  const [{ data: assignmentRows }, { data: checkRows }, { data: profile }] = await Promise.all([
    supabase.from('ptw_field_assignments').select('*').eq('ptw_id', ptwId).order('aktif_dari', { ascending: false }),
    supabase.from('ptw_daily_checks').select('*').eq('ptw_id', ptwId).order('hari_ke', { ascending: true }),
    supabase.from('profiles').select('type').eq('id', user.id).single(),
  ]);

  const ids = new Set<string>();
  (assignmentRows ?? []).forEach((r: any) => { ids.add(r.user_id); if (r.ditugaskan_oleh) ids.add(r.ditugaskan_oleh); });
  (checkRows ?? []).forEach((r: any) => ids.add(r.user_id));
  const names = await loadNames([...ids]);

  const assignments: PtwFieldAssignment[] = (assignmentRows ?? []).map((r: any) => ({
    id: r.id, ptw_id: r.ptw_id, peran: r.peran, user_id: r.user_id,
    user_name: names[r.user_id] ?? 'Tanpa nama',
    aktif_dari: r.aktif_dari, aktif_sampai: r.aktif_sampai,
    ditugaskan_oleh_name: r.ditugaskan_oleh ? (names[r.ditugaskan_oleh] ?? null) : null,
    alasan: r.alasan,
  }));
  const checks: PtwDailyCheck[] = (checkRows ?? []).map((r: any) => ({
    id: r.id, ptw_id: r.ptw_id, hari_ke: r.hari_ke, tanggal: r.tanggal, peran: r.peran,
    user_id: r.user_id, user_name: names[r.user_id] ?? 'Tanpa nama',
    diisi_pada: r.diisi_pada, inisial: r.inisial, uraian_pekerjaan: r.uraian_pekerjaan,
  }));

  let assignablePeran: FieldPeran | null = null;
  if (profile?.type === 'pgn' && await hasPermissionForUser(supabase, user.id, 'ptw', 'assign_pengawas')) {
    assignablePeran = 'pengawas';
  } else if (profile?.type === 'vendor' && await hasPermissionForUser(supabase, user.id, 'ptw', 'assign_holder')) {
    assignablePeran = 'pemegang';
  }

  const today = todayDateString();
  const effective = getEffectivePtwStatus(ptw.status, ptw.valid_to ?? ptw.project?.end_date);
  return {
    data: {
      assignments,
      checks,
      viewer: {
        userId: user.id,
        myPeran: assignments.find((a) => a.user_id === user.id && !a.aktif_sampai)?.peran ?? null,
        assignablePeran,
      },
      today,
      todayHari: dayIndexForDate(ptw.valid_from, ptw.valid_to, today, PTW_MAX_VALID_DAYS),
      active: effective === PTW_STATUS.aktif,
    },
  };
}

export async function getFieldCandidates(
  ptwId: string, peran: FieldPeran,
): Promise<{ data?: FieldCandidate[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Silakan login terlebih dahulu.' };

  const assignPerm = peran === 'pengawas' ? 'assign_pengawas' : 'assign_holder';
  if (!(await hasPermissionForUser(supabase, user.id, 'ptw', assignPerm))) {
    return { error: 'Anda tidak berwenang menugaskan peran ini.' };
  }
  const ptw = await loadPtw(supabase, ptwId);
  if (!ptw) return { error: 'PTW tidak ditemukan.' };

  const holderPerm = peran === 'pengawas' ? 'field_pengawas' : 'field_holder';
  const roleNames = await getRoleNamesWithPermission(supabase, 'ptw', holderPerm);
  const names = [...new Set([...roleNames, 'admin'])];

  const admin = createAdminClient();
  let query = admin.from('profiles').select('id, full_name').in('role', names);
  if (peran === 'pengawas') {
    query = query.eq('type', 'pgn');
  } else {
    if (!ptw.project?.vendor_id) return { error: 'Organisasi vendor proyek tidak ditemukan.' };
    query = query.eq('type', 'vendor').eq('org_id', ptw.project.vendor_id);
  }
  const { data, error } = await query.order('full_name');
  if (error) return { error: error.message };
  return { data: (data ?? []).map((p: any) => ({ id: p.id, name: p.full_name || 'Tanpa nama' })) };
}

export async function assignFieldRole(
  ptwId: string, peran: FieldPeran, userId: string, alasan?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Silakan login terlebih dahulu.' };

  const ptw = await loadPtw(supabase, ptwId);
  if (!ptw) return { error: 'PTW tidak ditemukan.' };

  const { data: prev } = await supabase
    .from('ptw_field_assignments')
    .select('user_id')
    .eq('ptw_id', ptwId).eq('peran', peran).is('aktif_sampai', null)
    .maybeSingle();

  const { error } = await supabase.rpc('ptw_assign_field_role', {
    p_ptw_id: ptwId, p_peran: peran, p_user_id: userId, p_alasan: alasan?.trim() || null,
  });
  if (error) return { error: error.message };

  // Notifikasi tidak boleh menggagalkan penugasan yang sudah tersimpan.
  try {
    const base = peran === 'pengawas' ? '/dashboard/projects' : '/vendor/dashboard/projects';
    const link = `${base}/${ptw.project_id}`;
    const label = FIELD_PERAN_LABEL[peran];
    const proyek = ptw.project?.name ?? 'proyek';
    await createNotification({
      userId, type: 'action_required',
      title: `Anda ditugaskan sebagai ${label}`,
      message: `Anda ditugaskan sebagai ${label} untuk PTW pada proyek "${proyek}". Lakukan daily check setiap hari selama PTW berlaku.`,
      link,
    });
    if (prev?.user_id && prev.user_id !== userId) {
      await createNotification({
        userId: prev.user_id, type: 'info',
        title: `Penugasan ${label} berakhir`,
        message: `Penugasan Anda sebagai ${label} pada proyek "${proyek}" telah digantikan.`,
        link,
      });
    }
  } catch (e) {
    console.error('assignFieldRole notify error:', e);
  }
  return {};
}

export async function submitDailyCheck(ptwId: string, uraian?: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Silakan login terlebih dahulu.' };

  const ptw = await loadPtw(supabase, ptwId);
  if (!ptw) return { error: 'PTW tidak ditemukan.' };
  const effective = getEffectivePtwStatus(ptw.status, ptw.valid_to ?? ptw.project?.end_date);
  if (effective !== PTW_STATUS.aktif) {
    return { error: 'Daily check hanya bisa diisi selama PTW berstatus Aktif.' };
  }

  const { data: mine } = await supabase
    .from('ptw_field_assignments')
    .select('peran')
    .eq('ptw_id', ptwId).eq('user_id', user.id).is('aktif_sampai', null)
    .maybeSingle();
  if (!mine) return { error: 'Anda bukan Pemegang/Pengawas aktif untuk PTW ini.' };

  // Pengawas wajib menjawab semua baris safety checklist hari itu.
  let requiredKeys: string[] = [];
  if (mine.peran === 'pengawas') {
    const typeDef = PTW_TYPES.find((t) => t.id === ptw.ptw_type) || PTW_TYPES[0];
    requiredKeys = flattenSafetyChecklist(typeDef)
      .filter((r) => r.checkable && r.key)
      .map((r) => r.key as string);
  }

  const { error } = await supabase.rpc('ptw_submit_daily_check', {
    p_ptw_id: ptwId,
    p_uraian: mine.peran === 'pemegang' ? (uraian ?? '') : null,
    p_required_keys: requiredKeys,
  });
  if (error) return { error: error.message };
  return {};
}

/** Daily check yang masih harus dikerjakan user login hari ini (untuk My Task). */
export async function getMyPendingDailyChecks(): Promise<PendingDailyCheck[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rows } = await supabase
    .from('ptw_field_assignments')
    .select('ptw_id, peran, ptw ( id, ptw_type, status, valid_from, valid_to, project_id, projects ( id, name, end_date ) )')
    .eq('user_id', user.id)
    .is('aktif_sampai', null);

  const today = todayDateString();
  const candidates: PendingDailyCheck[] = [];
  (rows ?? []).forEach((r: any) => {
    const ptw = Array.isArray(r.ptw) ? r.ptw[0] : r.ptw;
    if (!ptw) return;
    const project = Array.isArray(ptw.projects) ? ptw.projects[0] : ptw.projects;
    if (getEffectivePtwStatus(ptw.status, ptw.valid_to ?? project?.end_date) !== PTW_STATUS.aktif) return;
    const hari = dayIndexForDate(ptw.valid_from, ptw.valid_to, today, PTW_MAX_VALID_DAYS);
    if (hari === null) return;
    candidates.push({
      ptwId: ptw.id, projectId: ptw.project_id, projectName: project?.name ?? 'Proyek',
      ptwType: ptw.ptw_type, peran: r.peran, hari,
      date: `${today}T00:00:00+07:00`,
    });
  });
  if (candidates.length === 0) return [];

  const { data: done } = await supabase
    .from('ptw_daily_checks')
    .select('ptw_id, peran')
    .in('ptw_id', candidates.map((c) => c.ptwId))
    .eq('tanggal', today);
  const doneKeys = new Set((done ?? []).map((d: any) => `${d.ptw_id}:${d.peran}`));
  return candidates.filter((c) => !doneKeys.has(`${c.ptwId}:${c.peran}`));
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` → no output. (If `createNotification` rejects `type: 'info'`, confirm `NotificationType` in `app/dashboard/inbox/actions.ts:10` — it includes `'info'`.)

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/ptw-field/actions.ts
git commit -m "Add PTW field-role server actions (data, candidates, assign, daily check, pending)"
```

---

### Task 4: UI panel + embed in Safety Check tab

**Files:**
- Create: `components/ptw/PtwFieldPanel.tsx`
- Modify: `components/ptw/PtwSafetyCheckTab.tsx` (import + render inside the per-PTW `<section>`, between the progress block and `<div className="px-5 pb-5">`)

**Interfaces:**
- Consumes: Task 3 actions, Task 2 types/helpers, `ptwValidDayDates` (`@/lib/ptw-types`).
- Produces: `default export PtwFieldPanel(props: { ptwId: string; validFrom?: string | null; validTo?: string | null })`.

- [ ] **Step 1: Write `components/ptw/PtwFieldPanel.tsx`**

```tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { UserCheck, History, RefreshCw, Send, Loader2 } from 'lucide-react';
import {
  getPtwFieldData, getFieldCandidates, assignFieldRole, submitDailyCheck,
} from '@/app/dashboard/ptw-field/actions';
import {
  FIELD_PERAN_LABEL, dayRowStatus, formatCheckDate, formatCheckTime,
  type FieldPeran, type FieldCandidate, type PtwFieldData, type DayRowStatus,
} from '@/lib/ptw-field';
import { ptwValidDayDates } from '@/lib/ptw-types';

interface Props {
  ptwId: string;
  validFrom?: string | null;
  validTo?: string | null;
}

const STATUS_CHIP: Record<DayRowStatus, { label: string; cls: string }> = {
  lengkap:   { label: 'Lengkap',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  sebagian:  { label: 'Sebagian', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  terlewat:  { label: 'Terlewat', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  hari_ini:  { label: 'Hari ini', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  mendatang: { label: 'Mendatang', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const PERANS: FieldPeran[] = ['pemegang', 'pengawas'];

export default function PtwFieldPanel({ ptwId, validFrom, validTo }: Props) {
  const [data, setData] = useState<PtwFieldData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Form penugasan
  const [assigning, setAssigning] = useState(false);
  const [candidates, setCandidates] = useState<FieldCandidate[]>([]);
  const [candidateId, setCandidateId] = useState('');
  const [alasan, setAlasan] = useState('');

  // Form daily check Pemegang
  const [uraian, setUraian] = useState('');

  const reload = useCallback(async () => {
    const res = await getPtwFieldData(ptwId);
    if (res.error || !res.data) {
      setLoadError(res.error ?? 'Gagal memuat data.');
      return;
    }
    setLoadError(null);
    setData(res.data);
  }, [ptwId]);

  useEffect(() => { void reload(); }, [reload]);

  if (loadError) {
    return <p className="px-5 py-3 text-xs text-rose-600 border-b border-slate-100">{loadError}</p>;
  }
  if (!data) {
    return (
      <p className="px-5 py-3 text-xs text-slate-400 border-b border-slate-100 flex items-center gap-2">
        <Loader2 className="w-3 h-3 animate-spin" /> Memuat penugasan…
      </p>
    );
  }

  const { assignments, checks, viewer, today, todayHari, active } = data;
  const activeBy = (p: FieldPeran) => assignments.find((a) => a.peran === p && !a.aktif_sampai) ?? null;
  const days = ptwValidDayDates(validFrom, validTo);
  const checkOf = (hari: number, p: FieldPeran) => checks.find((c) => c.hari_ke === hari && c.peran === p) ?? null;
  const doneToday = (p: FieldPeran) => todayHari !== null && !!checkOf(todayHari, p);

  const startAssign = async (peran: FieldPeran) => {
    setAssigning(true);
    setActionError(null);
    setCandidateId('');
    setAlasan('');
    const res = await getFieldCandidates(ptwId, peran);
    if (res.error) { setActionError(res.error); setAssigning(false); return; }
    setCandidates(res.data ?? []);
  };

  const confirmAssign = async (peran: FieldPeran) => {
    if (!candidateId) { setActionError('Pilih orang yang akan ditugaskan.'); return; }
    setBusy(true);
    setActionError(null);
    const res = await assignFieldRole(ptwId, peran, candidateId, alasan);
    setBusy(false);
    if (res.error) { setActionError(res.error); return; }
    setAssigning(false);
    await reload();
  };

  const check = async () => {
    setBusy(true);
    setActionError(null);
    const res = await submitDailyCheck(ptwId, uraian);
    setBusy(false);
    if (res.error) { setActionError(res.error); return; }
    setUraian('');
    await reload();
  };

  return (
    <div className="px-5 py-4 border-b border-slate-100 space-y-4">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <UserCheck className="w-4 h-4 text-primary" /> Pemegang & Pengawas PTW
      </div>

      {/* Penjabat aktif */}
      <div className="grid sm:grid-cols-2 gap-3">
        {PERANS.map((p) => {
          const cur = activeBy(p);
          const canAssign = active && viewer.assignablePeran === p;
          return (
            <div key={p} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{FIELD_PERAN_LABEL[p]}</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{cur ? cur.user_name : 'Belum ditugaskan'}</p>
              {cur && (
                <p className="text-[11px] text-slate-500">
                  sejak {new Date(cur.aktif_dari).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </p>
              )}
              {canAssign && !assigning && (
                <button
                  type="button"
                  onClick={() => startAssign(p)}
                  className="mt-2 text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> {cur ? 'Ganti' : 'Tugaskan'}
                </button>
              )}
              {canAssign && assigning && (
                <div className="mt-2 space-y-2">
                  <select
                    value={candidateId}
                    onChange={(e) => setCandidateId(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                  >
                    <option value="">— pilih orang —</option>
                    {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {cur && (
                    <input
                      value={alasan}
                      onChange={(e) => setAlasan(e.target.value)}
                      placeholder="Alasan pergantian (opsional)"
                      className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5"
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button" disabled={busy} onClick={() => confirmAssign(p)}
                      className="px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-lg disabled:opacity-50"
                    >
                      Simpan
                    </button>
                    <button
                      type="button" disabled={busy} onClick={() => setAssigning(false)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 border border-slate-300 rounded-lg"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {actionError && <p className="text-xs font-semibold text-rose-600">{actionError}</p>}

      {/* Daily check hari ini untuk penjabat aktif */}
      {active && viewer.myPeran && todayHari !== null && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-bold text-slate-700">
            Daily check {FIELD_PERAN_LABEL[viewer.myPeran]} — Hari ke-{todayHari}
          </p>
          {doneToday(viewer.myPeran) ? (
            <p className="text-xs text-emerald-700 font-semibold">Sudah diisi hari ini.</p>
          ) : viewer.myPeran === 'pemegang' ? (
            <>
              <textarea
                value={uraian}
                onChange={(e) => setUraian(e.target.value)}
                rows={3}
                placeholder="Uraikan secara singkat pekerjaan yang dilakukan hari ini…"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
              />
              <button
                type="button" disabled={busy || !uraian.trim()} onClick={check}
                className="px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Verifikasi hari ini
              </button>
            </>
          ) : (
            <>
              <p className="text-[11px] text-slate-500">
                Isi seluruh baris safety checklist hari ini di bawah (Sudah/Belum), lalu beri paraf.
              </p>
              <button
                type="button" disabled={busy} onClick={check}
                className="px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Paraf hari ini
              </button>
            </>
          )}
        </div>
      )}

      {/* Tabel per hari */}
      {days.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="py-1 pr-2">Hari</th>
                <th className="py-1 pr-2">Status</th>
                <th className="py-1 pr-2">Pemegang</th>
                <th className="py-1">Pengawas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 align-top">
              {days.map((date, i) => {
                const hari = i + 1;
                const pm = checkOf(hari, 'pemegang');
                const pw = checkOf(hari, 'pengawas');
                const st = STATUS_CHIP[dayRowStatus(date, today, (pm ? 1 : 0) + (pw ? 1 : 0))];
                return (
                  <tr key={date}>
                    <td className="py-2 pr-2 font-semibold text-slate-700 whitespace-nowrap">
                      {hari} · {formatCheckDate(date)}
                    </td>
                    <td className="py-2 pr-2">
                      <span className={`inline-block border rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="py-2 pr-2 text-slate-600">
                      {pm ? (
                        <>
                          <span className="font-semibold">{pm.user_name}</span> ({pm.inisial}) · {formatCheckTime(pm.diisi_pada)}
                          <p className="text-slate-500 mt-0.5 whitespace-pre-wrap">{pm.uraian_pekerjaan}</p>
                        </>
                      ) : '—'}
                    </td>
                    <td className="py-2 text-slate-600">
                      {pw ? (
                        <><span className="font-semibold">{pw.user_name}</span> ({pw.inisial}) · {formatCheckTime(pw.diisi_pada)}</>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Riwayat penjabat */}
      {assignments.length > 0 && (
        <div>
          <button
            type="button" onClick={() => setShowHistory((v) => !v)}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <History className="w-3 h-3" /> Riwayat penjabat ({assignments.length})
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {assignments.map((a) => (
                <li key={a.id}>
                  <span className="font-semibold">{FIELD_PERAN_LABEL[a.peran]}</span> — {a.user_name},{' '}
                  {new Date(a.aktif_dari).toLocaleDateString('id-ID')}
                  {a.aktif_sampai ? ` s/d ${new Date(a.aktif_sampai).toLocaleDateString('id-ID')}` : ' (aktif)'}
                  {a.alasan ? ` · ${a.alasan}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Embed in `PtwSafetyCheckTab.tsx`**

Add the import next to the existing `PtwSafetyChecklistForm` import:

```tsx
import PtwFieldPanel from '@/components/ptw/PtwFieldPanel';
```

Then, in the `opened.map` section, insert directly **after** the closing `</div>` of the block that starts `<div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">` (the progress bar block, ends just before `<div className="px-5 pb-5">`):

```tsx
            <PtwFieldPanel ptwId={p.id} validFrom={p.valid_from} validTo={p.valid_to} />
```

- [ ] **Step 3: Typecheck + lint the touched files**

Run: `npx tsc --noEmit` → no output.
Run: `npx eslint components/ptw/PtwFieldPanel.tsx components/ptw/PtwSafetyCheckTab.tsx` → no **new** errors (pre-existing `no-explicit-any` elsewhere is not yours).

- [ ] **Step 4: Commit**

```bash
git add components/ptw/PtwFieldPanel.tsx components/ptw/PtwSafetyCheckTab.tsx
git commit -m "Add PTW field panel (assign/switch, daily check, per-day table) to Safety Check tab"
```

---

### Task 5: My Task reminders (vendor + internal)

**Files:**
- Modify: `app/vendor/dashboard/my-task/actions.ts` (type union + push before the final `return`)
- Modify: `app/dashboard/my-task/actions.ts` (type union + push before `// Sort tasks by date`)
- Modify: `app/vendor/dashboard/my-task/MyTaskClient.tsx`, `app/dashboard/my-task/MyTaskClient.tsx` (type lists/meta/counts)

**Interfaces:**
- Consumes: `getMyPendingDailyChecks()` (Task 3), `FIELD_PERAN_LABEL` (Task 2).
- Produces: task type string `'Check Harian'` in both queues. Sidebar badges need no change: both `getVendorSidebarBadges` and `getSidebarBadges` count `getVendorMyTasks()` / `getMyTasks()` results.

- [ ] **Step 1: Vendor actions**

In `app/vendor/dashboard/my-task/actions.ts`:

1. Imports (top): add
```ts
import { getMyPendingDailyChecks } from "@/app/dashboard/ptw-field/actions";
import { FIELD_PERAN_LABEL } from "@/lib/ptw-field";
```
2. Change `export type VendorTaskType = 'Prosedur' | 'JSA' | 'PTW' | 'Temuan' | 'Penugasan';` to
```ts
export type VendorTaskType = 'Prosedur' | 'JSA' | 'PTW' | 'Temuan' | 'Penugasan' | 'Check Harian';
```
3. Immediately before the final `return tasks.sort(...)` (after the `gaps.forEach` block) add:
```ts
  // Daily check PTW — Pemegang aktif yang belum verifikasi hari ini.
  const dailyChecks = await getMyPendingDailyChecks().catch(() => []);
  dailyChecks.forEach(d => {
    tasks.push({
      id: `daily-${d.ptwId}-${d.peran}`,
      title: `Daily check ${FIELD_PERAN_LABEL[d.peran]} — Hari ke-${d.hari}`,
      type: 'Check Harian',
      projectName: d.projectName,
      date: d.date,
      url: `/vendor/dashboard/projects/${d.projectId}`,
      status: 'Belum check hari ini',
      urgency: getUrgency(d.date),
      timeInQueue: formatTimeInQueue(d.date),
    });
  });
```

- [ ] **Step 2: Internal actions**

In `app/dashboard/my-task/actions.ts`:

1. Imports: add the same two imports as above.
2. `export type TaskType = 'Prosedur' | 'JSA' | 'PTW' | 'Insiden' | 'Pengawasan' | 'Penugasan';` → append `| 'Check Harian'`.
3. Before the line `  // Sort tasks by date (newest first)` add:
```ts
  // 7. Daily check PTW — Pengawas aktif yang belum paraf hari ini.
  {
    const dailyChecks = await getMyPendingDailyChecks().catch(() => []);
    dailyChecks.forEach(d => {
      tasks.push({
        id: `daily-${d.ptwId}-${d.peran}`,
        title: `Daily check ${FIELD_PERAN_LABEL[d.peran]} — Hari ke-${d.hari}`,
        type: 'Check Harian',
        projectName: d.projectName,
        vendorName: '-',
        date: d.date,
        url: `/dashboard/projects/${d.projectId}`,
        status: 'Belum check hari ini',
        urgency: getUrgency(d.date),
        timeInQueue: formatTimeInQueue(d.date),
      });
    });
  }
```

- [ ] **Step 3: Client type lists (both `MyTaskClient.tsx`)**

Vendor (`app/vendor/dashboard/my-task/MyTaskClient.tsx`):
- `const TASK_TYPES: VendorTaskType[] = ['Penugasan', 'Prosedur', 'JSA', 'PTW', 'Temuan'];` → append `'Check Harian'`.
- In `TYPE_META` add: `'Check Harian': { color: '#0d9488', icon: CheckCircle, soft: 'bg-teal-50', ink: 'text-teal-600' },`
- `const counts: Record<VendorTaskType, number> = { Prosedur: 0, JSA: 0, PTW: 0, Temuan: 0, Penugasan: 0 };` → add `'Check Harian': 0`.

Internal (`app/dashboard/my-task/MyTaskClient.tsx`):
- `TASK_TYPES` (line 37) → append `'Check Harian'`.
- `TYPE_META` add the same teal entry (`CheckCircle` is already imported there).
- `const counts: Record<TaskType, number> = { Prosedur: 0, JSA: 0, PTW: 0, Insiden: 0, Pengawasan: 0, Penugasan: 0 };` → add `'Check Harian': 0`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` → no output. A `Record<TaskType, …>` / `Record<VendorTaskType, …>` I missed will show up here as "Property 'Check Harian' is missing" — add the entry.

- [ ] **Step 5: Commit**

```bash
git add app/vendor/dashboard/my-task/actions.ts app/vendor/dashboard/my-task/MyTaskClient.tsx app/dashboard/my-task/actions.ts app/dashboard/my-task/MyTaskClient.tsx
git commit -m "Show pending PTW daily checks in My Task (vendor + internal)"
```

---

### Task 6: PDF Verifikasi box

**Files:**
- Modify: `components/ptw/PtwPDF.tsx`
- Modify: `app/dashboard/projects/[id]/page.tsx`, `app/vendor/dashboard/projects/[id]/page.tsx` (ptw select)
- Modify: `app/dashboard/projects/[id]/AdminProjectClient.tsx` (2 `<PtwPDF>` usages), `app/vendor/dashboard/projects/[id]/VendorProjectClient.tsx` (1 usage)

**Interfaces:**
- Consumes: `formatCheckDate`, `formatCheckTime`, `FieldPeran` from `@/lib/ptw-field`.
- Produces: `PtwPDF` prop `dailyChecks?: PtwPdfDailyCheck[]` where `PtwPdfDailyCheck = { hari_ke: number; peran: 'pemegang' | 'pengawas'; tanggal: string; diisi_pada: string; inisial: string }`.

- [ ] **Step 1: Extend `PtwPDF.tsx` props**

Near the existing type imports (top of file, by `import type { PtwSignatories, PtwSignatory }`) add:
```ts
import { formatCheckDate, formatCheckTime } from '@/lib/ptw-field';
```
Add above `interface PtwPDFProps` (line ~156):
```ts
/** Satu baris ptw_daily_checks yang dibutuhkan kotak Verifikasi. */
export interface PtwPdfDailyCheck {
  hari_ke: number;
  peran: 'pemegang' | 'pengawas';
  tanggal: string;
  diisi_pada: string;
  inisial: string;
}
```
In `interface PtwPDFProps`, after `checklistData?: PtwSafetyChecklistData;` add:
```ts
  /** Verifikasi harian Pemegang/Pengawas; kosong = kotak Verifikasi dibiarkan kosong. */
  dailyChecks?: PtwPdfDailyCheck[];
```
In the component's destructured props (the line `checklistData = {},` ~220) add `dailyChecks = [],` right after it.

- [ ] **Step 2: Fill the Tanggal/Waktu rows**

In `PtwPDF.tsx`, replace this block:
```tsx
                {['Tanggal (DD/MM)', 'Waktu'].map((label) => (
                  <View key={label} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: B, height: 10 }}>
                    <View style={{ width: '35%', borderRightWidth: 1, borderColor: B, justifyContent: 'center', paddingHorizontal: 4 }}><Text>{label}</Text></View>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => <View key={d} style={{ width: '8%', borderRightWidth: 1, borderColor: B }} />)}
                    <View style={{ width: '9%' }} />
                  </View>
                ))}
```
with:
```tsx
                {['Tanggal (DD/MM)', 'Waktu'].map((label, li) => (
                  <View key={label} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: B, height: 10 }}>
                    <View style={{ width: '35%', borderRightWidth: 1, borderColor: B, justifyContent: 'center', paddingHorizontal: 4 }}><Text>{label}</Text></View>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                      const dayChecks = dailyChecks.filter((c) => c.hari_ke === d);
                      const ref = dayChecks.find((c) => c.peran === 'pemegang') ?? dayChecks[0];
                      const text = !ref ? '' : li === 0 ? formatCheckDate(ref.tanggal) : formatCheckTime(ref.diisi_pada);
                      return (
                        <View key={d} style={{ width: '8%', borderRightWidth: 1, borderColor: B, justifyContent: 'center' }}>
                          <Text style={{ fontSize: 4, textAlign: 'center' }}>{text}</Text>
                        </View>
                      );
                    })}
                    <View style={{ width: '9%' }} />
                  </View>
                ))}
```

- [ ] **Step 3: Fill the Nama Inisial / Paraf rows**

Replace this inner line:
```tsx
                          {[1, 2, 3, 4, 5, 6, 7].map((d) => <View key={d} style={{ width: '10.26%', borderRightWidth: 1, borderColor: B }} />)}
```
with (it sits inside `['Nama Inisial', 'Paraf'].map((sub, si) => …` which is inside `…map((label, gi) => …`):
```tsx
                          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                            const c = dailyChecks.find((x) => x.hari_ke === d && x.peran === (gi === 0 ? 'pemegang' : 'pengawas'));
                            // Helvetica bawaan tidak punya glyph centang — pakai "V".
                            const text = !c ? '' : si === 0 ? c.inisial : 'V';
                            return (
                              <View key={d} style={{ width: '10.26%', borderRightWidth: 1, borderColor: B, justifyContent: 'center' }}>
                                <Text style={{ fontSize: 4, textAlign: 'center' }}>{text}</Text>
                              </View>
                            );
                          })}
```

- [ ] **Step 4: Select + pass the data**

In both `app/dashboard/projects/[id]/page.tsx` and `app/vendor/dashboard/projects/[id]/page.tsx`, change the end of the `ptw ( … )` embed from
```
            field_token, stopped_at, stopped_reason, stopped_by_name, safety_checklist ),
```
to
```
            field_token, stopped_at, stopped_reason, stopped_by_name, safety_checklist,
            ptw_daily_checks ( hari_ke, peran, tanggal, diisi_pada, inisial ) ),
```
In `AdminProjectClient.tsx` (two `<PtwPDF …>` usages, the ones with `checklistData={row.safety_checklist || {}}`) and `VendorProjectClient.tsx` (one usage), add right after each `checklistData={row.safety_checklist || {}}` line:
```tsx
                            dailyChecks={row.ptw_daily_checks || []}
```
(match the indentation of the neighbouring prop).

- [ ] **Step 5: Typecheck + lint + commit**

Run: `npx tsc --noEmit` → no output; `npx eslint components/ptw/PtwPDF.tsx` → no new errors.

```bash
git add components/ptw/PtwPDF.tsx "app/dashboard/projects/[id]/page.tsx" "app/dashboard/projects/[id]/AdminProjectClient.tsx" "app/vendor/dashboard/projects/[id]/page.tsx" "app/vendor/dashboard/projects/[id]/VendorProjectClient.tsx"
git commit -m "Fill PTW PDF Verifikasi box from daily checks"
```

---

### Task 7: Final verification and handoff

**Files:** none (verification + notes only)

- [ ] **Step 1: Full typecheck, lint of touched files, and production build**

```bash
npx tsc --noEmit
npx eslint components/ptw/PtwFieldPanel.tsx components/ptw/PtwSafetyCheckTab.tsx components/ptw/PtwPDF.tsx lib/ptw-field.ts app/dashboard/ptw-field/actions.ts
npm run build
```
Expected: `tsc` silent; eslint shows no error caused by these files (pre-existing `no-explicit-any` noise in `PtwPDF.tsx`/actions patterns is allowed only if it already existed — compare with `git stash`-free approach: check the same rule count on `git show HEAD~N:path` if in doubt); `npm run build` ends with the route table, no "Failed to compile".

- [ ] **Step 2: Refresh the knowledge graph**

Run: `graphify update .` (AST only, per `AGENTS.md`).

- [ ] **Step 3: Handoff notes for the user (state these plainly in the final message)**

1. **Apply `supabase/schema_ptw_field_assignments.sql` in the Supabase SQL editor BEFORE deploying** — otherwise both project pages fail to load (they embed `ptw_daily_checks`).
2. Create the vendor role **"Pemegang PTW"** in *Role & Permission* (vendor portal) with `ptw.field_holder` + read-only views; give the vendor admin role `ptw.assign_holder`; give PGN reviewer roles `ptw.field_pengawas` and the PGN admin role `ptw.assign_pengawas`. Without these, no candidates appear.
3. Manual smoke test on a PTW that is `PTW Aktif`: assign Pengawas (PGN) → assign Pemegang (vendor) → Pemegang submits uraian → Pengawas fills the checklist rows for today and presses *Paraf* → switch Pengawas → PDF shows initials/time/V in the Verifikasi box → My Task shows/clears "Check Harian".
4. Known limitation (document, do not fix): `ptw_submit_daily_check` trusts `p_required_keys` from the server action for the checklist-completeness rule; a hand-crafted direct RPC call could skip that one rule (assignment, day window, uniqueness stay enforced in the DB).
5. Nothing was pushed; the user pushes (`! git push origin main`).

---

## Self-Review (done while writing)

- **Spec coverage:** data model/RLS/RPC/switch → Task 1; permissions + Pemegang role guidance → Task 2 + handoff note 2; fail-closed daily check + checklist lock for PTW with a Pengawas → Task 1 (RPC) + Task 3; daily window/immutability/mid-day switch → Task 1; My Task + badges → Task 5; notifications → Task 3; panel/history/per-day table (spec says "Tab Daily Check"; implemented inside the existing *Safety Check* tab per PTW — same content, one fewer tab) → Task 4; PDF Verifikasi → Task 6 (paraf drawn as "V" instead of ✓ because the default PDF font lacks the glyph); out-of-scope items untouched.
- **Placeholders:** none — all steps carry code or exact commands; the only fill-in is the README item number `N` (instruction says to use the next number).
- **Type consistency:** `FieldPeran`, `PtwFieldData` (`assignments/checks/viewer/today/todayHari/active`), `PendingDailyCheck` fields, action names/return shapes, and `PtwPdfDailyCheck` match across Tasks 2–6.
