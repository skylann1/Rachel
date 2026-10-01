'use server';

import { randomInt } from 'crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { revalidatePath } from 'next/cache';
import { sendEmail, passwordResetEmailHtml } from '@/lib/email';

interface AccountActor {
  userId: string;
  orgId: string | null;
  orgKind: 'pgn' | 'pgsol' | 'vendor' | null;
  crossOrg: boolean; // true kalau punya manage_account (superadmin lintas org)
}

/**
 * Gate + konteks tunggal untuk semua aksi kelola akun di file ini.
 * `manage_account` (cuma admin PGN) bebas lintas organisasi. `manage_org_staff`
 * (Task 8) cuma boleh menyentuh akun dengan org_id yang sama dengan aktor
 * sendiri — dicek di sini SEKALI, bukan diulang di tiap action, dan dicek
 * ulang lagi lewat `assertSameOrg` sebelum tiap mutasi supaya org milik
 * target tidak bisa dipalsukan lewat urutan pemanggilan.
 */
async function requireAccountAccess(): Promise<{ error: string | null; actor: AccountActor | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', actor: null };

  const hasManageAccount = await hasPermissionForUser(supabase, user.id, 'masterData', 'manage_account');
  const orgScoped = hasManageAccount || await hasPermissionForUser(supabase, user.id, 'masterData', 'manage_org_staff');
  if (!orgScoped) return { error: 'Anda tidak memiliki izin untuk mengelola akun pengguna.', actor: null };

  const { data: profile } = await supabase.from('profiles').select('org_id, type').eq('id', user.id).single();
  // manage_account dideklarasikan allowedTypes: ['pgn'] di constants.ts, tapi
  // itu cuma menyaring checkbox di UI Role & Permission — tidak ada apa pun
  // yang mencegah permission ini diberikan ke role pgsol/vendor lewat jalur
  // lain. crossOrg (akses lintas organisasi) HARUS ikut mensyaratkan tipe
  // organisasi aktor sendiri 'pgn', sama seperti pola yang sudah dipakai
  // account/page.tsx dan role/actions.ts — tanpa ini, pemegang manage_account
  // non-pgn lolos assertSameOrg sepenuhnya dan bisa mengubah akun organisasi
  // mana pun.
  const crossOrg = hasManageAccount && profile?.type === 'pgn';
  return {
    error: null,
    actor: {
      userId: user.id,
      orgId: profile?.org_id ?? null,
      orgKind: (profile?.type as AccountActor['orgKind']) ?? null,
      crossOrg,
    },
  };
}

/** Menolak mutasi kalau target bukan milik org aktor, kecuali aktor superadmin lintas org. */
async function assertSameOrg(adminAuthClient: ReturnType<typeof createAdminClient>, actor: AccountActor, targetId: string): Promise<string | null> {
  if (actor.crossOrg) return null;
  const { data: target } = await adminAuthClient.from('profiles').select('org_id').eq('id', targetId).single();
  if (!target || target.org_id !== actor.orgId) {
    return 'Akun ini bukan bagian dari organisasi Anda.';
  }
  return null;
}

/**
 * Membatasi role apa yang boleh diberikan aktor org ter-scope.
 *
 * Tanpa ini, `role` diambil mentah dari form: pemegang `manage_org_staff`
 * (admin vendor/PGSOL) bisa memanggil updateAccount pada akunnya SENDIRI
 * — assertSameOrg lolos otomatis — dengan role 'admin', dan
 * getUserPermissionsForUser() (utils/permissions.ts) memberi akses penuh
 * ke SETIAP profil ber-role 'admin' terlepas dari tipenya. Satu request,
 * langsung jadi superadmin lintas organisasi.
 *
 * Dua lapis penolakan:
 *  1. 'admin' tidak pernah boleh diberikan dari jalur org-scoped (role ini
 *     mem-bypass seluruh sistem pengecekan permission).
 *  2. role lain harus punya `roles.type` yang sama dengan tipe organisasi
 *     aktor — admin vendor cuma boleh memberi role bertipe 'vendor', dst.
 */
async function assertAssignableRole(
  adminAuthClient: ReturnType<typeof createAdminClient>,
  actor: AccountActor,
  role: string
): Promise<string | null> {
  if (actor.crossOrg) return null;
  if (role === 'admin') {
    return 'Role admin tidak dapat diberikan dari halaman ini.';
  }
  const { data: roleRow } = await adminAuthClient.from('roles').select('type').eq('name', role).single();
  if (!roleRow || !actor.orgKind || roleRow.type !== actor.orgKind) {
    return 'Role ini tidak tersedia untuk organisasi Anda.';
  }
  return null;
}

export async function addAccount(formData: FormData) {
  try {
    const { error: permError, actor } = await requireAccountAccess();
    if (permError || !actor) return { error: permError };

    const fullName = formData.get('fullName') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;
    const nip = formData.get('nip') as string;
    const companyName = formData.get('companyName') as string;

    // type/org: superadmin lintas org boleh memilih lewat form; admin org
    // ter-scope SELALU dipaksa ke org & tipe miliknya sendiri, terlepas
    // dari apa yang dikirim client — ini batas keamanan sebenarnya, bukan
    // cuma field yang disembunyikan di modal (lihat Task 15).
    const type = actor.crossOrg ? (formData.get('type') as string) : actor.orgKind;

    if (!fullName || !email || !password || !role || !type) {
      return { error: 'Semua field wajib diisi' };
    }
    if (type !== 'vendor' && !nip) {
      return { error: 'NIP wajib diisi untuk user PGN/PGSOL' };
    }
    if (type === 'vendor' && actor.crossOrg && !companyName) {
      return { error: 'Nama Perusahaan wajib diisi untuk akun vendor baru' };
    }

    const adminAuthClient = createAdminClient();

    const roleError = await assertAssignableRole(adminAuthClient, actor, role);
    if (roleError) return { error: roleError };

    // Resolusi org: superadmin bikin org vendor baru (companyName wajib di
    // atas); admin ter-scope selalu memakai org miliknya sendiri.
    let orgId: string;
    if (actor.crossOrg) {
      if (type === 'vendor') {
        const { data: newOrg, error: orgError } = await adminAuthClient
          .from('organizations')
          .insert({ kind: 'vendor', name: companyName })
          .select('id')
          .single();
        if (orgError || !newOrg) return { error: orgError?.message || 'Gagal membuat organisasi vendor baru.' };
        orgId = newOrg.id;
      } else {
        const { data: existingOrg } = await adminAuthClient
          .from('organizations')
          .select('id')
          .eq('kind', type)
          .single();
        if (!existingOrg) return { error: `Organisasi ${type} tidak ditemukan.` };
        orgId = existingOrg.id;
      }
    } else {
      if (!actor.orgId) return { error: 'Organisasi Anda tidak ditemukan.' };
      orgId = actor.orgId;
    }

    const { data, error } = await adminAuthClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: role,
        type: type,
        nip: type !== 'vendor' ? nip : null,
        company_name: type === 'vendor' ? companyName : null,
      }
    });

    if (error) {
      console.error('Error creating user:', error);
      return { error: error.message || 'Terjadi kesalahan tidak diketahui saat membuat akun.' };
    }

    if (data.user) {
      // Tautan org WAJIB berhasil: setiap policy RLS org-scoped gagal-tertutup
      // pada org_id NULL, jadi kegagalan yang cuma di-console.error akan
      // menghasilkan akun yang tidak bisa melihat apa pun tanpa pesan error.
      // Akun auth yang baru dibuat dihapus lagi supaya email-nya tidak
      // "terkunci" oleh akun setengah jadi.
      const { error: orgLinkError } = await adminAuthClient.from('profiles').update({ org_id: orgId }).eq('id', data.user.id);
      if (orgLinkError) {
        console.error('Error linking profile to org:', orgLinkError);
        await adminAuthClient.auth.admin.deleteUser(data.user.id);
        return { error: 'Gagal menautkan akun baru ke organisasi. Akun dibatalkan, silakan coba lagi.' };
      }

      if (type === 'vendor') {
        // vendor_profiles.id sekarang = id organisasi (lihat
        // schema_org_backfill_vendor.sql) — hanya buat baris company baru
        // kalau memang org baru; staff tambahan berbagi org yang sama.
        if (actor.crossOrg) {
          const { error: vendorError } = await adminAuthClient.from('vendor_profiles').upsert({ id: orgId, company_name: companyName });
          if (vendorError) {
            console.error('Error creating vendor profile:', vendorError);
            await adminAuthClient.auth.admin.deleteUser(data.user.id);
            return { error: 'Gagal membuat data perusahaan vendor. Akun dibatalkan, silakan coba lagi.' };
          }
        }
      } else {
        const { error: internalError } = await adminAuthClient.from('internal_profiles').upsert({ id: data.user.id, nip: nip });
        if (internalError) console.error('Error creating internal profile:', internalError);
      }
    }

    revalidatePath('/dashboard/master-data/account');
    revalidatePath('/vendor/dashboard/staff');
    return { success: true };
  } catch (error: any) {
    console.error('Server error creating user:', error);
    return { error: 'Terjadi kesalahan pada server saat membuat akun' };
  }
}

export async function updateAccount(id: string, formData: FormData) {
  try {
    const { error: permError, actor } = await requireAccountAccess();
    if (permError || !actor) return { error: permError };
    const adminAuthClient = createAdminClient();
    const orgError = await assertSameOrg(adminAuthClient, actor, id);
    if (orgError) return { error: orgError };

    const fullName = formData.get('fullName') as string;
    const role = formData.get('role') as string;
    const type = actor.crossOrg ? (formData.get('type') as string) : (actor.orgKind as string);
    const nip = formData.get('nip') as string;
    const companyName = formData.get('companyName') as string;

    if (!id || !fullName || !role || !type) {
      return { error: 'Field utama wajib diisi' };
    }

    const roleError = await assertAssignableRole(adminAuthClient, actor, role);
    if (roleError) return { error: roleError };

    // 1. Update Auth Metadata
    const { error: authError } = await adminAuthClient.auth.admin.updateUserById(id, {
      user_metadata: {
        full_name: fullName,
        role: role,
        type: type,
        nip: type !== 'vendor' ? nip : null,
        company_name: type === 'vendor' ? companyName : null,
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
    //
    // `vendor_profiles` adalah data PERUSAHAAN, bukan data per-user:
    // id-nya = id organisasi (schema_org_backfill_vendor.sql), bukan id
    // profil yang sedang diedit. Karena itu upsert-nya dikunci ke org_id
    // target, dan cabang non-vendor TIDAK BOLEH menghapus baris company —
    // projects.vendor_id punya ON DELETE CASCADE ke vendor_profiles(id),
    // jadi menghapusnya di sini akan ikut menghapus seluruh proyek (dan
    // semua turunannya) milik satu perusahaan hanya karena tipe satu user
    // diubah. Menghapus perusahaan adalah operasi tingkat organisasi,
    // di luar cakupan "edit satu akun".
    const { data: targetProfile } = await adminAuthClient
      .from('profiles')
      .select('org_id')
      .eq('id', id)
      .single();

    if (type === 'vendor') {
      if (targetProfile?.org_id && companyName) {
        await adminAuthClient.from('vendor_profiles').upsert({ id: targetProfile.org_id, company_name: companyName });
      }
      await adminAuthClient.from('internal_profiles').delete().eq('id', id); // Cleanup per-user, aman
    } else {
      await adminAuthClient.from('internal_profiles').upsert({ id, nip: nip });
    }

    revalidatePath('/dashboard/master-data/account');
    revalidatePath('/vendor/dashboard/staff');
    return { success: true };
  } catch (error: any) {
    return { error: 'Terjadi kesalahan pada server saat mengubah akun' };
  }
}

export async function suspendAccount(id: string, isSuspended: boolean) {
  try {
    const { error: permError, actor } = await requireAccountAccess();
    if (permError || !actor) return { error: permError };
    const adminAuthClient = createAdminClient();
    const orgError = await assertSameOrg(adminAuthClient, actor, id);
    if (orgError) return { error: orgError };

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
    revalidatePath('/vendor/dashboard/staff');
    return { success: true };
  } catch (error: any) {
    return { error: 'Terjadi kesalahan pada server saat mengubah status' };
  }
}

/**
 * Forgot-password recovery for users who can't reset it themselves: an admin
 * generates a random one-time password, which is emailed to the account
 * holder (and also shown to the admin as a fallback in case delivery
 * fails). The user then logs in with it and should change it via their own
 * profile's "Ubah Kata Sandi" form.
 */
export async function resetAccountPassword(id: string) {
  try {
    const { error: permError, actor } = await requireAccountAccess();
    if (permError || !actor) return { error: permError };
    const adminAuthClient = createAdminClient();
    const orgError = await assertSameOrg(adminAuthClient, actor, id);
    if (orgError) return { error: orgError };
    // 8-digit random number — easy to read out/type, generated with a CSPRNG.
    const randomPassword = randomInt(10_000_000, 100_000_000).toString();

    const { data, error } = await adminAuthClient.auth.admin.updateUserById(id, {
      password: randomPassword,
    });

    if (error) {
      return { error: error.message || 'Gagal mereset kata sandi' };
    }

    let emailSent = false;
    if (data.user?.email) {
      const { data: profile } = await adminAuthClient
        .from('profiles')
        .select('full_name')
        .eq('id', id)
        .single();

      const { error: emailError } = await sendEmail({
        to: data.user.email,
        subject: 'Kata Sandi RACHEL K3 Anda Telah Direset',
        html: passwordResetEmailHtml({
          name: profile?.full_name || data.user.email,
          password: randomPassword,
        }),
      });
      emailSent = !emailError;
    }

    revalidatePath('/dashboard/master-data/account');
    revalidatePath('/vendor/dashboard/staff');
    return { success: true, password: randomPassword, emailSent };
  } catch (error: any) {
    return { error: 'Terjadi kesalahan pada server saat mereset kata sandi' };
  }
}

export async function deleteAccount(id: string) {
  try {
    const { error: permError, actor } = await requireAccountAccess();
    if (permError || !actor) return { error: permError };
    const adminAuthClient = createAdminClient();
    const orgError = await assertSameOrg(adminAuthClient, actor, id);
    if (orgError) return { error: orgError };

    // Delete from auth.users (Cascades to profiles)
    const { error } = await adminAuthClient.auth.admin.deleteUser(id);

    if (error) {
      return { error: error.message || 'Gagal menghapus akun' };
    }

    revalidatePath('/dashboard/master-data/account');
    revalidatePath('/vendor/dashboard/staff');
    return { success: true };
  } catch (error: any) {
    return { error: 'Terjadi kesalahan pada server saat menghapus akun' };
  }
}
