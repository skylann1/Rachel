/**
 * Alur persetujuan Prosedur Kerja — satu tahap, direview oleh PM.
 *
 *   Draft -> Menunggu Review PM -> Prosedur Disetujui
 *
 * Reject mengembalikan status ke Draft; vendor merevisi lalu mengajukan
 * ulang (balik ke Menunggu Review PM).
 */

export const PROCEDURE_STATUS = {
  draft: 'Draft',
  menungguReviewPM: 'Menunggu Review PM',
  approved: 'Prosedur Disetujui',
} as const;

/** Status yang berarti Prosedur sedang menunggu tindakan pihak internal. */
export const PROCEDURE_PENDING_STATUSES: string[] = [
  PROCEDURE_STATUS.menungguReviewPM,
];

export function isProcedurePending(status: string | null | undefined): boolean {
  return !!status && PROCEDURE_PENDING_STATUSES.includes(status);
}

/**
 * Permission yang berhak bertindak pada tiap tahap — dicocokkan lewat
 * roles.permissions (lihat utils/permissions.ts), bukan role slug yang
 * di-hardcode. Siapa pun boleh dikasih permission 'procedure.review' dari
 * halaman Role & Permission, tidak harus role bernama persis 'pm'.
 */
export const PROCEDURE_STAGE_PERMISSION: Record<string, { module: string; action: string }> = {
  [PROCEDURE_STATUS.menungguReviewPM]: { module: 'procedure', action: 'review' },
};
