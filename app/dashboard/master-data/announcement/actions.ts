'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { revalidatePath } from 'next/cache';

export interface Announcement {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

/**
 * Gate tunggal untuk semua mutasi pengumuman di file ini, pola yang sama
 * dengan requireRoleAccess() di app/dashboard/master-data/role/actions.ts.
 * Tidak perlu crossOrg/org-scoping seperti role atau account — pengumuman
 * bukan data per-organisasi, cuma butuh permission 'manage' (yang sudah
 * dideklarasikan allowedTypes: ['pgn'] di constants.ts).
 */
async function requireAnnouncementAccess(): Promise<{ error: string | null; userId: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', userId: null };

  const allowed = await hasPermissionForUser(supabase, user.id, 'announcement', 'manage');
  if (!allowed) return { error: 'Anda tidak memiliki izin untuk mengelola pengumuman.', userId: null };

  return { error: null, userId: user.id };
}

/**
 * Dipakai kedua dashboard home (internal & vendor) — cukup client biasa
 * karena RLS "Authenticated users can read active announcements" sudah
 * membatasi ke baris is_active=true untuk siapa pun yang login.
 */
export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, description, image_url, is_active, display_order, created_at')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('getActiveAnnouncements error:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Halaman kelola butuh baris nonaktif juga (supaya bisa diaktifkan lagi) —
 * pakai admin client, gate lewat requireAnnouncementAccess() sama seperti
 * mutasi di bawah.
 */
export async function getAnnouncementsForManagement(): Promise<Announcement[]> {
  const { error: permError } = await requireAnnouncementAccess();
  if (permError) return [];

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('announcements')
    .select('id, title, description, image_url, is_active, display_order, created_at')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('getAnnouncementsForManagement error:', error.message);
    return [];
  }

  return data || [];
}

export async function addAnnouncement(formData: FormData) {
  try {
    const { error: permError, userId } = await requireAnnouncementAccess();
    if (permError || !userId) return { error: permError };

    const title = formData.get('title') as string;
    const description = (formData.get('description') as string) || null;
    const image_url = formData.get('image_url') as string;
    const display_order = Number(formData.get('display_order')) || 0;

    if (!title || !image_url) {
      return { error: 'Judul dan gambar wajib diisi.' };
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('announcements')
      .insert({
        title,
        description,
        image_url,
        display_order,
        created_by: userId,
      });

    if (error) {
      return { error: error.message || 'Gagal menambahkan pengumuman.' };
    }

    revalidatePath('/dashboard/master-data/announcement');
    revalidatePath('/dashboard');
    revalidatePath('/vendor/dashboard');
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server saat menambahkan pengumuman.' };
  }
}

export async function updateAnnouncement(id: string, formData: FormData) {
  try {
    const { error: permError } = await requireAnnouncementAccess();
    if (permError) return { error: permError };

    const title = formData.get('title') as string;
    const description = (formData.get('description') as string) || null;
    const image_url = formData.get('image_url') as string;
    const display_order = Number(formData.get('display_order')) || 0;

    if (!title || !image_url) {
      return { error: 'Judul dan gambar wajib diisi.' };
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('announcements')
      .update({
        title,
        description,
        image_url,
        display_order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return { error: error.message || 'Gagal mengubah pengumuman.' };
    }

    revalidatePath('/dashboard/master-data/announcement');
    revalidatePath('/dashboard');
    revalidatePath('/vendor/dashboard');
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server saat mengubah pengumuman.' };
  }
}

export async function deleteAnnouncement(id: string) {
  try {
    const { error: permError } = await requireAnnouncementAccess();
    if (permError) return { error: permError };

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) {
      return { error: error.message || 'Gagal menghapus pengumuman.' };
    }

    revalidatePath('/dashboard/master-data/announcement');
    revalidatePath('/dashboard');
    revalidatePath('/vendor/dashboard');
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server saat menghapus pengumuman.' };
  }
}

export async function toggleAnnouncementActive(id: string, isActive: boolean) {
  try {
    const { error: permError } = await requireAnnouncementAccess();
    if (permError) return { error: permError };

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('announcements')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { error: error.message || 'Gagal mengubah status pengumuman.' };
    }

    revalidatePath('/dashboard/master-data/announcement');
    revalidatePath('/dashboard');
    revalidatePath('/vendor/dashboard');
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server saat mengubah status pengumuman.' };
  }
}
