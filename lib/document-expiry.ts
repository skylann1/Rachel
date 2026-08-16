/**
 * Status masa berlaku dokumen/kompetensi.
 *
 * Dipakai bersama oleh master data Pekerja, Peralatan, dan Material. Review 1
 * meminta sistem memberi peringatan bila masa berlaku kompetensi atau dokumen
 * sudah lewat; perhitungannya dipusatkan di sini agar ambang batas dan
 * labelnya konsisten di seluruh aplikasi.
 */

export type ExpiryStatus = 'valid' | 'expiring' | 'expired' | 'unknown';

/** Ambang default: dokumen dianggap "segera berakhir" 30 hari sebelum jatuh tempo. */
export const EXPIRY_WARN_DAYS = 30;

export interface ExpiryInfo {
  status: ExpiryStatus;
  /** Sisa hari sampai jatuh tempo; negatif berarti sudah lewat. null bila tanggal tidak diisi. */
  daysLeft: number | null;
}

export function getExpiry(validTo: string | null | undefined, warnDays = EXPIRY_WARN_DAYS): ExpiryInfo {
  if (!validTo) return { status: 'unknown', daysLeft: null };

  const due = new Date(validTo);
  if (isNaN(due.getTime())) return { status: 'unknown', daysLeft: null };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const daysLeft = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (daysLeft < 0) return { status: 'expired', daysLeft };
  if (daysLeft <= warnDays) return { status: 'expiring', daysLeft };
  return { status: 'valid', daysLeft };
}

export function expiryLabel({ status, daysLeft }: ExpiryInfo): string {
  switch (status) {
    case 'expired': return `Kedaluwarsa ${Math.abs(daysLeft!)} hari lalu`;
    case 'expiring': return daysLeft === 0 ? 'Berakhir hari ini' : `${daysLeft} hari lagi`;
    case 'valid': return 'Berlaku';
    default: return 'Tanpa masa berlaku';
  }
}

/** Kelas Tailwind untuk chip status — disamakan di semua halaman master data. */
export const EXPIRY_TONE: Record<ExpiryStatus, string> = {
  expired: 'bg-rose-50 text-rose-700 border-rose-100',
  expiring: 'bg-amber-50 text-amber-700 border-amber-100',
  valid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  unknown: 'bg-slate-100 text-slate-600 border-slate-200',
};

/** Status terburuk dari sekumpulan tanggal — untuk ringkasan pada baris tabel. */
export function worstExpiry(dates: (string | null | undefined)[]): ExpiryStatus {
  const order: ExpiryStatus[] = ['expired', 'expiring', 'valid', 'unknown'];
  const found = dates.map(d => getExpiry(d).status);
  return order.find(s => found.includes(s)) ?? 'unknown';
}
