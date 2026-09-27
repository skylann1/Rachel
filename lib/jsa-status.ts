/**
 * Alur persetujuan JSA — review internal vendor, lalu PGSOL (Reviewer, lalu HSE), lalu PGN.
 *
 *   Draft -> Review Internal Vendor -> Review PGSOL -> Review HSE PGSOL ->
 *   Persetujuan PGN -> JSA Disetujui
 *
 * Review Internal Vendor : staff vendor sendiri (ditugaskan admin vendor
 *                   per proyek, lihat Fase 3) harus menyetujui dulu
 *                   sebelum JSA nyampe PGSOL.
 * Review PGSOL    : verifikasi teknis oleh Satker Pemberi Kerja (PGSOL).
 *                   Mengecek bahaya sudah teridentifikasi, mitigasi memadai,
 *                   dan nilai risiko wajar. Blok "Direview Oleh" pada form.
 * Review HSE PGSOL : verifikasi aspek keselamatan kerja oleh orang PGSOL yang berbeda dari Reviewer, sebelum diteruskan ke PGN.
 *
 * Persetujuan PGN : otorisasi formal oleh Satker Penanggung Jawab (PGN).
 *                   Menerima risiko sisa dan mengizinkan pekerjaan berjalan.
 *                   Blok "Disetujui Oleh" pada form.
 */

export const JSA_STATUS = {
  draft: 'Draft',
  reviewInternalVendor: 'Review Internal Vendor',
  reviewPgsol: 'Review PGSOL',
  reviewHsePgsol: 'Review HSE PGSOL',
  approvalPgn: 'Persetujuan PGN',
  approved: 'JSA Disetujui',
} as const;

/**
 * Status yang berarti JSA sedang menunggu tindakan pihak INTERNAL
 * (PGN/PGSOL) — dipakai untuk /dashboard/my-task. `reviewInternalVendor`
 * SENGAJA tidak masuk sini: tahap itu menunggu staff vendor sendiri.
 */
export const JSA_PENDING_STATUSES: string[] = [
  JSA_STATUS.reviewPgsol,
  JSA_STATUS.reviewHsePgsol,
  JSA_STATUS.approvalPgn,
];

export function isJsaPending(status: string | null | undefined): boolean {
  return !!status && JSA_PENDING_STATUSES.includes(status);
}

/**
 * Permission yang berhak bertindak pada tiap tahap — dicocokkan lewat
 * roles.permissions (lihat utils/permissions.ts), bukan role slug yang
 * di-hardcode. Role apa pun yang dikasih permission ini dari halaman
 * Role & Permission otomatis bisa bertindak di tahap tersebut.
 */
export const JSA_STAGE_PERMISSION: Record<string, { module: string; action: string }> = {
  [JSA_STATUS.reviewPgsol]: { module: 'jsa', action: 'review_pgsol' },
  [JSA_STATUS.reviewHsePgsol]: { module: 'jsa', action: 'hse_pgsol' },
  [JSA_STATUS.approvalPgn]: { module: 'jsa', action: 'approve_pgn' },
};
