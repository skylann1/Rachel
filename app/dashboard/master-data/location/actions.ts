'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { revalidatePath } from 'next/cache';
import { logActivity } from '@/lib/activity-log';

export interface Location {
  id: string;
  name: string;
  code: string | null;
  region: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  project_count?: number;
}

/** Gate tunggal mutasi lokasi — pola sama dengan requireAnnouncementAccess(). */
async function requireLocationAccess(): Promise<{ error: string | null; userId: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', userId: null };
  const allowed = await hasPermissionForUser(supabase, user.id, 'masterData', 'manage_location');
  if (!allowed) return { error: 'Anda tidak memiliki izin untuk mengelola master lokasi.', userId: null };
  return { error: null, userId: user.id };
}

/** Lokasi aktif untuk dropdown (form proyek). RLS: semua user login boleh baca. */
export async function getActiveLocations(): Promise<Pick<Location, 'id' | 'name' | 'code' | 'region'>[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, code, region')
    .eq('is_active', true)
    .order('name');
  if (error) {
    console.error('getActiveLocations error:', error.message);
    return [];
  }
  return data || [];
}

/** Semua lokasi (termasuk nonaktif) + jumlah proyek yang memakainya, untuk halaman kelola. */
export async function getLocationsForManagement(): Promise<{ data: Location[]; error: string | null }> {
  const { error: permError } = await requireLocationAccess();
  if (permError) return { data: [], error: permError };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('locations')
    .select('id, name, code, region, address, is_active, created_at')
    .order('name');
  if (error) return { data: [], error: error.message };

  const { data: used } = await admin.from('projects').select('location_id').not('location_id', 'is', null);
  const counts = new Map<string, number>();
  (used || []).forEach((p: any) => counts.set(p.location_id, (counts.get(p.location_id) ?? 0) + 1));

  return { data: (data || []).map((l) => ({ ...l, project_count: counts.get(l.id) ?? 0 })), error: null };
}

function readFields(formData: FormData) {
  const text = (k: string) => ((formData.get(k) as string | null) || '').trim() || null;
  return { name: text('name'), code: text('code'), region: text('region'), address: text('address') };
}

export async function addLocation(formData: FormData) {
  try {
    const { error: permError, userId } = await requireLocationAccess();
    if (permError || !userId) return { error: permError };

    const fields = readFields(formData);
    if (!fields.name) return { error: 'Nama lokasi wajib diisi.' };

    const { error } = await createAdminClient().from('locations').insert(fields);
    if (error) {
      if (error.code === '23505') return { error: 'Lokasi dengan nama tersebut sudah ada.' };
      return { error: error.message || 'Gagal menambahkan lokasi.' };
    }

    await logActivity(await createClient(), { actorId: userId, action: 'Membuat lokasi', entityType: 'location', notes: fields.name });
    revalidatePath('/dashboard/master-data/location');
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server saat menambahkan lokasi.' };
  }
}

export async function updateLocation(id: string, formData: FormData) {
  try {
    const { error: permError, userId } = await requireLocationAccess();
    if (permError || !userId) return { error: permError };

    const fields = readFields(formData);
    if (!fields.name) return { error: 'Nama lokasi wajib diisi.' };

    const admin = createAdminClient();
    const { error } = await admin.from('locations').update(fields).eq('id', id);
    if (error) {
      if (error.code === '23505') return { error: 'Lokasi dengan nama tersebut sudah ada.' };
      return { error: error.message || 'Gagal mengubah lokasi.' };
    }
    // Nama di proyek yang sudah memakai lokasi ini ikut disinkronkan (projects.location = teks turunan).
    await admin.from('projects').update({ location: fields.name }).eq('location_id', id);

    await logActivity(await createClient(), { actorId: userId, action: 'Mengubah lokasi', entityType: 'location', entityId: id, notes: fields.name });
    revalidatePath('/dashboard/master-data/location');
    revalidatePath('/dashboard/master-data/project');
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server saat mengubah lokasi.' };
  }
}

export async function toggleLocationActive(id: string, isActive: boolean) {
  try {
    const { error: permError, userId } = await requireLocationAccess();
    if (permError || !userId) return { error: permError };
    const { error } = await createAdminClient().from('locations').update({ is_active: isActive }).eq('id', id);
    if (error) return { error: error.message || 'Gagal mengubah status lokasi.' };
    await logActivity(await createClient(), { actorId: userId, action: isActive ? 'Mengaktifkan lokasi' : 'Menonaktifkan lokasi', entityType: 'location', entityId: id });
    revalidatePath('/dashboard/master-data/location');
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server.' };
  }
}

export async function deleteLocation(id: string) {
  try {
    const { error: permError, userId } = await requireLocationAccess();
    if (permError || !userId) return { error: permError };

    const admin = createAdminClient();
    const { count } = await admin.from('projects').select('id', { count: 'exact', head: true }).eq('location_id', id);
    if ((count ?? 0) > 0) {
      return { error: `Lokasi dipakai ${count} proyek dan tidak bisa dihapus. Nonaktifkan saja.` };
    }
    const { error } = await admin.from('locations').delete().eq('id', id);
    if (error) return { error: error.message || 'Gagal menghapus lokasi.' };

    await logActivity(await createClient(), { actorId: userId, action: 'Menghapus lokasi', entityType: 'location', entityId: id });
    revalidatePath('/dashboard/master-data/location');
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server saat menghapus lokasi.' };
  }
}
