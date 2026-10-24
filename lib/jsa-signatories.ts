import { getRoleLabel } from './roles';
import { getStageAssignmentsWithNames, type StageAssignmentRowWithName } from './stage-assignments';

/**
 * Data tanda tangan pada formulir JSA.
 *
 * Tiga blok pada form:
 *   Disiapkan Oleh  -> vendor yang menyusun JSA
 *   Direview Oleh   -> PM PGSOL (Satker Pemberi Kerja)
 *   Disetujui Oleh  -> Approver PGN    (Satker Penanggung Jawab)
 *
 * `nama`/`jabatan` bisa berisi lebih dari satu orang (dipisah ", ") kalau
 * tahap itu ditugaskan ke beberapa assignee sekaligus — lihat
 * namaJabatanGabungan() di bawah. jsa.reviewer_id/approver_id (kolom
 * single-ID lama) TIDAK dipakai lagi di sini karena cuma mencatat satu
 * orang (siapa yang menutup tahap itu), bukan semua orang yang approve.
 */
export interface JsaSignatory {
  nama: string;
  jabatan: string;
  satker: string;
  tanggal: string;
}

/** Satu tahap pada jejak persetujuan (semua tahap berurutan, bukan hanya tiga blok tanda tangan). */
export interface JsaTrailRow {
  label: string;
  nama: string;
  jabatan: string;
  status: 'approved' | 'rejected' | 'pending' | 'none';
  tanggal: string;
}

export interface JsaSignatories {
  /** Penyusun (vendor) — dari aktor pertama di document_logs JSA, null kalau belum ada jejaknya. */
  preparer: { nama: string; jabatan: string } | null;
  reviewer: JsaSignatory | null;
  approver: JsaSignatory | null;
  trail: JsaTrailRow[];
}

export const JSA_SIGNATORIES_KOSONG: JsaSignatories = { preparer: null, reviewer: null, approver: null, trail: [] };

/** Urutan tahap JSA beserta labelnya — sinkron dengan JSA_STAGE_SEQUENCE (lib/jsa-status.ts). */
const TRAIL_STAGES: { key: string; label: string }[] = [
  { key: 'jsa.hse_vendor', label: 'HSE Vendor' },
  { key: 'jsa.review_vendor', label: 'PM Vendor' },
  { key: 'jsa.hse_pgsol', label: 'HSE PGSOL' },
  { key: 'jsa.review_pgsol', label: 'PM PGSOL' },
  { key: 'jsa.hsse_pgn', label: 'HSSE PGN' },
  { key: 'jsa.approve_pgn', label: 'PM Zona PGN' },
];

function trailRow(label: string, rows: StageAssignmentRowWithName[]): JsaTrailRow {
  if (rows.length === 0) return { label, nama: '', jabatan: '', status: 'none', tanggal: '' };
  const status: JsaTrailRow['status'] =
    rows.some(r => r.status === 'rejected') ? 'rejected'
    : rows.every(r => r.status === 'approved') ? 'approved'
    : 'pending';
  const decided = rows.filter(r => r.decided_at).map(r => r.decided_at as string).sort();
  return {
    label,
    nama: rows.map(r => r.assignee_name || 'Tidak diketahui').join(', '),
    jabatan: rows.map(r => r.assignee_jabatan || getRoleLabel(r.assignee_role)).filter(Boolean).join(', '),
    status,
    tanggal: status === 'approved' && decided.length > 0 ? formatTanggal(decided[decided.length - 1]) : '',
  };
}

function formatTanggal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Gabungkan nama/jabatan SEMUA assignee yang approved di satu tahap, urut berdasarkan waktu approve. */
function gabunganSignatory(rows: StageAssignmentRowWithName[], satker: string): JsaSignatory | null {
  const approved = rows.filter(r => r.status === 'approved').sort((a, b) => (a.decided_at ?? '').localeCompare(b.decided_at ?? ''));
  if (approved.length === 0) return null;
  return {
    nama: approved.map(r => r.assignee_name || 'Tidak diketahui').join(', '),
    jabatan: approved.map(r => r.assignee_jabatan || getRoleLabel(r.assignee_role)).join(', '),
    satker,
    tanggal: formatTanggal(approved[approved.length - 1].decided_at),
  };
}

/**
 * Mengambil nama & jabatan SEMUA penandatangan JSA per tahap, dari
 * stage_assignments — bukan lagi dari kolom single-ID jsa.reviewer_id/
 * approver_id, yang cuma mencatat satu orang (yang menutup tahap) walau
 * tahap itu bisa ditugaskan ke beberapa assignee sekaligus (semua harus
 * approve). Mengembalikan null untuk tahap yang belum ada yang approve.
 */
export async function getJsaSignatories(
  supabase: any,
  projectId: string,
  jsa: { id?: string } | null | undefined,
): Promise<JsaSignatories> {
  if (!jsa?.id) return JSA_SIGNATORIES_KOSONG;

  const stageRows = await Promise.all(
    TRAIL_STAGES.map(s => getStageAssignmentsWithNames(supabase, projectId, 'jsa', s.key)),
  );
  const rowsOf = (key: string) => stageRows[TRAIL_STAGES.findIndex(s => s.key === key)] ?? [];

  // Penyusun = aktor pertama yang tercatat di log dokumen JSA ini.
  let preparer: JsaSignatories['preparer'] = null;
  const { data: firstLog } = await supabase
    .from('document_logs')
    .select('actor_id')
    .eq('doc_type', 'jsa').eq('doc_id', jsa.id)
    .not('actor_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1);
  const actorId = firstLog?.[0]?.actor_id as string | undefined;
  if (actorId) {
    const { data: p } = await supabase.from('profiles').select('full_name, jabatan, role').eq('id', actorId).single();
    if (p) preparer = { nama: p.full_name || '', jabatan: p.jabatan || getRoleLabel(p.role) };
  }

  return {
    preparer,
    reviewer: gabunganSignatory(rowsOf('jsa.review_pgsol'), 'PGSOL'),
    approver: gabunganSignatory(rowsOf('jsa.approve_pgn'), 'PGN'),
    trail: TRAIL_STAGES.map((s, i) => trailRow(s.label, stageRows[i])),
  };
}
