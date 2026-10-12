'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Bell, CheckCircle2, XCircle, MinusCircle, RefreshCw, AlertTriangle, BellRing } from 'lucide-react';
import type { CommunicationLogData, EmailStatus } from './types';

const STATUS_META: Record<EmailStatus, { label: string; chip: string; icon: React.ElementType }> = {
  sent: { label: 'Terkirim', chip: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  failed: { label: 'Gagal', chip: 'bg-rose-100 text-rose-700 border-rose-200', icon: XCircle },
  skipped: { label: 'Dilewati', chip: 'bg-slate-100 text-slate-600 border-slate-200', icon: MinusCircle },
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function CommunicationLogClient({ data }: { data: CommunicationLogData }) {
  const router = useRouter();
  const [tab, setTab] = useState<'email' | 'notifikasi'>('email');
  const [emailFilter, setEmailFilter] = useState<'all' | EmailStatus>('all');
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();

  const emails = useMemo(() => data.emails.filter(e =>
    (emailFilter === 'all' || e.status === emailFilter) &&
    (!q || e.to.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q)),
  ), [data.emails, emailFilter, q]);

  const notifications = useMemo(() => data.notifications.filter(n =>
    (notifFilter === 'all' || !n.isRead) &&
    (!q || (n.recipientName || '').toLowerCase().includes(q) || (n.recipientEmail || '').toLowerCase().includes(q)
      || n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)),
  ), [data.notifications, notifFilter, q]);

  return (
    <div className="space-y-5">
      {/* Status konfigurasi email */}
      {data.emailConfigured ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-emerald-800">Pengiriman email aktif</p>
            <p className="text-xs text-emerald-700 mt-0.5">Kunci Resend terpasang di server — email sungguh dikirim.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Pengiriman email NONAKTIF</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              <code className="font-mono">RESEND_API_KEY</code> belum diset di server. Semua email (mis. reset kata sandi)
              dilewati tanpa error. Notifikasi di dalam aplikasi tidak terpengaruh.
            </p>
          </div>
        </div>
      )}

      {/* Tab + pencarian */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm w-full sm:w-fit">
          <TabButton active={tab === 'email'} onClick={() => setTab('email')} icon={Mail} label="Email" count={data.emailCounts.sent + data.emailCounts.failed + data.emailCounts.skipped} />
          <TabButton active={tab === 'notifikasi'} onClick={() => setTab('notifikasi')} icon={Bell} label="Notifikasi" count={data.notificationCounts.total} />
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'email' ? 'Cari penerima atau subjek…' : 'Cari penerima atau isi notifikasi…'}
            className="w-full sm:w-72 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button onClick={() => router.refresh()} title="Muat ulang"
            className="shrink-0 p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-primary hover:border-primary transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {tab === 'email' ? (
        <div className="space-y-4">
          {!data.emailTableReady && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-xs text-amber-800 leading-relaxed">
              Tabel <code className="font-mono">email_logs</code> belum ada di database, jadi email belum tercatat.
              Jalankan <code className="font-mono">supabase/schema_email_logs.sql</code> di SQL Editor Supabase.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {([['all', 'Semua'], ['sent', 'Terkirim'], ['failed', 'Gagal'], ['skipped', 'Dilewati']] as const).map(([id, label]) => {
              const n = id === 'all' ? data.emails.length : data.emailCounts[id];
              return (
                <button key={id} onClick={() => setEmailFilter(id)} aria-pressed={emailFilter === id}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    emailFilter === id ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary'
                  }`}>
                  {label} <span className="opacity-70">{n}</span>
                </button>
              );
            })}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {emails.length === 0 ? (
              <Empty icon={Mail} text="Belum ada email tercatat." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {emails.map(e => {
                  const meta = STATUS_META[e.status];
                  const Icon = meta.icon;
                  return (
                    <li key={e.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{e.subject}</p>
                        <p className="text-xs text-slate-500 truncate">Kepada: {e.to}</p>
                        {e.error && <p className="text-xs text-rose-600 mt-1 break-words">{e.error}</p>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs">
                        <span className={`inline-flex items-center gap-1 font-bold border rounded-full px-2 py-0.5 ${meta.chip}`}>
                          <Icon className="w-3 h-3" /> {meta.label}
                        </span>
                        <span className="text-slate-400">{formatDateTime(e.createdAt)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([['all', 'Semua', data.notificationCounts.total], ['unread', 'Belum dibaca', data.notificationCounts.unread]] as const).map(([id, label, n]) => (
              <button key={id} onClick={() => setNotifFilter(id)} aria-pressed={notifFilter === id}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  notifFilter === id ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary'
                }`}>
                {label} <span className="opacity-70">{n}</span>
              </button>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {notifications.length === 0 ? (
              <Empty icon={BellRing} text="Tidak ada notifikasi untuk filter ini." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.map(n => (
                  <li key={n.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${n.isRead ? 'bg-slate-300' : 'bg-rose-500'}`} title={n.isRead ? 'Sudah dibaca' : 'Belum dibaca'} />
                        <p className="text-sm font-bold text-slate-800">{n.title}</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 break-words">{n.message}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Untuk: <span className="font-semibold text-slate-600">{n.recipientName || n.recipientEmail || 'Pengguna tidak dikenal'}</span>
                        {n.recipientType && <> · {n.recipientType.toUpperCase()}</>}
                      </p>
                    </div>
                    <div className="shrink-0 text-xs text-slate-400">{formatDateTime(n.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400">Menampilkan hingga 200 catatan terbaru per tab.</p>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string; count: number;
}) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={`flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-bold rounded-lg transition-all ${
        active ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
      }`}>
      <Icon className="w-4 h-4" /> {label}
      <span className={`text-[10px] font-black rounded-full min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center ${
        active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
      }`}>{count}</span>
    </button>
  );
}

function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
      <Icon className="w-10 h-10 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
