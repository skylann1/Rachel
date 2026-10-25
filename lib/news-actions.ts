'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { insertNotificationsWithPush } from '@/lib/push';
import { newsState, normalizeAttachments, type NewsItem } from '@/lib/news';

type Viewer = { id: string; type: 'pgn' | 'pgsol' | 'vendor' };

async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('type').eq('id', user.id).maybeSingle();
  const type = data?.type;
  if (type !== 'pgn' && type !== 'pgsol' && type !== 'vendor') return null;
  return { id: user.id, type };
}

const newsPath = (type: Viewer['type']) => (type === 'vendor' ? '/vendor/dashboard/news' : '/dashboard/news');

function toItem(r: any): NewsItem {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    content: r.content ?? null,
    image_url: r.image_url,
    category: r.category || 'Info',
    audience: Array.isArray(r.audience) ? r.audience : ['pgn', 'pgsol', 'vendor'],
    is_active: !!r.is_active,
    is_pinned: !!r.is_pinned,
    is_mandatory: !!r.is_mandatory,
    display_order: r.display_order ?? 0,
    publish_at: r.publish_at ?? null,
    expires_at: r.expires_at ?? null,
    attachments: normalizeAttachments(r.attachments),
    created_at: r.created_at,
  };
}

/**
 * Kirim notifikasi satu kali ketika pengumuman mulai tayang (langsung atau saat
 * jadwalnya tiba). `notified_at` di-klaim secara atomik supaya tidak dobel.
 */
async function dispatchDueNotifications() {
  try {
    const admin = createAdminClient();
    const { data: rows } = await admin.from('announcements')
      .select('id, title, description, audience, is_mandatory, is_active, publish_at, expires_at')
      .eq('is_active', true).is('notified_at', null);
    for (const r of rows ?? []) {
      if (newsState(r) !== 'live') continue;
      const { data: claimed } = await admin.from('announcements')
        .update({ notified_at: new Date().toISOString() }).eq('id', r.id).is('notified_at', null).select('id');
      if (!claimed || claimed.length === 0) continue;

      const audience: string[] = Array.isArray(r.audience) ? r.audience : [];
      if (audience.length === 0) continue;
      const { data: users } = await admin.from('profiles').select('id, type').in('type', audience);
      const rowsToInsert = (users ?? []).map((u: any) => ({
        user_id: u.id,
        type: (r.is_mandatory ? 'action_required' : 'info') as 'action_required' | 'info',
        title: r.is_mandatory ? `Wajib Dibaca: ${r.title}` : `Pengumuman: ${r.title}`,
        message: r.description || r.title,
        link: `${newsPath(u.type)}/${r.id}`,
      }));
      await insertNotificationsWithPush(admin, rowsToInsert);
    }
  } catch (e) {
    console.error('dispatchDueNotifications error:', e);
  }
}

/** Semua pengumuman yang boleh dilihat pemanggil: aktif, sudah terbit, belum kedaluwarsa, sesuai audiens. */
async function visibleNews(viewer: Viewer): Promise<NewsItem[]> {
  const supabase = await createClient();
  const [{ data, error }, { data: reads }] = await Promise.all([
    supabase.from('announcements').select('*').eq('is_active', true),
    supabase.from('announcement_reads').select('announcement_id, acknowledged_at').eq('user_id', viewer.id),
  ]);
  if (error) { console.error('visibleNews error:', error.message); return []; }
  const readMap = new Map((reads ?? []).map((r: any) => [r.announcement_id, r]));
  const now = new Date();
  return (data ?? [])
    .map(toItem)
    .filter((n) => newsState(n, now) === 'live' && n.audience.includes(viewer.type))
    .map((n) => ({ ...n, is_read: readMap.has(n.id), is_acknowledged: !!readMap.get(n.id)?.acknowledged_at }))
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || a.display_order - b.display_order || b.created_at.localeCompare(a.created_at));
}

/** Untuk carousel di home (pin lebih dulu). */
export async function getActiveNews(): Promise<NewsItem[]> {
  const viewer = await getViewer();
  if (!viewer) return [];
  await dispatchDueNotifications();
  return visibleNews(viewer);
}

/** Daftar berita untuk halaman News (filter kategori & pencarian). */
export async function getNewsFeed(): Promise<NewsItem[]> {
  const viewer = await getViewer();
  if (!viewer) return [];
  return visibleNews(viewer);
}

export async function getNewsItem(id: string): Promise<NewsItem | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  const all = await visibleNews(viewer);
  return all.find((n) => n.id === id) ?? null;
}

/** Catat bahwa pemanggil telah membuka pengumuman (idempoten, tidak menimpa waktu baca pertama). */
export async function markNewsRead(id: string) {
  const viewer = await getViewer();
  if (!viewer) return;
  const supabase = await createClient();
  await supabase.from('announcement_reads')
    .upsert({ announcement_id: id, user_id: viewer.id }, { onConflict: 'announcement_id,user_id', ignoreDuplicates: true });
  revalidatePath(newsPath(viewer.type));
}

/** "Saya sudah membaca & memahami" untuk pengumuman wajib-baca. */
export async function acknowledgeNews(id: string) {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Unauthorized' };
  const item = await getNewsItem(id);
  if (!item) return { error: 'Pengumuman tidak ditemukan.' };
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from('announcement_reads')
    .upsert({ announcement_id: id, user_id: viewer.id, acknowledged_at: now }, { onConflict: 'announcement_id,user_id' });
  if (error) return { error: error.message };
  revalidatePath(newsPath(viewer.type));
  revalidatePath(viewer.type === 'vendor' ? '/vendor/dashboard' : '/dashboard');
  return { success: true as const };
}
