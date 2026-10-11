/**
 * Alur persetujuan JSA — tiga pihak, masing-masing dua tahap berurutan:
 * vendor (HSE -> PM), PGSOL (HSE -> PM), PGN (HSSE -> PM/OM Zona).
 *
 *   Draft -> Review HSE Vendor -> Review PM Vendor -> Review HSE PGSOL ->
 *   Review PM PGSOL -> Review HSSE PGN -> Persetujuan PGN -> JSA Disetujui
 *
 * Catatan penamaan: stage_key & permission lama DIPERTAHANKAN supaya
 * roles.permissions dan stage_assignments yang sudah ada tidak perlu
 * dimigrasi — hanya artinya yang berubah:
 *   jsa.hse_vendor    (baru)  = HSE Vendor
 *   jsa.review_vendor         = PM Vendor   (dulu "Review Internal Vendor")
 *   jsa.hse_pgsol             = HSE PGSOL   (sekarang tahap PGSOL PERTAMA)
 *   jsa.review_pgsol          = PM PGSOL    (dulu "Reviewer PGSOL", sekarang KEDUA)
 *
 * Review HSE/PM Vendor : staff vendor sendiri (ditugaskan admin vendor
 *                   per proyek, lihat Fase 3) harus menyetujui dulu
 *                   sebelum JSA nyampe PGSOL.
 * Review HSE PGSOL : verifikasi aspek keselamatan kerja oleh HSE PGSOL.
 * Review PM PGSOL : verifikasi akhir sisi PGSOL oleh PM PGSOL (Satker
 *                   Pemberi Kerja), orang yang berbeda dari HSE PGSOL.
 *                   Mengecek bahaya sudah teridentifikasi, mitigasi memadai,
 *                   dan nilai risiko wajar. Blok "Direview Oleh" pada form.
 * Review HSSE PGN : verifikasi keselamatan oleh HSSE PGN — menyamakan pola
 *                   dua-tahap PGSOL (Reviewer -> HSE) di sisi PGN, sebelum
 *                   diteruskan ke PM Zona untuk persetujuan akhir.
 *
 * Persetujuan PGN : otorisasi formal oleh PM Zona (Satker Penanggung Jawab, PGN).
 *                   Menerima risiko sisa dan mengizinkan pekerjaan berjalan.
 *                   Blok "Disetujui Oleh" pada form.
 */

export const JSA_STATUS = {
  draft: 'Draft',
  reviewHseVendor: 'Review HSE Vendor',
  reviewPmVendor: 'Review PM Vendor',
  reviewHsePgsol: 'Review HSE PGSOL',
  reviewPmPgsol: 'Review PM PGSOL',
  reviewHssePgn: 'Review HSSE PGN',
  approvalPgn: 'Persetujuan PGN',
  approved: 'JSA Disetujui',
} as const;

/**
 * Status yang berarti JSA sedang menunggu tindakan pihak INTERNAL
 * (PGN/PGSOL) — dipakai untuk /dashboard/my-task. `reviewHseVendor`/`reviewPmVendor`
 * SENGAJA tidak masuk sini: tahap itu menunggu staff vendor sendiri.
 */
export const JSA_PENDING_STATUSES: string[] = [
  JSA_STATUS.reviewHsePgsol,
  JSA_STATUS.reviewPmPgsol,
  JSA_STATUS.reviewHssePgn,
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
  [JSA_STATUS.reviewHsePgsol]: { module: 'jsa', action: 'hse_pgsol' },
  [JSA_STATUS.reviewPmPgsol]: { module: 'jsa', action: 'review_pgsol' },
  [JSA_STATUS.reviewHssePgn]: { module: 'jsa', action: 'hsse_pgn' },
  [JSA_STATUS.approvalPgn]: { module: 'jsa', action: 'approve_pgn' },
};

/**
 * Urutan lengkap tahap JSA (termasuk dua tahap review vendor) — satu-satunya
 * sumber kebenaran urutan tahap untuk timeline approval (lihat DocStageTimeline).
 */
export const JSA_STAGE_SEQUENCE = [
  { key: 'jsa.hse_vendor', label: 'Review HSE Vendor', status: JSA_STATUS.reviewHseVendor },
  { key: 'jsa.review_vendor', label: 'Review PM Vendor', status: JSA_STATUS.reviewPmVendor },
  { key: 'jsa.hse_pgsol', label: 'Review HSE PGSOL', status: JSA_STATUS.reviewHsePgsol },
  { key: 'jsa.review_pgsol', label: 'Review PM PGSOL', status: JSA_STATUS.reviewPmPgsol },
  { key: 'jsa.hsse_pgn', label: 'Review HSSE PGN', status: JSA_STATUS.reviewHssePgn },
  { key: 'jsa.approve_pgn', label: 'Persetujuan PM Zona (PGN)', status: JSA_STATUS.approvalPgn },
] as const;

/** Index tahap saat ini di JSA_STAGE_SEQUENCE; -1 = belum mulai (Draft), sequence.length = semua tahap selesai (Approved). */
export function jsaStageIndex(status: string | null | undefined): number {
  if (status === JSA_STATUS.approved) return JSA_STAGE_SEQUENCE.length;
  return JSA_STAGE_SEQUENCE.findIndex(s => s.status === status);
}
