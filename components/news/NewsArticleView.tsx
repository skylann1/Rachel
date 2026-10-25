'use client';

import Link from 'next/link';
import React, { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Paperclip, Pin, ShieldAlert, CheckCheck, Download } from 'lucide-react';
import { NewsContent } from '@/components/news/NewsContent';
import { categoryTone, type NewsItem } from '@/lib/news';
import { acknowledgeNews, markNewsRead } from '@/lib/news-actions';

export function NewsArticleView({ item, basePath }: { item: NewsItem; basePath: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acked, setAcked] = useState(!!item.is_acknowledged);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <article className="max-w-3xl mx-auto pb-16 space-y-6">
      <Link href={basePath} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-primary">
        <ArrowLeft className="w-4 h-4" /> Semua berita
      </Link>

      <div className="rounded-3xl overflow-hidden bg-slate-900 shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image_url} alt={item.title} className="w-full max-h-[420px] object-contain" />
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border uppercase ${categoryTone(item.category)}`}>{item.category}</span>
          {item.is_pinned && <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"><Pin className="w-3 h-3" /> Disematkan</span>}
        </div>
        <h1 className="text-3xl font-bold text-slate-900 leading-tight tracking-tight">{item.title}</h1>
        <p className="text-xs font-medium text-slate-400">
          {new Date(item.publish_at ?? item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        {item.description && <p className="text-base text-slate-600 font-medium leading-relaxed">{item.description}</p>}
      </header>

      <NewsContent content={item.content} />

      {item.attachments.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Paperclip className="w-4 h-4 text-slate-400" /> Lampiran</h2>
          <ul className="space-y-1.5">
            {item.attachments.map((a) => (
              <li key={a.url}>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-primary/5 hover:border-primary/30 text-sm font-semibold text-slate-700 transition-colors">
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
    </article>
  );
}
