/**
 * Tipe & helper murni untuk Pemegang/Pengawas PTW dan daily check.
 * SENGAJA tanpa import runtime (hanya `import type` bila perlu) supaya bisa
 * dipakai dari server action, komponen client, PDF, dan diverifikasi dengan
 * skrip node biasa. Spec: docs/superpowers/specs/2026-10-18-ptw-field-roles-daily-check-design.md
 */

export type FieldPeran = 'pemegang' | 'pengawas';

export const FIELD_PERAN_LABEL: Record<FieldPeran, string> = {
  pemegang: 'Pemegang PTW',
  pengawas: 'Pengawas PTW',
};

export interface PtwFieldAssignment {
  id: string;
  ptw_id: string;
  peran: FieldPeran;
  user_id: string;
  user_name: string;
  aktif_dari: string;
  /** null = masih aktif */
  aktif_sampai: string | null;
  ditugaskan_oleh_name: string | null;
  alasan: string | null;
}

export interface PtwDailyCheck {
  id: string;
  ptw_id: string;
  hari_ke: number;
  tanggal: string;
  peran: FieldPeran;
  user_id: string;
  user_name: string;
  diisi_pada: string;
  inisial: string;
  uraian_pekerjaan: string | null;
}

export interface PtwFieldViewer {
  userId: string;
  /** Peran aktif pemanggil di PTW ini, bila ada. */
  myPeran: FieldPeran | null;
  /** Peran yang boleh ditugaskan/diganti pemanggil (sisi PGN → pengawas, sisi vendor → pemegang). */
  assignablePeran: FieldPeran | null;
}

export interface PtwFieldData {
  assignments: PtwFieldAssignment[];
  checks: PtwDailyCheck[];
  viewer: PtwFieldViewer;
  /** Tanggal hari ini (WIB), YYYY-MM-DD. */
  today: string;
  /** Hari ke-N hari ini; null bila di luar masa berlaku. */
  todayHari: number | null;
  /** true hanya bila status efektif PTW = Aktif. */
  active: boolean;
}

export interface FieldCandidate {
  id: string;
  name: string;
}

export interface PendingDailyCheck {
  ptwId: string;
  projectId: string;
  projectName: string;
  ptwType: string;
  peran: FieldPeran;
  hari: number;
  /** Awal hari ini (WIB) sebagai ISO — dipakai sebagai "sejak kapan" di My Task. */
  date: string;
}

export function parseDateUtc(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Hari ke-N (1-based) dari validFrom untuk tanggal `today`; null bila di luar masa berlaku. */
export function dayIndexForDate(
  validFrom: string | null | undefined,
  validTo: string | null | undefined,
  today: string,
  maxDays: number,
): number | null {
  if (!validFrom) return null;
  const start = parseDateUtc(validFrom);
  const t = parseDateUtc(today);
  if (start === null || t === null) return null;
  const idx = Math.floor((t - start) / 86_400_000) + 1;
  if (idx < 1 || idx > maxDays) return null;
  if (validTo) {
    const end = parseDateUtc(validTo);
    if (end !== null && t > end) return null;
  }
  return idx;
}

/** Huruf pertama maksimal 3 kata nama, huruf besar; '?' bila kosong. */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
  const out = words.map((w) => w.charAt(0).toUpperCase()).join('');
  return out || '?';
}

/** 'YYYY-MM-DD' → 'DD/MM' (format kolom Tanggal pada form). */
export function formatCheckDate(tanggal: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(tanggal);
  return m ? `${m[2]}/${m[1]}` : '';
}

/** ISO → 'HH:mm' WIB (format kolom Waktu pada form). */
export function formatCheckTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta',
  }).format(d);
}

export type DayRowStatus = 'lengkap' | 'sebagian' | 'terlewat' | 'hari_ini' | 'mendatang';

/** Status satu baris hari pada tabel Daily Check. `filledCount` = jumlah peran yang sudah check (0-2). */
export function dayRowStatus(dayDate: string, today: string, filledCount: number): DayRowStatus {
  if (filledCount >= 2) return 'lengkap';
  if (filledCount === 1) return 'sebagian';
  const d = parseDateUtc(dayDate);
  const t = parseDateUtc(today);
  if (d === null || t === null) return 'mendatang';
  if (d < t) return 'terlewat';
  if (d === t) return 'hari_ini';
  return 'mendatang';
}
