// components/announcement-carousel.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Pin, ShieldAlert } from 'lucide-react';
import { categoryTone } from '@/lib/news';
import type { Announcement } from '@/app/dashboard/master-data/announcement/actions';

const AUTOPLAY_MS = 5000;

export function AnnouncementCarousel({ announcements, compact = false, basePath = '/dashboard/news' }: { announcements: Announcement[]; compact?: boolean; basePath?: string }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const pendingAck = announcements.filter((a) => a.is_mandatory && !a.is_acknowledged);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % announcements.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [announcements.length]);

  if (announcements.length === 0) return null;

  const goPrev = () => setIndex((i) => (i - 1 + announcements.length) % announcements.length);
  const goNext = () => setIndex((i) => (i + 1) % announcements.length);

  return (
    <>
      {pendingAck.length > 0 && (
        <Link href={`${basePath}/${pendingAck[0].id}`} className="mb-3 flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-rose-100 transition-colors">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="flex-1 min-w-0 truncate">{pendingAck.length} pengumuman wajib dibaca: {pendingAck[0].title}</span>
          <ChevronRight className="w-4 h-4 shrink-0" />
        </Link>
      )}
      <div className={`relative overflow-hidden shadow-lg group ${compact ? 'rounded-2xl' : 'rounded-3xl'}`}>
        <div className={`relative w-full bg-slate-900 ${compact ? 'h-40' : 'h-48 sm:h-56 lg:h-64'}`}>
          {announcements.map((a, i) => (
            <button
              key={a.id}
              onClick={() => router.push(`${basePath}/${a.id}`)}
              aria-label={`Baca: ${a.title}`}
              className={`absolute inset-0 w-full h-full text-left transition-opacity duration-700 ease-in-out ${
                i === index ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              {/* Latar: gambar yang sama diburamkan, supaya tidak ada pita hitam di sisi gambar. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.image_url} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-70" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.image_url} alt={a.title} className="relative w-full h-full object-contain" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/10 to-transparent" />
              <div className={`absolute bottom-0 left-0 right-0 text-left ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase ${categoryTone(a.category)}`}>{a.category}</span>
                  {a.is_pinned && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1"><Pin className="w-3 h-3" /> Disematkan</span>}
                  {a.is_mandatory && !a.is_acknowledged && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-600 text-white flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Wajib baca</span>}
                  {!a.is_read && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary text-white">BARU</span>}
                </div>
                <h2 className={`text-white font-bold drop-shadow-sm ${compact ? 'text-base' : 'text-lg sm:text-xl'}`}>{a.title}</h2>
                {a.description && (
                  <p className={`text-white/85 mt-1 max-w-2xl ${compact ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2'}`}>{a.description}</p>
                )}
              </div>
            </button>
          ))}
        </div>

        {announcements.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Sebelumnya"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Berikutnya"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-3 right-4 z-20 flex gap-1.5">
              {announcements.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setIndex(i)}
                  className="py-2.5 px-0.5"
                  aria-label={`Slide ${i + 1}`}
                >
                  <span className={`block h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

    </>
  );
}
