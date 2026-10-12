'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Activity, Download, Loader2, Search, X, ChevronDown, ChevronUp, Monitor } from 'lucide-react';
import { getActivityFeed, exportActivityCsv } from './actions';
import type { ActivityFeedRow, FeedFilters, FeedPage } from './types';
import { describeUserAgent } from '@/lib/user-agent';
import type { ActivityMetadata } from '@/lib/activity-diff';
import { CATEGORY_LABEL, TypeBadge, categoryIcon, formatDateTime } from './activity-ui';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 400;

function jakartaDate(offsetDays = 0): string {
  const d = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

const PRESETS: Array<{ label: string; from: () => string; to: () => string }> = [
  { label: 'Hari ini', from: () => jakartaDate(0), to: () => jakartaDate(0) },
  { label: '7 hari', from: () => jakartaDate(6), to: () => jakartaDate(0) },
  { label: '30 hari', from: () => jakartaDate(29), to: () => jakartaDate(0) },
];

function rowTone(row: ActivityFeedRow): { icon: string; badge: string | null } {
  if (row.action.startsWith('Login gagal')) return { icon: 'bg-rose-50 border-rose-200 text-rose-600', badge: 'Gagal' };
  if (row.action.startsWith('Login ditolak')) return { icon: 'bg-amber-50 border-amber-200 text-amber-600', badge: 'Ditolak' };
  if (row.metadata?.newDevice) return { icon: 'bg-sky-50 border-sky-200 text-sky-600', badge: 'Perangkat baru' };
  return { icon: 'bg-slate-50 border-slate-200 text-slate-500', badge: null };
}

function hasDetail(m: ActivityMetadata | null): boolean {
  return !!m && ((m.changes?.length ?? 0) > 0 || !!m.permissions?.added.length || !!m.permissions?.removed.length || !!m.reason);
}

/** Sebelum → sesudah, dan selisih permission untuk role. */
export function ChangeDetail({ metadata }: { metadata: ActivityMetadata }) {
  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2 text-xs">
      {metadata.reason && <p className="text-slate-600"><span className="font-bold">Alasan:</span> {metadata.reason}</p>}
      {metadata.changes?.map(c => (
        <div key={c.field} className="grid grid-cols-1 sm:grid-cols-[7rem_1fr] gap-0.5 sm:gap-2 items-start">
          <span className="font-bold text-slate-500">{c.label}</span>
          <span className="min-w-0 break-words">
            <span className="text-rose-600 line-through decoration-rose-300">{c.before ?? '(kosong)'}</span>
            <span className="mx-1.5 text-slate-400">→</span>
            <span className="text-emerald-700 font-semibold">{c.after ?? '(kosong)'}</span>
          </span>
        </div>
      ))}
      {metadata.permissions && (metadata.permissions.added.length > 0 || metadata.permissions.removed.length > 0) && (
        <div className="space-y-1.5">
          {metadata.permissions.added.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-slate-500 mr-1">Ditambah</span>
              {metadata.permissions.added.map(p => (
                <span key={p} className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-mono text-[11px]">+ {p}</span>
              ))}
            </div>
          )}
          {metadata.permissions.removed.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-slate-500 mr-1">Dicabut</span>
              {metadata.permissions.removed.map(p => (
                <span key={p} className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-mono text-[11px]">− {p}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Satu baris log — dipakai tab Riwayat dan drawer detail user. */
export function FeedRow({
  row, onSelectUser, compact,
}: {
  row: ActivityFeedRow;
  onSelectUser?: (userId: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const Icon = categoryIcon(row.category);
  const tone = rowTone(row);
  const detail = hasDetail(row.metadata);

  return (
    <li className={`flex gap-3 ${compact ? 'py-3' : 'px-4 sm:px-5 py-4'}`}>
      <div className={`shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center ${tone.icon}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{CATEGORY_LABEL[row.category] ?? row.category}</span>
          <span className="text-sm font-bold text-slate-800">{row.action}</span>
          {tone.badge && (
            <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{tone.badge}</span>
          )}
        </div>
        {row.notes && <p className="text-sm text-slate-600 mt-0.5 break-words">{row.notes}</p>}
        <p className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-1.5">
          {row.actorId && onSelectUser ? (
            <button onClick={() => onSelectUser(row.actorId!)} className="font-semibold text-slate-500 hover:text-primary hover:underline">
              {row.actorName || 'Pengguna'}
            </button>
          ) : (
            <span>{row.actorName || 'Sistem'}</span>
          )}
          {row.actorJabatan && <span>· {row.actorJabatan}</span>}
          <span>· {formatDateTime(row.createdAt)}</span>
          {row.ipAddress && <span>· IP {row.ipAddress}</span>}
          {row.userAgent && <span className="inline-flex items-center gap-1">· <Monitor className="w-3 h-3" />{describeUserAgent(row.userAgent)}</span>}
        </p>
        {detail && (
          <>
            <button
              onClick={() => setOpen(v => !v)}
              aria-expanded={open}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
            >
              {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {open ? 'Sembunyikan perubahan' : 'Lihat perubahan'}
            </button>
            {open && row.metadata && <ChangeDetail metadata={row.metadata} />}
          </>
        )}
      </div>
      {!compact && <div className="shrink-0 self-start"><TypeBadge type={row.actorType} /></div>}
    </li>
  );
}

export default function ActivityFeedTab({
  initialPage, onSelectUser,
}: {
  initialPage: FeedPage;
  onSelectUser: (userId: string) => void;
}) {
  const [filters, setFilters] = useState<FeedFilters>({ kind: 'all' });
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState(initialPage.rows);
  const [hasMore, setHasMore] = useState(initialPage.hasMore);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const firstRender = useRef(true);
  const requestSeq = useRef(0);

  // Pencarian ditunda supaya tidak menembak query tiap ketukan.
  useEffect(() => {
    const id = setTimeout(() => setFilters(f => (f.search === (searchInput || undefined) ? f : { ...f, search: searchInput || undefined })), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Ganti filter → ambil halaman pertama lagi. Data awal dari server sudah
  // sesuai filter kosong, jadi render pertama dilewati. requestSeq mencegah
  // respons lama menimpa respons yang lebih baru.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const seq = ++requestSeq.current;
    setLoading(true);
    getActivityFeed(filters, { limit: PAGE_SIZE })
      .then(page => {
        if (seq !== requestSeq.current) return;
        setRows(page.rows);
        setHasMore(page.hasMore);
      })
      .finally(() => { if (seq === requestSeq.current) setLoading(false); });
  }, [filters]);

  const loadMore = async () => {
    const before = rows[rows.length - 1]?.createdAt;
    if (!before) return;
    setLoading(true);
    try {
      const page = await getActivityFeed(filters, { limit: PAGE_SIZE, before });
      setRows(prev => [...prev, ...page.rows]);
      setHasMore(page.hasMore);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    setExportNote(null);
    try {
      const result = await exportActivityCsv(filters);
      if ('error' in result) { setExportNote(result.error); return; }
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `log-aktivitas-${jakartaDate(0)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      if (result.truncated) setExportNote('Ekspor dibatasi 5.000 baris terbaru — persempit rentang tanggal untuk data lebih lama.');
    } finally {
      setExporting(false);
    }
  };

  const hasActiveFilter = !!(filters.search || filters.category || filters.from || filters.to || (filters.kind && filters.kind !== 'all'));
  const reset = () => { setSearchInput(''); setFilters({ kind: 'all' }); };
  const fieldClass = 'px-3 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Cari nama pelaku, aksi, catatan, atau alamat IP…"
            aria-label="Cari log aktivitas"
            className={`${fieldClass} w-full pl-9`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filters.kind ?? 'all'}
            onChange={e => setFilters(f => ({ ...f, kind: e.target.value as FeedFilters['kind'], category: undefined }))}
            aria-label="Sumber log"
            className={`${fieldClass} w-full sm:w-auto`}
          >
            <option value="all">Semua sumber</option>
            <option value="activity">Sistem (login & Master Data)</option>
            <option value="document">Approval dokumen</option>
          </select>
          <select
            value={filters.category ?? ''}
            onChange={e => setFilters(f => ({ ...f, category: e.target.value || undefined }))}
            aria-label="Kategori"
            className={`${fieldClass} w-full sm:w-auto`}
          >
            <option value="">Semua kategori</option>
            {Object.entries(CATEGORY_LABEL)
              .filter(([key]) => {
                const isDoc = ['procedure', 'jsa', 'ptw'].includes(key);
                return filters.kind === 'document' ? isDoc : filters.kind === 'activity' ? !isDoc : true;
              })
              .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="date" value={filters.from ?? ''} max={filters.to || undefined}
              onChange={e => setFilters(f => ({ ...f, from: e.target.value || undefined }))}
              aria-label="Dari tanggal" className={`${fieldClass} flex-1 min-w-0 sm:flex-none`}
            />
            <span className="text-slate-400 text-sm shrink-0">s/d</span>
            <input
              type="date" value={filters.to ?? ''} min={filters.from || undefined}
              onChange={e => setFilters(f => ({ ...f, to: e.target.value || undefined }))}
              aria-label="Sampai tanggal" className={`${fieldClass} flex-1 min-w-0 sm:flex-none`}
            />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-1">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => setFilters(f => ({ ...f, from: p.from(), to: p.to() }))}
                className="px-3 py-2 sm:px-2.5 sm:py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto sm:ml-auto">
            {hasActiveFilter && (
              <button onClick={reset} className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800">
                <X className="w-3.5 h-3.5" /> Reset
              </button>
            )}
            <button
              onClick={exportCsv}
              disabled={exporting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg transition-colors"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Ekspor CSV
            </button>
          </div>
        </div>
        {exportNote && <p className="text-xs font-semibold text-amber-700">{exportNote}</p>}
      </div>

      <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-opacity ${loading && rows.length > 0 ? 'opacity-60' : ''}`}>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
            {loading ? <Loader2 className="w-8 h-8 animate-spin opacity-40" /> : <Activity className="w-10 h-10 opacity-30" />}
            <p className="text-sm">{loading ? 'Memuat…' : hasActiveFilter ? 'Tidak ada aktivitas yang cocok dengan filter.' : 'Belum ada aktivitas tercatat.'}</p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {rows.map(row => <FeedRow key={row.id} row={row} onSelectUser={onSelectUser} />)}
            </ul>
            {hasMore && (
              <div className="p-4 border-t border-slate-100 text-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition-colors"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Muat {PAGE_SIZE} lagi
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
