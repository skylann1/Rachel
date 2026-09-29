# Gabungkan Portal PGSOL ke `/dashboard` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the standalone `/pgsol/*` realm — PGSOL users log in and work in the same `/dashboard` PGN uses, distinguished only by `roles.permissions`, matching how vendor/PGSOL/PGN were already meant to share `allPermissionModules`.

**Architecture:** Delete `app/pgsol/dashboard/*` outright; port its 3 genuinely-unique features (org-scoped staff list, PGSOL reviewer assignment, and — closing a defense-in-depth gap found during design — type-scoped role management) into `/dashboard/master-data/*`, gated by permissions that already exist. Merge `/pgsol/login` into `/auth/login` and collapse the middleware's `isPgn`/`isPgsol` branches into one. No schema change.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (Postgres + Auth), Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-29-pgsol-dashboard-merge-design.md`

## Global Constraints

- No test framework in this repo (`AGENTS.md`) — every task's verification is `npx tsc`/`npm run build`'s repo-specific equivalents below, not `pytest`/`jest`.
- `npm`/`npx` are not installed in this environment — only `node` is (`/c/nvm4w/nodejs/node`). Use exactly:
  - Typecheck: `node node_modules/typescript/bin/tsc --noEmit`
  - Lint one file: `node node_modules/eslint/bin/eslint.js <path>`
  - Build: `node node_modules/next/dist/bin/next build`
- Lint gate: no *new* ESLint findings in files this plan touches (repo-wide lint has ~19,466 pre-existing problems and was never clean — don't try to fix unrelated ones).
- No new `supabase/schema_*.sql` file — this plan is pure application code.
- Every deleted/moved route must have no remaining internal link pointing at its old `/pgsol/dashboard/...` or `/pgsol/login` path (checked explicitly in Task 7).
- Indonesian comments/copy, matching the rest of the codebase.

---

## File Structure

**New:**
- `app/dashboard/master-data/project-pgsol-assign/layout.tsx` — permission gate
- `app/dashboard/master-data/project-pgsol-assign/actions.ts` — `getPgsolProjects`, `savePgsolAssignment`
- `app/dashboard/master-data/project-pgsol-assign/page.tsx` — project list ("Kelola Reviewer PGSOL")
- `app/dashboard/master-data/project-pgsol-assign/[id]/page.tsx` — 6-slot assignment screen
- `app/dashboard/master-data/project-pgsol-assign/[id]/AssignPgsolPanel.tsx` — checkbox panel (ported verbatim)

**Modified:**
- `app/dashboard/master-data/account/page.tsx` — accept `manage_org_staff`, scope query by org/type
- `app/dashboard/master-data/account/actions.ts` — drop dead `/pgsol/dashboard/staff` revalidations
- `app/dashboard/master-data/role/actions.ts` — type-scoped `requireRoleAccess()`
- `app/dashboard/master-data/role/[id]/actions.ts` — same scoping in `updateRolePermissions`
- `app/dashboard/master-data/role/page.tsx` — type-scoped role listing
- `components/internal/sidebar-nav.tsx` — 2 new nav entries + href de-dup
- `app/auth/login/actions.ts` — accept `type === 'pgsol'`
- `app/pgsol/login/page.tsx` — rewritten to a thin redirect stub
- `utils/supabase/middleware.ts` — merge `isPgn`/`isPgsol` handling
- `lib/stage-assignments.ts` — one stale path comment
- `AGENTS.md` — "Three app realms" → "Two app realms"

**Deleted (Task 7, all at once):**
- `app/pgsol/dashboard/**` (17 files: layout, page, profile, projects/*, role/**, staff)
- `app/pgsol/login/actions.ts`

---

### Task 1: Scope Manajemen Akun for org-scoped staff (`manage_org_staff`)

**Files:**
- Modify: `app/dashboard/master-data/account/page.tsx`
- Modify: `app/dashboard/master-data/account/actions.ts`

**Interfaces:**
- Consumes: `hasPermission(module, action): Promise<boolean>` (`utils/permissions.ts`), `AccountTable` props (`components/org/AccountTable.tsx`) — unchanged shape: `{ accounts, roles, page, totalPages, totalItems, offset, limit, search, role, status, basePath, title, subtitle, lockedType? }`.
- Produces: nothing new consumed elsewhere — this task only changes what data reaches the existing `AccountTable`.

- [ ] **Step 1: Rewrite `app/dashboard/master-data/account/page.tsx`**

Replace the entire file with:

```tsx
import { createClient } from '@/utils/supabase/server';
import { hasPermission } from '@/utils/permissions';
import { redirect } from 'next/navigation';
import { AccountTable } from '@/components/org/AccountTable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AccountManagementPage(props: { searchParams?: Promise<{ page?: string, search?: string, role?: string, status?: string }> }) {
  // `view_account` (superadmin PGN, lintas organisasi) ATAU
  // `manage_org_staff` (admin PGSOL/vendor, org sendiri saja) — pola yang
  // sama dengan requireAccountAccess() di actions.ts. Tanpa opsi kedua,
  // halaman ini tetap tertutup buat admin PGSOL/vendor walau mutasinya
  // (addAccount dkk) sudah scope-aware sejak Fase Task 8 (org foundation).
  const crossOrg = await hasPermission('masterData', 'view_account');
  const orgScoped = crossOrg || await hasPermission('masterData', 'manage_org_staff');
  if (!orgScoped) {
    redirect('/dashboard');
  }

  const searchParams = await props.searchParams;
  const page = parseInt(searchParams?.page || '1');
  const search = searchParams?.search || '';
  const role = searchParams?.role || '';
  const status = searchParams?.status || '';

  const limit = 5;
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  // Aktor org-scoped (bukan crossOrg) cuma boleh melihat staff & role dari
  // organisasi/tipe miliknya sendiri — org_id diambil dari profil aktor
  // sendiri, tidak pernah dari input klien. Mirrors assertSameOrg() di
  // actions.ts (dieksekusi lagi di sana pada tiap mutasi; di sini cuma
  // buat query listing).
  let actorOrgId: string | null = null;
  let actorType: string | null = null;
  if (!crossOrg) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: actorProfile } = await supabase.from('profiles').select('org_id, type').eq('id', user?.id).single();
    actorOrgId = actorProfile?.org_id ?? null;
    actorType = actorProfile?.type ?? null;

    // Fail closed: aktor org-scoped tanpa org_id (profil rusak / belum
    // ditautkan) tidak boleh melihat siapa pun, bukan malah lihat semua.
    if (!actorOrgId) {
      return (
        <AccountTable
          accounts={[]}
          roles={[]}
          page={1}
          totalPages={0}
          totalItems={0}
          offset={0}
          limit={limit}
          search={search}
          role={role}
          status={status}
          basePath="/dashboard/master-data/account"
          title="Staff Organisasi"
          subtitle="Organisasi Anda belum tertaut. Hubungi administrator."
        />
      );
    }
  }

  // Fetch Roles — org-scoped aktor cuma lihat role dari tipe organisasinya
  // sendiri, sama seperti dropdown filter yang sebelumnya di halaman
  // /pgsol/dashboard/staff. `type` kolom teks (bukan uuid), jadi sentinel
  // '__none__' aman dipakai kalau actorType entah kenapa kosong — hasilnya
  // nol baris, bukan error tipe.
  let rolesQuery = supabase.from('roles').select('name, is_system, type').order('name');
  if (!crossOrg) {
    rolesQuery = rolesQuery.eq('type', actorType ?? '__none__');
  }
  const { data: roles, error: rolesError } = await rolesQuery;
  if (rolesError) console.error('Gagal memuat daftar role:', rolesError.message);
  const availableRoles = roles || [];

  // Nama perusahaan sekarang dibaca dari `organizations` lewat
  // `profiles.org_id`, bukan lagi dari embed `vendor_profiles` — FK
  // vendor_profiles.id -> profiles.id sudah dilepas (lihat
  // schema_org_backfill_vendor.sql), jadi PostgREST tidak bisa lagi
  // menyimpulkan relasi profiles <-> vendor_profiles.
  let query = supabase.from('profiles').select(`
    *,
    organizations(name),
    internal_profiles(nip)
  `, { count: 'exact' });

  if (!crossOrg) {
    query = query.eq('org_id', actorOrgId as string);
  }
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }
  if (role) {
    query = query.eq('role', role);
  }
  if (status) {
    if (status === 'active') {
      query = query.eq('status', 'Active');
    } else if (status === 'inactive') {
      query = query.eq('status', 'Inactive');
    }
  }

  const { data: profiles, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const totalItems = count || 0;
  const totalPages = Math.ceil(totalItems / limit);

  const accounts = profiles ? profiles.map(p => ({
    id: p.id,
    name: p.full_name,
    email: p.email || 'Menunggu Sinkronisasi',
    role: p.role,
    type: p.type,
    verified: !!p.email_confirmed_at,
    status: p.status || 'Active',
    companyName: (Array.isArray(p.organizations) ? p.organizations[0]?.name : p.organizations?.name) || null,
    nip: Array.isArray(p.internal_profiles) ? p.internal_profiles[0]?.nip : p.internal_profiles?.nip || null,
    lastLogin: p.last_sign_in_at
      ? new Date(p.last_sign_in_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Belum Pernah Login',
    registeredAt: new Date(p.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })
  })) : [];

  return (
    <AccountTable
      accounts={accounts}
      roles={availableRoles}
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      offset={offset}
      limit={limit}
      search={search}
      role={role}
      status={status}
      basePath="/dashboard/master-data/account"
      title={crossOrg ? "Manajemen Akun" : "Staff Organisasi"}
      subtitle={crossOrg ? "Kelola data pengguna, peran, dan akses sistem." : "Kelola akun staff di organisasi Anda."}
      lockedType={crossOrg ? undefined : (actorType as 'pgn' | 'pgsol' | 'vendor' | undefined)}
    />
  );
}
```

- [ ] **Step 2: Remove dead revalidations in `app/dashboard/master-data/account/actions.ts`**

Find and delete every line reading exactly:
```ts
    revalidatePath('/pgsol/dashboard/staff');
```
There are 5 occurrences (in `addAccount`, `updateAccount`, `suspendAccount`, `resetAccountPassword`, `deleteAccount`). Leave the neighboring `revalidatePath('/dashboard/master-data/account');` and `revalidatePath('/vendor/dashboard/staff');` lines untouched — the account list now lives at `/dashboard/master-data/account` for every actor type, so that revalidation alone covers PGSOL too.

- [ ] **Step 3: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors in `app/dashboard/master-data/account/page.tsx` or `actions.ts` (pre-existing unrelated errors elsewhere, if any, are not this task's concern — note them but don't fix).

- [ ] **Step 4: Lint the two changed files**

Run: `node node_modules/eslint/bin/eslint.js app/dashboard/master-data/account/page.tsx app/dashboard/master-data/account/actions.ts`
Expected: no new findings beyond whatever the pre-change files already had (compare against `git stash`/`git diff` if unsure).

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/master-data/account/page.tsx app/dashboard/master-data/account/actions.ts
git commit -m "Scope Manajemen Akun page for org-scoped staff (manage_org_staff)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SsSyQQDH1zxAa83LEHmurV"
```

---

### Task 2: Close Gap #3 — type-scope Role & Permission management

**Files:**
- Modify: `app/dashboard/master-data/role/actions.ts`
- Modify: `app/dashboard/master-data/role/[id]/actions.ts`
- Modify: `app/dashboard/master-data/role/page.tsx`

**Interfaces:**
- Consumes: `hasPermissionForUser(supabase, userId, module, action): Promise<boolean>`, `createAdminClient()`, `createClient()` (all existing, unchanged).
- Produces: nothing new consumed by later tasks — self-contained defense-in-depth. Behaviorally inert today (no role of type `pgsol`/`vendor` currently holds `manage_role`), verified in Step 5.

- [ ] **Step 1: Rewrite `app/dashboard/master-data/role/actions.ts`**

Replace the entire file with:

```ts
'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { revalidatePath } from 'next/cache';

interface RoleActor {
  userId: string;
  type: string | null; // tipe organisasi aktor sendiri ('pgn' | 'pgsol' | 'vendor')
  crossOrg: boolean; // true kalau aktor bertipe 'pgn' — boleh kelola role tipe apa pun
}

/**
 * Gate + konteks tunggal untuk semua aksi kelola role di file ini, pola
 * yang sama dengan requireAccountAccess() di
 * app/dashboard/master-data/account/actions.ts.
 *
 * `crossOrg` ditentukan dari TIPE AKTOR SENDIRI (`profiles.type === 'pgn'`),
 * bukan cuma dari permission `manage_role` yang dipegangnya. Kenapa: item
 * `manage_role` di allPermissionModules sudah dideklarasikan
 * `allowedTypes: ['pgn']`, tapi itu cuma menyaring checkbox mana yang
 * MUNCUL di UI RolePermissionsClient — tidak ada apa pun di level server
 * yang pernah menegakkan aturan itu. Kalau suatu saat role non-PGN diberi
 * `manage_role` lewat SQL langsung (di luar jalur UI), pemegangnya bisa
 * mengedit/menghapus role PGN atau vendor manapun lewat action yang sama
 * persis. Defense-in-depth ini menutup jalur itu di titik masuknya —
 * lihat docs/superpowers/specs/2026-09-29-pgsol-dashboard-merge-design.md,
 * "Gap #3".
 */
async function requireRoleAccess(): Promise<{ error: string | null; actor: RoleActor | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', actor: null };

  const allowed = await hasPermissionForUser(supabase, user.id, 'masterData', 'manage_role');
  if (!allowed) return { error: 'Anda tidak memiliki izin untuk mengelola role.', actor: null };

  const { data: profile } = await supabase.from('profiles').select('type').eq('id', user.id).single();
  const type = profile?.type ?? null;
  return { error: null, actor: { userId: user.id, type, crossOrg: type === 'pgn' } };
}

/** Menolak mutasi kalau role target bukan tipe aktor sendiri atau role sistem, kecuali aktor crossOrg. */
async function assertSameRoleType(adminAuthClient: ReturnType<typeof createAdminClient>, actor: RoleActor, roleId: string): Promise<string | null> {
  if (actor.crossOrg) return null;
  const { data: target } = await adminAuthClient.from('roles').select('type, is_system').eq('id', roleId).single();
  if (!target || target.type !== actor.type) {
    return 'Role ini bukan bagian dari organisasi Anda.';
  }
  if (target.is_system) {
    return 'Role sistem tidak dapat diubah dari halaman ini.';
  }
  return null;
}

export async function addRole(formData: FormData) {
  try {
    const { error: permError, actor } = await requireRoleAccess();
    if (permError || !actor) return { error: permError };

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    // Aktor org-scoped selalu dipaksa membuat role dengan tipe miliknya
    // sendiri, terlepas dari apa yang dikirim form — sejalan dengan
    // addAccount() di master-data/account/actions.ts.
    const type = actor.crossOrg ? (formData.get('type') as string) : (actor.type as string);

    if (!name || !type) {
      return { error: 'Nama Role dan Tipe Role wajib diisi.' };
    }

    const adminClient = createAdminClient();

    // Default permissions are empty for new roles
    const { error } = await adminClient
      .from('roles')
      .insert({
        name: name.toLowerCase().replace(/\s+/g, '_'), // Normalize name to lower snake_case
        description: description,
        type: type,
        is_system: false, // User created roles are never system roles
        permissions: {}
      });

    if (error) {
      if (error.code === '23505') {
        return { error: 'Role dengan nama tersebut sudah ada.' };
      }
      return { error: error.message || 'Gagal menambahkan role.' };
    }

    revalidatePath('/dashboard/master-data/role');
    revalidatePath('/dashboard/master-data/account');
    return { success: true };
  } catch (error: any) {
    return { error: 'Terjadi kesalahan pada server saat menambahkan role.' };
  }
}

export async function updateRole(id: string, formData: FormData) {
  try {
    const { error: permError, actor } = await requireRoleAccess();
    if (permError || !actor) return { error: permError };

    const adminClient = createAdminClient();
    const typeError = await assertSameRoleType(adminClient, actor, id);
    if (typeError) return { error: typeError };

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    // Aktor org-scoped tidak boleh memindahkan role ke tipe lain — paksa
    // tetap tipe miliknya sendiri, sama seperti addRole di atas.
    const type = actor.crossOrg ? (formData.get('type') as string) : (actor.type as string);

    if (!name || !type) {
      return { error: 'Nama Role dan Tipe Role wajib diisi.' };
    }

    const { error } = await adminClient
      .from('roles')
      .update({
        name: name.toLowerCase().replace(/\s+/g, '_'),
        description: description,
        type: type,
      })
      .eq('id', id);

    if (error) {
      if (error.code === '23505') {
        return { error: 'Role dengan nama tersebut sudah ada.' };
      }
      return { error: error.message || 'Gagal mengubah role.' };
    }

    revalidatePath('/dashboard/master-data/role');
    revalidatePath('/dashboard/master-data/account');
    return { success: true };
  } catch (error: any) {
    return { error: 'Terjadi kesalahan pada server saat mengubah role.' };
  }
}

export async function deleteRole(id: string) {
  try {
    const { error: permError, actor } = await requireRoleAccess();
    if (permError || !actor) return { error: permError };

    const adminClient = createAdminClient();
    const typeError = await assertSameRoleType(adminClient, actor, id);
    if (typeError) return { error: typeError };

    // Pastikan tidak ada profil yang menggunakan role ini
    const { error } = await adminClient
      .from('roles')
      .delete()
      .eq('id', id)
      .eq('is_system', false); // Hanya role non-system yang bisa dihapus

    if (error) {
      if (error.code === '23503') {
         return { error: 'Role tidak dapat dihapus karena sedang digunakan oleh pengguna.' };
      }
      return { error: error.message || 'Gagal menghapus role.' };
    }

    revalidatePath('/dashboard/master-data/role');
    revalidatePath('/dashboard/master-data/account');
    return { success: true };
  } catch (error: any) {
    return { error: 'Terjadi kesalahan pada server saat menghapus role.' };
  }
}
```

- [ ] **Step 2: Rewrite `app/dashboard/master-data/role/[id]/actions.ts`**

Replace the entire file with:

```ts
'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';

export async function updateRolePermissions(
  id: string,
  name: string,
  description: string,
  type: string,
  permissions: Record<string, string[]>
) {
  try {
    // Tanpa gate ini siapa pun bisa memanggil action ini dan memberi role-nya
    // sendiri permission penuh — kolom roles.permissions inilah yang dibaca
    // hasPermissionForUser, jadi ini jalur privilege escalation langsung.
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return { error: 'Unauthorized' };
    const allowed = await hasPermissionForUser(authClient, user.id, 'masterData', 'manage_role');
    if (!allowed) return { error: 'Anda tidak memiliki izin untuk mengelola role.' };

    const { data: actorProfile } = await authClient.from('profiles').select('type').eq('id', user.id).single();
    const crossOrg = actorProfile?.type === 'pgn';

    const supabase = createAdminClient();

    // Sama seperti requireRoleAccess()/assertSameRoleType() di
    // ../actions.ts: aktor org-scoped (bukan crossOrg) cuma boleh mengubah
    // role dengan tipe & is_system yang sama dengan organisasinya sendiri,
    // dan tidak boleh memindahkan role ke tipe lain.
    if (!crossOrg) {
      const { data: target } = await supabase.from('roles').select('type, is_system').eq('id', id).single();
      if (!target || target.type !== actorProfile?.type) {
        return { error: 'Role ini bukan bagian dari organisasi Anda.' };
      }
      if (target.is_system) {
        return { error: 'Role sistem tidak dapat diubah dari halaman ini.' };
      }
      if (type !== target.type) {
        return { error: 'Role ini tidak dapat dipindahkan ke tipe lain.' };
      }
    }

    const { error } = await supabase
      .from('roles')
      .update({
        name,
        description,
        type,
        permissions
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating role:', error);
      return { error: 'Gagal memperbarui konfigurasi role.' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return { error: 'Terjadi kesalahan sistem.' };
  }
}
```

- [ ] **Step 3: Scope the role list query in `app/dashboard/master-data/role/page.tsx`**

Find this block (near the top of the `fetchData` function, currently lines 21-27):

```tsx
  const fetchData = async () => {
    setLoading(true);
    // Fetch roles
    const { data: rolesData } = await supabase.from('roles').select('*').order('created_at');
    
    // Fetch profile counts
    const { data: profilesData } = await supabase.from('profiles').select('role');
```

Replace it with:

```tsx
  const fetchData = async () => {
    setLoading(true);

    // Role & Permission ini cuma boleh diakses lewat permission manage_role
    // (dicek server-side di role/layout.tsx). Hari ini `manage_role` cuma
    // pernah dipegang role bertipe 'pgn' (lihat requireRoleAccess() di
    // ./actions.ts) — filter tipe di sini defense-in-depth kalau itu
    // berubah nanti: aktor non-PGN cuma lihat role dari tipe organisasinya
    // sendiri.
    const { data: { user } } = await supabase.auth.getUser();
    const { data: actorProfile } = await supabase.from('profiles').select('type').eq('id', user?.id).single();
    const actorType = actorProfile?.type ?? null;
    const crossOrg = actorType === 'pgn';

    // Fetch roles
    let rolesQuery = supabase.from('roles').select('*').order('created_at');
    if (!crossOrg) {
      rolesQuery = rolesQuery.eq('type', actorType ?? '__none__');
    }
    const { data: rolesData } = await rolesQuery;
    
    // Fetch profile counts
    const { data: profilesData } = await supabase.from('profiles').select('role');
```

Everything below this point in the function (the `if (rolesData) {...}` block onward) stays exactly as-is.

- [ ] **Step 4: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors in the 3 changed files.

- [ ] **Step 5: Manual inert-behavior check**

Since no role of type `pgsol`/`vendor` currently holds `manage_role`, this task must produce **zero visible change** for every real account today. Confirm by reading the current permissions of any role with `manage_role` — it should still be `type: 'pgn'` (already confirmed for `admin` during brainstorming; if the implementer finds a non-`pgn` role with `manage_role` at this point, stop and flag it — that role's admin will suddenly lose cross-type visibility, which is the intended fix but should be called out, not silently shipped).

- [ ] **Step 6: Lint the three changed files**

Run: `node node_modules/eslint/bin/eslint.js app/dashboard/master-data/role/actions.ts "app/dashboard/master-data/role/[id]/actions.ts" app/dashboard/master-data/role/page.tsx`
Expected: no new findings.

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/master-data/role/actions.ts "app/dashboard/master-data/role/[id]/actions.ts" app/dashboard/master-data/role/page.tsx
git commit -m "Close Gap #3: type-scope Role & Permission management

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SsSyQQDH1zxAa83LEHmurV"
```

---

### Task 3: Port "Kelola Reviewer PGSOL" to `/dashboard/master-data/project-pgsol-assign`

**Files:**
- Create: `app/dashboard/master-data/project-pgsol-assign/layout.tsx`
- Create: `app/dashboard/master-data/project-pgsol-assign/actions.ts`
- Create: `app/dashboard/master-data/project-pgsol-assign/page.tsx`
- Create: `app/dashboard/master-data/project-pgsol-assign/[id]/page.tsx`
- Create: `app/dashboard/master-data/project-pgsol-assign/[id]/AssignPgsolPanel.tsx`
- Modify: `lib/stage-assignments.ts:5` (stale path comment)

**Interfaces:**
- Consumes: `getStageAssignments(supabase, projectId, docType, stageKey)`, `getEligibleAssignees(supabase, module, action, orgId)`, `writeStageAssignment(supabase, userId, {projectId, docType, stageKey, assigneeIds})`, `PGSOL_STAGE_KEYS` — all exported from `lib/stage-assignments.ts`, unchanged.
- Produces: `getPgsolProjects(): Promise<Project[]>` and `savePgsolAssignment(projectId, docType, stageKey, assigneeIds): Promise<{error?: string; success?: true}>` from this task's own `actions.ts` — consumed by `page.tsx` and `AssignPgsolPanel.tsx` in this same task, and by Task 4's nav link (`href` only, no import).

- [ ] **Step 1: Create `app/dashboard/master-data/project-pgsol-assign/layout.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { hasPermission } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

export default async function ProjectPgsolAssignLayout({ children }: { children: React.ReactNode }) {
  // Gerbang tunggal untuk seluruh subtree ini — pola yang sama dengan
  // app/dashboard/master-data/project/layout.tsx (yang menggerbangi
  // manage_project). manage_assignment_pgsol allowedTypes: ['pgsol']
  // sehingga entri nav ini otomatis tidak pernah nongol untuk admin PGN
  // (lihat SidebarNav), tapi gate server-side ini tetap wajib ada karena
  // URL bisa diakses langsung.
  const isAllowed = await hasPermission('jsa', 'manage_assignment_pgsol');
  if (!isAllowed) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Create `app/dashboard/master-data/project-pgsol-assign/actions.ts`**

```ts
'use server';

import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { writeStageAssignment, PGSOL_STAGE_KEYS } from '@/lib/stage-assignments';
import { revalidatePath } from 'next/cache';

export async function getPgsolProjects() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id, name, status, created_at,
      vendor_profiles ( company_name ),
      procedures ( id, status ),
      jsa ( id, status ),
      ptw ( id, status )
    `)
    .order('created_at', { ascending: false });
  if (error) { console.error('getPgsolProjects error:', error.message); return []; }
  // Proyek relevan buat PGSOL begitu punya Prosedur Kerja, JSA, ATAU PTW —
  // tahap PGSOL ada di ketiga jenis dokumen.
  return (data || []).filter((p: any) => {
    const procRows = Array.isArray(p.procedures) ? p.procedures : (p.procedures ? [p.procedures] : []);
    const jsaRows = Array.isArray(p.jsa) ? p.jsa : (p.jsa ? [p.jsa] : []);
    const ptwRows = Array.isArray(p.ptw) ? p.ptw : (p.ptw ? [p.ptw] : []);
    return procRows.length > 0 || jsaRows.length > 0 || ptwRows.length > 0;
  });
}

export async function savePgsolAssignment(
  projectId: string, docType: 'procedure' | 'jsa' | 'ptw', stageKey: string, assigneeIds: string[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // Satu permission menggerbangi kemampuan menugaskan reviewer PGSOL untuk
  // KETIGA doc_type (jsa, procedure & ptw) — sengaja tidak dipecah jadi
  // permission baru per doc_type supaya grant yang sudah ada di production
  // (Fase 2) tidak perlu dimigrasikan ulang.
  const allowed = await hasPermissionForUser(supabase, user.id, 'jsa', 'manage_assignment_pgsol');
  if (!allowed) return { error: 'Anda tidak memiliki izin untuk menunjuk reviewer PGSOL.' };

  if (!(PGSOL_STAGE_KEYS as readonly string[]).includes(stageKey)) {
    return { error: 'Tahap ini tidak dikenali.' };
  }

  // Permission saja tidak cukup: role `admin` (PGN) mendapat SELURUH permission
  // lewat fullAccessPermissions(), jadi tanpa cek tipe org ini admin PGN bisa
  // ikut muncul sebagai kandidat reviewer PGSOL.
  const { data: actorProfile } = await supabase.from('profiles').select('type').eq('id', user.id).single();
  if (actorProfile?.type !== 'pgsol') return { error: 'Aksi ini hanya untuk admin PGSOL.' };

  const result = await writeStageAssignment(supabase, user.id, {
    projectId, docType, stageKey, assigneeIds,
  });
  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/master-data/project-pgsol-assign/${projectId}`);
  return { success: true };
}
```

- [ ] **Step 3: Create `app/dashboard/master-data/project-pgsol-assign/page.tsx`**

```tsx
import Link from 'next/link';
import { getPgsolProjects } from './actions';

export default async function ProjectPgsolAssignListPage() {
  const projects = await getPgsolProjects();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Kelola Reviewer PGSOL</h1>
        <p className="text-sm text-slate-500 mt-1">Kelola siapa yang mereview Prosedur Kerja, JSA, & PTW tahap PGSOL untuk tiap proyek.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Proyek</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor</th>
              <th className="relative px-6 py-4"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {projects.map((p: any) => {
              const vendor = Array.isArray(p.vendor_profiles) ? p.vendor_profiles[0] : p.vendor_profiles;
              return (
                <tr key={p.id} className="hover:bg-slate-50/80">
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">{p.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{vendor?.company_name || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/dashboard/master-data/project-pgsol-assign/${p.id}`} className="text-primary text-sm font-semibold hover:underline">
                      Kelola Reviewer
                    </Link>
                  </td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr><td colSpan={3} className="px-6 py-12 text-center text-sm text-slate-500">Belum ada proyek dengan Prosedur Kerja, JSA, atau PTW diajukan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `app/dashboard/master-data/project-pgsol-assign/[id]/page.tsx`**

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { hasPermission } from '@/utils/permissions';
import { getStageAssignments, getEligibleAssignees } from '@/lib/stage-assignments';
import AssignPgsolPanel from './AssignPgsolPanel';

export default async function ProjectPgsolAssignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  if (!(await hasPermission('jsa', 'manage_assignment_pgsol'))) redirect('/dashboard');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: actorProfile } = await supabase.from('profiles').select('org_id').eq('id', user?.id).single();
  if (!actorProfile?.org_id) redirect('/dashboard');

  const { data: project } = await supabase.from('projects').select('id, name').eq('id', projectId).single();
  const [
    procReviewCandidates, procReviewAssignments, procHseCandidates, procHseAssignments,
    jsaReviewCandidates, jsaReviewAssignments, jsaHseCandidates, jsaHseAssignments,
    ptwReviewCandidates, ptwReviewAssignments, ptwHseCandidates, ptwHseAssignments,
  ] = await Promise.all([
    getEligibleAssignees(supabase, 'procedure', 'review_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'procedure', 'procedure.review_pgsol'),
    getEligibleAssignees(supabase, 'procedure', 'hse_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'procedure', 'procedure.hse_pgsol'),
    getEligibleAssignees(supabase, 'jsa', 'review_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'jsa', 'jsa.review_pgsol'),
    getEligibleAssignees(supabase, 'jsa', 'hse_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'jsa', 'jsa.hse_pgsol'),
    getEligibleAssignees(supabase, 'ptw', 'review_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'ptw', 'ptw.review_pgsol'),
    getEligibleAssignees(supabase, 'ptw', 'hse_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'ptw', 'ptw.hse_pgsol'),
  ]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/master-data/project-pgsol-assign" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reviewer & HSE PGSOL — {project?.name}</h1>
          <p className="text-sm text-slate-500 mt-1">Reviewer dan HSE adalah dua tahap berurutan — semua yang ditunjuk di satu tahap harus menyetujui sebelum dokumen lanjut.</p>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">Prosedur Kerja</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Reviewer</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="procedure"
              stageKey="procedure.review_pgsol"
              candidates={procReviewCandidates}
              currentAssigneeIds={procReviewAssignments.map(a => a.assignee_id)}
              locked={procReviewAssignments.some(a => a.status !== 'pending')}
            />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">HSE</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="procedure"
              stageKey="procedure.hse_pgsol"
              candidates={procHseCandidates}
              currentAssigneeIds={procHseAssignments.map(a => a.assignee_id)}
              locked={procHseAssignments.some(a => a.status !== 'pending')}
            />
          </div>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">JSA</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Reviewer</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="jsa"
              stageKey="jsa.review_pgsol"
              candidates={jsaReviewCandidates}
              currentAssigneeIds={jsaReviewAssignments.map(a => a.assignee_id)}
              locked={jsaReviewAssignments.some(a => a.status !== 'pending')}
            />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">HSE</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="jsa"
              stageKey="jsa.hse_pgsol"
              candidates={jsaHseCandidates}
              currentAssigneeIds={jsaHseAssignments.map(a => a.assignee_id)}
              locked={jsaHseAssignments.some(a => a.status !== 'pending')}
            />
          </div>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">PTW (Permit to Work)</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Reviewer</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="ptw"
              stageKey="ptw.review_pgsol"
              candidates={ptwReviewCandidates}
              currentAssigneeIds={ptwReviewAssignments.map(a => a.assignee_id)}
              locked={ptwReviewAssignments.some(a => a.status !== 'pending')}
            />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">HSE</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="ptw"
              stageKey="ptw.hse_pgsol"
              candidates={ptwHseCandidates}
              currentAssigneeIds={ptwHseAssignments.map(a => a.assignee_id)}
              locked={ptwHseAssignments.some(a => a.status !== 'pending')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `app/dashboard/master-data/project-pgsol-assign/[id]/AssignPgsolPanel.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { savePgsolAssignment } from '../actions';

interface Candidate { id: string; full_name: string; }

export default function AssignPgsolPanel({
  projectId, docType, stageKey, candidates, currentAssigneeIds, locked,
}: {
  projectId: string; docType: 'procedure' | 'jsa' | 'ptw'; stageKey: string;
  candidates: Candidate[]; currentAssigneeIds: string[]; locked: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(currentAssigneeIds);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await savePgsolAssignment(projectId, docType, stageKey, selected);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
      {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>}
      {locked && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          Tahap ini sedang diproses — assignment terkunci sampai ditolak/diajukan ulang.
        </div>
      )}
      <div className="space-y-2">
        {candidates.length === 0 && <p className="text-sm text-slate-400">Tidak ada staff PGSOL dengan izin review tahap ini.</p>}
        {candidates.map(c => (
          <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              disabled={locked}
              checked={selected.includes(c.id)}
              onChange={(e) => setSelected(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))}
            />
            {c.full_name}
          </label>
        ))}
      </div>
      {!locked && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : null}
          Simpan
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Fix the stale path comment in `lib/stage-assignments.ts`**

Find line 5 (a comment): `// app/pgsol/dashboard/projects/actions.ts) maupun oleh actions approval`
Replace `app/pgsol/dashboard/projects/actions.ts` with `app/dashboard/master-data/project-pgsol-assign/actions.ts` in that comment line (keep the rest of the sentence/comment unchanged).

- [ ] **Step 7: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors in the new `project-pgsol-assign/**` files or in `lib/stage-assignments.ts`.

- [ ] **Step 8: Lint the new files**

Run: `node node_modules/eslint/bin/eslint.js app/dashboard/master-data/project-pgsol-assign/layout.tsx app/dashboard/master-data/project-pgsol-assign/actions.ts app/dashboard/master-data/project-pgsol-assign/page.tsx "app/dashboard/master-data/project-pgsol-assign/[id]/page.tsx" "app/dashboard/master-data/project-pgsol-assign/[id]/AssignPgsolPanel.tsx" lib/stage-assignments.ts`
Expected: no new findings.

- [ ] **Step 9: Commit**

```bash
git add app/dashboard/master-data/project-pgsol-assign lib/stage-assignments.ts
git commit -m "Port Kelola Reviewer PGSOL to /dashboard/master-data/project-pgsol-assign

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SsSyQQDH1zxAa83LEHmurV"
```

---

### Task 4: Add PGSOL nav entries to the shared sidebar

**Files:**
- Modify: `components/internal/sidebar-nav.tsx`

**Interfaces:**
- Consumes: `hasAccess(module, action)` (existing local helper in this file, unchanged), the route created in Task 3 (`/dashboard/master-data/project-pgsol-assign`) and the existing `/dashboard/master-data/account` route (now scoping-aware since Task 1).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Add two entries to the `masterData` array and de-dup by href in the filter**

Find:

```tsx
const masterData = [
  { name: 'Manajemen Akun', href: '/dashboard/master-data/account', icon: Users, permission: { module: 'masterData', action: 'view_account' } },
  { name: 'Role & Permission', href: '/dashboard/master-data/role', icon: Shield, permission: { module: 'masterData', action: 'manage_role' } },
  { name: 'Data Vendor', href: '/dashboard/master-data/vendor', icon: Building2, permission: { module: 'masterData', action: 'view_vendor' } },
  { name: 'Data Proyek', href: '/dashboard/master-data/project', icon: Briefcase, permission: { module: 'masterData', action: 'view_project' } },
];
```

Replace with:

```tsx
const masterData = [
  { name: 'Manajemen Akun', href: '/dashboard/master-data/account', icon: Users, permission: { module: 'masterData', action: 'view_account' } },
  // Href sama dengan "Manajemen Akun" di atas — halaman itu sendiri
  // membedakan tampilan lewat crossOrg (lihat
  // app/dashboard/master-data/account/page.tsx). De-dup di filter di
  // bawah mencegah dua entri identik kalau satu aktor kebetulan punya
  // kedua permission.
  { name: 'Staff Organisasi', href: '/dashboard/master-data/account', icon: Users, permission: { module: 'masterData', action: 'manage_org_staff' } },
  { name: 'Kelola Reviewer PGSOL', href: '/dashboard/master-data/project-pgsol-assign', icon: Users, permission: { module: 'jsa', action: 'manage_assignment_pgsol' } },
  { name: 'Role & Permission', href: '/dashboard/master-data/role', icon: Shield, permission: { module: 'masterData', action: 'manage_role' } },
  { name: 'Data Vendor', href: '/dashboard/master-data/vendor', icon: Building2, permission: { module: 'masterData', action: 'view_vendor' } },
  { name: 'Data Proyek', href: '/dashboard/master-data/project', icon: Briefcase, permission: { module: 'masterData', action: 'view_project' } },
];
```

Then find:

```tsx
  const filteredMenuUtama = menuUtama.filter(item => hasAccess(item.permission.module, item.permission.action));
  const filteredMasterData = masterData.filter(item => hasAccess(item.permission.module, item.permission.action));
```

Replace with:

```tsx
  const filteredMenuUtama = menuUtama.filter(item => hasAccess(item.permission.module, item.permission.action));
  const filteredMasterData = masterData
    .filter(item => hasAccess(item.permission.module, item.permission.action))
    // Manajemen Akun dan Staff Organisasi mengarah ke href yang sama —
    // hindari dua entri nav identik kalau satu aktor kebetulan punya
    // kedua permission (keeps the first match, i.e. "Manajemen Akun").
    .filter((item, idx, arr) => arr.findIndex(i => i.href === item.href) === idx);
```

- [ ] **Step 2: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors in `components/internal/sidebar-nav.tsx`.

- [ ] **Step 3: Lint**

Run: `node node_modules/eslint/bin/eslint.js components/internal/sidebar-nav.tsx`
Expected: no new findings.

- [ ] **Step 4: Commit**

```bash
git add components/internal/sidebar-nav.tsx
git commit -m "Add PGSOL nav entries (Staff Organisasi, Kelola Reviewer PGSOL) to shared sidebar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SsSyQQDH1zxAa83LEHmurV"
```

---

### Task 5: Merge login — `/auth/login` accepts PGSOL, `/pgsol/login` becomes a redirect stub

**Files:**
- Modify: `app/auth/login/actions.ts`
- Modify: `app/pgsol/login/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed elsewhere. `app/pgsol/login/actions.ts` (the old `login`/`logout` exports) becomes unused by `page.tsx` after this task but is **not deleted yet** — `app/pgsol/dashboard/layout.tsx` still imports `logout` from it, and that file isn't deleted until Task 7. Deleting `actions.ts` in this task would break the typecheck.

- [ ] **Step 1: Widen the type gate in `app/auth/login/actions.ts`**

Find:

```ts
  if (profile?.type !== 'pgn') {
    // Kalau bukan pgn, sign out paksa dan tolak
    await supabase.auth.signOut();
    const debugMsg = `Data profil: ${JSON.stringify(profile) || 'Kosong'}. Error: ${profileError?.message || 'Tidak ada error DB'}`;
    redirect(`/auth/login?error=Akses ditolak. ${debugMsg}`);
  }
```

Replace with:

```ts
  if (profile?.type !== 'pgn' && profile?.type !== 'pgsol') {
    // PGN dan PGSOL sekarang berbagi realm /dashboard yang sama, dibedakan
    // lewat roles.permissions — bukan lagi lewat portal/login terpisah
    // (docs/superpowers/specs/2026-09-29-pgsol-dashboard-merge-design.md).
    // Vendor tetap ditolak di sini (punya /vendor/login sendiri).
    await supabase.auth.signOut();
    const debugMsg = `Data profil: ${JSON.stringify(profile) || 'Kosong'}. Error: ${profileError?.message || 'Tidak ada error DB'}`;
    redirect(`/auth/login?error=Akses ditolak. ${debugMsg}`);
  }
```

Redirect-on-success stays `redirect("/dashboard")` — no change needed there, it already targets the shared realm.

- [ ] **Step 2: Rewrite `app/pgsol/login/page.tsx` as a thin redirect stub**

Replace the entire file with:

```tsx
import { redirect } from 'next/navigation';

// /pgsol/login dulu adalah pintu masuk terbrand realm PGSOL sendiri. PGSOL
// sekarang login lewat /auth/login yang sama dengan PGN — lihat
// docs/superpowers/specs/2026-09-29-pgsol-dashboard-merge-design.md.
// Halaman ini disisakan tipis (bukan dihapus) supaya bookmark/link lama
// tidak 404.
export default function PgsolLoginRedirect() {
  redirect('/auth/login');
}
```

- [ ] **Step 3: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors. `app/pgsol/login/actions.ts` still exists and is still imported by `app/pgsol/dashboard/layout.tsx`, so nothing should break — this task must NOT remove `app/pgsol/login/actions.ts`.

- [ ] **Step 4: Lint**

Run: `node node_modules/eslint/bin/eslint.js app/auth/login/actions.ts app/pgsol/login/page.tsx`
Expected: no new findings. (`app/pgsol/login/page.tsx` will show an "unused" style warning for nothing — it has no unused imports; fine.)

- [ ] **Step 5: Commit**

```bash
git add app/auth/login/actions.ts app/pgsol/login/page.tsx
git commit -m "Merge PGSOL login into /auth/login, turn /pgsol/login into a redirect stub

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SsSyQQDH1zxAa83LEHmurV"
```

---

### Task 6: Merge middleware — unify PGN/PGSOL handling

**Files:**
- Modify: `utils/supabase/middleware.ts`

**Interfaces:**
- Consumes: `isPgn`, `isPgsol`, `isVendor` from `lib/roles.ts` (unchanged).
- Produces: nothing consumed elsewhere — middleware is the outermost gate.

- [ ] **Step 1: Replace the entire file**

`utils/supabase/middleware.ts` currently has a separate `isPgsolPath`/`isPgsolLogin`/`isDashboardApprovalPath` carve-out for PGSOL. Since PGSOL now has full access to `/dashboard` (Tasks 1-5 already made every page it needs reachable there) and `/pgsol/*` no longer has any real pages except the `/pgsol/login` redirect stub from Task 5, this carve-out can be deleted outright and the `isPgsol(type)` branch merged into the `isPgn(type)` branch — both should now be treated identically. Unmatched paths like `/pgsol/dashboard/...` fall through to Next.js's normal 404 (no page.tsx exists there after Task 7) — acceptable per the design spec.

Replace the entire file with:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPgn, isPgsol, isVendor } from "@/lib/roles";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPath = request.nextUrl.pathname.startsWith("/auth");
  const isVendorPath = request.nextUrl.pathname.startsWith("/vendor");
  const isDashboardPath = request.nextUrl.pathname.startsWith("/dashboard");

  const isAuthLogin = request.nextUrl.pathname === "/auth/login";
  const isVendorLogin = request.nextUrl.pathname === "/vendor/login";

  if (!user) {
    if (isAuthPath && !isAuthLogin) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }
    if (isVendorPath && !isVendorLogin) {
      const url = request.nextUrl.clone();
      url.pathname = "/vendor/login";
      return NextResponse.redirect(url);
    }
    if (isDashboardPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }
  } else if (isAuthPath || isVendorPath || isDashboardPath) {
    // Tipe portal dibaca dari tabel `profiles`, bukan user_metadata: metadata
    // bisa ditulis sendiri oleh user lewat supabase.auth.updateUser() dari
    // browser, sehingga vendor bisa mengaku 'pgn' dan lolos gate ini.
    // `profiles` adalah sumber kebenaran yang sama dengan yang dipakai kedua
    // login action (/auth/login dan /vendor/login). Query hanya dijalankan
    // untuk path yang memang di-gate.
    const { data: profile } = await supabase
      .from('profiles')
      .select('type')
      .eq('id', user.id)
      .single();
    const type = profile?.type; // 'pgn' | 'pgsol' | 'vendor'

    if (isVendor(type)) {
      if (isDashboardPath || isAuthPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/vendor/dashboard";
        return NextResponse.redirect(url);
      }
      if (isVendorLogin) {
        const url = request.nextUrl.clone();
        url.pathname = "/vendor/dashboard";
        return NextResponse.redirect(url);
      }
    } else if (isPgn(type) || isPgsol(type)) {
      // PGN dan PGSOL berbagi realm /dashboard yang sama sejak 2026-09-29
      // (docs/superpowers/specs/2026-09-29-pgsol-dashboard-merge-design.md)
      // — dibedakan lewat roles.permissions, bukan lagi path terpisah.
      // Keduanya diperlakukan identik di sini.
      if (isVendorPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
      if (isAuthLogin) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    } else {
      // Profil tidak ditemukan / tipe tidak dikenal: jangan biarkan lolos ke
      // portal mana pun. Halaman login masing-masing sengaja dibiarkan
      // lewat supaya tidak terjadi redirect loop.
      if (isDashboardPath || (isAuthPath && !isAuthLogin) || (isVendorPath && !isVendorLogin)) {
        const url = request.nextUrl.clone();
        url.pathname = "/auth/login";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
```

- [ ] **Step 2: Typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `node node_modules/eslint/bin/eslint.js utils/supabase/middleware.ts`
Expected: no new findings.

- [ ] **Step 4: Commit**

```bash
git add utils/supabase/middleware.ts
git commit -m "Merge middleware PGN/PGSOL handling into one branch

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SsSyQQDH1zxAa83LEHmurV"
```

---

### Task 7: Delete `app/pgsol/dashboard/*` + `app/pgsol/login/actions.ts`, update `AGENTS.md`, full verification

**Files:**
- Delete: `app/pgsol/dashboard/layout.tsx`
- Delete: `app/pgsol/dashboard/page.tsx`
- Delete: `app/pgsol/dashboard/profile/page.tsx`
- Delete: `app/pgsol/dashboard/projects/page.tsx`
- Delete: `app/pgsol/dashboard/projects/actions.ts`
- Delete: `app/pgsol/dashboard/projects/[id]/assign/page.tsx`
- Delete: `app/pgsol/dashboard/projects/[id]/assign/AssignPgsolPanel.tsx`
- Delete: `app/pgsol/dashboard/role/page.tsx`
- Delete: `app/pgsol/dashboard/role/actions.ts`
- Delete: `app/pgsol/dashboard/role/constants.ts`
- Delete: `app/pgsol/dashboard/role/layout.tsx`
- Delete: `app/pgsol/dashboard/role/AddRoleModal.tsx`
- Delete: `app/pgsol/dashboard/role/[id]/page.tsx`
- Delete: `app/pgsol/dashboard/role/[id]/actions.ts`
- Delete: `app/pgsol/dashboard/role/[id]/RolePermissionsClient.tsx`
- Delete: `app/pgsol/dashboard/staff/page.tsx`
- Delete: `app/pgsol/login/actions.ts`
- Modify: `AGENTS.md`

**Interfaces:** none — this is the cleanup/integration task, nothing new produced or consumed.

This task must run **after** Tasks 1-6 — it deletes the last remaining reference to `app/pgsol/login/actions.ts` (`app/pgsol/dashboard/layout.tsx`, deleted in this same task) and removes the files that everything else in this plan already stopped depending on.

- [ ] **Step 1: Confirm nothing outside `app/pgsol/**` still references a deleted path**

Run: `node node_modules/typescript/bin/tsc --noEmit` (baseline — record any pre-existing errors, there should be none related to `pgsol` at this point since Tasks 1-6 already moved every real consumer).

Also run (informational, not a gate — greps for leftover links):
```bash
grep -rn "pgsol/dashboard\|/pgsol/login" --include="*.ts" --include="*.tsx" app components lib utils | grep -v "^app/pgsol/"
```
Expected: only the intentional in-code mentions of the *string* `/pgsol/login` inside `app/pgsol/login/page.tsx` itself (the redirect target) and any explanatory comments added in Tasks 1-6 that reference the *old* path for context (e.g. "used to live at..."). If this turns up a real, live import or `href` pointing at a path this task is about to delete, STOP — that means an earlier task missed something; fix the source task's file, not this one.

- [ ] **Step 2: Delete the files**

```bash
git rm app/pgsol/dashboard/layout.tsx
git rm app/pgsol/dashboard/page.tsx
git rm app/pgsol/dashboard/profile/page.tsx
git rm app/pgsol/dashboard/projects/page.tsx
git rm app/pgsol/dashboard/projects/actions.ts
git rm "app/pgsol/dashboard/projects/[id]/assign/page.tsx"
git rm "app/pgsol/dashboard/projects/[id]/assign/AssignPgsolPanel.tsx"
git rm app/pgsol/dashboard/role/page.tsx
git rm app/pgsol/dashboard/role/actions.ts
git rm app/pgsol/dashboard/role/constants.ts
git rm app/pgsol/dashboard/role/layout.tsx
git rm app/pgsol/dashboard/role/AddRoleModal.tsx
git rm "app/pgsol/dashboard/role/[id]/page.tsx"
git rm "app/pgsol/dashboard/role/[id]/actions.ts"
git rm "app/pgsol/dashboard/role/[id]/RolePermissionsClient.tsx"
git rm app/pgsol/dashboard/staff/page.tsx
git rm app/pgsol/login/actions.ts
```

(If any now-empty directories remain under `app/pgsol/dashboard/`, remove them too — Next.js ignores empty directories, but keep the tree tidy.)

- [ ] **Step 3: Update `AGENTS.md`**

Find:

```markdown
## Three app realms in one Next.js app
- `/dashboard/*` — internal PGN app (master-data, approval, incidents, inspections)
- `/vendor/*` and `/pgsol/*` — vendor and PGSOL apps
Each realm has its own login page, server actions, and layout. `profiles.type` (`pgn | pgsol | vendor`) drives post-login redirects in `middleware.ts` / `utils/supabase/middleware.ts`. Roles are data-driven: `roles` table + `roles.permissions` JSONB, role UI in `app/*/dashboard/role/`.
```

Replace with:

```markdown
## Two app realms in one Next.js app
- `/dashboard/*` — internal app, shared by **both PGN and PGSOL** (master-data, approval, incidents, inspections). The two are distinguished purely by `roles.permissions` (`allowedTypes` per item in `app/dashboard/master-data/role/constants.ts`) and, for the few PGSOL-only screens (`Staff Organisasi` / `Kelola Reviewer PGSOL` under `app/dashboard/master-data/`), by scoping queries to the caller's own `org_id`/`type` — never by a separate directory. PGSOL used to have its own `/pgsol/*` portal; it was merged into `/dashboard` 2026-09-29 (`docs/superpowers/specs/2026-09-29-pgsol-dashboard-merge-design.md`). `/pgsol/login` still exists as a thin redirect to `/auth/login`, kept only so old bookmarks don't 404.
- `/vendor/*` — vendor app.
Each realm has its own login page, server actions, and layout. `profiles.type` (`pgn | pgsol | vendor`) drives post-login redirects in `middleware.ts` / `utils/supabase/middleware.ts` — PGN and PGSOL both land on `/dashboard`. Roles are data-driven: `roles` table + `roles.permissions` JSONB, role UI at `app/dashboard/master-data/role/`.
```

- [ ] **Step 4: Full typecheck**

Run: `node node_modules/typescript/bin/tsc --noEmit`
Expected: no errors anywhere in the project attributable to this plan (pre-existing unrelated errors, if any existed before this plan started, are out of scope — compare against a pre-plan baseline if unsure).

- [ ] **Step 5: Full build**

Run: `node node_modules/next/dist/bin/next build`
Expected: build succeeds. This is the only way to catch a dangling route reference that `tsc` alone wouldn't (e.g. Next.js's own route-manifest generation).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Delete app/pgsol/dashboard/*, retire /pgsol/login actions, update AGENTS.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SsSyQQDH1zxAa83LEHmurV"
```

- [ ] **Step 7: Record the manual verification checklist for the user**

This environment has no browser and can't run `next dev` interactively — leave this checklist for the user to run against a real login session, matching the spec's "Testing" section:

1. Login as a `pgsol_admin`-role account via `/auth/login` → lands on `/dashboard`; nav shows "Staff Organisasi" and "Kelola Reviewer PGSOL" but **not** "Role & Permission" (that role has no `manage_role`).
2. "Staff Organisasi" only lists staff from that account's own PGSOL org, not the whole system.
3. Login as a `pgsol_reviewer`-role account → smaller nav still, but `/dashboard/approval` still reachable for review.
4. Login as a PGN admin → no regressions: "Manajemen Akun" still shows every org, not filtered to PGN.
5. Visit `/pgsol/login` while logged out → lands on `/auth/login`.
6. Visit any old `/pgsol/dashboard/...` URL → 404 (not a 500).

---

## Self-Review Notes

- **Spec coverage:** all 8 architecture sections in the design doc map to a task — §1 login → Task 5, §2 middleware → Task 6, §3 delete pgsol dashboard → Task 7, §4 nav → Task 4, §5 account scoping → Task 1, §6 assign feature → Task 3, §7 role scoping → Task 2, §8 docs → Task 7.
- **Placeholder scan:** none found — every step has literal, complete code; no "similar to Task N" shorthand.
- **Type consistency:** `savePgsolAssignment(projectId, docType, stageKey, assigneeIds)` signature matches between Task 3's `actions.ts` (producer) and `AssignPgsolPanel.tsx`/`[id]/page.tsx` (consumers), same shape as the original. `getPgsolProjects()` return shape (array with `vendor_profiles`, `procedures`, `jsa`, `ptw`) matches between `actions.ts` and `page.tsx`. `AccountTable`'s prop shape is unchanged from Task 1 through to `components/org/AccountTable.tsx` (not modified by this plan).
- **Dependency order verified:** Task 5 deliberately leaves `app/pgsol/login/actions.ts` alive because Task 7 (not Task 5) is where `app/pgsol/dashboard/layout.tsx` — its last consumer — gets deleted. Tasks 1-4 are independent of each other and of Tasks 5/6; Task 7 must run last.
