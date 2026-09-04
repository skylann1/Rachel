/**
 * Alur persetujuan Prosedur Kerja — vendor -> PGSOL -> PGN, sama polanya
 * dengan JSA.
 *
 *   Draft -> Review Internal Vendor -> Review PGSOL -> Menunggu Review PM -> Prosedur Disetujui
 *
 * Review Internal Vendor tidak pernah nyampe pihak PGN/PGSOL — staff vendor
 * sendiri (ditugaskan admin vendor per proyek, lihat Fase 3) harus
 * menyetujui dulu sebelum PGSOL melihatnya. Review PGSOL: verifikasi teknis
 * sebelum diteruskan ke PM (PGN) untuk persetujuan akhir. Reject di tahap
 * manapun mengembalikan status ke Draft; vendor merevisi lalu mengajukan
 * ulang (balik ke Review Internal Vendor).
 */

export const PROCEDURE_STATUS = {
  draft: 'Draft',
  reviewInternalVendor: 'Review Internal Vendor',
  reviewPgsol: 'Review PGSOL',
  menungguReviewPM: 'Menunggu Review PM',
  approved: 'Prosedur Disetujui',
} as const;

/**
 * Status yang berarti Prosedur sedang menunggu tindakan pihak INTERNAL
 * (PGN/PGSOL) — dipakai untuk /dashboard/my-task. `reviewInternalVendor`
 * SENGAJA tidak masuk sini: tahap itu menunggu staff vendor sendiri, bukan
 * pihak internal, dan tidak boleh muncul di task list internal.
 */
export const PROCEDURE_PENDING_STATUSES: string[] = [
  PROCEDURE_STATUS.reviewPgsol,
  PROCEDURE_STATUS.menungguReviewPM,
];

export function isProcedurePending(status: string | null | undefined): boolean {
  return !!status && PROCEDURE_PENDING_STATUSES.includes(status);
}

/**
 * Permission yang berhak bertindak pada tiap tahap — dicocokkan lewat
 * roles.permissions (lihat utils/permissions.ts), bukan role slug yang
 * di-hardcode. Siapa pun boleh dikasih permission dari halaman Role &
 * Permission, tidak harus role bernama persis tertentu.
 */
export const PROCEDURE_STAGE_PERMISSION: Record<string, { module: string; action: string }> = {
  [PROCEDURE_STATUS.reviewPgsol]: { module: 'procedure', action: 'review_pgsol' },
  [PROCEDURE_STATUS.menungguReviewPM]: { module: 'procedure', action: 'review' },
};
