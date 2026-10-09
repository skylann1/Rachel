'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, Users, Clock, LogIn, Building2, Shield, Briefcase, Megaphone, UserCog,
  FileText, ShieldAlert, Stamp, Loader2,
} from 'lucide-react';
import { getActivityFeed } from './actions';
import type { OnlineUser, ActivityFeedRow } from './actions';
import { labelForPath } from '@/lib/presence-labels';
import { getRoleLabel } from '@/lib/roles';

const ONLINE_REFRESH_MS = 30_000;
const PAGE_SIZE = 50;

function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Baru saja';
  if (min < 60) return `${min}m lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}j lalu`;
  const day = Math.floor(hr / 24);
  return `${day}h lalu`;
}

const TYPE_BADGE: Record<string, string> = {
  pgn: 'bg-blue-100 text-blue-700',
  pgsol: 'bg-violet-100 text-violet-700',
  vendor: 'bg-amber-100 text-amber-700',
};
const TYPE_LABEL: Record<string, string> = { pgn: 'PGN', pgsol: 'PGSOL', vendor: 'Vendor' };

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  auth: LogIn,
  vendor: Building2,
  account: Users,
  role: Shield,
  project: Briefcase,
  announcement: Megaphone,
  pgsol_assignment: UserCog,
  procedure: FileText,
  jsa: ShieldAlert,
  ptw: Stamp,
};

const CATEGORY_LABEL: Record<string, string> = {
  auth: 'Autentikasi',
  vendor: 'Vendor',
  account: 'Akun',
  role: 'Role',
  project: 'Proyek',
  announcement: 'Pengumuman',
  pgsol_assignment: 'Reviewer PGSOL',
  procedure: 'Prosedur Kerja',
  jsa: 'JSA',
  ptw: 'PTW',
};

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  return (
    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${TYPE_BADGE[type] ?? 'bg-slate-100 text-slate-600'}`}>
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}

export default function ActivityLogClient({
  initialOnlineUsers, initialFeed,
}: {
  initialOnlineUsers: OnlineUser[];
  initialFeed: ActivityFeedRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'online' | 'riwayat'>('online');
  const [feed, setFeed] = useState(initialFeed);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  // Daftar online berubah dalam skala menit — refresh ringan selama tab itu
  // yang sedang dilihat. router.refresh() menjalankan ulang page.tsx dan
  // mengirim initialOnlineUsers yang baru.
  useEffect(() => {
    if (tab !== 'online') return;
    const id = setInterval(() => router.refresh(), ONLINE_REFRESH_MS);
    return () => clearInterval(id);
  }, [tab, router]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextLimit = limit + PAGE_SIZE;
      const next = await getActivityFeed({ limit: nextLimit });
      setFeed(next);
      setLimit(nextLimit);
    } finally {
      setLoadingMore(false);
    }
  };

  const tabs = [
    { id: 'online' as const, label: 'Pengguna Online', icon: Users, count: initialOnlineUsers.length },
    { id: 'riwayat' as const, label: 'Riwayat Aktivitas', icon: Activity, count: null },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm w-fit">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 py-2.5 px-4 text-sm font-bold rounded-lg transition-all ${
                tab === t.id ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
              {t.count !== null && (
                <span className={`text-[10px] font-black rounded-full min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center ${
                  tab === t.id ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'
                }`}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'online' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {initialOnlineUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
              <Users className="w-10 h-10 opacity-30" />
              <p className="text-sm">Tidak ada pengguna online saat ini.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {initialOnlineUsers.map(u => (
                <li key={u.userId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4">
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
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'riwayat' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
              <Activity className="w-10 h-10 opacity-30" />
              <p className="text-sm">Belum ada aktivitas tercatat.</p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {feed.map(row => {
                  const Icon = CATEGORY_ICON[row.category] ?? Activity;
                  return (
                    <li key={row.id} className="flex gap-3 px-5 py-4">
                      <div className="shrink-0 w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{CATEGORY_LABEL[row.category] ?? row.category}</span>
                          <span className="text-sm font-bold text-slate-800">{row.action}</span>
                        </div>
                        {row.notes && <p className="text-sm text-slate-600 mt-0.5">{row.notes}</p>}
                        <p className="text-[11px] text-slate-400 mt-1">
                          {row.actorName || 'Sistem'}{row.actorJabatan ? ` · ${row.actorJabatan}` : ''} · {new Date(row.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <TypeBadge type={row.actorType} />
                    </li>
                  );
                })}
              </ul>
              {feed.length >= limit && (
                <div className="p-4 border-t border-slate-100 text-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition-colors"
                  >
                    {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                    Muat {PAGE_SIZE} lagi
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
