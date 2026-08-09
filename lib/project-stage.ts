import { isJsaPending, JSA_STATUS } from './jsa-status';
import { getEffectivePtwStatus, PTW_STATUS } from './ptw-status';
import { PROCEDURE_STATUS } from './procedure-status';

/**
 * Tahapan dokumen K3 sebuah proyek: Prosedur -> JSA -> PTW.
 *
 * Dokumen ditulis oleh vendor dan direview internal, jadi dari sisi internal
 * sebuah proyek selalu berada di salah satu dari dua keadaan: menunggu vendor
 * mengajukan dokumen, atau menunggu review internal. Halaman Data Proyek
 * memakai ini agar admin tahu langkah berikutnya setelah membuat proyek —
 * sebelumnya kartu proyek tidak memberi petunjuk apa pun.
 */

export type StageTone = 'waiting-vendor' | 'waiting-internal' | 'done' | 'rejected';

export interface ProjectStage {
  /** Label singkat tahapan saat ini. */
  label: string;
  /** Penjelasan langkah berikutnya, ditujukan ke pengguna internal. */
  hint: string;
  tone: StageTone;
  /** Siapa yang harus bertindak berikutnya. */
  actor: 'vendor' | 'internal' | null;
}

export interface ProjectDocs {
  procedureStatus?: string | null;
  jsaStatus?: string | null;
  /**
   * Satu proyek bisa punya beberapa PTW sekaligus (tipe berbeda) — satu entri
   * per baris. `valid_to` adalah masa berlaku izin itu sendiri; kalau kosong
   * (baris lama) dipakai `endDate` proyek sebagai acuan kedaluwarsa.
   */
  ptws?: { status?: string | null; valid_to?: string | null }[];
  projectStatus?: string | null;
  endDate?: string | null;
}

export const APPROVED_PROCEDURE = PROCEDURE_STATUS.approved;
export const APPROVED_JSA = JSA_STATUS.approved;

export function getProjectStage(docs: ProjectDocs): ProjectStage {
  const { procedureStatus, jsaStatus, ptws, projectStatus, endDate } = docs;

  if (projectStatus === 'Ditolak') {
    return { label: 'Ditolak', hint: 'Proyek ditolak dan tidak dilanjutkan.', tone: 'rejected', actor: null };
  }
  if (projectStatus === 'Selesai') {
    return { label: 'Selesai', hint: 'Pekerjaan telah selesai dan diarsipkan.', tone: 'done', actor: null };
  }

  // --- Tahap 1: Prosedur Kerja
  if (!procedureStatus) {
    return {
      label: 'Menunggu Prosedur',
      hint: 'Vendor belum mengajukan Prosedur Kerja.',
      tone: 'waiting-vendor',
      actor: 'vendor',
    };
  }
  if (procedureStatus !== APPROVED_PROCEDURE) {
    return {
      label: 'Review Prosedur',
      hint: 'Prosedur Kerja diajukan dan menunggu review internal.',
      tone: 'waiting-internal',
      actor: 'internal',
    };
  }

  // --- Tahap 2: JSA
  if (!jsaStatus) {
    return {
      label: 'Menunggu JSA',
      hint: 'Prosedur disetujui. Vendor belum mengajukan JSA.',
      tone: 'waiting-vendor',
      actor: 'vendor',
    };
  }
  if (isJsaPending(jsaStatus) || jsaStatus !== APPROVED_JSA) {
    return {
      label: 'Review JSA',
      hint: `JSA menunggu tindak lanjut internal (${jsaStatus}).`,
      tone: 'waiting-internal',
      actor: 'internal',
    };
  }

  // --- Tahap 3: PTW
  // Satu proyek bisa punya beberapa PTW sekaligus (tipe berbeda, mis. Kerja
  // Dingin + Kerja di Ketinggian + Kerja Panas). Tahap ini baru "selesai"
  // (hijau) kalau SEMUA PTW yang sudah diajukan berstatus Aktif — proyek
  // tidak pernah dianggap siap kalau ada satu izin pun yang masih tertahan.
  const submitted = (ptws ?? []).filter(p => !!p?.status);
  if (submitted.length === 0) {
    return {
      label: 'Menunggu PTW',
      hint: 'JSA disetujui. Vendor belum mengajukan Permit to Work.',
      tone: 'waiting-vendor',
      actor: 'vendor',
    };
  }

  const effectiveStatuses = submitted.map(p => getEffectivePtwStatus(p.status, p.valid_to ?? endDate));
  if (effectiveStatuses.some(s => s === PTW_STATUS.expired)) {
    return { label: 'PTW Kedaluwarsa', hint: 'Salah satu PTW proyek ini telah lewat masa berlaku.', tone: 'rejected', actor: 'internal' };
  }
  if (effectiveStatuses.every(s => s === PTW_STATUS.aktif)) {
    return {
      label: PTW_STATUS.aktif,
      hint: effectiveStatuses.length > 1 ? `Semua ${effectiveStatuses.length} izin kerja aktif — pekerjaan boleh berjalan.` : 'Izin kerja aktif — pekerjaan boleh berjalan.',
      tone: 'done',
      actor: null,
    };
  }

  const pendingCount = effectiveStatuses.filter(s => s !== PTW_STATUS.aktif).length;
  return {
    label: 'Review PTW',
    hint: effectiveStatuses.length > 1
      ? `${pendingCount} dari ${effectiveStatuses.length} PTW masih menunggu tindak lanjut internal.`
      : `PTW menunggu tindak lanjut internal (${submitted[0].status}).`,
    tone: 'waiting-internal',
    actor: 'internal',
  };
}

export const STAGE_TONE_CLASS: Record<StageTone, string> = {
  'waiting-vendor': 'text-amber-700 bg-amber-50 border-amber-200',
  'waiting-internal': 'text-blue-700 bg-blue-50 border-blue-200',
  'done': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'rejected': 'text-rose-700 bg-rose-50 border-rose-200',
};
