'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { revalidatePath } from 'next/cache';
import { assertSameRoleType, type RoleActor } from '@/lib/role-access';
import { logActivity } from '@/lib/activity-log';

const VALID_ROLE_TYPES = ['pgn', 'pgsol', 'vendor'];

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
    if (!VALID_ROLE_TYPES.includes(type)) {
      return { error: 'Tipe Role tidak valid.' };
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

    await logActivity(await createClient(), { actorId: actor.userId, action: 'Membuat role', entityType: 'role', notes: name });

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
    const typeResult = await assertSameRoleType(adminClient, actor, id);
    if (typeResult.error) return { error: typeResult.error };

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    // Aktor org-scoped tidak boleh memindahkan role ke tipe lain — paksa
    // tetap tipe miliknya sendiri, sama seperti addRole di atas.
    const type = actor.crossOrg ? (formData.get('type') as string) : (actor.type as string);

    if (!name || !type) {
      return { error: 'Nama Role dan Tipe Role wajib diisi.' };
    }
    if (!VALID_ROLE_TYPES.includes(type)) {
      return { error: 'Tipe Role tidak valid.' };
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

    await logActivity(await createClient(), { actorId: actor.userId, action: 'Mengubah role', entityType: 'role', entityId: id, notes: name });

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
    const typeResult = await assertSameRoleType(adminClient, actor, id);
    if (typeResult.error) return { error: typeResult.error };

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

    await logActivity(await createClient(), { actorId: actor.userId, action: 'Menghapus role', entityType: 'role', entityId: id });

    revalidatePath('/dashboard/master-data/role');
    revalidatePath('/dashboard/master-data/account');
    return { success: true };
  } catch (error: any) {
    return { error: 'Terjadi kesalahan pada server saat menghapus role.' };
  }
}
