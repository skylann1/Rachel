'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

// Update Vendor Data
export async function updateVendor(id: string, formData: FormData) {
  try {
    const companyName = formData.get('companyName') as string;
    const phone = formData.get('phone') as string;
    const companyEmail = formData.get('companyEmail') as string;
    const address = formData.get('address') as string;
    const csmsStatus = formData.get('csmsStatus') as string;
    
    // Also we might want to update PIC (full_name in profiles)
    const pic = formData.get('pic') as string;

    if (!id || !companyName) {
      return { error: 'ID dan Nama Perusahaan wajib diisi.' };
    }

    const adminAuthClient = createAdminClient();

    // 1. Update vendor_profiles
    const { error: vendorError } = await adminAuthClient
      .from('vendor_profiles')
      .update({
        company_name: companyName,
        phone: phone,
        company_email: companyEmail,
        address: address,
        csms_status: csmsStatus
      })
      .eq('id', id);

    if (vendorError) {
      console.error(vendorError);
      return { error: 'Gagal memperbarui data vendor.' };
    }

    // 2. Update profiles (PIC name)
    if (pic) {
      await adminAuthClient
        .from('profiles')
        .update({ full_name: pic })
        .eq('id', id);
    }

    revalidatePath('/dashboard/master-data/vendor');
    return { success: true };
  } catch (error: any) {
    console.error('Server error updating vendor:', error);
    return { error: 'Terjadi kesalahan pada server saat mengubah vendor.' };
  }
}

// Add Vendor (Essentially creating an account of type 'external')
export async function addVendor(formData: FormData) {
  try {
    const companyName = formData.get('companyName') as string;
    const pic = formData.get('pic') as string; // full_name
    const loginEmail = formData.get('loginEmail') as string; // auth email
    const password = formData.get('password') as string;
    
    const phone = formData.get('phone') as string;
    const companyEmail = formData.get('companyEmail') as string;
    const address = formData.get('address') as string;
    
    if (!companyName || !pic || !loginEmail || !password) {
      return { error: 'Data login dan profil utama wajib diisi.' };
    }

    const adminAuthClient = createAdminClient();

    // 1. Create Auth User
    const { data: authData, error: authError } = await adminAuthClient.auth.admin.createUser({
      email: loginEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: pic,
        role: 'vendor',
        type: 'external',
        company_name: companyName,
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return { error: authError.message || 'Gagal membuat akun vendor.' };
    }

    const userId = authData.user.id;

    // 2. The trigger `handle_new_user` will automatically insert into profiles and vendor_profiles.
    // However, it doesn't set phone, company_email, address. We need to update it now.
    // Wait for the trigger to finish by small delay or just update it
    
    // We can do an upsert or update. Since trigger inserts it, we update.
    const { error: updateError } = await adminAuthClient
      .from('vendor_profiles')
      .update({
        phone: phone,
        company_email: companyEmail,
        address: address
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Update vendor profile error:', updateError);
      // It's not fatal, but good to log
    }

    revalidatePath('/dashboard/master-data/vendor');
    revalidatePath('/dashboard/master-data/account');
    return { success: true };
  } catch (error: any) {
    console.error('Server error creating vendor:', error);
    return { error: 'Terjadi kesalahan pada server saat membuat vendor.' };
  }
}
