// components/ui/modal-portal.tsx
'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

/**
 * Overlay modal yang dirender lewat portal ke <body>, bukan di dalam pohon
 * halaman. Layout dashboard memakai `h-screen` + area scroll sendiri
 * (`overflow-y-auto`), jadi `fixed inset-0` di dalamnya bisa tidak menutup
 * seluruh tinggi layar (sisa strip konten di bawah modal tetap terlihat).
 * Lewat portal, overlay selalu menempel ke viewport.
 */
export function ModalPortal({
  children,
  onClose,
  zIndex = 100,
  blocking = false,
  className,
}: {
  children: React.ReactNode;
  /** Dipanggil saat klik area gelap atau tekan Esc. */
  onClose?: () => void;
  zIndex?: number;
  /** true = klik area gelap / Esc diabaikan (mis. saat request berjalan). */
  blocking?: boolean;
  /** Ganti tata letak isi (default: tengah layar), mis. drawer `justify-end p-0`. */
  className?: string;
}) {
  // false saat SSR/hydration, true di client — tanpa setState di dalam effect.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!onClose || blocking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, blocking]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed left-0 top-0 flex h-[100dvh] w-screen overflow-y-auto bg-slate-950/70 backdrop-blur-sm ${
        className ?? 'items-center justify-center p-4 sm:p-6'
      }`}
      style={{ zIndex }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onClose && !blocking) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>,
    document.body,
  );
}
