/**
 * Alur persetujuan Prosedur Kerja — vendor -> PGSOL (Reviewer, lalu HSE) ->
 * PGN, sama polanya dengan JSA dan PTW.
 *
 *   Draft -> Review Internal Vendor -> Review PGSOL -> Review HSE PGSOL ->
 *   Menunggu Review PM -> Prosedur Disetujui
 *
 * Review Internal Vendor tidak pernah nyampe pihak PGN/PGSOL — staff vendor
 * sendiri (ditugaskan admin vendor per proyek, lihat Fase 3) harus
 * menyetujui dulu sebelum PGSOL melihatnya. Review PGSOL -> Review HSE
 * PGSOL: dua orang PGSOL berbeda, berurutan — verifikasi teknis lalu
 * verifikasi HSE — sebelum diteruskan ke PM (PGN) untuk persetujuan akhir.
 * Reject di tahap manapun mengembalikan status ke Draft; vendor merevisi
 * lalu mengajukan ulang (balik ke Review Internal Vendor).
 */

export const PROCEDURE_STATUS = {
  draft: 'Draft',
  reviewInternalVendor: 'Review Internal Vendor',
  reviewPgsol: 'Review PGSOL',
  reviewHsePgsol: 'Review HSE PGSOL',
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
  PROCEDURE_STATUS.reviewHsePgsol,
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
  [PROCEDURE_STATUS.reviewHsePgsol]: { module: 'procedure', action: 'hse_pgsol' },
  [PROCEDURE_STATUS.menungguReviewPM]: { module: 'procedure', action: 'review' },
};

/**
 * Urutan lengkap tahap Prosedur Kerja (termasuk review internal vendor, yang
 * sengaja TIDAK masuk PROCEDURE_STAGE_PERMISSION di atas karena itu menunggu
 * vendor, bukan pihak internal) — satu-satunya sumber kebenaran urutan tahap
 * untuk timeline approval (lihat DocStageTimeline).
 */
export const PROCEDURE_STAGE_SEQUENCE = [
  { key: 'procedure.review_vendor', label: 'Review Internal Vendor', status: PROCEDURE_STATUS.reviewInternalVendor },
  { key: 'procedure.review_pgsol', label: 'Review PGSOL', status: PROCEDURE_STATUS.reviewPgsol },
  { key: 'procedure.hse_pgsol', label: 'Review HSE PGSOL', status: PROCEDURE_STATUS.reviewHsePgsol },
  { key: 'procedure.review', label: 'Review PM (PGN)', status: PROCEDURE_STATUS.menungguReviewPM },
] as const;

/** Index tahap saat ini di PROCEDURE_STAGE_SEQUENCE; -1 = belum mulai (Draft), sequence.length = semua tahap selesai (Approved). */
export function procedureStageIndex(status: string | null | undefined): number {
  if (status === PROCEDURE_STATUS.approved) return PROCEDURE_STAGE_SEQUENCE.length;
  return PROCEDURE_STAGE_SEQUENCE.findIndex(s => s.status === status);
}
