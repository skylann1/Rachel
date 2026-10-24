/** Opsi & helper form lengkap Inspeksi Temuan (kolom: supabase/schema_inspection_detail_fields.sql). */

export const FINDING_TYPES = [
  { value: 'Unsafe Condition', label: 'Unsafe Condition (Kondisi Tidak Aman)' },
  { value: 'Unsafe Act', label: 'Unsafe Act (Tindakan Tidak Aman)' },
  { value: 'Near Miss', label: 'Near Miss (Hampir Celaka)' },
] as const;

export const PRIORITIES = [
  { value: 'Low', label: 'Low (Bisa ditoleransi sementara)', slaDays: 14 },
  { value: 'Medium', label: 'Medium (Perlu segera diperbaiki)', slaDays: 7 },
  { value: 'High', label: 'High (Berpotensi cedera)', slaDays: 3 },
  { value: 'Critical', label: 'Critical (Stop Work Authority!)', slaDays: 1 },
] as const;

export const HAZARD_CATEGORIES = [
  'APD (Alat Pelindung Diri)',
  'Bekerja di Ketinggian',
  'Pekerjaan Panas (Hot Work)',
  'Ruang Terbatas (Confined Space)',
  'Kelistrikan',
  'Pengangkatan / Lifting',
  'Galian / Excavation',
  'Housekeeping & Kebersihan',
  'Peralatan & Mesin',
  'Bahan Kimia / B3',
  'Lalu Lintas & Kendaraan',
  'Lingkungan & Limbah',
  'Kebakaran & Tanggap Darurat',
  'Dokumen & Perizinan (PTW/JSA)',
  'Lainnya',
] as const;

export const ROOT_CAUSES = [
  'Manusia (kelalaian / kurang kompetensi)',
  'Peralatan / material',
  'Prosedur / instruksi kerja',
  'Lingkungan kerja',
  'Manajemen / pengawasan',
  'Belum diketahui',
] as const;

/** Tanggal batas perbaikan default (YYYY-MM-DD) dari prioritas, mulai hari ini. */
export function defaultDueDate(priority: string, from: Date = new Date()): string {
  const days = PRIORITIES.find((p) => p.value === priority)?.slaDays ?? 7;
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Status SLA temuan terhadap due_date. Temuan Closed tidak pernah dianggap terlambat. */
export function dueState(dueDate: string | null | undefined, status: string): { label: string; tone: 'ok' | 'warn' | 'late' | 'none' } {
  if (!dueDate) return { label: 'Tanpa batas waktu', tone: 'none' };
  if (status === 'Closed') return { label: 'Selesai', tone: 'ok' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `Terlambat ${-diff} hari`, tone: 'late' };
  if (diff === 0) return { label: 'Jatuh tempo hari ini', tone: 'warn' };
  if (diff <= 2) return { label: `${diff} hari lagi`, tone: 'warn' };
  return { label: `${diff} hari lagi`, tone: 'ok' };
}
