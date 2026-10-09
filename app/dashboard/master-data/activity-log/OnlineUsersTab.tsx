'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Users, Clock, ChevronRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getRoleLabel } from '@/lib/roles';
import { labelForPath } from '@/lib/presence-labels';
import { isOnline } from '@/lib/presence';
import { getOnlineUsers } from './actions';
import type { OnlineUser } from './types';
import { TypeBadge, timeAgo } from './activity-ui';

const PRUNE_MS = 10_000;
const POLL_FALLBACK_MS = 30_000;
const POLL_RESYNC_MS = 30_000;
const REFETCH_DEBOUNCE_MS = 500;

/**
 * Daftar pengguna online. Sumber utama: Supabase Realtime (postgres_changes
 * pada user_presence) — heartbeat user lain muncul di sini seketika. Realtime
 * menghormati RLS, jadi event hanya sampai ke pemegang activityLog.view.
 *
 * Realtime hanya memberi tahu ADA perubahan baris; user yang berhenti
 * heartbeat tidak menghasilkan event apa pun. Karena itu daftar dipangkas
 * lokal tiap 10 detik memakai aturan 2 menit yang sama dengan server. Kalau
 * kanal gagal tersambung, jatuh ke polling 30 detik; saat tersambung tetap ada
 * sinkronisasi ulang tiap 30 detik untuk mengoreksi event yang terlewat, plus
 * sinkron seketika saat tab kembali aktif atau kanal tersambung ulang.
 */
export default function OnlineUsersTab({
  initialUsers, onSelectUser, onCountChange,
}: {
  initialUsers: OnlineUser[];
  onSelectUser: (userId: string) => void;
  onCountChange: (n: number) => void;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [live, setLive] = useState(false);
  const [, setTick] = useState(0);
  const knownIds = useRef(new Set(initialUsers.map(u => u.userId)));
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    const fresh = await getOnlineUsers();
    knownIds.current = new Set(fresh.map(u => u.userId));
    setUsers(fresh);
  }, []);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => { refetch(); }, REFETCH_DEBOUNCE_MS);
  }, [refetch]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let wasSubscribed = false;

    // Pastikan kanal Realtime bergabung dengan JWT user, bukan anon key —
    // kalau subscribe lebih dulu dari sesi terbaca, RLS menyaring semua event
    // dan tab terlihat "Live" padahal tidak pernah menerima apa-apa.
    const start = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      } catch {
        // lanjut tanpa setAuth; polling fallback tetap menjaga daftar segar.
      }
      if (cancelled) return;

      channel = supabase
        .channel('user-presence-watch')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, (payload) => {
          const row = payload.new as { user_id?: string; current_path?: string | null; last_seen_at?: string } | undefined;
          const oldRow = payload.old as { user_id?: string } | undefined;

          if (payload.eventType === 'DELETE') {
            const id = oldRow?.user_id;
            if (id) {
              knownIds.current.delete(id);
              setUsers(prev => prev.filter(u => u.userId !== id));
            }
            return;
          }
          if (!row?.user_id || !row.last_seen_at) return;
          const userId = row.user_id;

          if (!isOnline(row.last_seen_at)) {
            // Sinyal "keluar" (tab terakhir ditutup): last_seen_at digeser ke belakang.
            knownIds.current.delete(userId);
            setUsers(prev => prev.filter(u => u.userId !== userId));
            return;
          }
          if (knownIds.current.has(userId)) {
            setUsers(prev => prev.map(u => u.userId === userId
              ? { ...u, currentPath: row.current_path ?? null, lastSeenAt: row.last_seen_at! }
              : u));
          } else {
            // Pengguna yang belum ada di daftar — profilnya tidak ikut di event, ambil ulang.
            scheduleRefetch();
          }
        })
        .subscribe((status) => {
          const subscribed = status === 'SUBSCRIBED';
          setLive(subscribed);
          // Setelah (re)connect, event selama kanal putus sudah hilang — ambil ulang.
          if (subscribed && wasSubscribed) scheduleRefetch();
          if (subscribed) wasSubscribed = true;
        });
    };
    start();

    return () => {
      cancelled = true;
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [scheduleRefetch]);

  // Tab di-background dibatasi browser (timer & WebSocket), event bisa terlewat.
  // Begitu admin kembali ke tab ini, langsung sinkron.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refetch(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refetch]);

  useEffect(() => {
    const id = setInterval(refetch, live ? POLL_RESYNC_MS : POLL_FALLBACK_MS);
    return () => clearInterval(id);
  }, [live, refetch]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), PRUNE_MS);
    return () => clearInterval(id);
  }, []);

  const online = users.filter(u => isOnline(u.lastSeenAt));
  useEffect(() => { onCountChange(online.length); }, [online.length, onCountChange]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
        <span className="text-xs font-bold text-slate-500">{online.length} pengguna online</span>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${live ? 'text-emerald-600' : 'text-slate-400'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          {live ? 'Live' : 'Memperbarui tiap 30 detik'}
        </span>
      </div>

      {online.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
          <Users className="w-10 h-10 opacity-30" />
          <p className="text-sm">Tidak ada pengguna online saat ini.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {online.map(u => (
            <li key={u.userId}>
              <button
                onClick={() => onSelectUser(u.userId)}
                className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-800 truncate">{u.fullName || 'Tanpa nama'}</span>
                      <TypeBadge type={u.type} />
                    </div>
                    <p className="text-xs text-slate-500 truncate">{u.jabatan || getRoleLabel(u.role)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:justify-end text-xs">
                  <span className="font-semibold text-slate-700">Sedang di: {labelForPath(u.currentPath)}</span>
                  <span className="flex items-center gap-1 text-slate-400 shrink-0"><Clock className="w-3.5 h-3.5" /> {timeAgo(u.lastSeenAt)}</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
