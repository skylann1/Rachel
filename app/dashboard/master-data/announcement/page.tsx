'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Megaphone, Plus, Edit2, Trash2, Eye, EyeOff, Pin, PinOff, Users, ShieldAlert, Search, X, CheckCheck } from 'lucide-react';
import { DataTable, DataHead, ROW_CLS, CELL_CLS } from '@/components/ui/data-table';
import { ModalPortal } from '@/components/ui/modal-portal';
import {
  getAnnouncementsForManagement, getNewsReaders, deleteAnnouncement, toggleAnnouncementActive, toggleAnnouncementPinned,
  type AnnouncementWithStats,
} from './actions';
import AnnouncementFormModal from './AnnouncementFormModal';
import { AUDIENCE_OPTIONS, NEWS_CATEGORIES, STATE_META, categoryTone, newsState, plainExcerpt } from '@/lib/news';

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

export default function AnnouncementPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementWithStats | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [readersFor, setReadersFor] = useState<AnnouncementWithStats | null>(null);
  const [readers, setReaders] = useState<Awaited<ReturnType<typeof getNewsReaders>> | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const data = await getAnnouncementsForManagement();
    setAnnouncements(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openForm = (item: AnnouncementWithStats | null) => {
    setEditing(item);
    setFormKey((k) => k + 1);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus pengumuman "${title}"? Aksi ini tidak dapat dibatalkan.`)) return;
    setIsDeleting(id);
    const res = await deleteAnnouncement(id);
    setIsDeleting(null);
    if (res.error) alert(res.error);
    else fetchData();
  };

  const handleToggle = async (id: string, current: boolean) => {
    const res = await toggleAnnouncementActive(id, !current);
    if (res.error) alert(res.error);
    else fetchData();
  };

  const handlePin = async (id: string, current: boolean) => {
    const res = await toggleAnnouncementPinned(id, !current);
    if (res.error) alert(res.error);
    else fetchData();
  };

  const openReaders = async (item: AnnouncementWithStats) => {
    setReadersFor(item);
    setReaders(null);
    setReaders(await getNewsReaders(item.id));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return announcements.filter((a) => {
      if (category && a.category !== category) return false;
      if (stateFilter && newsState(a) !== stateFilter) return false;
      if (q && !`${a.title} ${a.description ?? ''} ${a.content ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [announcements, query, category, stateFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" /> News & Pengumuman
          </h1>
          <p className="text-sm text-slate-500 mt-1">Kelola berita K3: konten lengkap, target audiens, jadwal terbit, dan pantau siapa yang sudah membaca.</p>
        </div>
        <button
          onClick={() => openForm(null)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30"
        >
          <Plus className="w-4 h-4" />
          Tambah Pengumuman
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari judul atau isi..." className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/40 focus:border-primary" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm">
          <option value="">Semua Kategori</option>
          {NEWS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm">
          <option value="">Semua Status</option>
          {Object.entries(STATE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border-2 border-dashed border-slate-200 rounded-2xl">
          <Megaphone className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">Belum ada pengumuman.</p>
        </div>
      ) : (
        <DataTable minWidth={1100}>
          <DataHead columns={[
            { label: 'Gambar', className: 'w-28' }, { label: 'Pengumuman' }, { label: 'Audiens' }, { label: 'Jadwal' }, { label: 'Status' }, { label: 'Pembaca' }, { label: 'Aksi', className: 'text-right' },
          ]} />
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">Tidak ada pengumuman yang cocok dengan filter.</td></tr>
            )}
            {filtered.map((item) => {
              const state = newsState(item);
              const meta = STATE_META[state];
              return (
                <tr key={item.id} className={ROW_CLS}>
                  <td className={CELL_CLS}>
                    <div className="w-24 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                  </td>
                  <td className={`${CELL_CLS} max-w-md`}>
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase ${categoryTone(item.category)}`}>{item.category}</span>
                      {item.is_pinned && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"><Pin className="w-3 h-3" /> Disematkan</span>}
                      {item.is_mandatory && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Wajib baca</span>}
                    </div>
                    <p className="font-semibold text-slate-800">{item.title}</p>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{item.description || plainExcerpt(item.content, 120)}</p>
                  </td>
                  <td className={CELL_CLS}>
                    <div className="flex flex-wrap gap-1">
                      {AUDIENCE_OPTIONS.filter((a) => item.audience.includes(a.value)).map((a) => (
                        <span key={a.value} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{a.label}</span>
                      ))}
                    </div>
                  </td>
                  <td className={`${CELL_CLS} text-xs text-slate-600 whitespace-nowrap space-y-0.5`}>
                    <div>Terbit: <b className="text-slate-700">{fmt(item.publish_at) ?? 'Langsung'}</b></div>
                    <div>Berakhir: <b className="text-slate-700">{fmt(item.expires_at) ?? '—'}</b></div>
                  </td>
                  <td className={CELL_CLS}>
                    <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-md border ${meta.tone}`}>{meta.label}</span>
                  </td>
                  <td className={CELL_CLS}>
                    <button onClick={() => openReaders(item)} className="text-left group" title="Lihat daftar pembaca">
                      <p className="text-sm font-black text-slate-800 group-hover:text-primary">{item.read_count}<span className="text-xs font-semibold text-slate-400"> / {item.target_count}</span></p>
                      <div className="w-24 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${item.target_count ? Math.min(100, Math.round((item.read_count / item.target_count) * 100)) : 0}%` }} />
                      </div>
                      {item.is_mandatory && (
                        <p className="text-[11px] font-bold text-emerald-600 mt-1 flex items-center gap-1"><CheckCheck className="w-3 h-3" /> {item.ack_count} konfirmasi</p>
                      )}
                    </button>
                  </td>
                  <td className={`${CELL_CLS} text-right`}>
                    <div className="inline-flex gap-0.5">
                      <button onClick={() => openReaders(item)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Pembaca">
                        <Users className="w-4 h-4" />
                      </button>
                      <button onClick={() => handlePin(item.id, item.is_pinned)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title={item.is_pinned ? 'Lepas sematan' : 'Sematkan'}>
                        {item.is_pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleToggle(item.id, item.is_active)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title={item.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                        {item.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openForm(item)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        disabled={isDeleting === item.id}
                        onClick={() => handleDelete(item.id, item.title)}
                        className={`p-2 rounded-lg transition-colors ${isDeleting === item.id ? 'text-slate-300' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}

      {isFormOpen && (
        <AnnouncementFormModal
          key={formKey}
          isOpen
          editing={editing}
          onClose={() => { setIsFormOpen(false); setEditing(null); }}
          onSuccess={() => { setIsFormOpen(false); setEditing(null); fetchData(); }}
        />
      )}

      {readersFor && (
        <ModalPortal zIndex={100} onClose={() => setReadersFor(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Pembaca</h2>
                <p className="text-xs text-slate-500 truncate">{readersFor.title}</p>
              </div>
              <button onClick={() => setReadersFor(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto">
              {readers === null ? (
                <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
              ) : readers.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">Belum ada yang membaca.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {readers.map((r, i) => (
                    <li key={i} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{r.name}</p>
                        <p className="text-[11px] text-slate-400 uppercase">{r.type}{r.role ? ` · ${r.role}` : ''}</p>
                      </div>
                      <div className="text-right text-[11px] text-slate-500 shrink-0">
                        <p>Dibaca {fmt(r.read_at)}</p>
                        {r.acknowledged_at && <p className="font-bold text-emerald-600">Konfirmasi {fmt(r.acknowledged_at)}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
