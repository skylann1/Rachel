'use server';

import { createAdminClient } from '@/utils/supabase/admin';

export async function updateRolePermissions(
  id: string,
  name: string,
  description: string,
  type: string,
  permissions: Record<string, string[]>
) {
  try {
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
