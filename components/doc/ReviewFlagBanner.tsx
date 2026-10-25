import { RefreshCw } from 'lucide-react';

export interface ReviewFlag { since: string; reason: string | null }

/**
 * Penanda dokumen yang berubah otomatis karena sinkronisasi Prosedur ⇄ JSA ⇄ PTW
 * (kolom needs_review_since). Hilang saat reviewer memutuskan atau vendor mengajukan ulang.
 */
export function ReviewFlagBanner({ flag }: { flag?: ReviewFlag | null }) {
  if (!flag) return null;
  const when = new Date(flag.since).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
  return (
    <div className="flex items-start gap-2.5 bg-violet-50 border border-violet-200 text-violet-900 rounded-xl px-4 py-3 text-xs">
      <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 text-violet-600" />
      <div>
        <p className="font-bold">Perlu ditinjau ulang</p>
        <p>{flag.reason || 'Dokumen ini berubah otomatis karena sinkronisasi dengan dokumen lain.'} ({when}). Lihat riwayat perubahan untuk detailnya.</p>
      </div>
    </div>
  );
}
