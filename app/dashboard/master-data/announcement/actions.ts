'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { revalidatePath } from 'next/cache';
import { logActivity } from '@/lib/activity-log';
import { diffFields, type FieldChange } from '@/lib/activity-diff';
import { getActiveNews } from '@/lib/news-actions';
import { ALL_AUDIENCES, NEWS_CATEGORIES, normalizeAttachments, type NewsItem } from '@/lib/news';

/** Bentuk data pengumuman (dipakai carousel & halaman kelola). */
export type Announcement = NewsItem;

export interface AnnouncementWithStats extends NewsItem {
  read_count: number;
  ack_count: number;
  target_count: number;
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
 * Dipakai kedua dashboard home (internal & vendor). Hanya yang sedang tayang
 * dan sesuai audiens pemanggil; pengumuman yang disematkan tampil lebih dulu.
 */
export async function getActiveAnnouncements(): Promise<Announcement[]> {
  return getActiveNews();
}

/**
 * Halaman kelola butuh semua baris (nonaktif, terjadwal, kedaluwarsa) beserta
 * statistik pembaca — pakai admin client, gate lewat requireAnnouncementAccess().
 */
export async function getAnnouncementsForManagement(): Promise<AnnouncementWithStats[]> {
  const { error: permError } = await requireAnnouncementAccess();
  if (permError) return [];

  const adminClient = createAdminClient();
  const [{ data, error }, { data: reads }, { data: profiles }] = await Promise.all([
    adminClient.from('announcements').select('*').order('is_pinned', { ascending: false }).order('display_order', { ascending: true }),
    adminClient.from('announcement_reads').select('announcement_id, acknowledged_at'),
    adminClient.from('profiles').select('type'),
  ]);

  if (error) {
    console.error('getAnnouncementsForManagement error:', error.message);
    return [];
  }

  const typeCount: Record<string, number> = {};
  (profiles ?? []).forEach((p: any) => { typeCount[p.type] = (typeCount[p.type] ?? 0) + 1; });
  const readCount = new Map<string, number>();
  const ackCount = new Map<string, number>();
  (reads ?? []).forEach((r: any) => {
    readCount.set(r.announcement_id, (readCount.get(r.announcement_id) ?? 0) + 1);
    if (r.acknowledged_at) ackCount.set(r.announcement_id, (ackCount.get(r.announcement_id) ?? 0) + 1);
  });

  return (data ?? []).map((r: any) => {
    const audience: string[] = Array.isArray(r.audience) ? r.audience : [...ALL_AUDIENCES];
    return {
      id: r.id, title: r.title, description: r.description ?? null, content: r.content ?? null, image_url: r.image_url,
      category: r.category || 'Info', audience, is_active: !!r.is_active, is_pinned: !!r.is_pinned, is_mandatory: !!r.is_mandatory,
      display_order: r.display_order ?? 0, publish_at: r.publish_at ?? null, expires_at: r.expires_at ?? null,
      attachments: normalizeAttachments(r.attachments), created_at: r.created_at,
      read_count: readCount.get(r.id) ?? 0,
      ack_count: ackCount.get(r.id) ?? 0,
      target_count: audience.reduce((sum, a) => sum + (typeCount[a] ?? 0), 0),
    };
  });
}

/** Daftar pembaca satu pengumuman (nama, tipe, waktu baca, waktu konfirmasi). */
export async function getNewsReaders(id: string) {
  const { error: permError } = await requireAnnouncementAccess();
  if (permError) return [];
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from('announcement_reads')
    .select('read_at, acknowledged_at, profiles ( full_name, type, role )')
    .eq('announcement_id', id)
    .order('read_at', { ascending: false });
  return (data ?? []).map((r: any) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return { name: p?.full_name || '-', type: p?.type || '-', role: p?.role || '', read_at: r.read_at as string, acknowledged_at: (r.acknowledged_at ?? null) as string | null };
  });
}

interface ParsedForm {
  title: string;
  description: string | null;
  content: string | null;
  image_url: string;
  category: string;
  audience: string[];
  display_order: number;
  publish_at: string | null;
  expires_at: string | null;
  is_pinned: boolean;
  is_mandatory: boolean;
  attachments: { name: string; url: string }[];
}

function parseForm(formData: FormData): { error: string } | { data: ParsedForm } {
  const title = ((formData.get('title') as string) || '').trim();
  const image_url = (formData.get('image_url') as string) || '';
  if (!title || !image_url) return { error: 'Judul dan gambar wajib diisi.' };

  const category = (formData.get('category') as string) || 'Info';
  const audience = formData.getAll('audience').map(String).filter((a) => (ALL_AUDIENCES as string[]).includes(a));
  if (audience.length === 0) return { error: 'Pilih minimal satu target audiens.' };

  const dateOrNull = (k: string) => {
    const v = (formData.get(k) as string) || '';
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };
  const publish_at = dateOrNull('publish_at');
  const expires_at = dateOrNull('expires_at');
  if (publish_at && expires_at && new Date(expires_at) <= new Date(publish_at)) {
    return { error: 'Tanggal kedaluwarsa harus setelah tanggal terbit.' };
  }

  let attachments: { name: string; url: string }[] = [];
  try { attachments = normalizeAttachments(JSON.parse((formData.get('attachments') as string) || '[]')); } catch { /* abaikan */ }

  return {
    data: {
      title,
      description: ((formData.get('description') as string) || '').trim() || null,
      content: ((formData.get('content') as string) || '').trim() || null,
      image_url,
      category: (NEWS_CATEGORIES as readonly string[]).includes(category) ? category : 'Info',
      audience,
      display_order: Number(formData.get('display_order')) || 0,
      publish_at,
      expires_at,
      is_pinned: formData.get('is_pinned') === 'on',
      is_mandatory: formData.get('is_mandatory') === 'on',
      attachments,
    },
  };
}

function revalidateAll() {
  revalidatePath('/dashboard/master-data/announcement');
  revalidatePath('/dashboard');
  revalidatePath('/vendor/dashboard');
  revalidatePath('/dashboard/news');
  revalidatePath('/vendor/dashboard/news');
}

export async function addAnnouncement(formData: FormData) {
  try {
    const { error: permError, userId } = await requireAnnouncementAccess();
    if (permError || !userId) return { error: permError };

    const parsed = parseForm(formData);
    if ('error' in parsed) return { error: parsed.error };

    const adminClient = createAdminClient();
    const { error } = await adminClient.from('announcements').insert({ ...parsed.data, created_by: userId });

    if (error) {
      return { error: error.message || 'Gagal menambahkan pengumuman.' };
    }

    await logActivity(await createClient(), { actorId: userId, action: 'Membuat pengumuman', entityType: 'announcement', notes: parsed.data.title });

    revalidateAll();
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server saat menambahkan pengumuman.' };
  }
}

export async function updateAnnouncement(id: string, formData: FormData) {
  try {
    const { error: permError, userId } = await requireAnnouncementAccess();
    if (permError) return { error: permError };

    const parsed = parseForm(formData);
    if ('error' in parsed) return { error: parsed.error };
    const d = parsed.data;

    const adminClient = createAdminClient();
    const { data: beforeAnn } = await adminClient
      .from('announcements')
      .select('title, description, content, image_url, display_order, category, is_pinned, is_mandatory')
      .eq('id', id)
      .single();

    const { error } = await adminClient
      .from('announcements')
      .update({ ...d, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { error: error.message || 'Gagal mengubah pengumuman.' };
    }

    // URL gambar terlalu panjang untuk ditampilkan sebagai before/after — cukup tandai diganti.
    const changes: FieldChange[] = diffFields(
      beforeAnn ?? {},
      { title: d.title, description: d.description, content: d.content, display_order: d.display_order, category: d.category, is_pinned: d.is_pinned, is_mandatory: d.is_mandatory },
      { title: 'Judul', description: 'Deskripsi', content: 'Isi berita', display_order: 'Urutan tampil', category: 'Kategori', is_pinned: 'Disematkan', is_mandatory: 'Wajib baca' },
    );
    if (beforeAnn && beforeAnn.image_url !== d.image_url) {
      changes.push({ field: 'image_url', label: 'Gambar', before: '(gambar lama)', after: '(gambar baru)' });
    }
    await logActivity(await createClient(), {
      actorId: userId, action: 'Mengubah pengumuman', entityType: 'announcement', entityId: id, notes: d.title,
      metadata: { changes },
    });

    revalidateAll();
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server saat mengubah pengumuman.' };
  }
}

export async function deleteAnnouncement(id: string) {
  try {
    const { error: permError, userId } = await requireAnnouncementAccess();
    if (permError) return { error: permError };

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) {
      return { error: error.message || 'Gagal menghapus pengumuman.' };
    }

    await logActivity(await createClient(), { actorId: userId, action: 'Menghapus pengumuman', entityType: 'announcement', entityId: id });

    revalidateAll();
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server saat menghapus pengumuman.' };
  }
}

export async function toggleAnnouncementActive(id: string, isActive: boolean) {
  try {
    const { error: permError, userId } = await requireAnnouncementAccess();
    if (permError) return { error: permError };

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('announcements')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { error: error.message || 'Gagal mengubah status pengumuman.' };
    }

    await logActivity(await createClient(), { actorId: userId, action: isActive ? 'Mengaktifkan pengumuman' : 'Menonaktifkan pengumuman', entityType: 'announcement', entityId: id });

    revalidateAll();
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server saat mengubah status pengumuman.' };
  }
}

export async function toggleAnnouncementPinned(id: string, pinned: boolean) {
  try {
    const { error: permError, userId } = await requireAnnouncementAccess();
    if (permError) return { error: permError };

    const { error } = await createAdminClient()
      .from('announcements')
      .update({ is_pinned: pinned, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: error.message || 'Gagal mengubah sematan.' };

    await logActivity(await createClient(), { actorId: userId, action: pinned ? 'Menyematkan pengumuman' : 'Melepas sematan pengumuman', entityType: 'announcement', entityId: id });
    revalidateAll();
    return { success: true as const };
  } catch {
    return { error: 'Terjadi kesalahan pada server.' };
  }
}
