'use server';

import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { isOnline } from '@/lib/presence';
import { labelForPath } from '@/lib/presence-labels';
import { describeUserAgent } from '@/lib/user-agent';
import type { ActivityMetadata } from '@/lib/activity-diff';
import type {
  OnlineUser, ActivityFeedRow, FeedFilters, FeedPage, SecurityAlert, UserDetail, UserSession,
} from './types';

const ACTIVITY_CATEGORIES = ['auth', 'vendor', 'account', 'role', 'project', 'announcement', 'pgsol_assignment'];
const DOCUMENT_CATEGORIES = ['procedure', 'jsa', 'ptw'];
// Batas baris per request di Supabase (max_rows) — tidak ada gunanya meminta lebih.
const MAX_PAGE = 1000;
const EXPORT_MAX_ROWS = 5000;

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

/** Buang karakter yang punya arti khusus di filter PostgREST (.or) dan wildcard LIKE. */
function sanitizeSearch(raw: string | undefined): string {
  return (raw ?? '').replace(/[,()%*\\"]/g, ' ').trim().slice(0, 80);
}

function dayStart(d: string) { return `${d}T00:00:00+07:00`; }
function dayEnd(d: string) { return `${d}T23:59:59.999+07:00`; }

// ---------------------------------------------------------------------------
// Pengguna online
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Feed aktivitas
// ---------------------------------------------------------------------------

/**
 * Gabungan activity_logs + document_logs (read-only), terbaru dulu, dengan
 * filter yang sama untuk keduanya. Dua query lalu digabung di JS: kolom kedua
 * tabel berbeda. Cursor `before` (created_at) dipakai untuk halaman berikutnya;
 * `limit` per tabel cukup menjamin `limit` teratas gabungan benar karena tiap
 * tabel paling banyak menyumbang `limit` baris.
 */
async function buildFeed(supabase: any, filters: FeedFilters, limit: number, before?: string): Promise<FeedPage> {
  const pageSize = Math.min(Math.max(limit, 1), MAX_PAGE);
  const kind = filters.kind ?? 'all';
  const category = filters.category || undefined;
  const search = sanitizeSearch(filters.search);

  // Kategori menentukan tabel mana yang relevan; tabel yang tak mungkin cocok dilewati.
  const wantActivity = kind !== 'document' && (!category || ACTIVITY_CATEGORIES.includes(category));
  const wantDocument = kind !== 'activity' && (!category || DOCUMENT_CATEGORIES.includes(category));

  // Pencarian juga mencocokkan NAMA pelaku, yang ada di tabel profiles, bukan di log.
  let nameMatchIds: string[] = [];
  if (search) {
    const { data } = await supabase.from('profiles').select('id').ilike('full_name', `%${search}%`).limit(50);
    nameMatchIds = (data || []).map((p: { id: string }) => p.id);
  }

  const applyCommon = (q: any, searchColumns: string[], categoryColumn: string) => {
    if (category) q = q.eq(categoryColumn, category);
    if (filters.actorId) q = q.eq('actor_id', filters.actorId);
    if (filters.from) q = q.gte('created_at', dayStart(filters.from));
    if (filters.to) q = q.lte('created_at', dayEnd(filters.to));
    if (before) q = q.lt('created_at', before);
    if (search) {
      const parts = searchColumns.map(c => `${c}.ilike.%${search}%`);
      if (nameMatchIds.length > 0) parts.push(`actor_id.in.(${nameMatchIds.join(',')})`);
      q = q.or(parts.join(','));
    }
    return q;
  };

  const activityQuery = wantActivity
    ? applyCommon(
        supabase
          .from('activity_logs')
          .select('id, action, entity_type, notes, created_at, actor_id, ip_address, user_agent, metadata, profiles ( full_name, type, jabatan )')
          .order('created_at', { ascending: false })
          .limit(pageSize),
        ['action', 'notes', 'ip_address'],
        'entity_type',
      )
    : null;
  const docQuery = wantDocument
    ? applyCommon(
        supabase
          .from('document_logs')
          .select('id, action, doc_type, notes, created_at, actor_id, profiles ( full_name, type, jabatan )')
          .order('created_at', { ascending: false })
          .limit(pageSize),
        ['action', 'notes'],
        'doc_type',
      )
    : null;

  const [activityRes, docRes] = await Promise.all([
    activityQuery ?? Promise.resolve({ data: [], error: null }),
    docQuery ?? Promise.resolve({ data: [], error: null }),
  ]);
  if (activityRes.error) console.error('buildFeed activity_logs error:', activityRes.error.message);
  if (docRes.error) console.error('buildFeed document_logs error:', docRes.error.message);

  const rows: ActivityFeedRow[] = [
    ...(activityRes.data || []).map((r: any): ActivityFeedRow => {
      const p: any = one(r.profiles);
      return {
        id: `a-${r.id}`, createdAt: r.created_at, action: r.action, notes: r.notes ?? null,
        kind: 'activity', category: r.entity_type,
        actorId: r.actor_id ?? null,
        actorName: p?.full_name ?? null, actorJabatan: p?.jabatan ?? null, actorType: p?.type ?? null,
        ipAddress: r.ip_address ?? null, userAgent: r.user_agent ?? null,
        metadata: (r.metadata as ActivityMetadata | null) ?? null,
      };
    }),
    ...(docRes.data || []).map((r: any): ActivityFeedRow => {
      const p: any = one(r.profiles);
      return {
        id: `d-${r.id}`, createdAt: r.created_at, action: r.action, notes: r.notes ?? null,
        kind: 'document', category: r.doc_type,
        actorId: r.actor_id ?? null,
        actorName: p?.full_name ?? null, actorJabatan: p?.jabatan ?? null, actorType: p?.type ?? null,
        ipAddress: null, userAgent: null, metadata: null,
      };
    }),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const hasMore =
    rows.length > pageSize ||
    (activityRes.data || []).length === pageSize ||
    (docRes.data || []).length === pageSize;

  return { rows: rows.slice(0, pageSize), hasMore };
}

export async function getActivityFeed(
  filters: FeedFilters = {},
  opts: { limit?: number; before?: string } = {},
): Promise<FeedPage> {
  const supabase = await requireActivityLogAccess();
  if (!supabase) return { rows: [], hasMore: false };
  return buildFeed(supabase, filters, opts.limit ?? 50, opts.before);
}

// ---------------------------------------------------------------------------
// Ekspor CSV
// ---------------------------------------------------------------------------

/** Sel diawali = + - @ dianggap rumus oleh Excel/Sheets (CSV injection) — awali dengan tanda kutip tunggal. */
function csvCell(v: string | null | undefined): string {
  let s = v ?? '';
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function summarizeChanges(m: ActivityMetadata | null): string {
  if (!m) return '';
  const parts: string[] = [];
  for (const c of m.changes ?? []) parts.push(`${c.label}: ${c.before ?? '(kosong)'} → ${c.after ?? '(kosong)'}`);
  if (m.permissions?.added.length) parts.push(`Permission ditambah: ${m.permissions.added.join(', ')}`);
  if (m.permissions?.removed.length) parts.push(`Permission dicabut: ${m.permissions.removed.join(', ')}`);
  if (m.reason) parts.push(`Alasan: ${m.reason}`);
  if (m.newDevice) parts.push('Perangkat baru');
  return parts.join('; ');
}

/** Mengembalikan isi CSV (UTF-8 + BOM supaya Excel membaca Unicode dengan benar), maksimal 5.000 baris. */
export async function exportActivityCsv(filters: FeedFilters = {}): Promise<{ csv: string; truncated: boolean } | { error: string }> {
  const supabase = await requireActivityLogAccess();
  if (!supabase) return { error: 'Anda tidak memiliki izin untuk mengekspor log aktivitas.' };

  const all: ActivityFeedRow[] = [];
  let before: string | undefined;
  let more = true;
  while (more && all.length < EXPORT_MAX_ROWS) {
    const page = await buildFeed(supabase, filters, MAX_PAGE, before);
    all.push(...page.rows);
    more = page.hasMore && page.rows.length > 0;
    before = page.rows[page.rows.length - 1]?.createdAt;
  }
  const truncated = more && all.length >= EXPORT_MAX_ROWS;
  const rows = all.slice(0, EXPORT_MAX_ROWS);

  const header = ['Waktu', 'Sumber', 'Kategori', 'Aksi', 'Catatan', 'Pelaku', 'Jabatan', 'Tipe', 'IP', 'Perangkat', 'Perubahan'];
  const lines = rows.map(r => [
    new Date(r.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
    r.kind === 'activity' ? 'Sistem' : 'Dokumen',
    r.category, r.action, r.notes,
    r.actorName ?? 'Sistem', r.actorJabatan, r.actorType,
    r.ipAddress, r.userAgent ? describeUserAgent(r.userAgent) : '',
    summarizeChanges(r.metadata),
  ].map(csvCell).join(','));

  return { csv: '﻿' + [header.map(csvCell).join(','), ...lines].join('\r\n'), truncated };
}

// ---------------------------------------------------------------------------
// Peringatan keamanan
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<SecurityAlert['severity'], number> = { high: 0, medium: 1, info: 2 };
const HOUR_MS = 60 * 60 * 1000;

/**
 * Sinyal sederhana dari log login 24 jam terakhir — heuristik untuk menarik
 * perhatian admin, bukan sistem deteksi intrusi:
 *   - satu email gagal login ≥3x dalam 1 jam (≥5x = tinggi)
 *   - satu IP gagal login ≥5x dalam 1 jam, atau menyasar ≥3 email berbeda
 *   - login sukses dari perangkat yang baru untuk akun itu
 *   - login ke portal yang salah
 */
export async function getSecurityAlerts(): Promise<SecurityAlert[]> {
  const supabase = await requireActivityLogAccess();
  if (!supabase) return [];

  const since24h = new Date(Date.now() - 24 * HOUR_MS).toISOString();
  const since1h = Date.now() - HOUR_MS;

  const [failsRes, newDeviceRes, rejectedRes] = await Promise.all([
    supabase.from('activity_logs').select('id, notes, ip_address, created_at')
      .eq('action', 'Login gagal').gte('created_at', since24h).order('created_at', { ascending: false }).limit(500),
    supabase.from('activity_logs').select('id, created_at, ip_address, user_agent, profiles ( full_name )')
      .eq('action', 'Login').eq('metadata->>newDevice', 'true').gte('created_at', since24h)
      .order('created_at', { ascending: false }).limit(20),
    supabase.from('activity_logs').select('id, created_at, notes, ip_address, metadata, profiles ( full_name )')
      .like('action', 'Login ditolak%').gte('created_at', since24h).order('created_at', { ascending: false }).limit(20),
  ]);

  const alerts: SecurityAlert[] = [];
  const recentFails = (failsRes.data || []).filter((f: any) => new Date(f.created_at).getTime() >= since1h);

  const byEmail = new Map<string, { n: number; at: string }>();
  const byIp = new Map<string, { n: number; emails: Set<string>; at: string }>();
  for (const f of recentFails as any[]) {
    const email = String(f.notes ?? '').toLowerCase();
    const e = byEmail.get(email) ?? { n: 0, at: f.created_at };
    e.n += 1;
    byEmail.set(email, e);
    if (f.ip_address) {
      const i = byIp.get(f.ip_address) ?? { n: 0, emails: new Set<string>(), at: f.created_at };
      i.n += 1;
      i.emails.add(email);
      byIp.set(f.ip_address, i);
    }
  }
  for (const [email, v] of byEmail) {
    if (v.n >= 3) alerts.push({
      id: `fail-email-${email}`, severity: v.n >= 5 ? 'high' : 'medium',
      title: 'Percobaan login gagal berulang',
      detail: `${email || '(email kosong)'} — ${v.n} kali gagal dalam 1 jam terakhir.`,
      at: v.at,
    });
  }
  for (const [ip, v] of byIp) {
    if (v.n >= 5 || v.emails.size >= 3) alerts.push({
      id: `fail-ip-${ip}`, severity: 'high',
      title: 'Banyak kegagalan login dari satu alamat IP',
      detail: `${ip} — ${v.n} kegagalan menyasar ${v.emails.size} akun berbeda dalam 1 jam terakhir.`,
      at: v.at,
    });
  }
  for (const r of (newDeviceRes.data || []) as any[]) {
    alerts.push({
      id: `newdev-${r.id}`, severity: 'info',
      title: 'Login dari perangkat baru',
      detail: `${one<any>(r.profiles)?.full_name ?? 'Pengguna'} — ${describeUserAgent(r.user_agent)}${r.ip_address ? ` · IP ${r.ip_address}` : ''}`,
      at: r.created_at,
    });
  }
  for (const r of (rejectedRes.data || []) as any[]) {
    alerts.push({
      id: `reject-${r.id}`, severity: 'medium',
      title: 'Login ke portal yang salah',
      detail: `${one<any>(r.profiles)?.full_name ?? r.notes ?? 'Pengguna'} — ${(r.metadata as ActivityMetadata | null)?.reason ?? 'akun tidak sesuai portal'}${r.ip_address ? ` · IP ${r.ip_address}` : ''}`,
      at: r.created_at,
    });
  }

  return alerts
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.at.localeCompare(a.at))
    .slice(0, 12);
}

// ---------------------------------------------------------------------------
// Detail satu pengguna
// ---------------------------------------------------------------------------

const SESSION_GAP_MS = 3 * 60 * 1000;
// Satu heartbeat = ~60 detik; kunjungan yang cuma terlihat sekali tetap dihitung singkat, bukan 0.
const MIN_VISIT_MS = 30_000;

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const supabase = await requireActivityLogAccess();
  if (!supabase) return null;

  const since7d = new Date(Date.now() - 7 * 24 * HOUR_MS).toISOString();
  const since30d = new Date(Date.now() - 30 * 24 * HOUR_MS).toISOString();

  const [profileRes, presenceRes, historyRes, loginsRes, loginCountRes, feed] = await Promise.all([
    supabase.from('profiles').select('full_name, type, role, jabatan').eq('id', userId).single(),
    supabase.from('user_presence').select('current_path, last_seen_at').eq('user_id', userId).maybeSingle(),
    supabase.from('presence_history').select('path, entered_at, last_seen_at')
      .eq('user_id', userId).gte('entered_at', since7d).order('entered_at', { ascending: false }).limit(500),
    supabase.from('activity_logs').select('created_at, ip_address, user_agent, metadata')
      .eq('actor_id', userId).eq('action', 'Login').order('created_at', { ascending: false }).limit(5),
    supabase.from('activity_logs').select('id', { count: 'exact', head: true })
      .eq('actor_id', userId).eq('action', 'Login').gte('created_at', since30d),
    buildFeed(supabase, { actorId: userId }, 30),
  ]);
  if (!profileRes.data) return null;

  const history = ((historyRes.data || []) as Array<{ path: string | null; entered_at: string; last_seen_at: string }>);
  const visitMs = (h: { entered_at: string; last_seen_at: string }) =>
    Math.max(new Date(h.last_seen_at).getTime() - new Date(h.entered_at).getTime(), 0) + MIN_VISIT_MS;

  // Sesi = kunjungan berurutan dengan jeda antar-kunjungan ≤ 3 menit.
  const ascending = [...history].reverse();
  const sessions: UserSession[] = [];
  let current: { start: string; end: string; pages: number } | null = null;
  for (const h of ascending) {
    if (current && new Date(h.entered_at).getTime() - new Date(current.end).getTime() <= SESSION_GAP_MS) {
      if (h.last_seen_at > current.end) current.end = h.last_seen_at;
      current.pages += 1;
    } else {
      if (current) sessions.push({ ...current, minutes: Math.round((new Date(current.end).getTime() - new Date(current.start).getTime()) / 60000) });
      current = { start: h.entered_at, end: h.last_seen_at, pages: 1 };
    }
  }
  if (current) sessions.push({ ...current, minutes: Math.round((new Date(current.end).getTime() - new Date(current.start).getTime()) / 60000) });

  const perModule = new Map<string, number>();
  for (const h of history) {
    const label = labelForPath(h.path);
    perModule.set(label, (perModule.get(label) ?? 0) + visitMs(h));
  }

  const p = profileRes.data as { full_name: string | null; type: string | null; role: string | null; jabatan: string | null };
  const presence = presenceRes.data as { current_path: string | null; last_seen_at: string } | null;

  return {
    userId,
    fullName: p.full_name, type: p.type, role: p.role, jabatan: p.jabatan,
    online: isOnline(presence?.last_seen_at),
    lastSeenAt: presence?.last_seen_at ?? null,
    currentPath: presence?.current_path ?? null,
    loginCount30d: loginCountRes.count ?? 0,
    logins: ((loginsRes.data || []) as any[]).map(l => ({
      at: l.created_at, ip: l.ip_address ?? null, userAgent: l.user_agent ?? null,
      newDevice: !!(l.metadata as ActivityMetadata | null)?.newDevice,
    })),
    sessions: sessions.reverse().slice(0, 8),
    moduleTime: [...perModule.entries()]
      .map(([label, ms]) => ({ label, minutes: Math.max(Math.round(ms / 60000), 1) }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 6),
    recentVisits: history.slice(0, 15).map(h => ({
      label: labelForPath(h.path), at: h.entered_at, seconds: Math.round(visitMs(h) / 1000),
    })),
    activity: feed.rows,
  };
}
