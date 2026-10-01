'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { assertSameRoleType, type RoleActor } from '@/lib/role-access';

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

    // Sama seperti app/dashboard/master-data/role/[id]/actions.ts: aktor
    // org-scoped (bukan crossOrg) cuma boleh mengubah role dengan tipe &
    // is_system yang sama dengan organisasinya sendiri, dan tidak boleh
    // memindahkan role ke tipe lain. Sebelumnya file ini (copy vendor)
    // tidak punya pengecekan ini sama sekali.
    const actor: RoleActor = { userId: user.id, type: actorProfile?.type ?? null, crossOrg };
    const typeResult = await assertSameRoleType(supabase, actor, id);
    if (typeResult.error) return { error: typeResult.error };

    if (!crossOrg) {
      if (type !== typeResult.targetType) {
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
