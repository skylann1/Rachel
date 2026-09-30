# News Carousel & Audit/Kunjungan Inspection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PGN-managed announcement carousel shared by the internal and vendor dashboard home pages, and add multi-photo support plus a new "Audit / Kunjungan" category to the Inspeksi Temuan module.

**Architecture:** Two independent, additive subsystems. News/Pengumuman is a brand-new permission-driven module (`announcements` table, CRUD actions, management page under `master-data`, a client carousel dropped into both dashboard home pages). Audit/Kunjungan reuses the existing `inspections` table and form entirely — it's just a new dropdown value — while multi-photo is a new child table (`inspection_photos`) joined onto the existing report flow, with a shared lightbox component reused by both the internal and vendor inspection pages.

**Tech Stack:** Next.js 16 App Router (React 19 Server + Client Components), Supabase (Postgres + RLS + Storage), Tailwind v4, lucide-react icons. No test framework in this repo — verification is `tsc --noEmit` + `next build` + (where noted) a manual browser check via the `run` skill.

**Spec:** `docs/superpowers/specs/2026-09-30-news-carousel-and-audit-inspection-design.md`

## Global Constraints

- No `npm`/`npx` in this environment. Use `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/eslint/bin/eslint.js <path>`, and `node node_modules/next/dist/bin/next build` for verification — never `npm run ...`.
- No test framework exists (`AGENTS.md`) — do not write Jest/Vitest-style test files. "Tests" for this plan means: typecheck, build, and (for UI-heavy tasks) a manual smoke check.
- Domain text, labels, and code comments are Indonesian, matching the rest of the codebase.
- Follow the existing mutation pattern exactly: server action checks `hasPermissionForUser(...)` first, then uses `createAdminClient()` (from `@/utils/supabase/admin`) for the actual write. Reads that don't need elevated access use the regular `createClient()` from `@/utils/supabase/server` (server components/actions) or `@/utils/supabase/client` (client components).
- Announcement management is gated by permission `announcement.manage`, `allowedTypes: ['pgn']` — **not** a hardcoded `role === 'admin'` check. This mirrors `manage_vendor`/`manage_role`/`manage_account` in `app/dashboard/master-data/role/constants.ts`.
- `vendor_evidence_url` (vendor's fix-evidence photo in the "Validasi Perbaikan" flow) is explicitly **out of scope** — stays single-photo. Only the report-side photo (`inspections.image_url` / new `inspection_photos`) becomes multi-photo.
- Shared client components go directly under `components/` (kebab-case filenames), matching the existing flat convention (`components/submit-button.tsx`, `components/project-discussion.tsx`) — the codebase has no `components/shared/` subfolder, so don't introduce one.
- Image uploads go through the existing `uploadImage(file, path)` helper (`@/utils/supabase/storage`, bucket `sipermit-images`) — call it client-side, append the resulting URL string(s) to `FormData`, never pass `File` objects into a server action. This is the existing pattern in `app/dashboard/inspection/page.tsx`'s `handleCreate`.
- The `supabase/schema_announcements_and_audit_photos.sql` file created in Task 1 is **not applied automatically** to any live database as part of this plan — matches `AGENTS.md`'s stated convention ("applied by hand in the Supabase SQL editor"). Tasks 3 onward will typecheck and build fine without the tables existing live, but a real end-to-end smoke test (actually creating an announcement, actually uploading multiple inspection photos) requires the migration to have been applied first. The controller should confirm with the user whether to apply it (e.g. via the connected Supabase MCP tools) before or after finishing all tasks.

---

## File Structure

**New files:**
- `supabase/schema_announcements_and_audit_photos.sql` — both new tables + RLS
- `app/dashboard/master-data/announcement/actions.ts` — CRUD server actions
- `app/dashboard/master-data/announcement/layout.tsx` — permission gate
- `app/dashboard/master-data/announcement/page.tsx` — list + delete + toggle-active UI
- `app/dashboard/master-data/announcement/AnnouncementFormModal.tsx` — add/edit form (image upload)
- `components/announcement-carousel.tsx` — client carousel, used by both dashboard homes
- `components/photo-gallery-lightbox.tsx` — client lightbox, used by both inspection pages

**Modified files:**
- `app/dashboard/master-data/role/constants.ts` — new `announcement` permission module
- `components/internal/sidebar-nav.tsx` — new "News & Pengumuman" nav entry
- `app/dashboard/page.tsx` — fetch + render carousel at the top
- `app/vendor/dashboard/page.tsx` — fetch + render carousel at the top
- `app/dashboard/inspection/actions.ts` — multi-photo `createInspection`, `getInspections` join
- `app/dashboard/inspection/page.tsx` — multi-file upload, "Audit / Kunjungan" option, gallery/lightbox wiring
- `app/vendor/dashboard/inspection/actions.ts` — `getVendorInspections` join
- `app/vendor/dashboard/inspection/page.tsx` — gallery/lightbox wiring (read-only)
- `AGENTS.md` — doc note for both new modules

---

### Task 1: Database schema — `announcements` + `inspection_photos`

**Files:**
- Create: `supabase/schema_announcements_and_audit_photos.sql`

**Interfaces:**
- Produces: table `public.announcements` (`id`, `title`, `description`, `image_url`, `is_active`, `display_order`, `created_by`, `created_at`, `updated_at`); table `public.inspection_photos` (`id`, `inspection_id`, `image_url`, `created_at`). Every later task that reads/writes these tables assumes these exact column names and types.

- [ ] **Step 1: Write the schema file**

```sql
-- supabase/schema_announcements_and_audit_photos.sql
--
-- Dua tabel baru, independen dari migrasi lain (tidak butuh backfill,
-- tidak bergantung urutan Fase 1-3.1 di README_org_migration_order.md):
--
--   1. announcements      — konten carousel News/Pengumuman di home
--      dashboard internal & vendor. Dikelola PGN lewat permission
--      'announcement'/'manage' (lihat app/dashboard/master-data/role/
--      constants.ts), bukan hardcode role admin.
--   2. inspection_photos  — galeri multi-foto untuk sisi LAPORAN temuan
--      K3 (inspections.image_url tetap dipertahankan sebagai foto
--      pertama, untuk kompatibilitas baris lama). vendor_evidence_url
--      (bukti perbaikan vendor) sengaja TIDAK disentuh — tetap 1 foto.
--
-- Harus dijalankan SETELAH schema.sql dasar dan migrasi schema_org_*
-- (RLS di bawah memakai public.is_internal_user() dan
-- public.current_vendor_org_id() yang didefinisikan di situ).
--
-- Dijalankan manual di Supabase SQL editor, sesuai konvensi repo ini
-- (lihat AGENTS.md, "Supabase schema changes are manual SQL files").

-- ==============================================================================
-- 1. ANNOUNCEMENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  display_order INT DEFAULT 0 NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Semua user authenticated (pgn/pgsol/vendor) boleh lihat pengumuman aktif —
-- carousel tampil di kedua dashboard home, bukan data sensitif.
DROP POLICY IF EXISTS "Authenticated users can read active announcements" ON public.announcements;
CREATE POLICY "Authenticated users can read active announcements"
ON public.announcements FOR SELECT
TO authenticated
USING (is_active = true);

-- Internal (pgn/pgsol) juga boleh baca baris NONAKTIF — dibutuhkan halaman
-- kelola (getAnnouncementsForManagement) untuk menampilkan semua baris.
-- Mutasi tetap lewat createAdminClient() + gate permission di action, ini
-- backstop RLS saja (pola sama seperti schema_inspections_rls.sql).
DROP POLICY IF EXISTS "Internal users can read all announcements" ON public.announcements;
CREATE POLICY "Internal users can read all announcements"
ON public.announcements FOR SELECT
TO authenticated
USING (public.is_internal_user());

DROP POLICY IF EXISTS "Internal users can insert announcements" ON public.announcements;
CREATE POLICY "Internal users can insert announcements"
ON public.announcements FOR INSERT
TO authenticated
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS "Internal users can update announcements" ON public.announcements;
CREATE POLICY "Internal users can update announcements"
ON public.announcements FOR UPDATE
TO authenticated
USING (public.is_internal_user())
WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS "Internal users can delete announcements" ON public.announcements;
CREATE POLICY "Internal users can delete announcements"
ON public.announcements FOR DELETE
TO authenticated
USING (public.is_internal_user());

-- ==============================================================================
-- 2. INSPECTION_PHOTOS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inspection_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID REFERENCES public.inspections(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users can read all inspection photos" ON public.inspection_photos;
CREATE POLICY "Internal users can read all inspection photos"
ON public.inspection_photos FOR SELECT
TO authenticated
USING (public.is_internal_user());

-- inspection_photos sendiri tidak punya target_vendor — vendor boleh baca
-- kalau inspeksi induknya ditujukan ke organisasi mereka.
DROP POLICY IF EXISTS "Vendors can read own inspection photos" ON public.inspection_photos;
CREATE POLICY "Vendors can read own inspection photos"
ON public.inspection_photos FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.inspections i
  WHERE i.id = inspection_photos.inspection_id
  AND i.target_vendor = public.current_vendor_org_id()
));

-- Hanya internal yang membuat laporan (createInspection), sinkron dengan
-- INSERT policy inspections di schema_inspections_rls.sql.
DROP POLICY IF EXISTS "Internal users can insert inspection photos" ON public.inspection_photos;
CREATE POLICY "Internal users can insert inspection photos"
ON public.inspection_photos FOR INSERT
TO authenticated
WITH CHECK (public.is_internal_user());

-- Tidak ada UPDATE/DELETE policy — foto laporan tidak pernah diedit
-- setelah dibuat, sama seperti tidak adanya edit pada inspections sendiri
-- di luar field status/disposisi/validasi.
```

- [ ] **Step 2: Verify the file is complete**

Run: read the file back and confirm both tables are present:

```bash
grep -c "CREATE TABLE IF NOT EXISTS public.announcements" supabase/schema_announcements_and_audit_photos.sql
grep -c "CREATE TABLE IF NOT EXISTS public.inspection_photos" supabase/schema_announcements_and_audit_photos.sql
```

Expected: both print `1`.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema_announcements_and_audit_photos.sql
git commit -m "Add schema for announcements and inspection_photos tables"
```

---

### Task 2: Permission module + sidebar nav entry

**Files:**
- Modify: `app/dashboard/master-data/role/constants.ts`
- Modify: `components/internal/sidebar-nav.tsx`

**Interfaces:**
- Consumes: nothing from Task 1 directly (this is pure permission/nav plumbing).
- Produces: permission module id `'announcement'` with keys `'view'` and `'manage'` — Task 3's `requireAnnouncementAccess()` checks `hasPermissionForUser(supabase, user.id, 'announcement', 'manage')`, and Task 4's `layout.tsx` checks `hasPermission('announcement', 'manage')`. Both string literals must match this task's `id`/`key` values exactly.

- [ ] **Step 1: Add the `announcement` module to `allPermissionModules`**

In `app/dashboard/master-data/role/constants.ts`, insert a new module object right after the `dashboard` module (before `inspection`, so it reads top-to-bottom as "Dashboard Overview" → "News & Pengumuman" → "Modul Inspeksi..."):

```ts
  {
    id: 'announcement',
    title: 'News & Pengumuman',
    description: 'Konten pengumuman yang tampil sebagai carousel di halaman utama dashboard internal maupun vendor.',
    items: [
      { key: 'view', label: 'Melihat Carousel Pengumuman', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'manage', label: 'Mengelola Pengumuman (tambah/edit/hapus)', allowedTypes: ['pgn'] },
    ]
  },
```

So the top of the array becomes:

```ts
export const allPermissionModules = [
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    description: 'Akses ke halaman utama dashboard dan statistik keseluruhan.',
    items: [
      { key: 'view', label: 'Melihat Statistik & Metrik', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
    ]
  },
  {
    id: 'announcement',
    title: 'News & Pengumuman',
    description: 'Konten pengumuman yang tampil sebagai carousel di halaman utama dashboard internal maupun vendor.',
    items: [
      { key: 'view', label: 'Melihat Carousel Pengumuman', allowedTypes: ['pgn', 'pgsol', 'vendor'] },
      { key: 'manage', label: 'Mengelola Pengumuman (tambah/edit/hapus)', allowedTypes: ['pgn'] },
    ]
  },
  {
    id: 'inspection',
    title: 'Modul Inspeksi & Temuan K3',
    ...
```

(the `inspection` module and everything after it is unchanged — only insert the new block between `dashboard` and `inspection`.)

- [ ] **Step 2: Add the sidebar nav entry**

In `components/internal/sidebar-nav.tsx`, add `Megaphone` to the lucide-react import on line 6:

```ts
import { LayoutDashboard, CheckCircle, FileSignature, Users, Shield, Building2, Briefcase, ClipboardList, Camera, AlertTriangle, Rocket, Archive, Siren, BookOpen, Megaphone } from 'lucide-react';
```

Then add a new entry to the `masterData` array (after `'Role & Permission'`, before `'Data Vendor'`):

```ts
  { name: 'News & Pengumuman', href: '/dashboard/master-data/announcement', icon: Megaphone, permission: { module: 'announcement', action: 'manage' } },
```

So `masterData` becomes:

```ts
const masterData = [
  { name: 'Manajemen Akun', href: '/dashboard/master-data/account', icon: Users, permission: { module: 'masterData', action: 'view_account' } },
  { name: 'Staff Organisasi', href: '/dashboard/master-data/account', icon: Users, permission: { module: 'masterData', action: 'manage_org_staff' } },
  { name: 'Kelola Reviewer PGSOL', href: '/dashboard/master-data/project-pgsol-assign', icon: Users, permission: { module: 'jsa', action: 'manage_assignment_pgsol' } },
  { name: 'Role & Permission', href: '/dashboard/master-data/role', icon: Shield, permission: { module: 'masterData', action: 'manage_role' } },
  { name: 'News & Pengumuman', href: '/dashboard/master-data/announcement', icon: Megaphone, permission: { module: 'announcement', action: 'manage' } },
  { name: 'Data Vendor', href: '/dashboard/master-data/vendor', icon: Building2, permission: { module: 'masterData', action: 'view_vendor' } },
  { name: 'Data Proyek', href: '/dashboard/master-data/project', icon: Briefcase, permission: { module: 'masterData', action: 'view_project' } },
];
```

- [ ] **Step 3: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors (the route `/dashboard/master-data/announcement` doesn't exist yet — that's fine, `href` is a plain string, not a typed route in this project).

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/master-data/role/constants.ts components/internal/sidebar-nav.tsx
git commit -m "Add announcement permission module and sidebar nav entry"
```

---

### Task 3: Announcement server actions

**Files:**
- Create: `app/dashboard/master-data/announcement/actions.ts`

**Interfaces:**
- Consumes: permission module `'announcement'`/`'manage'` (Task 2); table `announcements` (Task 1) with columns `id, title, description, image_url, is_active, display_order, created_by, created_at, updated_at`.
- Produces: `getActiveAnnouncements(): Promise<Announcement[]>` (Task 5 carousel wiring calls this from both dashboard home pages); `getAnnouncementsForManagement(): Promise<Announcement[]>`, `addAnnouncement(formData: FormData): Promise<{error?: string; success?: true}>`, `updateAnnouncement(id: string, formData: FormData): Promise<{error?: string; success?: true}>`, `deleteAnnouncement(id: string): Promise<{error?: string; success?: true}>`, `toggleAnnouncementActive(id: string, isActive: boolean): Promise<{error?: string; success?: true}>` (Task 4 management UI calls these). Exported `Announcement` type: `{ id: string; title: string; description: string | null; image_url: string; is_active: boolean; display_order: number; created_at: string }`.

- [ ] **Step 1: Write the actions file**

```ts
'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { revalidatePath } from 'next/cache';

export interface Announcement {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

/**
 * Gate tunggal untuk semua mutasi pengumuman di file ini, pola yang sama
 * dengan requireRoleAccess() di app/dashboard/master-data/role/actions.ts.
 * Tidak perlu crossOrg/org-scoping seperti role atau account — pengumuman
 * bukan data per-organisasi, cuma butuh permission 'manage' (yang sudah
 * dideklarasikan allowedTypes: ['pgn'] di constants.ts).
 */
async function requireAnnouncementAccess(): Promise<{ error: string | null; userId: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', userId: null };

  const allowed = await hasPermissionForUser(supabase, user.id, 'announcement', 'manage');
  if (!allowed) return { error: 'Anda tidak memiliki izin untuk mengelola pengumuman.', userId: null };

  return { error: null, userId: user.id };
}

/**
 * Dipakai kedua dashboard home (internal & vendor) — cukup client biasa
 * karena RLS "Authenticated users can read active announcements" sudah
 * membatasi ke baris is_active=true untuk siapa pun yang login.
 */
export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, description, image_url, is_active, display_order, created_at')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('getActiveAnnouncements error:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Halaman kelola butuh baris nonaktif juga (supaya bisa diaktifkan lagi) —
 * pakai admin client, gate lewat requireAnnouncementAccess() sama seperti
 * mutasi di bawah.
 */
export async function getAnnouncementsForManagement(): Promise<Announcement[]> {
  const { error: permError } = await requireAnnouncementAccess();
  if (permError) return [];

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('announcements')
    .select('id, title, description, image_url, is_active, display_order, created_at')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('getAnnouncementsForManagement error:', error.message);
    return [];
  }

  return data || [];
}

export async function addAnnouncement(formData: FormData) {
  try {
    const { error: permError, userId } = await requireAnnouncementAccess();
    if (permError || !userId) return { error: permError };

    const title = formData.get('title') as string;
    const description = (formData.get('description') as string) || null;
    const image_url = formData.get('image_url') as string;
    const display_order = Number(formData.get('display_order')) || 0;

    if (!title || !image_url) {
      return { error: 'Judul dan gambar wajib diisi.' };
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('announcements')
      .insert({
        title,
        description,
        image_url,
        display_order,
        created_by: userId,
      });

    if (error) {
      return { error: error.message || 'Gagal menambahkan pengumuman.' };
    }

    revalidatePath('/dashboard/master-data/announcement');
    revalidatePath('/dashboard');
    revalidatePath('/vendor/dashboard');
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server saat menambahkan pengumuman.' };
  }
}

export async function updateAnnouncement(id: string, formData: FormData) {
  try {
    const { error: permError } = await requireAnnouncementAccess();
    if (permError) return { error: permError };

    const title = formData.get('title') as string;
    const description = (formData.get('description') as string) || null;
    const image_url = formData.get('image_url') as string;
    const display_order = Number(formData.get('display_order')) || 0;

    if (!title || !image_url) {
      return { error: 'Judul dan gambar wajib diisi.' };
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('announcements')
      .update({
        title,
        description,
        image_url,
        display_order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return { error: error.message || 'Gagal mengubah pengumuman.' };
    }

    revalidatePath('/dashboard/master-data/announcement');
    revalidatePath('/dashboard');
    revalidatePath('/vendor/dashboard');
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server saat mengubah pengumuman.' };
  }
}

export async function deleteAnnouncement(id: string) {
  try {
    const { error: permError } = await requireAnnouncementAccess();
    if (permError) return { error: permError };

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) {
      return { error: error.message || 'Gagal menghapus pengumuman.' };
    }

    revalidatePath('/dashboard/master-data/announcement');
    revalidatePath('/dashboard');
    revalidatePath('/vendor/dashboard');
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server saat menghapus pengumuman.' };
  }
}

export async function toggleAnnouncementActive(id: string, isActive: boolean) {
  try {
    const { error: permError } = await requireAnnouncementAccess();
    if (permError) return { error: permError };

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('announcements')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { error: error.message || 'Gagal mengubah status pengumuman.' };
    }

    revalidatePath('/dashboard/master-data/announcement');
    revalidatePath('/dashboard');
    revalidatePath('/vendor/dashboard');
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server saat mengubah status pengumuman.' };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors. (This file references the `announcements` table via the Supabase client, which is untyped `any`-style access in this codebase's existing pattern — no generated DB types are used elsewhere, so this won't fail on a missing table type.)

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/master-data/announcement/actions.ts
git commit -m "Add announcement CRUD server actions"
```

---

### Task 4: Announcement management UI

**Files:**
- Create: `app/dashboard/master-data/announcement/layout.tsx`
- Create: `app/dashboard/master-data/announcement/page.tsx`
- Create: `app/dashboard/master-data/announcement/AnnouncementFormModal.tsx`

**Interfaces:**
- Consumes: `Announcement` type, `getAnnouncementsForManagement`, `addAnnouncement`, `updateAnnouncement`, `deleteAnnouncement`, `toggleAnnouncementActive` from `./actions` (Task 3); `uploadImage` from `@/utils/supabase/storage`.
- Produces: route `/dashboard/master-data/announcement`, reachable from the Task 2 sidebar entry.

- [ ] **Step 1: Write the permission gate**

```tsx
// app/dashboard/master-data/announcement/layout.tsx
import { redirect } from 'next/navigation';
import { hasPermission } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

export default async function AnnouncementLayout({ children }: { children: React.ReactNode }) {
  const isAllowed = await hasPermission('announcement', 'manage');
  if (!isAllowed) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Write the add/edit form modal**

```tsx
// app/dashboard/master-data/announcement/AnnouncementFormModal.tsx
'use client';

import React, { useRef, useState } from 'react';
import { X, Loader2, AlertCircle, Megaphone, UploadCloud } from 'lucide-react';
import { uploadImage } from '@/utils/supabase/storage';
import { addAnnouncement, updateAnnouncement, type Announcement } from './actions';

export default function AnnouncementFormModal({
  isOpen,
  onClose,
  onSuccess,
  editing,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editing?: Announcement | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);

    try {
      if (imageFile) {
        const imageUrl = await uploadImage(imageFile, 'announcements');
        if (!imageUrl) {
          setError('Gagal mengunggah gambar.');
          setLoading(false);
          return;
        }
        formData.set('image_url', imageUrl);
      } else if (editing) {
        formData.set('image_url', editing.image_url);
      }

      if (!formData.get('image_url')) {
        setError('Gambar wajib diunggah.');
        setLoading(false);
        return;
      }

      const result = editing
        ? await updateAnnouncement(editing.id, formData)
        : await addAnnouncement(formData);

      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        setLoading(false);
        setImageFile(null);
        if (onSuccess) onSuccess();
        else onClose();
      }
    } catch {
      setError('Gagal menyimpan pengumuman.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-slate-800">{editing ? 'Edit Pengumuman' : 'Tambah Pengumuman'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors p-1 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          <form id="announcement-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Gambar Pengumuman <span className="text-rose-500">*</span></label>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              <div onClick={() => fileInputRef.current?.click()} className="w-full h-40 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden">
                {imageFile ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={URL.createObjectURL(imageFile)} alt="Preview" className="w-full h-full object-cover" />
                ) : editing?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editing.image_url} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <UploadCloud className="w-6 h-6 mb-2" />
                    <span className="text-sm font-medium">Klik untuk upload gambar</span>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Judul <span className="text-rose-500">*</span></label>
              <input
                type="text"
                name="title"
                required
                defaultValue={editing?.title}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
                placeholder="Contoh: Sosialisasi K3 Bulan November"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Deskripsi</label>
              <textarea
                name="description"
                rows={3}
                defaultValue={editing?.description || ''}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm resize-none"
                placeholder="Penjelasan pengumuman..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Urutan Tampil</label>
              <input
                type="number"
                name="display_order"
                defaultValue={editing?.display_order ?? 0}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
              />
              <p className="text-[11px] text-slate-500 mt-1">Angka lebih kecil tampil lebih dulu di carousel.</p>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors">
            Batal
          </button>
          <button
            form="announcement-form"
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 disabled:bg-primary/50 rounded-xl transition-all shadow-sm shadow-primary/30 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the list page**

```tsx
// app/dashboard/master-data/announcement/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Megaphone, Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import { getAnnouncementsForManagement, deleteAnnouncement, toggleAnnouncementActive, type Announcement } from './actions';
import AnnouncementFormModal from './AnnouncementFormModal';

export default function AnnouncementPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const data = await getAnnouncementsForManagement();
    setAnnouncements(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus pengumuman "${title}"? Aksi ini tidak dapat dibatalkan.`)) return;
    setIsDeleting(id);
    const res = await deleteAnnouncement(id);
    setIsDeleting(null);
    if (res.error) {
      alert(res.error);
    } else {
      fetchData();
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    const res = await toggleAnnouncementActive(id, !current);
    if (res.error) {
      alert(res.error);
    } else {
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" /> News & Pengumuman
          </h1>
          <p className="text-sm text-slate-500 mt-1">Kelola konten carousel pengumuman di halaman utama dashboard.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setIsFormOpen(true); }}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30"
        >
          <Plus className="w-4 h-4" />
          Tambah Pengumuman
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border-2 border-dashed border-slate-200 rounded-2xl">
          <Megaphone className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">Belum ada pengumuman.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {announcements.map((item) => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="h-40 bg-slate-100 relative overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                <span className={`absolute top-3 left-3 px-2.5 py-1 text-xs font-bold rounded-lg shadow-sm ${item.is_active ? 'bg-emerald-100/90 text-emerald-700 border border-emerald-200' : 'bg-slate-100/90 text-slate-500 border border-slate-200'}`}>
                  {item.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="text-sm font-bold text-slate-800 mb-1">{item.title}</h3>
                {item.description && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{item.description}</p>}
                <div className="mt-auto flex gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleToggle(item.id, item.is_active)}
                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title={item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  >
                    {item.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { setEditing(item); setIsFormOpen(true); }}
                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    disabled={isDeleting === item.id}
                    onClick={() => handleDelete(item.id, item.title)}
                    className={`p-2 rounded-lg transition-colors ${isDeleting === item.id ? 'text-slate-300' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnnouncementFormModal
        isOpen={isFormOpen}
        editing={editing}
        onClose={() => { setIsFormOpen(false); setEditing(null); }}
        onSuccess={() => { setIsFormOpen(false); setEditing(null); fetchData(); }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/master-data/announcement/
git commit -m "Add announcement management UI"
```

---

### Task 5: Announcement carousel component + wire into both dashboard homes

**Files:**
- Create: `components/announcement-carousel.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `app/vendor/dashboard/page.tsx`

**Interfaces:**
- Consumes: `Announcement` type and `getActiveAnnouncements()` from `@/app/dashboard/master-data/announcement/actions` (Task 3).
- Produces: `<AnnouncementCarousel announcements={Announcement[]} />` — a client component that renders nothing meaningful on an empty array (caller is expected to skip rendering it entirely when the array is empty, per the design's "no carousel at all when nothing active" rule).

- [ ] **Step 1: Write the carousel component**

```tsx
// components/announcement-carousel.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Announcement } from '@/app/dashboard/master-data/announcement/actions';

const AUTOPLAY_MS = 5000;

export function AnnouncementCarousel({ announcements }: { announcements: Announcement[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % announcements.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [announcements.length]);

  if (announcements.length === 0) return null;

  const current = announcements[index];
  const goPrev = () => setIndex((i) => (i - 1 + announcements.length) % announcements.length);
  const goNext = () => setIndex((i) => (i + 1) % announcements.length);

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-lg group">
      <div className="relative h-48 sm:h-56 lg:h-64 w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.image_url} alt={current.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
          <h2 className="text-white font-bold text-lg sm:text-xl drop-shadow-sm">{current.title}</h2>
          {current.description && (
            <p className="text-white/85 text-sm mt-1 line-clamp-2 max-w-2xl">{current.description}</p>
          )}
        </div>
      </div>

      {announcements.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Berikutnya"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-3 right-4 flex gap-1.5">
            {announcements.map((a, i) => (
              <button
                key={a.id}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into `app/dashboard/page.tsx`**

Add the import near the other imports at the top of the file (after the `PeriodSwitcher` import on line 10):

```ts
import { AnnouncementCarousel } from '@/components/announcement-carousel';
import { getActiveAnnouncements } from '@/app/dashboard/master-data/announcement/actions';
```

Inside `DashboardOverviewPage`, add the fetch alongside the existing `Promise.all` fetches (right after the `const supabase = await createClient();` / `const now = new Date();` block, before `const { periode: periodeParam } = await searchParams;` — order doesn't matter functionally, but keep it near the top with the other data fetches):

```ts
   const announcements = await getActiveAnnouncements();
```

In the returned JSX (`return (\n      <div className="space-y-6">`), render the carousel as the very first child, before the "Welcome Header" block:

```tsx
   return (
      <div className="space-y-6">
         {announcements.length > 0 && <AnnouncementCarousel announcements={announcements} />}
         <div className="flex flex-col gap-4">
           {/* Welcome Header */}
```

- [ ] **Step 3: Wire into `app/vendor/dashboard/page.tsx`**

Add the import after the existing `VendorDashboardCharts` import (line 20):

```ts
import { AnnouncementCarousel } from '@/components/announcement-carousel';
import { getActiveAnnouncements } from '@/app/dashboard/master-data/announcement/actions';
```

Inside `VendorDashboardPage`, add the fetch alongside the existing ones:

```ts
  const announcements = await getActiveAnnouncements();
```

In the returned JSX, render it as the first child, before the "Hero" block:

```tsx
  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">

      {announcements.length > 0 && <AnnouncementCarousel announcements={announcements} />}

      {/* ── Hero ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-blue-800 p-6 sm:p-8 lg:p-10 text-white shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
```

- [ ] **Step 4: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add components/announcement-carousel.tsx app/dashboard/page.tsx app/vendor/dashboard/page.tsx
git commit -m "Add announcement carousel to internal and vendor dashboard homes"
```

---

### Task 6: Inspection multi-photo server actions

**Files:**
- Modify: `app/dashboard/inspection/actions.ts`
- Modify: `app/vendor/dashboard/inspection/actions.ts`

**Interfaces:**
- Consumes: table `inspection_photos` (Task 1), columns `id, inspection_id, image_url, created_at`.
- Produces: `createInspection(formData)` now reads `formData.getAll('image_urls')` (plural) instead of `formData.get('image_url')` (singular) — Task 7's form must append under the key `'image_urls'`, one `formData.append('image_urls', url)` call per uploaded photo. `getInspections()` and `getVendorInspections()` rows now include an `inspection_photos: { id: string; image_url: string }[]` array — Task 7 and Task 8's `loadData()` mapping must read `d.inspection_photos`.

- [ ] **Step 1: Update `createInspection` in `app/dashboard/inspection/actions.ts`**

Replace the single `image_url` read and the insert/log block. Before:

```ts
  const image_url = formData.get("image_url") as string;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (!(await hasPermissionForUser(supabase, user.id, 'inspection', 'create'))) {
    throw new Error("Anda tidak memiliki izin untuk membuat laporan inspeksi.");
  }

  const { data, error } = await supabase
    .from('inspections')
    .insert({
      project_id: project_id || null,
      reported_by: user?.id,
      target_vendor: target_vendor || null,
      title,
      finding_type,
      priority,
      location,
      status: 'Open',
      image_url,
      is_project_activity,
      assigned_to: assigned_to || user?.id // Default to reporter if not explicitly assigned
    })
    .select()
    .single();
    
  if (error) {
    console.error(error);
    throw new Error(error.message);
  }

  // Create initial log
  if (data) {
```

After:

```ts
  // Multi-foto: satu laporan bisa punya banyak foto (inspection_photos),
  // foto pertama tetap diduplikasi ke inspections.image_url supaya kode
  // lama yang baca item.image_url sebagai thumbnail tidak perlu berubah.
  const imageUrls = (formData.getAll("image_urls") as string[]).filter(Boolean);
  const image_url = imageUrls[0] || null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  if (!(await hasPermissionForUser(supabase, user.id, 'inspection', 'create'))) {
    throw new Error("Anda tidak memiliki izin untuk membuat laporan inspeksi.");
  }

  const { data, error } = await supabase
    .from('inspections')
    .insert({
      project_id: project_id || null,
      reported_by: user?.id,
      target_vendor: target_vendor || null,
      title,
      finding_type,
      priority,
      location,
      status: 'Open',
      image_url,
      is_project_activity,
      assigned_to: assigned_to || user?.id // Default to reporter if not explicitly assigned
    })
    .select()
    .single();
    
  if (error) {
    console.error(error);
    throw new Error(error.message);
  }

  // Create initial log
  if (data) {
    if (imageUrls.length > 0) {
      await supabase.from('inspection_photos').insert(
        imageUrls.map((url) => ({ inspection_id: data.id, image_url: url }))
      );
    }

```

(the rest of the `if (data) { ... }` block — the `inspection_logs` insert, the `notifyOrgMembers` call, the `createNotification` call — stays exactly as-is, just now has the `inspection_photos` insert prepended inside the same `if (data)` block.)

- [ ] **Step 2: Update `getInspections` in `app/dashboard/inspection/actions.ts`**

Add `inspection_photos ( id, image_url )` to the `.select()` call. Before:

```ts
      assigned_to,
      internal_profiles:assigned_to (
        profiles:id ( full_name )
      )
    `)
    .order('created_at', { ascending: false });
```

After:

```ts
      assigned_to,
      internal_profiles:assigned_to (
        profiles:id ( full_name )
      ),
      inspection_photos ( id, image_url )
    `)
    .order('created_at', { ascending: false });
```

- [ ] **Step 3: Update `getVendorInspections` in `app/vendor/dashboard/inspection/actions.ts`**

Add `inspection_photos ( id, image_url )` to its `.select()` too. Before:

```ts
    .select(`
      id,
      title,
      finding_type,
      location,
      priority,
      status,
      image_url,
      vendor_response,
      vendor_evidence_url,
      created_at
    `)
    .eq('target_vendor', vendorOrgId)
```

After:

```ts
    .select(`
      id,
      title,
      finding_type,
      location,
      priority,
      status,
      image_url,
      vendor_response,
      vendor_evidence_url,
      created_at,
      inspection_photos ( id, image_url )
    `)
    .eq('target_vendor', vendorOrgId)
```

- [ ] **Step 4: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/inspection/actions.ts app/vendor/dashboard/inspection/actions.ts
git commit -m "Support multi-photo inspection reports in server actions"
```

---

### Task 7: Shared lightbox + internal inspection UI (multi-upload, Audit/Kunjungan, gallery)

**Files:**
- Create: `components/photo-gallery-lightbox.tsx`
- Modify: `app/dashboard/inspection/page.tsx`

**Interfaces:**
- Produces: `<PhotoGalleryLightbox photos={string[]} initialIndex={number} onClose={() => void} />` — reused as-is by Task 8's vendor inspection page.
- Consumes: `createInspection` now expecting repeated `image_urls` form fields (Task 6); `inspection_photos` array on each row from `getInspections()` (Task 6).

- [ ] **Step 1: Write the shared lightbox component**

```tsx
// components/photo-gallery-lightbox.tsx
'use client';

import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export function PhotoGalleryLightbox({
  photos,
  initialIndex = 0,
  onClose,
}: {
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);

  if (photos.length === 0) return null;

  const goPrev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const goNext = () => setIndex((i) => (i + 1) % photos.length);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-200">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        aria-label="Tutup"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="relative w-full max-w-3xl max-h-[85vh] flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[index]} alt={`Foto ${index + 1} dari ${photos.length}`} className="max-w-full max-h-[85vh] object-contain rounded-xl" />

        {photos.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Sebelumnya"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Berikutnya"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-xs font-medium">
              {index + 1} / {photos.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the "Audit / Kunjungan" dropdown option**

In `app/dashboard/inspection/page.tsx`, the `finding_type` select. Before:

```html
                    <select name="finding_type" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm">
                      <option value="Unsafe Condition">Unsafe Condition (Kondisi Tidak Aman)</option>
                      <option value="Unsafe Act">Unsafe Act (Tindakan Tidak Aman)</option>
                      <option value="Near Miss">Near Miss (Hampir Celaka)</option>
                    </select>
```

After:

```html
                    <select name="finding_type" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm">
                      <option value="Unsafe Condition">Unsafe Condition (Kondisi Tidak Aman)</option>
                      <option value="Unsafe Act">Unsafe Act (Tindakan Tidak Aman)</option>
                      <option value="Near Miss">Near Miss (Hampir Celaka)</option>
                      <option value="Audit / Kunjungan">Audit / Kunjungan (Temuan Pasca-Kunjungan)</option>
                    </select>
```

- [ ] **Step 3: Switch the upload field from single-file to multi-file**

Add the import for the new lightbox component and swap `imageFile` state for `imageFiles`. Before (imports + state):

```ts
import { getInspections, getVendorsAndProjects, createInspection, delegateInspection, getInspectionLogs, validateInspection } from './actions';
import { uploadImage } from '@/utils/supabase/storage';
```
```ts
  const [imageFile, setImageFile] = useState<File | null>(null);
```

After:

```ts
import { getInspections, getVendorsAndProjects, createInspection, delegateInspection, getInspectionLogs, validateInspection } from './actions';
import { uploadImage } from '@/utils/supabase/storage';
import { PhotoGalleryLightbox } from '@/components/photo-gallery-lightbox';
```
```ts
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [galleryPhotos, setGalleryPhotos] = useState<string[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
```

- [ ] **Step 4: Update `loadData()`'s row mapping to carry the photo list**

Before:

```ts
    const formatted = data.map((d: any) => ({
      id: d.id,
      type: d.finding_type,
      description: d.title,
      location: d.location,
      vendor: d.vendor_profiles?.company_name || 'Non-Vendor / Internal',
      date: new Date(d.created_at).toLocaleString('id-ID'),
      status: d.status,
      priority: d.priority,
      image: d.image_url || 'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=500&q=80',
      assigned_to: d.internal_profiles?.profiles?.full_name || 'Belum di-assign',
      is_project_activity: d.is_project_activity,
      vendor_response: d.vendor_response,
      vendor_evidence_url: d.vendor_evidence_url
    }));
```

After:

```ts
    const formatted = data.map((d: any) => {
      const photos = (d.inspection_photos || []).map((p: any) => p.image_url);
      return {
        id: d.id,
        type: d.finding_type,
        description: d.title,
        location: d.location,
        vendor: d.vendor_profiles?.company_name || 'Non-Vendor / Internal',
        date: new Date(d.created_at).toLocaleString('id-ID'),
        status: d.status,
        priority: d.priority,
        image: d.image_url || photos[0] || 'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=500&q=80',
        photos,
        assigned_to: d.internal_profiles?.profiles?.full_name || 'Belum di-assign',
        is_project_activity: d.is_project_activity,
        vendor_response: d.vendor_response,
        vendor_evidence_url: d.vendor_evidence_url
      };
    });
```

- [ ] **Step 5: Update `handleCreate` to upload every selected file**

Before:

```ts
    try {
      if (imageFile) {
        const imageUrl = await uploadImage(imageFile, 'inspections');
        if (imageUrl) formData.append('image_url', imageUrl);
      }

      await createInspection(formData);
      alert("Laporan hasil inspeksi berhasil dikirim!");
      setIsModalOpen(false);
      setImageFile(null);
      await loadData();
    } catch (err) {
```

After:

```ts
    try {
      for (const file of imageFiles) {
        const imageUrl = await uploadImage(file, 'inspections');
        if (imageUrl) formData.append('image_urls', imageUrl);
      }

      await createInspection(formData);
      alert("Laporan hasil inspeksi berhasil dikirim!");
      setIsModalOpen(false);
      setImageFiles([]);
      await loadData();
    } catch (err) {
```

- [ ] **Step 6: Replace the single-file upload field in the "Lapor Hasil Inspeksi" modal with a multi-file picker + preview grid**

Before:

```html
               <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Foto Temuan <span className="text-rose-500">*</span></label>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                  <div onClick={() => fileInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden">
                     {imageFile ? (
                       <img src={URL.createObjectURL(imageFile)} alt="Preview" className="w-full h-full object-cover" />
                     ) : (
                       <>
                         <UploadCloud className="w-6 h-6 mb-2" />
                         <span className="text-sm font-medium">Klik untuk upload foto temuan</span>
                         <span className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB</span>
                       </>
                     )}
                  </div>
               </div>
```

After:

```html
               <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Foto Temuan <span className="text-rose-500">*</span></label>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => setImageFiles((prev) => [...prev, ...Array.from(e.target.files || [])])} />
                  {imageFiles.length === 0 ? (
                    <div onClick={() => fileInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden">
                       <UploadCloud className="w-6 h-6 mb-2" />
                       <span className="text-sm font-medium">Klik untuk upload foto temuan (bisa lebih dari satu)</span>
                       <span className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB per foto</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {imageFiles.map((file, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={URL.createObjectURL(file)} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setImageFiles((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-1 right-1 p-1 bg-slate-900/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-primary/50 hover:text-primary transition-colors"
                      >
                        <UploadCloud className="w-5 h-5" />
                      </button>
                    </div>
                  )}
               </div>
```

- [ ] **Step 7: Add a photo-count badge + click-to-open on the card grid image**

Before:

```html
            {/* Image Placeholder */}
            <div className="h-48 bg-slate-100 relative overflow-hidden">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={item.image} alt={item.type} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
               <div className="absolute top-3 right-3 flex gap-2">
```

After:

```html
            {/* Image Placeholder */}
            <div
              className="h-48 bg-slate-100 relative overflow-hidden cursor-pointer"
              onClick={() => { if (item.photos.length > 0) { setGalleryPhotos(item.photos); setGalleryIndex(0); } }}
            >
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={item.image} alt={item.type} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
               {item.photos.length > 1 && (
                 <span className="absolute bottom-3 right-3 px-2 py-1 text-xs font-bold rounded-lg bg-slate-900/70 text-white backdrop-blur-sm">
                   +{item.photos.length - 1}
                 </span>
               )}
               <div className="absolute top-3 right-3 flex gap-2">
```

- [ ] **Step 8: Render the lightbox at the bottom of the component**

Right before the component's final closing `</div>\n  );\n}` (after the "Modal Log History" block), add:

```tsx
      {/* Lightbox Galeri Foto */}
      {galleryPhotos && (
        <PhotoGalleryLightbox
          photos={galleryPhotos}
          initialIndex={galleryIndex}
          onClose={() => setGalleryPhotos(null)}
        />
      )}

    </div>
  );
}
```

(replacing the previous bare `</div>\n  );\n}` ending.)

- [ ] **Step 9: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors.

- [ ] **Step 10: Commit**

```bash
git add components/photo-gallery-lightbox.tsx app/dashboard/inspection/page.tsx
git commit -m "Add multi-photo upload, gallery lightbox, and Audit/Kunjungan category to inspection reports"
```

---

### Task 8: Vendor inspection UI gallery display

**Files:**
- Modify: `app/vendor/dashboard/inspection/page.tsx`

**Interfaces:**
- Consumes: `PhotoGalleryLightbox` from `@/components/photo-gallery-lightbox` (Task 7); `inspection_photos` array on rows from `getVendorInspections()` (Task 6). This page stays read-only for report photos — it does not gain an upload control (the "Upload Foto Bukti" field on this page is `vendor_evidence_url`, explicitly out of scope, untouched).

- [ ] **Step 1: Add the import and gallery state**

Before:

```ts
import { Camera, AlertTriangle, CheckCircle, Clock, MapPin, UploadCloud, X, ArrowRight, Loader2, Inbox } from 'lucide-react';
import { getVendorInspections, submitVendorResponse } from './actions';
import { uploadImage } from '@/utils/supabase/storage';
```

After:

```ts
import { Camera, AlertTriangle, CheckCircle, Clock, MapPin, UploadCloud, X, ArrowRight, Loader2, Inbox } from 'lucide-react';
import { getVendorInspections, submitVendorResponse } from './actions';
import { uploadImage } from '@/utils/supabase/storage';
import { PhotoGalleryLightbox } from '@/components/photo-gallery-lightbox';
```

Add state near the existing `imageFile` state:

```ts
  const [galleryPhotos, setGalleryPhotos] = useState<string[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
```

- [ ] **Step 2: Update `loadData()`'s row mapping to carry the photo list**

Before:

```ts
    const formatted = data.map((d: any) => ({
      id: d.id,
      type: d.finding_type,
      description: d.title,
      location: d.location,
      date: new Date(d.created_at).toLocaleString('id-ID'),
      status: d.status,
      priority: d.priority,
      image: d.image_url || 'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=500&q=80',
      feedbackHSE: d.title,
    }));
```

After:

```ts
    const formatted = data.map((d: any) => {
      const photos = (d.inspection_photos || []).map((p: any) => p.image_url);
      return {
        id: d.id,
        type: d.finding_type,
        description: d.title,
        location: d.location,
        date: new Date(d.created_at).toLocaleString('id-ID'),
        status: d.status,
        priority: d.priority,
        image: d.image_url || photos[0] || 'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=500&q=80',
        photos,
        feedbackHSE: d.title,
      };
    });
```

- [ ] **Step 3: Add the badge + click-to-open on the card grid image**

Before:

```html
            {/* Image Placeholder */}
            <div className="h-48 bg-slate-100 relative overflow-hidden">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={item.image} alt={item.type} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
               <div className="absolute top-3 right-3 flex gap-2">
```

After:

```html
            {/* Image Placeholder */}
            <div
              className="h-48 bg-slate-100 relative overflow-hidden cursor-pointer"
              onClick={() => { if (item.photos.length > 0) { setGalleryPhotos(item.photos); setGalleryIndex(0); } }}
            >
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={item.image} alt={item.type} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
               {item.photos.length > 1 && (
                 <span className="absolute bottom-3 right-3 px-2 py-1 text-xs font-bold rounded-lg bg-slate-900/70 text-white backdrop-blur-sm">
                   +{item.photos.length - 1}
                 </span>
               )}
               <div className="absolute top-3 right-3 flex gap-2">
```

- [ ] **Step 4: Render the lightbox at the bottom of the component**

Before (the file's ending):

```tsx
      )}

    </div>
  );
}
```

After:

```tsx
      )}

      {/* Lightbox Galeri Foto */}
      {galleryPhotos && (
        <PhotoGalleryLightbox
          photos={galleryPhotos}
          initialIndex={galleryIndex}
          onClose={() => setGalleryPhotos(null)}
        />
      )}

    </div>
  );
}
```

(this is the closing of the "Modal Tindak Lanjut" conditional block right before the component's final return — there is exactly one such `)}\n\n    </div>\n  );\n}` at the end of the file.)

- [ ] **Step 5: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add app/vendor/dashboard/inspection/page.tsx
git commit -m "Show inspection photo gallery on vendor inspection page"
```

---

### Task 9: AGENTS.md documentation update

**Files:**
- Modify: `AGENTS.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Add a short note documenting both new modules**

In `AGENTS.md`, after the "## Two app realms in one Next.js app" section (right before "## Supabase schema changes are manual SQL files, not a migration runner"), add:

```markdown
## News/Pengumuman and multi-photo inspections (2026-09-30)
- `announcement` is a permission-driven module (`app/dashboard/master-data/role/constants.ts`) — `manage` is `allowedTypes: ['pgn']`, matching `manage_vendor`/`manage_role`. Content lives in `announcements` (`supabase/schema_announcements_and_audit_photos.sql`), management UI at `app/dashboard/master-data/announcement/`, and the carousel (`components/announcement-carousel.tsx`) renders on both `app/dashboard/page.tsx` and `app/vendor/dashboard/page.tsx` — home pages only, not every page.
- Inspeksi Temuan (`app/dashboard/inspection/`) gained a new `finding_type` value, "Audit / Kunjungan" (no schema change — the column is free-text), and multi-photo support for the **report** side via `inspection_photos` (same migration file). The vendor's fix-evidence photo (`inspections.vendor_evidence_url`) is still single-photo — unrelated to `inspection_photos`. `components/photo-gallery-lightbox.tsx` is shared by both the internal and vendor inspection pages.
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "Document announcement module and multi-photo inspections in AGENTS.md"
```

---

## Self-Review Notes

- **Spec coverage:** Bagian 1 (announcements table, permission module, management UI, carousel component, home-page wiring) → Tasks 1, 2, 3, 4, 5. Bagian 2 (dropdown option, inspection_photos table, actions, multi-upload UI, gallery, vendor read-only display, out-of-scope vendor_evidence_url) → Tasks 1, 6, 7, 8. Bagian 3 (schema file, sidebar, AGENTS.md, "tidak berubah" items) → Tasks 1, 2, 9. No spec section is without a task.
- **Placeholder scan:** no TBD/TODO; every step has literal code, not a description of code.
- **Type consistency:** `Announcement` type defined once in Task 3's `actions.ts`, imported (not redefined) by Task 4's UI and Task 5's carousel. `PhotoGalleryLightbox` props (`photos`, `initialIndex`, `onClose`) defined once in Task 7, reused identically in Task 8. `formData` key `image_urls` (plural) is consistent between Task 6 (reader) and Task 7 (writer). `inspection_photos ( id, image_url )` join shape is consistent between Task 6 (both `getInspections` and `getVendorInspections`) and Tasks 7/8 (`d.inspection_photos` mapping in both `loadData()` functions).
