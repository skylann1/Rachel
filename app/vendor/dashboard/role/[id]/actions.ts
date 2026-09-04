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

    const supabase = createAdminClient();

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
