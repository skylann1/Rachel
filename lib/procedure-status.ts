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

/** Role yang berhak bertindak pada tiap tahap. */
export const PROCEDURE_STAGE_ROLES: Record<string, string[]> = {
  [PROCEDURE_STATUS.menungguReviewPM]: ['pm'],
};
