'use client';

import Link from 'next/link';
import React, { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Paperclip, Pin, ShieldAlert, CheckCheck, Download, CalendarDays, Maximize2 } from 'lucide-react';
import { NewsContent } from '@/components/news/NewsContent';
import { PhotoGalleryLightbox } from '@/components/photo-gallery-lightbox';
import { categoryTone, type NewsItem } from '@/lib/news';
import { acknowledgeNews, markNewsRead } from '@/lib/news-actions';

export function NewsArticleView({ item, basePath }: { item: NewsItem; basePath: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acked, setAcked] = useState(!!item.is_acknowledged);
  const [error, setError] = useState<string | null>(null);
  // Rasio gambar sampul menentukan tata letak: poster (tegak) di samping, banner (lebar) di atas.
  const [wide, setWide] = useState<boolean | null>(null);
  const [zoom, setZoom] = useState(false);

  // Membuka halaman = tercatat sebagai sudah dibaca.
  useEffect(() => {
    if (!item.is_read) markNewsRead(item.id).catch(() => { /* tidak kritis */ });
  }, [item.id, item.is_read]);

  const acknowledge = () => {
    setError(null);
    startTransition(async () => {
      const res = await acknowledgeNews(item.id);
      if ('error' in res && res.error) setError(res.error);
      else { setAcked(true); router.refresh(); }
    });
  };

  const date = new Date(item.publish_at ?? item.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const cover = (
    <button
      type="button"
      onClick={() => setZoom(true)}
      className="group relative block w-full rounded-2xl overflow-hidden shadow-lg ring-1 ring-slate-200 bg-white cursor-zoom-in"
      aria-label="Perbesar gambar"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.image_url}
        alt={item.title}
        onLoad={(e) => setWide(e.currentTarget.naturalWidth >= e.currentTarget.naturalHeight * 1.15)}
        className="block w-full h-auto"
      />
      <span className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/70 text-white text-[11px] font-bold backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
        <Maximize2 className="w-3.5 h-3.5" /> Perbesar
      </span>
    </button>
  );

  const body = (
    <div className="space-y-6 min-w-0">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border uppercase tracking-wide ${categoryTone(item.category)}`}>{item.category}</span>
          {item.is_pinned && <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"><Pin className="w-3 h-3" /> Disematkan</span>}
          {item.is_mandatory && <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Wajib baca</span>}
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight">{item.title}</h1>
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400"><CalendarDays className="w-4 h-4" /> {date}</p>
        {item.description && (
          <p className="text-lg text-slate-600 leading-relaxed border-l-4 border-primary/40 pl-4">{item.description}</p>
        )}
      </header>

      {item.content && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-7">
          <NewsContent content={item.content} />
        </div>
      )}

      {item.attachments.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Paperclip className="w-4 h-4 text-slate-400" /> Lampiran ({item.attachments.length})</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {item.attachments.map((a) => (
              <li key={a.url}>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-primary/5 hover:border-primary/30 text-sm font-semibold text-slate-700 transition-colors">
                  <span className="truncate">{a.name}</span>
                  <Download className="w-4 h-4 text-slate-400 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {item.is_mandatory && (
        <section className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${acked ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <div className="flex items-start gap-3">
            {acked ? <CheckCheck className="w-5 h-5 text-emerald-600 mt-0.5" /> : <ShieldAlert className="w-5 h-5 text-rose-600 mt-0.5" />}
            <div>
              <p className={`text-sm font-bold ${acked ? 'text-emerald-800' : 'text-rose-800'}`}>{acked ? 'Anda sudah mengonfirmasi pengumuman ini.' : 'Pengumuman ini wajib dibaca.'}</p>
              {!acked && <p className="text-xs text-rose-700/80 mt-0.5">Setelah membaca, tekan konfirmasi agar tercatat sudah memahami isinya.</p>}
              {error && <p className="text-xs font-semibold text-rose-700 mt-1">{error}</p>}
            </div>
          </div>
          {!acked && (
            <button onClick={acknowledge} disabled={pending} className="shrink-0 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-bold transition-colors">
              {pending ? 'Menyimpan...' : 'Saya sudah membaca & memahami'}
            </button>
          )}
        </section>
      )}
    </div>
  );

  return (
    <article className="max-w-6xl mx-auto pb-16 space-y-6">
      <Link href={basePath} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-primary">
        <ArrowLeft className="w-4 h-4" /> Semua berita
      </Link>

      {wide ? (
        // Banner lebar: gambar penuh di atas, isi di bawah dengan lebar baca nyaman.
        <div className="space-y-8">
          <div className="max-w-4xl mx-auto">{cover}</div>
          <div className="max-w-3xl mx-auto">{body}</div>
        </div>
      ) : (
        // Poster / gambar tegak: gambar di samping (menempel saat scroll), isi di kanan.
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] gap-8 items-start">
          <div className="lg:sticky lg:top-6 max-w-md mx-auto w-full lg:max-w-none">{cover}</div>
          {body}
        </div>
      )}

      {zoom && <PhotoGalleryLightbox photos={[item.image_url]} onClose={() => setZoom(false)} />}
    </article>
  );
}
