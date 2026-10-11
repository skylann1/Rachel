/**
 * Alur persetujuan Prosedur Kerja — tiga pihak, masing-masing dua tahap
 * berurutan: vendor (HSE -> PM), PGSOL (HSE -> PM), PGN (HSSE -> PM Zona).
 * Sama polanya dengan JSA dan PTW.
 *
 *   Draft -> Review HSE Vendor -> Review PM Vendor -> Review HSE PGSOL ->
 *   Review PM PGSOL -> Review HSSE PGN -> Menunggu Review PM ->
 *   Prosedur Disetujui
 *
 * Catatan penamaan: stage_key & permission lama DIPERTAHANKAN supaya
 * roles.permissions dan stage_assignments yang sudah ada tidak perlu
 * dimigrasi — hanya artinya yang berubah:
 *   procedure.hse_vendor    (baru) = HSE Vendor
 *   procedure.review_vendor        = PM Vendor   (dulu "Review Internal Vendor")
 *   procedure.hse_pgsol            = HSE PGSOL   (sekarang tahap PGSOL PERTAMA)
 *   procedure.review_pgsol         = PM PGSOL    (dulu "Reviewer PGSOL", sekarang KEDUA)
 *
 * Review HSE/PM Vendor tidak pernah nyampe pihak PGN/PGSOL — staff vendor
 * sendiri (ditugaskan admin vendor per proyek, lihat Fase 3) harus
 * menyetujui dulu sebelum PGSOL melihatnya. Review HSE PGSOL -> Review PM
 * PGSOL: dua orang PGSOL berbeda, berurutan, sebelum diteruskan ke PGN.
 * Di sisi PGN: Review HSSE PGN lalu Menunggu Review PM (persetujuan akhir
 * oleh PM Zona).
 * Reject di tahap manapun mengembalikan status ke Draft; vendor merevisi
 * lalu mengajukan ulang (balik ke Review HSE Vendor).
 */

export const PROCEDURE_STATUS = {
  draft: 'Draft',
  reviewHseVendor: 'Review HSE Vendor',
  reviewPmVendor: 'Review PM Vendor',
  reviewHsePgsol: 'Review HSE PGSOL',
  reviewPmPgsol: 'Review PM PGSOL',
  reviewHssePgn: 'Review HSSE PGN',
  menungguReviewPM: 'Menunggu Review PM',
  approved: 'Prosedur Disetujui',
} as const;

/**
 * Status yang berarti Prosedur sedang menunggu tindakan pihak INTERNAL
 * (PGN/PGSOL) — dipakai untuk /dashboard/my-task. `reviewHseVendor`/`reviewPmVendor`
 * SENGAJA tidak masuk sini: tahap itu menunggu staff vendor sendiri, bukan
 * pihak internal, dan tidak boleh muncul di task list internal.
 */
export const PROCEDURE_PENDING_STATUSES: string[] = [
  PROCEDURE_STATUS.reviewHsePgsol,
  PROCEDURE_STATUS.reviewPmPgsol,
  PROCEDURE_STATUS.reviewHssePgn,
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
  [PROCEDURE_STATUS.reviewHsePgsol]: { module: 'procedure', action: 'hse_pgsol' },
  [PROCEDURE_STATUS.reviewPmPgsol]: { module: 'procedure', action: 'review_pgsol' },
  [PROCEDURE_STATUS.reviewHssePgn]: { module: 'procedure', action: 'hsse_pgn' },
  [PROCEDURE_STATUS.menungguReviewPM]: { module: 'procedure', action: 'review' },
};

/**
 * Urutan lengkap tahap Prosedur Kerja (termasuk dua tahap review vendor, yang
 * sengaja TIDAK masuk PROCEDURE_STAGE_PERMISSION di atas karena itu menunggu
 * vendor, bukan pihak internal) — satu-satunya sumber kebenaran urutan tahap
 * untuk timeline approval (lihat DocStageTimeline).
 */
export const PROCEDURE_STAGE_SEQUENCE = [
  { key: 'procedure.hse_vendor', label: 'Review HSE Vendor', status: PROCEDURE_STATUS.reviewHseVendor },
  { key: 'procedure.review_vendor', label: 'Review PM Vendor', status: PROCEDURE_STATUS.reviewPmVendor },
  { key: 'procedure.hse_pgsol', label: 'Review HSE PGSOL', status: PROCEDURE_STATUS.reviewHsePgsol },
  { key: 'procedure.review_pgsol', label: 'Review PM PGSOL', status: PROCEDURE_STATUS.reviewPmPgsol },
  { key: 'procedure.hsse_pgn', label: 'Review HSSE PGN', status: PROCEDURE_STATUS.reviewHssePgn },
  { key: 'procedure.review', label: 'Review PM Zona (PGN)', status: PROCEDURE_STATUS.menungguReviewPM },
] as const;

/** Index tahap saat ini di PROCEDURE_STAGE_SEQUENCE; -1 = belum mulai (Draft), sequence.length = semua tahap selesai (Approved). */
export function procedureStageIndex(status: string | null | undefined): number {
  if (status === PROCEDURE_STATUS.approved) return PROCEDURE_STAGE_SEQUENCE.length;
  return PROCEDURE_STAGE_SEQUENCE.findIndex(s => s.status === status);
}
