'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function addRole(formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const type = formData.get('type') as string;

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
      // Handle unique constraint violation
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
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const type = formData.get('type') as string;

    if (!name || !type) {
      return { error: 'Nama Role dan Tipe Role wajib diisi.' };
    }

    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from('roles')
      .update({
        name: name.toLowerCase().replace(/\s+/g, '_'), // Normalize name to lower snake_case
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
    const adminClient = createAdminClient();

    // Pastikan tidak ada profil yang menggunakan role ini
    // Seharusnya bisa di cek via count, tapi kita asumsikan untuk sekarang bisa dihapus jika tidak restrict di DB
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
