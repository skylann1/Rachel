'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function addAccount(formData: FormData) {
  try {
    const fullName = formData.get('fullName') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;
    const type = formData.get('type') as string;
    const nip = formData.get('nip') as string;
    const companyName = formData.get('companyName') as string;

    if (!fullName || !email || !password || !role || !type) {
      return { error: 'Semua field wajib diisi' };
    }

    if (type === 'internal' && !nip) {
      return { error: 'NIP wajib diisi untuk user internal' };
    }

    if (type === 'external' && !companyName) {
      return { error: 'Nama Perusahaan wajib diisi untuk user external' };
    }

    const adminAuthClient = createAdminClient();

    const { data, error } = await adminAuthClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: role,
        type: type,
        nip: type === 'internal' ? nip : null,
        company_name: type === 'external' ? companyName : null,
      }
    });

    if (error) {
      console.error('Error creating user:', error);
      return { error: error.message || JSON.stringify(error) || 'Terjadi kesalahan tidak diketahui.' };
    }

    if (data.user) {
      if (type === 'external') {
        const { error: vendorError } = await adminAuthClient.from('vendor_profiles').upsert({ id: data.user.id, company_name: companyName });
        if (vendorError) console.error('Error creating vendor profile:', vendorError);
      } else {
        const { error: internalError } = await adminAuthClient.from('internal_profiles').upsert({ id: data.user.id, nip: nip });
        if (internalError) console.error('Error creating internal profile:', internalError);
      }
    }

    revalidatePath('/dashboard/master-data/account');
    return { success: true };
  } catch (error: any) {
    console.error('Server error creating user:', error);
    return { error: 'Terjadi kesalahan pada server saat membuat akun' };
  }
}

export async function updateAccount(id: string, formData: FormData) {
  try {
    const fullName = formData.get('fullName') as string;
    const role = formData.get('role') as string;
    const type = formData.get('type') as string;
    const nip = formData.get('nip') as string;
    const companyName = formData.get('companyName') as string;

    if (!id || !fullName || !role || !type) {
      return { error: 'Field utama wajib diisi' };
    }

    const adminAuthClient = createAdminClient();

    // 1. Update Auth Metadata
    const { error: authError } = await adminAuthClient.auth.admin.updateUserById(id, {
      user_metadata: {
        full_name: fullName,
        role: role,
        type: type,
        nip: type === 'internal' ? nip : null,
        company_name: type === 'external' ? companyName : null,
      }
    });

    if (authError) {
      return { error: authError.message || 'Gagal mengubah metadata auth' };
    }

    // 2. Update Profiles
    const { error: profileError } = await adminAuthClient
      .from('profiles')
      .update({
        full_name: fullName,
        role: role,
        type: type
      })
      .eq('id', id);

    if (profileError) {
      return { error: 'Gagal mengubah data profil' };
    }

    // 3. Update Sub-profiles
    if (type === 'external') {
      await adminAuthClient.from('vendor_profiles').upsert({ id, company_name: companyName });
      await adminAuthClient.from('internal_profiles').delete().eq('id', id); // Cleanup if type changed
    } else {
      await adminAuthClient.from('internal_profiles').upsert({ id, nip: nip });
      await adminAuthClient.from('vendor_profiles').delete().eq('id', id); // Cleanup if type changed
    }

    revalidatePath('/dashboard/master-data/account');
    return { success: true };
  } catch (error: any) {
    return { error: 'Terjadi kesalahan pada server saat mengubah akun' };
  }
}

export async function suspendAccount(id: string, isSuspended: boolean) {
  try {
    const adminAuthClient = createAdminClient();
    
    // Ban user in Auth
    const { error: banError } = await adminAuthClient.auth.admin.updateUserById(id, {
      ban_duration: isSuspended ? '876000h' : 'none' // Ban for 100 years or unban
    });

    if (banError) {
      return { error: banError.message || 'Gagal mengubah status auth' };
    }

    // Attempt to update status in profiles if column exists (it might not exist, but we fallback)
    await adminAuthClient.from('profiles').update({ status: isSuspended ? 'Inactive' : 'Active' }).eq('id', id);

    revalidatePath('/dashboard/master-data/account');
    return { success: true };
  } catch (error: any) {
    return { error: 'Terjadi kesalahan pada server saat mengubah status' };
  }
}

export async function deleteAccount(id: string) {
  try {
    const adminAuthClient = createAdminClient();
    
    // Delete from auth.users (Cascades to profiles)
    const { error } = await adminAuthClient.auth.admin.deleteUser(id);

    if (error) {
      return { error: error.message || 'Gagal menghapus akun' };
    }

    revalidatePath('/dashboard/master-data/account');
    return { success: true };
  } catch (error: any) {
    return { error: 'Terjadi kesalahan pada server saat menghapus akun' };
  }
}
