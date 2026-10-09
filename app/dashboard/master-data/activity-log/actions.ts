'use server';

import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { isOnline } from '@/lib/presence';

export interface OnlineUser {
  userId: string;
  fullName: string | null;
  type: string | null;
  role: string | null;
  jabatan: string | null;
  currentPath: string | null;
  lastSeenAt: string;
}

export interface ActivityFeedRow {
  id: string;
  createdAt: string;
  action: string;
  notes: string | null;
  kind: 'activity' | 'document';
  /** entity_type (activity_logs) atau doc_type (document_logs). */
  category: string;
  actorName: string | null;
  actorJabatan: string | null;
  actorType: string | null;
}

/** Gerbang yang sama dengan layout.tsx — dicek lagi karena server action bisa dipanggil langsung. */
async function requireActivityLogAccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const allowed = await hasPermissionForUser(supabase, user.id, 'activityLog', 'view');
  return allowed ? supabase : null;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export async function getOnlineUsers(): Promise<OnlineUser[]> {
  const supabase = await requireActivityLogAccess();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('user_presence')
    .select('user_id, current_path, last_seen_at, profiles ( full_name, type, role, jabatan )')
    .order('last_seen_at', { ascending: false });
  if (error) { console.error('getOnlineUsers error:', error.message); return []; }

  return (data || [])
    .filter((r: any) => isOnline(r.last_seen_at))
    .map((r: any) => {
      const p: any = one(r.profiles);
      return {
        userId: r.user_id,
        fullName: p?.full_name ?? null,
        type: p?.type ?? null,
        role: p?.role ?? null,
        jabatan: p?.jabatan ?? null,
        currentPath: r.current_path ?? null,
        lastSeenAt: r.last_seen_at,
      };
    });
}

/**
 * Gabungan activity_logs + document_logs (read-only), terbaru dulu. Dua query
 * lalu digabung di JS: kolom kedua tabel berbeda, dan `limit` per tabel
 * cukup untuk menjamin `limit` teratas gabungan benar (tiap tabel paling
 * banyak menyumbang `limit` baris ke hasil akhir).
 */
export async function getActivityFeed(opts: { limit?: number } = {}): Promise<ActivityFeedRow[]> {
  const limit = opts.limit ?? 50;
  const supabase = await requireActivityLogAccess();
  if (!supabase) return [];

  const [activityRes, docRes] = await Promise.all([
    supabase
      .from('activity_logs')
      .select('id, action, entity_type, notes, created_at, profiles ( full_name, type, jabatan )')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('document_logs')
      .select('id, action, doc_type, notes, created_at, profiles ( full_name, type, jabatan )')
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);
  if (activityRes.error) console.error('getActivityFeed activity_logs error:', activityRes.error.message);
  if (docRes.error) console.error('getActivityFeed document_logs error:', docRes.error.message);

  const rows: ActivityFeedRow[] = [
    ...(activityRes.data || []).map((r: any) => {
      const p: any = one(r.profiles);
      return {
        id: `a-${r.id}`, createdAt: r.created_at, action: r.action, notes: r.notes ?? null,
        kind: 'activity' as const, category: r.entity_type,
        actorName: p?.full_name ?? null, actorJabatan: p?.jabatan ?? null, actorType: p?.type ?? null,
      };
    }),
    ...(docRes.data || []).map((r: any) => {
      const p: any = one(r.profiles);
      return {
        id: `d-${r.id}`, createdAt: r.created_at, action: r.action, notes: r.notes ?? null,
        kind: 'document' as const, category: r.doc_type,
        actorName: p?.full_name ?? null, actorJabatan: p?.jabatan ?? null, actorType: p?.type ?? null,
      };
    }),
  ];

  return rows
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
