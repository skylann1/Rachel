'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { Search, Pin, ShieldAlert, Paperclip, Newspaper, ChevronRight } from 'lucide-react';
import { NEWS_CATEGORIES, categoryTone, plainExcerpt, type NewsItem } from '@/lib/news';

const dateFmt = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

export function NewsFeed({ items, basePath }: { items: NewsItem[]; basePath: string }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);

  const unreadCount = items.filter((n) => !n.is_read).length;
  const pendingAck = items.filter((n) => n.is_mandatory && !n.is_acknowledged);

  const categories = useMemo(() => {
    const present = new Set(items.map((n) => n.category));
    return NEWS_CATEGORIES.filter((c) => present.has(c));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((n) => {
      if (category && n.category !== category) return false;
      if (onlyUnread && n.is_read) return false;
      if (q && !`${n.title} ${n.description ?? ''} ${n.content ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, category, onlyUnread]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
          <Newspaper className="w-8 h-8 text-primary" /> Berita & Pengumuman K3
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Informasi, regulasi, dan pelajaran K3 terbaru. {unreadCount > 0 ? <b className="text-primary">{unreadCount} belum dibaca.</b> : 'Semua sudah dibaca.'}
        </p>
      </div>

      {pendingAck.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-rose-800 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> {pendingAck.length} pengumuman wajib dibaca belum Anda konfirmasi</p>
          <ul className="mt-2 space-y-1">
            {pendingAck.map((n) => (
              <li key={n.id}><Link href={`${basePath}/${n.id}`} className="text-sm font-semibold text-rose-700 hover:underline">{n.title}</Link></li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari berita..." className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/40 focus:border-primary" />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 cursor-pointer select-none px-1">
            <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} className="accent-primary" /> Belum dibaca saja
          </label>
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {['', ...categories].map((c) => (
              <button key={c || 'all'} onClick={() => setCategory(c)} className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${category === c ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {c || 'Semua'}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border-2 border-dashed border-slate-200 rounded-2xl">
          <Newspaper className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">{items.length === 0 ? 'Belum ada berita.' : 'Tidak ada berita yang cocok.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => (
            <Link key={n.id} href={`${basePath}/${n.id}`} className={`group flex gap-4 bg-white border rounded-2xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-all ${n.is_pinned ? 'border-amber-200' : 'border-slate-200'}`}>
              <div className="w-28 h-24 sm:w-44 sm:h-28 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={n.image_url} alt={n.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="min-w-0 flex-1 flex flex-col">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase ${categoryTone(n.category)}`}>{n.category}</span>
                  {n.is_pinned && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"><Pin className="w-3 h-3" /> Disematkan</span>}
                  {n.is_mandatory && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${n.is_acknowledged ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                      <ShieldAlert className="w-3 h-3" /> {n.is_acknowledged ? 'Sudah dikonfirmasi' : 'Wajib baca'}
                    </span>
                  )}
                  {!n.is_read && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary text-white">BARU</span>}
                </div>
                <h2 className={`text-base sm:text-lg leading-snug text-slate-800 line-clamp-2 ${n.is_read ? 'font-semibold' : 'font-bold'}`}>{n.title}</h2>
                <p className="text-sm text-slate-500 line-clamp-2 mt-1">{n.description || plainExcerpt(n.content)}</p>
                <div className="mt-auto pt-2 flex items-center gap-3 text-[11px] text-slate-400 font-medium">
                  <span>{dateFmt(n.publish_at ?? n.created_at)}</span>
                  {n.attachments.length > 0 && <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> {n.attachments.length} lampiran</span>}
                  <span className="ml-auto flex items-center gap-0.5 text-primary font-bold group-hover:gap-1.5 transition-all">Baca <ChevronRight className="w-3.5 h-3.5" /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
