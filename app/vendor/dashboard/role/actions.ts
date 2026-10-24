'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { assertSameRoleType, orgRoleName, roleDisplayName, type RoleActor } from '@/lib/role-access';

const VALID_ROLE_TYPES = ['pgn', 'pgsol', 'vendor'];

/**
 * Gate + konteks tunggal untuk semua aksi kelola role di file ini, pola
 * yang sama dengan requireRoleAccess() di
 * app/dashboard/master-data/role/actions.ts. Sebelumnya file ini cuma
 * mengecek permission manage_role tanpa scoping tipe/organisasi sama
 * sekali — siapa pun pemegang manage_role bisa mengedit/menghapus role
 * PGN, PGSOL, atau sistem lewat halaman vendor ini (Gap #3 yang disebut
 * docs/superpowers/specs/2026-09-29-pgsol-dashboard-merge-design.md,
 * sengaja ditunda saat itu karena di luar scope plan tersebut).
 */
async function requireRoleAccess(): Promise<{ error: string | null; actor: RoleActor | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', actor: null };

  const allowed = await hasPermissionForUser(supabase, user.id, 'masterData', 'manage_role');
  if (!allowed) return { error: 'Anda tidak memiliki izin untuk mengelola role.', actor: null };

  const { data: profile } = await supabase.from('profiles').select('type, org_id').eq('id', user.id).single();
  const type = profile?.type ?? null;
  const crossOrg = type === 'pgn';
  // Role sekarang milik organisasi (roles.org_id): aktor non-PGN tanpa org tidak punya ruang lingkup.
  if (!crossOrg && !profile?.org_id) return { error: 'Organisasi Anda belum tertaut. Hubungi administrator.', actor: null };
  return { error: null, actor: { userId: user.id, type, orgId: profile?.org_id ?? null, crossOrg } };
}

export async function addRole(formData: FormData) {
  try {
    const { error: permError, actor } = await requireRoleAccess();
    if (permError || !actor) return { error: permError };

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    // Aktor org-scoped selalu dipaksa membuat role dengan tipe miliknya
    // sendiri, terlepas dari apa yang dikirim form.
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
        name: actor.crossOrg ? name.toLowerCase().replace(/\s+/g, '_') : orgRoleName(name, actor.orgId as string), // snake_case; role org diberi akhiran org agar unik global
        org_id: actor.crossOrg ? null : actor.orgId,
        description: description,
        type: type,
        is_system: false, // User created roles are never system roles
        permissions: {}
      });

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        return { error: 'Role dengan nama tersebut sudah ada.' };
      }
      return { error: error.message || 'Gagal menambahkan role.' };
    }

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
        name: actor.crossOrg ? name.toLowerCase().replace(/\s+/g, '_') : orgRoleName(name, actor.orgId as string), // snake_case; role org diberi akhiran org agar unik global
        org_id: actor.crossOrg ? null : actor.orgId,
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

    return { success: true };
  } catch (error: any) {
    return { error: 'Terjadi kesalahan pada server saat menghapus role.' };
  }
}
