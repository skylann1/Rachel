// components/announcement-carousel.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Announcement } from '@/app/dashboard/master-data/announcement/actions';

const AUTOPLAY_MS = 5000;

export function AnnouncementCarousel({ announcements }: { announcements: Announcement[] }) {
  const [index, setIndex] = useState(0);
  const [detail, setDetail] = useState<Announcement | null>(null);

  useEffect(() => {
    if (announcements.length <= 1 || detail) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % announcements.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [announcements.length, detail]);

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetail(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detail]);

  if (announcements.length === 0) return null;

  const goPrev = () => setIndex((i) => (i - 1 + announcements.length) % announcements.length);
  const goNext = () => setIndex((i) => (i + 1) % announcements.length);

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl shadow-lg group">
        <div className="relative h-48 sm:h-56 lg:h-64 w-full bg-slate-900">
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
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 text-left">
                <h2 className="text-white font-bold text-lg sm:text-xl drop-shadow-sm">{a.title}</h2>
                {a.description && (
                  <p className="text-white/85 text-sm mt-1 line-clamp-2 max-w-2xl">{a.description}</p>
                )}
              </div>
            </button>
          ))}
        </div>

        {announcements.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Sebelumnya"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Berikutnya"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-3 right-4 z-20 flex gap-1.5">
              {announcements.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setDetail(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setDetail(null)}
              className="absolute right-3 top-3 z-10 p-2 rounded-full bg-white/80 hover:bg-white text-slate-700 shadow-sm"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="bg-slate-900 flex items-center justify-center max-h-[60vh] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={detail.image_url} alt={detail.title} className="max-w-full max-h-[60vh] object-contain" />
            </div>
            <div className="p-6 overflow-y-auto">
              <h2 className="text-xl font-bold text-slate-800">{detail.title}</h2>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(detail.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              {detail.description && (
                <p className="text-sm text-slate-600 mt-4 whitespace-pre-wrap">{detail.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
