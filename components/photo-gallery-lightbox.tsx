'use client';

import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export function PhotoGalleryLightbox({
  photos,
  initialIndex = 0,
  onClose,
}: {
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);

  if (photos.length === 0) return null;

  const goPrev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const goNext = () => setIndex((i) => (i + 1) % photos.length);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-200">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        aria-label="Tutup"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="relative w-full max-w-3xl max-h-[85vh] flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[index]} alt={`Foto ${index + 1} dari ${photos.length}`} className="max-w-full max-h-[85vh] object-contain rounded-xl" />

        {photos.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Sebelumnya"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Berikutnya"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-xs font-medium">
              {index + 1} / {photos.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
