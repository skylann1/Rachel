import { isJsaPending } from './jsa-status';
import { getEffectivePtwStatus } from './ptw-status';

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
  ptwStatus?: string | null;
  projectStatus?: string | null;
  endDate?: string | null;
}

const APPROVED_PROCEDURE = 'Prosedur Disetujui';
const APPROVED_JSA = 'JSA Disetujui';

export function getProjectStage(docs: ProjectDocs): ProjectStage {
  const { procedureStatus, jsaStatus, ptwStatus, projectStatus, endDate } = docs;

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
  if (!ptwStatus) {
    return {
      label: 'Menunggu PTW',
      hint: 'JSA disetujui. Vendor belum mengajukan Permit to Work.',
      tone: 'waiting-vendor',
      actor: 'vendor',
    };
  }

  const effectivePtw = getEffectivePtwStatus(ptwStatus, endDate);
  if (effectivePtw === 'Expired') {
    return { label: 'PTW Kedaluwarsa', hint: 'Masa berlaku PTW telah lewat.', tone: 'rejected', actor: 'internal' };
  }
  if (effectivePtw === 'PTW Aktif') {
    return { label: 'PTW Aktif', hint: 'Izin kerja aktif — pekerjaan boleh berjalan.', tone: 'done', actor: null };
  }

  return {
    label: 'Review PTW',
    hint: `PTW menunggu tindak lanjut internal (${ptwStatus}).`,
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
