/** Helper lembur PTW (tabel ptw_overtimes, lihat supabase/schema_ptw_overtime.sql). */

export interface PtwOvertime {
  id: string;
  ptw_id: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  alasan: string;
  status: 'Menunggu' | 'Disetujui' | 'Ditolak';
  decision_note?: string | null;
}

/** Jam selesai <= jam mulai berarti melewati tengah malam. Mengembalikan durasi dalam menit. */
export function overtimeMinutes(mulai: string, selesai: string): number {
  const [h1, m1] = mulai.split(':').map(Number);
  const [h2, m2] = selesai.split(':').map(Number);
  if ([h1, m1, h2, m2].some(Number.isNaN)) return 0;
  const a = h1 * 60 + m1, b = h2 * 60 + m2;
  return b > a ? b - a : b + 24 * 60 - a;
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} jam ${m} menit` : `${h} jam`;
}

export const OVERTIME_TONE: Record<PtwOvertime['status'], string> = {
  Menunggu: 'bg-amber-50 text-amber-700 border-amber-200',
  Disetujui: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Ditolak: 'bg-rose-50 text-rose-700 border-rose-200',
};
