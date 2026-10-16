// components/announcement-carousel.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ModalPortal } from '@/components/ui/modal-portal';
import type { Announcement } from '@/app/dashboard/master-data/announcement/actions';

const AUTOPLAY_MS = 5000;

export function AnnouncementCarousel({ announcements, compact = false }: { announcements: Announcement[]; compact?: boolean }) {
  const [index, setIndex] = useState(0);
  const [detail, setDetail] = useState<Announcement | null>(null);

  useEffect(() => {
    if (announcements.length <= 1 || detail) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % announcements.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [announcements.length, detail]);

  if (announcements.length === 0) return null;

  const goPrev = () => setIndex((i) => (i - 1 + announcements.length) % announcements.length);
  const goNext = () => setIndex((i) => (i + 1) % announcements.length);

  return (
    <>
      <div className={`relative overflow-hidden shadow-lg group ${compact ? 'rounded-2xl' : 'rounded-3xl'}`}>
        <div className={`relative w-full bg-slate-900 ${compact ? 'h-40' : 'h-48 sm:h-56 lg:h-64'}`}>
          {announcements.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setDetail(a)}
              aria-label={`Lihat detail: ${a.title}`}
              className={`absolute inset-0 w-full h-full text-left transition-opacity duration-700 ease-in-out ${
                i === index ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.image_url} alt={a.title} className="w-full h-full object-contain" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/10 to-transparent" />
              <div className={`absolute bottom-0 left-0 right-0 text-left ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
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

      {detail && (
        <ModalPortal onClose={() => setDetail(null)} zIndex={100}>
          <div className="relative flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
            <button
              onClick={() => setDetail(null)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md transition hover:bg-white"
              aria-label="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex max-h-[55dvh] shrink-0 items-center justify-center overflow-hidden bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={detail.image_url} alt={detail.title} className="max-h-[55dvh] max-w-full object-contain" />
            </div>
            <div className="overflow-y-auto p-6 sm:p-7">
              <h2 className="text-xl font-bold text-slate-900">{detail.title}</h2>
              <p className="mt-1 text-xs font-medium text-slate-400">
                {new Date(detail.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              {detail.description && (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{detail.description}</p>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
