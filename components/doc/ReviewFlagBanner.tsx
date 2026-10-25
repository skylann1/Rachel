'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck, RefreshCw } from 'lucide-react';
import { dismissReviewFlag } from '@/lib/review-flag-actions';

export interface ReviewFlag { since: string; reason: string | null }

/**
 * Penanda dokumen yang berubah otomatis karena sinkronisasi Prosedur ⇄ JSA ⇄ PTW
 * (kolom needs_review_since). Hilang saat reviewer memutuskan, vendor mengajukan
 * ulang, atau seseorang menekan "Tandai sudah ditinjau" (kind + docId diisi).
 */
export function ReviewFlagBanner({ flag, kind, docId }: { flag?: ReviewFlag | null; kind?: 'procedure' | 'jsa' | 'ptw'; docId?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!flag) return null;
  const when = new Date(flag.since).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

  const dismiss = () => {
    if (!kind || !docId) return;
    setError(null);
    startTransition(async () => {
      try {
        await dismissReviewFlag(kind, docId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal menandai.');
      }
    });
  };

  return (
    <div className="flex items-start gap-2.5 bg-violet-50 border border-violet-200 text-violet-900 rounded-xl px-4 py-3 text-xs">
      <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 text-violet-600" />
      <div className="flex-1">
        <p className="font-bold">Perlu ditinjau ulang</p>
        <p>{flag.reason || 'Dokumen ini berubah otomatis karena sinkronisasi dengan dokumen lain.'} ({when}). Lihat riwayat perubahan untuk detailnya.</p>
        {error && <p className="text-rose-600 font-semibold mt-1">{error}</p>}
      </div>
      {kind && docId && (
        <button
          type="button"
          onClick={dismiss}
          disabled={pending}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-violet-200 text-violet-700 font-bold hover:bg-violet-100 disabled:opacity-50 transition-colors"
        >
          <CheckCheck className="w-3.5 h-3.5" /> {pending ? 'Menyimpan...' : 'Tandai sudah ditinjau'}
        </button>
      )}
    </div>
  );
}
