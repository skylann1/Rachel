'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { revalidatePath } from 'next/cache';
import { logActivity } from '@/lib/activity-log';

async function requireManageVendor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'Unauthorized';
  const allowed = await hasPermissionForUser(supabase, user.id, 'masterData', 'manage_vendor');
  if (!allowed) return 'Anda tidak memiliki izin untuk mengelola data vendor.';
  return null;
}

async function logVendorActivity(action: string, entityId: string, notes: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await logActivity(supabase, { actorId: user?.id ?? null, action, entityType: 'vendor', entityId, notes });
}

// Update Vendor Data
//
// `orgId` di sini adalah id ORGANISASI vendor (= vendor_profiles.id sejak
// schema_org_backfill_vendor.sql), bukan id user — pemanggilnya
// (EditVendorModal) mengirim `vendor.id` yang memang berasal dari
// vendor_profiles. Nama PIC diperbarui lewat `picId` terpisah, karena satu
// organisasi vendor sekarang bisa punya banyak profil staff.
export async function updateVendor(orgId: string, formData: FormData) {
  try {
    const permError = await requireManageVendor();
    if (permError) return { error: permError };

    const companyName = formData.get('companyName') as string;
    const phone = formData.get('phone') as string;
    const companyEmail = formData.get('companyEmail') as string;
    const address = formData.get('address') as string;
    const csmsStatus = formData.get('csmsStatus') as string;

    // Also we might want to update PIC (full_name in profiles)
    const pic = formData.get('pic') as string;
    const picId = formData.get('picId') as string;

    if (!orgId || !companyName) {
      return { error: 'ID dan Nama Perusahaan wajib diisi.' };
    }

    const adminAuthClient = createAdminClient();

    // 1. Update vendor_profiles (id = id organisasi)
    const { error: vendorError } = await adminAuthClient
      .from('vendor_profiles')
      .update({
        company_name: companyName,
        phone: phone,
        company_email: companyEmail,
        address: address,
        csms_status: csmsStatus
      })
      .eq('id', orgId);

    if (vendorError) {
      console.error(vendorError);
      return { error: 'Gagal memperbarui data vendor.' };
    }

    // 1b. Nama organisasi mengikuti nama perusahaan supaya daftar akun
    // (yang membaca organizations.name) tidak jadi tidak sinkron.
    await adminAuthClient.from('organizations').update({ name: companyName }).eq('id', orgId);

    // 2. Update profiles (PIC name) — dikunci ke profil yang memang milik
    // organisasi ini, supaya id sembarang dari form tidak bisa dipakai
    // mengubah nama akun orang lain.
    if (pic && picId) {
      await adminAuthClient
        .from('profiles')
        .update({ full_name: pic })
        .eq('id', picId)
        .eq('org_id', orgId);
    }

    await logVendorActivity('Mengubah data vendor', orgId, companyName);

    revalidatePath('/dashboard/master-data/vendor');
    revalidatePath('/dashboard/master-data/account');
    return { success: true };
  } catch (error: any) {
    console.error('Server error updating vendor:', error);
    return { error: 'Terjadi kesalahan pada server saat mengubah vendor.' };
  }
}

/**
 * Membuat perusahaan vendor BARU beserta akun staff pertamanya.
 *
 * Alurnya identik dengan jalur `crossOrg` + `type='vendor'` di
 * `addAccount` (app/dashboard/master-data/account/actions.ts): organisasi
 * dibuat lebih dulu, lalu akun auth, lalu `profiles.org_id` ditautkan, lalu
 * baris company `vendor_profiles` di-upsert pada id ORGANISASI (bukan id
 * user — sejak schema_org_backfill_vendor.sql `vendor_profiles.id` menunjuk
 * `organizations(id)`). Trigger `handle_new_user` sudah tidak lagi membuat
 * baris vendor_profiles (lihat schema_org_fix_vendor_trigger_and_policies.sql).
 */
export async function addVendor(formData: FormData) {
  try {
    const permError = await requireManageVendor();
    if (permError) return { error: permError };

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

    // 1. Buat organisasi vendor baru
    const { data: newOrg, error: orgError } = await adminAuthClient
      .from('organizations')
      .insert({ kind: 'vendor', name: companyName })
      .select('id')
      .single();

    if (orgError || !newOrg) {
      console.error('Org error:', orgError);
      return { error: orgError?.message || 'Gagal membuat organisasi vendor baru.' };
    }
    const orgId = newOrg.id as string;

    // 2. Buat akun auth staff pertama
    const { data: authData, error: authError } = await adminAuthClient.auth.admin.createUser({
      email: loginEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: pic,
        role: 'vendor',
        type: 'vendor',
        company_name: companyName,
      }
    });

    if (authError || !authData?.user) {
      console.error('Auth error:', authError);
      // Organisasi yatim dibersihkan supaya tidak muncul sebagai company
      // kosong tanpa satu pun akun.
      await adminAuthClient.from('organizations').delete().eq('id', orgId);
      return { error: authError?.message || 'Gagal membuat akun vendor.' };
    }

    const userId = authData.user.id;

    // 3. Tautkan profil ke organisasi. Wajib berhasil: semua policy RLS
    // org-scoped gagal-tertutup pada org_id NULL.
    const { error: linkError } = await adminAuthClient
      .from('profiles')
      .update({ org_id: orgId })
      .eq('id', userId);

    if (linkError) {
      console.error('Link org error:', linkError);
      await adminAuthClient.auth.admin.deleteUser(userId);
      await adminAuthClient.from('organizations').delete().eq('id', orgId);
      return { error: 'Gagal menautkan akun vendor ke organisasinya. Pembuatan dibatalkan.' };
    }

    // 4. Buat baris detail company pada id ORGANISASI
    const { error: vendorError } = await adminAuthClient
      .from('vendor_profiles')
      .upsert({
        id: orgId,
        company_name: companyName,
        phone: phone,
        company_email: companyEmail,
        address: address
      });

    if (vendorError) {
      console.error('Create vendor profile error:', vendorError);
      await adminAuthClient.auth.admin.deleteUser(userId);
      await adminAuthClient.from('organizations').delete().eq('id', orgId);
      return { error: 'Gagal membuat data perusahaan vendor. Pembuatan dibatalkan.' };
    }

    await logVendorActivity('Membuat data vendor', orgId, companyName);

    revalidatePath('/dashboard/master-data/vendor');
    revalidatePath('/dashboard/master-data/account');
    return { success: true };
  } catch (error: any) {
    console.error('Server error creating vendor:', error);
    return { error: 'Terjadi kesalahan pada server saat membuat vendor.' };
  }
}
