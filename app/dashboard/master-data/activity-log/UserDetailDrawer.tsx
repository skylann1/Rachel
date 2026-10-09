'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2, Clock, LogIn, Monitor, Timer, History } from 'lucide-react';
import { getUserDetail } from './actions';
import type { UserDetail } from './types';
import { getRoleLabel } from '@/lib/roles';
import { labelForPath } from '@/lib/presence-labels';
import { describeUserAgent } from '@/lib/user-agent';
import { TypeBadge, formatDateTime, formatDuration, initials, timeAgo } from './activity-ui';
import { FeedRow } from './ActivityFeedTab';

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
        <Icon className="w-3.5 h-3.5" /> {title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl px-4 py-3">{children}</p>;
}

/**
 * Panel samping detail satu pengguna: status online, waktu per modul (7 hari),
 * sesi, login terakhir, halaman terakhir dibuka, dan aktivitas terbarunya.
 * Dibuka dari tab Pengguna Online maupun dari nama pelaku di Riwayat.
 */
export default function UserDetailDrawer({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setDetail(null);
    getUserDetail(userId)
      .then(d => { if (!cancelled) { setDetail(d); setFailed(!d); } })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [userId, onClose]);

  if (!userId) return null;

  const totalMinutes = detail?.sessions.reduce((s, x) => s + x.minutes, 0) ?? 0;
  const maxModule = Math.max(...(detail?.moduleTime.map(m => m.minutes) ?? [1]), 1);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Detail pengguna"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-6 py-5 bg-white/95 backdrop-blur border-b border-slate-100">
          {detail ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black flex items-center justify-center">
                {initials(detail.fullName)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-slate-900 truncate">{detail.fullName || 'Tanpa nama'}</h2>
                  <TypeBadge type={detail.type} />
                </div>
                <p className="text-xs text-slate-500 truncate">{detail.jabatan || getRoleLabel(detail.role)}</p>
                <p className="text-xs mt-1 flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${detail.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  {detail.online
                    ? <span className="font-semibold text-emerald-700">Online · {labelForPath(detail.currentPath)}</span>
                    : <span className="text-slate-500">{detail.lastSeenAt ? `Terakhir terlihat ${timeAgo(detail.lastSeenAt)}` : 'Belum pernah terlihat'}</span>}
                </p>
              </div>
            </div>
          ) : (
            <h2 className="font-bold text-slate-900">Detail Pengguna</h2>
          )}
          <button onClick={onClose} aria-label="Tutup" className="shrink-0 w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-7">
          {loading && (
            <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          )}
          {failed && !loading && <Empty>Detail pengguna tidak dapat dimuat.</Empty>}

          {detail && !loading && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Login (30 hari)', value: String(detail.loginCount30d) },
                  { label: 'Sesi (7 hari)', value: String(detail.sessions.length) },
                  { label: 'Aktif (7 hari)', value: formatDuration(totalMinutes) },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3">
                    <div className="text-lg font-black text-slate-800 leading-tight">{s.value}</div>
                    <div className="text-[11px] font-semibold text-slate-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              <Section title="Waktu per modul · 7 hari" icon={Timer}>
                {detail.moduleTime.length === 0 ? <Empty>Belum ada riwayat halaman.</Empty> : (
                  <ul className="space-y-2.5">
                    {detail.moduleTime.map(m => (
                      <li key={m.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-semibold text-slate-700 truncate pr-2">{m.label}</span>
                          <span className="text-slate-500 shrink-0">{formatDuration(m.minutes)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max((m.minutes / maxModule) * 100, 4)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Sesi online terakhir" icon={Clock}>
                {detail.sessions.length === 0 ? <Empty>Belum ada sesi tercatat.</Empty> : (
                  <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {detail.sessions.map(s => (
                      <li key={s.start} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                        <span className="font-semibold text-slate-700">{formatDateTime(s.start)}</span>
                        <span className="text-slate-500 shrink-0">{formatDuration(s.minutes)} · {s.pages} halaman</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Login terakhir" icon={LogIn}>
                {detail.logins.length === 0 ? <Empty>Belum ada login tercatat.</Empty> : (
                  <ul className="space-y-2">
                    {detail.logins.map(l => (
                      <li key={l.at} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5 text-xs">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                            <Monitor className="w-3.5 h-3.5 text-slate-400" /> {describeUserAgent(l.userAgent)}
                            {l.newDevice && <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">Baru</span>}
                          </div>
                          <div className="text-slate-400 mt-0.5">{l.ip ? `IP ${l.ip}` : 'IP tidak tercatat'}</div>
                        </div>
                        <span className="text-slate-500 shrink-0">{formatDateTime(l.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Halaman terakhir dibuka" icon={History}>
                {detail.recentVisits.length === 0 ? <Empty>Belum ada riwayat halaman.</Empty> : (
                  <ul className="space-y-1.5">
                    {detail.recentVisits.map(v => (
                      <li key={v.at} className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-slate-700 truncate">{v.label}</span>
                        <span className="text-slate-400 shrink-0">{timeAgo(v.at)} · {formatDuration(Math.max(Math.round(v.seconds / 60), 0))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Aktivitas terbaru" icon={History}>
                {detail.activity.length === 0 ? <Empty>Belum ada aktivitas tercatat.</Empty> : (
                  <ul className="divide-y divide-slate-100">
                    {detail.activity.map(row => <FeedRow key={row.id} row={row} compact />)}
                  </ul>
                )}
              </Section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
