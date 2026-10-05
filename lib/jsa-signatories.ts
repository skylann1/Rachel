import { getRoleLabel } from './roles';
import { getStageAssignmentsWithNames, type StageAssignmentRowWithName } from './stage-assignments';

/**
 * Data tanda tangan pada formulir JSA.
 *
 * Tiga blok pada form:
 *   Disiapkan Oleh  -> vendor yang menyusun JSA
 *   Direview Oleh   -> Reviewer PGSOL  (Satker Pemberi Kerja)
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

export interface JsaSignatories {
  reviewer: JsaSignatory | null;
  approver: JsaSignatory | null;
}

export const JSA_SIGNATORIES_KOSONG: JsaSignatories = { reviewer: null, approver: null };

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

  const [hseRows, pgnRows] = await Promise.all([
    getStageAssignmentsWithNames(supabase, projectId, 'jsa', 'jsa.hse_pgsol'),
    getStageAssignmentsWithNames(supabase, projectId, 'jsa', 'jsa.approve_pgn'),
  ]);

  return {
    reviewer: gabunganSignatory(hseRows, 'PGSOL'),
    approver: gabunganSignatory(pgnRows, 'PGN'),
  };
}
