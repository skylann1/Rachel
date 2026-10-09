# Log Aktivitas & Pengguna Online Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PGN-only "Log Aktivitas" page with two tabs — who is online right now and which page they are on, and a merged chronological activity feed (login/logout + Master Data CRUD + the existing document approval log).

**Architecture:** Two new tables (`activity_logs` for system actions, `user_presence` for a 60-second heartbeat) plus three small `lib/` helpers. A client `PresenceHeartbeat` mounted in both realm layouts upserts the caller's current path into `user_presence`. A `logActivity()` helper is called from the login/logout actions and the Master Data mutation actions. A new permission-gated page reads both tables, and `document_logs` read-only, and merges them in JS.

**Tech Stack:** Next.js 16 App Router (Server Components, Server Actions, one client component), Supabase (Postgres + RLS), TypeScript, Tailwind v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-07-activity-log-and-presence-design.md`

## Global Constraints

- No `npm`/`npx` in this environment. Verify with `node node_modules/typescript/bin/tsc --noEmit` and `node node_modules/next/dist/bin/next build` — never `npm run ...`.
- No test framework exists (`AGENTS.md`). Do not write Jest/Vitest files. "Tests" for this plan means typecheck, build, and the manual checks each task lists.
- Domain text, labels, and code comments are Indonesian, matching the codebase.
- `AGENTS.md` warns this is not the Next.js you know: before writing any Next.js-specific code, skim the relevant guide under `node_modules/next/dist/docs/` (server actions, `usePathname`, layouts).
- Schema changes are manual SQL files applied by hand in the Supabase SQL editor (`AGENTS.md`). Task 1 creates the file and the README note; it does **not** apply it. Tasks 2-7 typecheck and build without the tables existing, but a real end-to-end check needs the migration applied first. Ask the user whether to apply it (e.g. via the Supabase MCP) before the final smoke test.
- RLS on both new tables is deliberately permissive for reads, matching `document_logs` (`USING (true)`); real access control is app-side via `hasPermission`. Do not tighten it here.
- Logging must never break the action being logged. `logActivity()` and `touchPresence()` swallow their own errors, so call sites need no `try/catch` of their own.
- The `activityLog.view` permission is `allowedTypes: ['pgn']`. It is NOT automatic for custom PGN roles — only the built-in `admin` role gets it via `fullAccessPermissions()`. State this reminder in the final report.
- Presence is a 60-second heartbeat, "online" = seen within the last 2 minutes. This is an explicit user decision, not a limitation to engineer around.
- `document_logs` and every `logDocumentEvent` caller are not modified.

---

## File Structure

**New files:**
- `supabase/schema_activity_log.sql` — `activity_logs` + `user_presence` tables, indexes, RLS.
- `lib/activity-log.ts` — `logActivity()` helper, mirrors `lib/document-logs.ts`.
- `lib/presence.ts` — `touchPresence()` and `isOnline()`.
- `lib/presence-labels.ts` — `labelForPath()`: URL path to human label.
- `app/actions/presence.ts` — `touchPresenceAction()` server action shared by both realms (`app/actions/` already holds the shared `profile.ts`).
- `components/internal/presence-heartbeat.tsx` — client component, renders `null`, pings every 60s and on navigation.
- `app/dashboard/master-data/activity-log/layout.tsx` — permission gate.
- `app/dashboard/master-data/activity-log/actions.ts` — `getOnlineUsers()`, `getActivityFeed()`.
- `app/dashboard/master-data/activity-log/page.tsx` — server page, fetches initial data.
- `app/dashboard/master-data/activity-log/ActivityLogClient.tsx` — two-tab client UI.

**Modified files:**
- `supabase/README_org_migration_order.md` — item 9 for the new migration.
- `app/dashboard/master-data/role/constants.ts` and `app/vendor/dashboard/role/constants.ts` — new `activityLog` module (kept identical, as with every other module).
- `components/internal/sidebar-nav.tsx` — new "Log Aktivitas" menu entry.
- `app/dashboard/layout.tsx`, `app/vendor/dashboard/layout.tsx` — mount `<PresenceHeartbeat />`.
- `app/auth/login/actions.ts`, `app/vendor/login/actions.ts` — log login/logout.
- `app/dashboard/master-data/{vendor,account,role,project,project-pgsol-assign,announcement}/actions.ts` and `role/[id]/actions.ts` — log mutations.

---

### Task 1: Database schema — `activity_logs` + `user_presence`

**Files:**
- Create: `supabase/schema_activity_log.sql`
- Modify: `supabase/README_org_migration_order.md` (append item 9)

**Interfaces:**
- Produces: table `public.activity_logs` (`id`, `actor_id`, `action`, `entity_type`, `entity_id`, `notes`, `created_at`) and table `public.user_presence` (`user_id` PK, `current_path`, `last_seen_at`). Every later task assumes these exact column names. `entity_type` is constrained to `'auth' | 'vendor' | 'account' | 'role' | 'project' | 'announcement' | 'pgsol_assignment'`.

- [ ] **Step 1: Write the schema file**

```sql
-- supabase/schema_activity_log.sql
--
-- Dua tabel baru, additive dan independen dari migrasi lain (tidak butuh
-- backfill, tidak bergantung urutan Fase 1-3.1):
--
--   1. activity_logs — jejak aksi di luar alur approval dokumen K3: login,
--      logout, dan CRUD Master Data. Approval Prosedur/JSA/PTW tetap di
--      document_logs; halaman Log Aktivitas menggabungkan keduanya saat
--      dibaca, tanpa menulis ganda.
--   2. user_presence — satu baris per user, di-upsert heartbeat client tiap
--      60 detik (current_path + last_seen_at). Dipisah dari profiles dengan
--      sengaja: baris ini berubah jauh lebih sering daripada profil, dan
--      profiles dibaca di puluhan tempat.
--
-- RLS sengaja permisif untuk SELECT/INSERT (sama pola document_logs): akses
-- sebenarnya dijaga di sisi aplikasi lewat permission 'activityLog'/'view'.
--
-- Dijalankan manual di Supabase SQL editor (lihat AGENTS.md). Aman
-- dijalankan ulang.

-- ==============================================================================
-- 1. ACTIVITY LOGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'auth', 'vendor', 'account', 'role', 'project', 'announcement', 'pgsol_assignment'
  )),
  entity_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON public.activity_logs(actor_id, created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all activity logs" ON public.activity_logs;
CREATE POLICY "Users can read all activity logs"
ON public.activity_logs FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can insert activity logs" ON public.activity_logs;
CREATE POLICY "Users can insert activity logs"
ON public.activity_logs FOR INSERT
WITH CHECK (true);

-- ==============================================================================
-- 2. USER PRESENCE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  current_path TEXT,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all presence" ON public.user_presence;
CREATE POLICY "Users can read all presence"
ON public.user_presence FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can insert own presence" ON public.user_presence;
CREATE POLICY "Users can insert own presence"
ON public.user_presence FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own presence" ON public.user_presence;
CREATE POLICY "Users can update own presence"
ON public.user_presence FOR UPDATE
USING (auth.uid() = user_id);
```

- [ ] **Step 2: Append the README note**

Append to the end of `supabase/README_org_migration_order.md`:

```markdown
9. `schema_activity_log.sql` — tabel `activity_logs` (jejak login/logout dan
   CRUD Master Data) dan `user_presence` (heartbeat pengguna online +
   halaman yang sedang dibuka), untuk halaman Master Data → Log Aktivitas.
   Additive dan tidak bergantung migrasi lain; aman dijalankan ulang
   (`CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF EXISTS`). Kode aplikasi
   menelan error insert log, jadi deploy sebelum migrasi tidak merusak
   login/CRUD — tapi halaman Log Aktivitas akan kosong sampai file ini
   dijalankan.
```

- [ ] **Step 3: Review the SQL**

Re-read the file once: every table is `IF NOT EXISTS`, every policy is preceded by `DROP POLICY IF EXISTS`, and the `entity_type` list exactly matches the seven values in the Interfaces block above.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema_activity_log.sql supabase/README_org_migration_order.md
git commit -m "Add activity_logs and user_presence tables"
```

---

### Task 2: Core helpers — `logActivity`, `touchPresence`, `labelForPath`

**Files:**
- Create: `lib/activity-log.ts`
- Create: `lib/presence.ts`
- Create: `lib/presence-labels.ts`

**Interfaces:**
- Produces:
  - `type ActivityEntityType = 'auth' | 'vendor' | 'account' | 'role' | 'project' | 'announcement' | 'pgsol_assignment'`
  - `logActivity(supabase: any, params: { actorId?: string | null; action: string; entityType: ActivityEntityType; entityId?: string | null; notes?: string | null }): Promise<void>` — never throws.
  - `touchPresence(supabase: any, userId: string, path: string): Promise<void>` — never throws.
  - `isOnline(lastSeenAt: string | null | undefined): boolean`
  - `ONLINE_WINDOW_MS: number` (120000)
  - `labelForPath(path: string | null | undefined): string`

- [ ] **Step 1: Create `lib/activity-log.ts`**

```ts
/**
 * Helper tulis untuk activity_logs (lihat supabase/schema_activity_log.sql) —
 * jejak aksi di luar approval dokumen K3: login/logout dan CRUD Master Data.
 * Approval Prosedur/JSA/PTW tetap ditulis lewat lib/document-logs.ts.
 *
 * Disimpan di modul biasa, bukan di dalam file "use server": export tipe di
 * file "use server" ikut jadi re-export runtime di Turbopack dan bikin crash
 * (lihat catatan yang sama di lib/document-logs.ts).
 *
 * Gagal menulis log TIDAK boleh menggagalkan aksi yang sedang dicatat, jadi
 * semua error ditelan di sini — pemanggil tidak perlu try/catch sendiri.
 */
export type ActivityEntityType =
  | 'auth'
  | 'vendor'
  | 'account'
  | 'role'
  | 'project'
  | 'announcement'
  | 'pgsol_assignment';

export async function logActivity(supabase: any, params: {
  actorId?: string | null;
  action: string;
  entityType: ActivityEntityType;
  entityId?: string | null;
  notes?: string | null;
}): Promise<void> {
  try {
    const { error } = await supabase.from('activity_logs').insert({
      actor_id: params.actorId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      notes: params.notes ?? null,
    });
    if (error) console.error('logActivity gagal:', error.message);
  } catch (e) {
    console.error('logActivity gagal:', e);
  }
}
```

- [ ] **Step 2: Create `lib/presence.ts`**

```ts
/**
 * Presence pengguna: heartbeat client menulis current_path + last_seen_at ke
 * user_presence tiap 60 detik (lihat components/internal/presence-heartbeat.tsx).
 * "Online" = terlihat dalam 2 menit terakhir.
 */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

/** Best-effort — gagal tulis presence tidak boleh mengganggu apa pun. */
export async function touchPresence(supabase: any, userId: string, path: string): Promise<void> {
  try {
    const { error } = await supabase.from('user_presence').upsert({
      user_id: userId,
      current_path: path,
      last_seen_at: new Date().toISOString(),
    });
    if (error) console.error('touchPresence gagal:', error.message);
  } catch (e) {
    console.error('touchPresence gagal:', e);
  }
}
```

- [ ] **Step 3: Create `lib/presence-labels.ts`**

```ts
/**
 * Pemetaan path URL → label manusiawi untuk kolom "sedang di" pada daftar
 * pengguna online. Urutan PENTING: path paling spesifik harus di atas, karena
 * pencocokan memakai startsWith dan yang pertama cocok menang (mis.
 * '/dashboard/master-data/vendor' harus ketemu sebelum '/dashboard').
 */
const PRESENCE_PATH_LABELS: Array<[string, string]> = [
  ['/dashboard/master-data/activity-log', 'Log Aktivitas'],
  ['/dashboard/master-data/vendor', 'Master Data — Vendor'],
  ['/dashboard/master-data/account', 'Master Data — Akun'],
  ['/dashboard/master-data/role', 'Master Data — Role & Permission'],
  ['/dashboard/master-data/project-pgsol-assign', 'Kelola Reviewer PGSOL'],
  ['/dashboard/master-data/project', 'Master Data — Proyek'],
  ['/dashboard/master-data/announcement', 'Master Data — Pengumuman'],
  ['/dashboard/projects', 'Detail Proyek'],
  ['/dashboard/approval', 'Kelola Proyek (Approval K3)'],
  ['/dashboard/ongoing', 'Proyek Berjalan'],
  ['/dashboard/archive', 'Arsip Proyek'],
  ['/dashboard/my-task', 'My Task'],
  ['/dashboard/inspection', 'Inspeksi Proyek'],
  ['/dashboard/incident', 'Laporan Insiden'],
  ['/dashboard/vendor-docs', 'Dokumen Vendor'],
  ['/dashboard/site-status', 'Status Lapangan'],
  ['/dashboard/inbox', 'Kotak Masuk'],
  ['/dashboard/profile', 'Profil'],
  ['/dashboard/panduan', 'Panduan Alur K3'],
  ['/dashboard', 'Dashboard'],
  ['/vendor/dashboard/projects', 'Vendor — Proyek'],
  ['/vendor/dashboard/ptw', 'Vendor — Buat PTW'],
  ['/vendor/dashboard/jsa', 'Vendor — Buat JSA'],
  ['/vendor/dashboard/my-task', 'Vendor — My Task'],
  ['/vendor/dashboard/inspection', 'Vendor — Inspeksi'],
  ['/vendor/dashboard/incident', 'Vendor — Insiden'],
  ['/vendor/dashboard/pekerja', 'Vendor — Data Pekerja'],
  ['/vendor/dashboard/peralatan', 'Vendor — Data Peralatan'],
  ['/vendor/dashboard/material', 'Vendor — Data Material'],
  ['/vendor/dashboard/dokumen', 'Vendor — Dokumen K3'],
  ['/vendor/dashboard/staff', 'Vendor — Staff'],
  ['/vendor/dashboard', 'Vendor — Dashboard'],
];

export function labelForPath(path: string | null | undefined): string {
  if (!path) return 'Tidak diketahui';
  const hit = PRESENCE_PATH_LABELS.find(([prefix]) => path.startsWith(prefix));
  if (hit) return hit[1];
  // Belum dipetakan: pakai segmen terakhir URL supaya tetap terbaca, tidak
  // pernah kosong.
  const seg = path.split('/').filter(Boolean).pop() || path;
  return seg.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
}
```

- [ ] **Step 4: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/activity-log.ts lib/presence.ts lib/presence-labels.ts
git commit -m "Add activity log, presence, and path-label helpers"
```

---

### Task 3: Presence heartbeat — server action, client component, mount in both layouts

**Files:**
- Create: `app/actions/presence.ts`
- Create: `components/internal/presence-heartbeat.tsx`
- Modify: `app/dashboard/layout.tsx`
- Modify: `app/vendor/dashboard/layout.tsx`

**Interfaces:**
- Consumes: `touchPresence(supabase, userId, path)` from `lib/presence.ts` (Task 2).
- Produces: `touchPresenceAction(path: string): Promise<void>` server action; `<PresenceHeartbeat />` client component taking no props.

- [ ] **Step 1: Create the server action**

`app/actions/presence.ts`:

```ts
'use server';

import { createClient } from '@/utils/supabase/server';
import { touchPresence } from '@/lib/presence';

/** Dipanggil heartbeat client; user diambil dari sesi, bukan dari argumen. */
export async function touchPresenceAction(path: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await touchPresence(supabase, user.id, path);
}
```

- [ ] **Step 2: Create the heartbeat component**

`components/internal/presence-heartbeat.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { touchPresenceAction } from '@/app/actions/presence';

const HEARTBEAT_MS = 60_000;

/**
 * Tanpa UI. Ping sekali tiap pindah halaman (supaya "sedang di" akurat) dan
 * lanjut tiap 60 detik selama tab terbuka. Dipasang di layout kedua realm
 * (/dashboard dan /vendor/dashboard) — tidak di halaman login/publik.
 */
export function PresenceHeartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    const ping = () => {
      touchPresenceAction(pathname).catch(() => {});
    };
    ping();
    const id = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [pathname]);

  return null;
}
```

- [ ] **Step 3: Mount it in the internal layout**

In `app/dashboard/layout.tsx`, add the import below the `getRoleLabel` import:

```tsx
import { getRoleLabel } from "@/lib/roles";
import { PresenceHeartbeat } from "@/components/internal/presence-heartbeat";
```

Then render it as the first child of the root div. Before:

```tsx
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900">
      {/* Sidebar - Dark Theme */}
      <DesktopSidebar
```

After:

```tsx
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900">
      <PresenceHeartbeat />
      {/* Sidebar - Dark Theme */}
      <DesktopSidebar
```

- [ ] **Step 4: Mount it in the vendor layout**

In `app/vendor/dashboard/layout.tsx`, add the import below the `getUnreadCount` import:

```tsx
import { getUnreadCount, getNotificationPreferences } from "@/app/dashboard/inbox/actions";
import { PresenceHeartbeat } from "@/components/internal/presence-heartbeat";
```

Before:

```tsx
    <div className="flex h-screen w-full bg-slate-50">
      <VendorDesktopSidebar />
```

After:

```tsx
    <div className="flex h-screen w-full bg-slate-50">
      <PresenceHeartbeat />
      <VendorDesktopSidebar />
```

- [ ] **Step 5: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual verification (needs Task 1's migration applied)**

Run the dev server, log in as any user, open any dashboard page, wait about 5 seconds. In the Supabase table editor, `user_presence` has one row for that user with `current_path` equal to the page you are on. Navigate to another page: `current_path` updates within a few seconds. If the migration is not applied yet, the page must still work normally and the server log shows only a `touchPresence gagal` line.

- [ ] **Step 7: Commit**

```bash
git add app/actions/presence.ts components/internal/presence-heartbeat.tsx app/dashboard/layout.tsx app/vendor/dashboard/layout.tsx
git commit -m "Add presence heartbeat to internal and vendor layouts"
```

---

### Task 4: Permission module and sidebar menu

**Files:**
- Modify: `app/dashboard/master-data/role/constants.ts`
- Modify: `app/vendor/dashboard/role/constants.ts`
- Modify: `components/internal/sidebar-nav.tsx`

**Interfaces:**
- Produces: permission `activityLog.view` (`allowedTypes: ['pgn']`). Task 5's layout gate checks exactly `hasPermission('activityLog', 'view')`.

- [ ] **Step 1: Add the module to the internal constants**

In `app/dashboard/master-data/role/constants.ts`, add a new module after the `announcement` module. Before:

```ts
      { key: 'manage', label: 'Mengelola Pengumuman (tambah/edit/hapus)', allowedTypes: ['pgn'] },
    ]
  },
  {
    id: 'inspection',
```

After:

```ts
      { key: 'manage', label: 'Mengelola Pengumuman (tambah/edit/hapus)', allowedTypes: ['pgn'] },
    ]
  },
  {
    id: 'activityLog',
    title: 'Log Aktivitas',
    description: 'Riwayat aktivitas sistem (login, perubahan Master Data, approval dokumen) dan daftar pengguna yang sedang online.',
    items: [
      { key: 'view', label: 'Melihat Log Aktivitas & Pengguna Online', allowedTypes: ['pgn'] },
    ]
  },
  {
    id: 'inspection',
```

- [ ] **Step 2: Make the identical edit in the vendor constants**

Apply the exact same insertion to `app/vendor/dashboard/role/constants.ts` (the two files are kept identical; vendors can never be granted this because of `allowedTypes`).

- [ ] **Step 3: Add the sidebar entry**

In `components/internal/sidebar-nav.tsx`, add `Activity` to the lucide import. Before:

```tsx
import { LayoutDashboard, CheckCircle, FileSignature, Users, Shield, Building2, Briefcase, ClipboardList, Camera, AlertTriangle, Rocket, Archive, Siren, BookOpen, Megaphone } from 'lucide-react';
```

After:

```tsx
import { LayoutDashboard, CheckCircle, FileSignature, Users, Shield, Building2, Briefcase, ClipboardList, Camera, AlertTriangle, Rocket, Archive, Siren, BookOpen, Megaphone, Activity } from 'lucide-react';
```

Add the menu item after "News & Pengumuman". Before:

```tsx
  { name: 'News & Pengumuman', href: '/dashboard/master-data/announcement', icon: Megaphone, permission: { module: 'announcement', action: 'manage' } },
```

After:

```tsx
  { name: 'News & Pengumuman', href: '/dashboard/master-data/announcement', icon: Megaphone, permission: { module: 'announcement', action: 'manage' } },
  { name: 'Log Aktivitas', href: '/dashboard/master-data/activity-log', icon: Activity, permission: { module: 'activityLog', action: 'view' } },
```

No `requiresOrgType` is needed: unlike "Kelola Reviewer PGSOL", this permission is PGN-only by `allowedTypes`, so the permission check already matches who may open the page.

- [ ] **Step 4: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/master-data/role/constants.ts app/vendor/dashboard/role/constants.ts components/internal/sidebar-nav.tsx
git commit -m "Add activityLog permission module and sidebar entry"
```

---

### Task 5: Log Aktivitas page — gate, data actions, tabs UI

**Files:**
- Create: `app/dashboard/master-data/activity-log/layout.tsx`
- Create: `app/dashboard/master-data/activity-log/actions.ts`
- Create: `app/dashboard/master-data/activity-log/page.tsx`
- Create: `app/dashboard/master-data/activity-log/ActivityLogClient.tsx`

**Interfaces:**
- Consumes: `isOnline` (Task 2), `labelForPath` (Task 2), `getRoleLabel` from `@/lib/roles`, permission `activityLog.view` (Task 4), tables from Task 1.
- Produces: `getOnlineUsers(): Promise<OnlineUser[]>` and `getActivityFeed(opts?: { limit?: number }): Promise<ActivityFeedRow[]>`, plus the exported `OnlineUser` and `ActivityFeedRow` types. They are exported from a `'use server'` file, so they are declared with `export interface` and imported with `import type` in the client file — never as runtime values.

- [ ] **Step 1: Create the gate**

`app/dashboard/master-data/activity-log/layout.tsx` (same shape as the announcement module's layout):

```tsx
import { redirect } from 'next/navigation';
import { hasPermission } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

export default async function ActivityLogLayout({ children }: { children: React.ReactNode }) {
  const isAllowed = await hasPermission('activityLog', 'view');
  if (!isAllowed) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Create the data actions**

`app/dashboard/master-data/activity-log/actions.ts`:

```ts
'use server';

import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { isOnline } from '@/lib/presence';

export interface OnlineUser {
  userId: string;
  fullName: string | null;
  type: string | null;
  role: string | null;
  jabatan: string | null;
  currentPath: string | null;
  lastSeenAt: string;
}

export interface ActivityFeedRow {
  id: string;
  createdAt: string;
  action: string;
  notes: string | null;
  kind: 'activity' | 'document';
  /** entity_type (activity_logs) atau doc_type (document_logs). */
  category: string;
  actorName: string | null;
  actorJabatan: string | null;
  actorType: string | null;
}

/** Gerbang yang sama dengan layout.tsx — dicek lagi karena server action bisa dipanggil langsung. */
async function requireActivityLogAccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const allowed = await hasPermissionForUser(supabase, user.id, 'activityLog', 'view');
  return allowed ? supabase : null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export async function getOnlineUsers(): Promise<OnlineUser[]> {
  const supabase = await requireActivityLogAccess();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('user_presence')
    .select('user_id, current_path, last_seen_at, profiles ( full_name, type, role, jabatan )')
    .order('last_seen_at', { ascending: false });
  if (error) { console.error('getOnlineUsers error:', error.message); return []; }

  return (data || [])
    .filter((r: any) => isOnline(r.last_seen_at))
    .map((r: any) => {
      const p: any = one(r.profiles);
      return {
        userId: r.user_id,
        fullName: p?.full_name ?? null,
        type: p?.type ?? null,
        role: p?.role ?? null,
        jabatan: p?.jabatan ?? null,
        currentPath: r.current_path ?? null,
        lastSeenAt: r.last_seen_at,
      };
    });
}

/**
 * Gabungan activity_logs + document_logs (read-only), terbaru dulu. Dua query
 * lalu digabung di JS: kolom kedua tabel berbeda, dan `limit` per tabel
 * cukup untuk menjamin `limit` teratas gabungan benar (tiap tabel paling
 * banyak menyumbang `limit` baris ke hasil akhir).
 */
export async function getActivityFeed(opts: { limit?: number } = {}): Promise<ActivityFeedRow[]> {
  const limit = opts.limit ?? 50;
  const supabase = await requireActivityLogAccess();
  if (!supabase) return [];

  const [activityRes, docRes] = await Promise.all([
    supabase
      .from('activity_logs')
      .select('id, action, entity_type, notes, created_at, profiles ( full_name, type, jabatan )')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('document_logs')
      .select('id, action, doc_type, notes, created_at, profiles ( full_name, type, jabatan )')
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);
  if (activityRes.error) console.error('getActivityFeed activity_logs error:', activityRes.error.message);
  if (docRes.error) console.error('getActivityFeed document_logs error:', docRes.error.message);

  const rows: ActivityFeedRow[] = [
    ...(activityRes.data || []).map((r: any) => {
      const p: any = one(r.profiles);
      return {
        id: `a-${r.id}`, createdAt: r.created_at, action: r.action, notes: r.notes ?? null,
        kind: 'activity' as const, category: r.entity_type,
        actorName: p?.full_name ?? null, actorJabatan: p?.jabatan ?? null, actorType: p?.type ?? null,
      };
    }),
    ...(docRes.data || []).map((r: any) => {
      const p: any = one(r.profiles);
      return {
        id: `d-${r.id}`, createdAt: r.created_at, action: r.action, notes: r.notes ?? null,
        kind: 'document' as const, category: r.doc_type,
        actorName: p?.full_name ?? null, actorJabatan: p?.jabatan ?? null, actorType: p?.type ?? null,
      };
    }),
  ];

  return rows
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
```

- [ ] **Step 3: Create the server page**

`app/dashboard/master-data/activity-log/page.tsx`:

```tsx
import { getOnlineUsers, getActivityFeed } from './actions';
import ActivityLogClient from './ActivityLogClient';

export default async function ActivityLogPage() {
  const [onlineUsers, feed] = await Promise.all([
    getOnlineUsers(),
    getActivityFeed({ limit: 50 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Log Aktivitas</h1>
        <p className="text-sm text-slate-500 mt-1">Pantau siapa yang sedang online dan apa saja yang terjadi di sistem.</p>
      </div>
      <ActivityLogClient initialOnlineUsers={onlineUsers} initialFeed={feed} />
    </div>
  );
}
```

- [ ] **Step 4: Create the client UI**

`app/dashboard/master-data/activity-log/ActivityLogClient.tsx`:

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, Users, Clock, LogIn, Building2, Shield, Briefcase, Megaphone, UserCog,
  FileText, ShieldAlert, Stamp, Loader2,
} from 'lucide-react';
import { getActivityFeed } from './actions';
import type { OnlineUser, ActivityFeedRow } from './actions';
import { labelForPath } from '@/lib/presence-labels';
import { getRoleLabel } from '@/lib/roles';

const ONLINE_REFRESH_MS = 30_000;
const PAGE_SIZE = 50;

function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Baru saja';
  if (min < 60) return `${min}m lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}j lalu`;
  const day = Math.floor(hr / 24);
  return `${day}h lalu`;
}

const TYPE_BADGE: Record<string, string> = {
  pgn: 'bg-blue-100 text-blue-700',
  pgsol: 'bg-violet-100 text-violet-700',
  vendor: 'bg-amber-100 text-amber-700',
};
const TYPE_LABEL: Record<string, string> = { pgn: 'PGN', pgsol: 'PGSOL', vendor: 'Vendor' };

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  auth: LogIn,
  vendor: Building2,
  account: Users,
  role: Shield,
  project: Briefcase,
  announcement: Megaphone,
  pgsol_assignment: UserCog,
  procedure: FileText,
  jsa: ShieldAlert,
  ptw: Stamp,
};

const CATEGORY_LABEL: Record<string, string> = {
  auth: 'Autentikasi',
  vendor: 'Vendor',
  account: 'Akun',
  role: 'Role',
  project: 'Proyek',
  announcement: 'Pengumuman',
  pgsol_assignment: 'Reviewer PGSOL',
  procedure: 'Prosedur Kerja',
  jsa: 'JSA',
  ptw: 'PTW',
};

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  return (
    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${TYPE_BADGE[type] ?? 'bg-slate-100 text-slate-600'}`}>
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}

export default function ActivityLogClient({
  initialOnlineUsers, initialFeed,
}: {
  initialOnlineUsers: OnlineUser[];
  initialFeed: ActivityFeedRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'online' | 'riwayat'>('online');
  const [feed, setFeed] = useState(initialFeed);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  // Daftar online berubah dalam skala menit — refresh ringan selama tab itu
  // yang sedang dilihat. router.refresh() menjalankan ulang page.tsx dan
  // mengirim initialOnlineUsers yang baru.
  useEffect(() => {
    if (tab !== 'online') return;
    const id = setInterval(() => router.refresh(), ONLINE_REFRESH_MS);
    return () => clearInterval(id);
  }, [tab, router]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextLimit = limit + PAGE_SIZE;
      const next = await getActivityFeed({ limit: nextLimit });
      setFeed(next);
      setLimit(nextLimit);
    } finally {
      setLoadingMore(false);
    }
  };

  const tabs = [
    { id: 'online' as const, label: 'Pengguna Online', icon: Users, count: initialOnlineUsers.length },
    { id: 'riwayat' as const, label: 'Riwayat Aktivitas', icon: Activity, count: null },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm w-fit">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 py-2.5 px-4 text-sm font-bold rounded-lg transition-all ${
                tab === t.id ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
              {t.count !== null && (
                <span className={`text-[10px] font-black rounded-full min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center ${
                  tab === t.id ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'
                }`}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'online' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {initialOnlineUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
              <Users className="w-10 h-10 opacity-30" />
              <p className="text-sm">Tidak ada pengguna online saat ini.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {initialOnlineUsers.map(u => (
                <li key={u.userId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-800 truncate">{u.fullName || 'Tanpa nama'}</span>
                        <TypeBadge type={u.type} />
                      </div>
                      <p className="text-xs text-slate-500 truncate">{u.jabatan || getRoleLabel(u.role)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:justify-end text-xs">
                    <span className="font-semibold text-slate-700">Sedang di: {labelForPath(u.currentPath)}</span>
                    <span className="flex items-center gap-1 text-slate-400 shrink-0"><Clock className="w-3.5 h-3.5" /> {timeAgo(u.lastSeenAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'riwayat' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
              <Activity className="w-10 h-10 opacity-30" />
              <p className="text-sm">Belum ada aktivitas tercatat.</p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {feed.map(row => {
                  const Icon = CATEGORY_ICON[row.category] ?? Activity;
                  return (
                    <li key={row.id} className="flex gap-3 px-5 py-4">
                      <div className="shrink-0 w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{CATEGORY_LABEL[row.category] ?? row.category}</span>
                          <span className="text-sm font-bold text-slate-800">{row.action}</span>
                        </div>
                        {row.notes && <p className="text-sm text-slate-600 mt-0.5">{row.notes}</p>}
                        <p className="text-[11px] text-slate-400 mt-1">
                          {row.actorName || 'Sistem'}{row.actorJabatan ? ` · ${row.actorJabatan}` : ''} · {new Date(row.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <TypeBadge type={row.actorType} />
                    </li>
                  );
                })}
              </ul>
              {feed.length >= limit && (
                <div className="p-4 border-t border-slate-100 text-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition-colors"
                  >
                    {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                    Muat {PAGE_SIZE} lagi
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck and build**

Run: `node node_modules/typescript/bin/tsc --noEmit` then `node node_modules/next/dist/bin/next build`
Expected: both clean, and `/dashboard/master-data/activity-log` appears in the route list.

- [ ] **Step 6: Manual verification (needs Task 1's migration applied)**

1. Log in as the PGN admin. "Log Aktivitas" shows in the sidebar under Master Data; open it. Tab "Pengguna Online" lists your own account with "Sedang di: Log Aktivitas".
2. Open a second browser (or private window) as another user, browse to Kelola Proyek. Within about 30 seconds the first window lists that user as "Sedang di: Kelola Proyek (Approval K3)".
3. Close the second window and wait over 2 minutes plus one refresh cycle: that user disappears.
4. Tab "Riwayat Aktivitas" shows existing `document_logs` entries (approve/reject history) even before any new `activity_logs` row exists.
5. Log in as a PGSOL admin and as a vendor, then type `/dashboard/master-data/activity-log` directly: both are redirected to `/dashboard`. The menu item is absent from their sidebar.

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/master-data/activity-log
git commit -m "Add Log Aktivitas page with online users and merged activity feed"
```

---

### Task 6: Log login and logout

**Files:**
- Modify: `app/auth/login/actions.ts`
- Modify: `app/vendor/login/actions.ts`

**Interfaces:**
- Consumes: `logActivity` (Task 2).

- [ ] **Step 1: Instrument the internal login/logout**

In `app/auth/login/actions.ts`, add the import:

```ts
import { createClient } from "@/utils/supabase/server";
import { logActivity } from "@/lib/activity-log";
```

Log after the account-type check passes, so only a real, accepted login is recorded. Before:

```ts
    redirect(`/auth/login?error=Akses ditolak. ${debugMsg}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
```

After:

```ts
    redirect(`/auth/login?error=Akses ditolak. ${debugMsg}`);
  }

  await logActivity(supabase, { actorId: authData.user.id, action: 'Login', entityType: 'auth' });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  // Ambil user SEBELUM signOut — setelahnya sesi sudah tidak ada.
  const { data: { user } } = await supabase.auth.getUser();
  await logActivity(supabase, { actorId: user?.id ?? null, action: 'Logout', entityType: 'auth' });
  await supabase.auth.signOut();
  redirect("/auth/login");
}
```

- [ ] **Step 2: Instrument the vendor login/logout**

In `app/vendor/login/actions.ts`, add the same import. Before:

```ts
    redirect("/vendor/login?error=Akses ditolak. Akun ini bukan akun Vendor.");
  }

  revalidatePath("/", "layout");
  redirect("/vendor/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/vendor/login");
}
```

After:

```ts
    redirect("/vendor/login?error=Akses ditolak. Akun ini bukan akun Vendor.");
  }

  await logActivity(supabase, { actorId: authData.user.id, action: 'Login', entityType: 'auth' });

  revalidatePath("/", "layout");
  redirect("/vendor/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await logActivity(supabase, { actorId: user?.id ?? null, action: 'Logout', entityType: 'auth' });
  await supabase.auth.signOut();
  redirect("/vendor/login");
}
```

Do not log rejected logins (wrong password, wrong account type) — only accepted ones, per the spec's single "Login" event.

- [ ] **Step 3: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification (needs Task 1's migration applied)**

Log in then log out as an internal user and as a vendor user. `activity_logs` gets four rows (two "Login", two "Logout", `entity_type = 'auth'`, `actor_id` set). A login with a wrong password adds no row. The Riwayat Aktivitas tab shows them.

- [ ] **Step 5: Commit**

```bash
git add app/auth/login/actions.ts app/vendor/login/actions.ts
git commit -m "Log login and logout to activity_logs"
```

---

### Task 7: Log Master Data mutations

**Files:**
- Modify: `app/dashboard/master-data/vendor/actions.ts`
- Modify: `app/dashboard/master-data/account/actions.ts`
- Modify: `app/dashboard/master-data/role/actions.ts`
- Modify: `app/dashboard/master-data/role/[id]/actions.ts`
- Modify: `app/dashboard/master-data/project/actions.ts`
- Modify: `app/dashboard/master-data/project-pgsol-assign/actions.ts`
- Modify: `app/dashboard/master-data/announcement/actions.ts`

**Interfaces:**
- Consumes: `logActivity` and `ActivityEntityType` (Task 2).

Every call goes immediately after the mutation is confirmed successful and before `revalidatePath`, so a failed mutation is never logged. Each file gets one new import:

```ts
import { logActivity } from '@/lib/activity-log';
```

(`app/dashboard/master-data/project/actions.ts` uses double quotes — match it: `import { logActivity } from "@/lib/activity-log";`.)

- [ ] **Step 1: vendor/actions.ts**

Both functions have only the admin client in scope, so resolve the actor with a regular client. Add this local helper under `requireManageVendor`:

```ts
async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
```

In `updateVendor`, before the first `revalidatePath`:

```ts
    await logActivity(await createClient(), { actorId: await currentUserId(), action: 'Mengubah data vendor', entityType: 'vendor', entityId: orgId, notes: companyName });

    revalidatePath('/dashboard/master-data/vendor');
    revalidatePath('/dashboard/master-data/account');
    return { success: true };
```

In `addVendor`, before the first `revalidatePath`:

```ts
    await logActivity(await createClient(), { actorId: await currentUserId(), action: 'Membuat data vendor', entityType: 'vendor', entityId: orgId, notes: companyName });

    revalidatePath('/dashboard/master-data/vendor');
    revalidatePath('/dashboard/master-data/account');
    return { success: true };
```

- [ ] **Step 2: account/actions.ts**

`actor.userId` is already in scope in all five functions. Add a local client helper-free call using a fresh client. Insert before the `revalidatePath` of each function:

`addAccount` (after the `if (data.user) { ... }` block, before `revalidatePath`):

```ts
    await logActivity(await createClient(), { actorId: actor.userId, action: 'Membuat akun', entityType: 'account', entityId: data.user?.id ?? null, notes: `${fullName} (${role})` });
```

`updateAccount`:

```ts
    await logActivity(await createClient(), { actorId: actor.userId, action: 'Mengubah akun', entityType: 'account', entityId: id, notes: `${fullName} (${role})` });
```

`suspendAccount`:

```ts
    await logActivity(await createClient(), { actorId: actor.userId, action: isSuspended ? 'Menangguhkan akun' : 'Mengaktifkan kembali akun', entityType: 'account', entityId: id });
```

`resetAccountPassword` (never put the generated password in `notes`):

```ts
    await logActivity(await createClient(), { actorId: actor.userId, action: 'Reset password akun', entityType: 'account', entityId: id });
```

`deleteAccount`:

```ts
    await logActivity(await createClient(), { actorId: actor.userId, action: 'Menghapus akun', entityType: 'account', entityId: id });
```

- [ ] **Step 3: role/actions.ts**

`actor.userId` is in scope. Insert before the `revalidatePath` of each.

`addRole`:

```ts
    await logActivity(await createClient(), { actorId: actor.userId, action: 'Membuat role', entityType: 'role', notes: name });
```

`updateRole`:

```ts
    await logActivity(await createClient(), { actorId: actor.userId, action: 'Mengubah role', entityType: 'role', entityId: id, notes: name });
```

`deleteRole`:

```ts
    await logActivity(await createClient(), { actorId: actor.userId, action: 'Menghapus role', entityType: 'role', entityId: id });
```

(`addRole` leaves `entityId` unset because the insert does not select the new id back; do not widen the query just for logging.)

- [ ] **Step 4: role/[id]/actions.ts**

Add the import. `user.id` and `authClient` are in scope. Before:

```ts
    if (error) {
      console.error('Error updating role:', error);
      return { error: 'Gagal memperbarui konfigurasi role.' };
    }

    return { success: true };
```

After:

```ts
    if (error) {
      console.error('Error updating role:', error);
      return { error: 'Gagal memperbarui konfigurasi role.' };
    }

    await logActivity(authClient, { actorId: user.id, action: 'Mengubah permission role', entityType: 'role', entityId: id, notes: name });

    return { success: true };
```

- [ ] **Step 5: project/actions.ts**

Only `createProject` is logged (`saveStageAssignment` is already audited through `stage_assignments`). `user` and `supabase` are in scope. Before the `revalidatePath`:

```ts
  await logActivity(supabase, { actorId: user.id, action: "Membuat proyek", entityType: "project", entityId: project.id, notes: name });

  revalidatePath("/dashboard/master-data/project");
```

- [ ] **Step 6: project-pgsol-assign/actions.ts**

`supabase` and `user` are in scope. Before:

```ts
  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/master-data/project-pgsol-assign/${projectId}`);
```

After:

```ts
  if (result.error) return { error: result.error };

  await logActivity(supabase, { actorId: user.id, action: 'Mengubah assignment PGSOL', entityType: 'pgsol_assignment', entityId: projectId, notes: `${docType} / ${stageKey}` });

  revalidatePath(`/dashboard/master-data/project-pgsol-assign/${projectId}`);
```

- [ ] **Step 7: announcement/actions.ts**

`addAnnouncement` already destructures `userId`. The other three only take `permError`, so widen them to also take `userId`. Insert before each success `revalidatePath` block:

`addAnnouncement`:

```ts
    await logActivity(await createClient(), { actorId: userId, action: 'Membuat pengumuman', entityType: 'announcement', notes: title });
```

`updateAnnouncement` — change `const { error: permError } = await requireAnnouncementAccess();` to `const { error: permError, userId } = await requireAnnouncementAccess();`, then:

```ts
    await logActivity(await createClient(), { actorId: userId, action: 'Mengubah pengumuman', entityType: 'announcement', entityId: id, notes: title });
```

`deleteAnnouncement` — same widening, then:

```ts
    await logActivity(await createClient(), { actorId: userId, action: 'Menghapus pengumuman', entityType: 'announcement', entityId: id });
```

`toggleAnnouncementActive` — same widening, then:

```ts
    await logActivity(await createClient(), { actorId: userId, action: isActive ? 'Mengaktifkan pengumuman' : 'Menonaktifkan pengumuman', entityType: 'announcement', entityId: id });
```

- [ ] **Step 8: Typecheck and build**

Run: `node node_modules/typescript/bin/tsc --noEmit` then `node node_modules/next/dist/bin/next build`
Expected: both clean.

- [ ] **Step 9: Manual verification (needs Task 1's migration applied)**

As the PGN admin, do one of each: create a vendor, edit that vendor, create an account, edit it, suspend then reactivate it, reset its password, delete it, create a role, change its permissions, delete it, create a project, create and toggle and delete an announcement. The Riwayat Aktivitas tab lists every one with the right label and actor. Spot-check that a deliberately failing action (e.g. creating an account with a duplicate email) adds no row, and that no `notes` field contains a password.

- [ ] **Step 10: Commit**

```bash
git add app/dashboard/master-data
git commit -m "Log Master Data mutations to activity_logs"
```

---

## Self-Review Notes

- **Spec coverage:** `activity_logs` + `user_presence` + README note → Task 1. `logActivity`/`touchPresence`/`isOnline`/`labelForPath` → Task 2. Heartbeat in both realms → Task 3. `activityLog.view` + sidebar → Task 4. Page, tab "Pengguna Online" with "sedang di", tab "Riwayat Aktivitas" merged with `document_logs`, "Muat lebih banyak" → Task 5. Login/logout → Task 6. Every row of the spec's instrumentation table (vendor ×2, account ×5, role ×4 including permissions, project ×1, pgsol assignment, announcement ×4) → Task 7. Out-of-scope items (no change to `document_logs`, no retention, PGN-only, no field-level diff) have no task. The spec said call sites wrap their own `try/catch`; this plan centralizes it inside `logActivity`/`touchPresence`, which meets the same requirement (never break the caller) with less repetition.
- **Placeholder scan:** none; every code step carries literal code.
- **Type consistency:** `ActivityEntityType` values match the SQL `CHECK` list and the `CATEGORY_ICON`/`CATEGORY_LABEL` keys. `OnlineUser`/`ActivityFeedRow` are defined in Task 5's `actions.ts` and imported with `import type` in the client. `logActivity` is called with `{ actorId, action, entityType, entityId?, notes? }` everywhere. `touchPresenceAction(path: string)` matches the `PresenceHeartbeat` call.
