import { todayDateString } from '@/lib/site-ops';

/**
 * Alur persetujuan PTW — vendor (HSE -> PM), PGSOL (HSE -> PM), lalu tiga
 * tahap internal PGN.
 *
 *   Review HSE Vendor -> Review PM Vendor -> Review HSE PGSOL ->
 *   Review PM PGSOL -> Menunggu Approval PM -> Review PTW Issuer ->
 *   Menunggu Penomoran HSSE -> PTW Aktif
 *
 * Catatan penamaan: stage_key & permission lama DIPERTAHANKAN supaya
 * roles.permissions dan stage_assignments yang sudah ada tidak perlu
 * dimigrasi — hanya artinya yang berubah:
 *   ptw.hse_vendor    (baru) = HSE Vendor
 *   ptw.review_vendor        = PM Vendor   (dulu "Review Internal Vendor")
 *   ptw.hse_pgsol            = HSE PGSOL   (sekarang tahap PGSOL PERTAMA)
 *   ptw.review_pgsol         = PM PGSOL    (dulu "Reviewer PGSOL", sekarang KEDUA)
 *
 * Review HSE/PM Vendor tidak pernah nyampe PM PGN — staff vendor sendiri
 * (ditugaskan admin vendor per proyek, lihat Fase 3) harus menyetujui dulu.
 * Review HSE PGSOL -> Review PM PGSOL: dua orang PGSOL berbeda, berurutan,
 * sama polanya dengan Prosedur Kerja dan JSA.
 * Reject di tahap manapun mengembalikan status ke Draft; vendor merevisi
 * lalu mengajukan ulang (balik ke Review HSE Vendor).
 */
export const PTW_STATUS = {
  draft: 'Draft',
  reviewHseVendor: 'Review HSE Vendor',
  reviewPmVendor: 'Review PM Vendor',
  reviewHsePgsol: 'Review HSE PGSOL',
  reviewPmPgsol: 'Review PM PGSOL',
  menungguApprovalPM: 'Menunggu Approval PM',
  reviewPtwIssuer: 'Review PTW Issuer',
  menungguPenomoranHSSE: 'Menunggu Penomoran HSSE',
  aktif: 'PTW Aktif',
  expired: 'Expired',
  stoppedSwa: 'Dihentikan (SWA)',
  penutupanDiajukan: 'Penutupan Diajukan',
  selesai: 'Selesai',
} as const;

/**
 * Penutupan PTW: PTW Aktif/Expired -> (vendor mengisi form penutupan)
 * 'Penutupan Diajukan' -> (HSSE memverifikasi) 'Selesai'. Ditolak -> kembali
 * 'PTW Aktif'. Transisi hanya lewat RPC ptw_request_closure/ptw_decide_closure
 * (supabase/schema_ptw_project_completion.sql).
 */
export function isPtwClosed(status: string | null | undefined): boolean {
  return status === PTW_STATUS.selesai;
}

/** Item checklist yang diisi pemegang saat mengajukan penutupan PTW. */
export const PTW_CLOSURE_CHECKLIST = [
  { key: 'pekerjaan_selesai', label: 'Seluruh pekerjaan yang diizinkan PTW ini telah selesai' },
  { key: 'area_bersih', label: 'Area kerja telah dibersihkan (housekeeping) dan aman' },
  { key: 'peralatan_keluar', label: 'Peralatan, material, dan sisa pekerjaan telah dikeluarkan dari area' },
  { key: 'tidak_ada_bahaya', label: 'Tidak ada sumber energi/bahaya tersisa (isolasi dilepas, tidak ada api/gas/bukaan)' },
  { key: 'pekerja_keluar', label: 'Semua pekerja telah check-out dan meninggalkan area kerja' },
] as const;

/**
 * Status yang berarti PTW sedang menunggu tindakan pihak INTERNAL
 * (PGN/PGSOL) — dipakai untuk /dashboard/my-task. `reviewHseVendor`/`reviewPmVendor`
 * SENGAJA tidak masuk sini: tahap itu menunggu staff vendor sendiri.
 */
export const PTW_PENDING_STATUSES: string[] = [
  PTW_STATUS.reviewHsePgsol,
  PTW_STATUS.reviewPmPgsol,
  PTW_STATUS.menungguApprovalPM,
  PTW_STATUS.reviewPtwIssuer,
  PTW_STATUS.menungguPenomoranHSSE,
];

export function isPtwPending(status: string | null | undefined): boolean {
  return !!status && PTW_PENDING_STATUSES.includes(status);
}

/**
 * Permission yang berhak bertindak pada tiap tahap — dicocokkan lewat
 * roles.permissions (lihat utils/permissions.ts), bukan role slug yang
 * di-hardcode. Role apa pun yang dikasih permission ini dari halaman
 * Role & Permission otomatis bisa bertindak di tahap tersebut.
 */
export const PTW_STAGE_PERMISSION: Record<string, { module: string; action: string }> = {
  [PTW_STATUS.reviewHsePgsol]: { module: 'ptw', action: 'hse_pgsol' },
  [PTW_STATUS.reviewPmPgsol]: { module: 'ptw', action: 'review_pgsol' },
  [PTW_STATUS.menungguApprovalPM]: { module: 'ptw', action: 'approve_pm' },
  [PTW_STATUS.reviewPtwIssuer]: { module: 'ptw', action: 'review_issuer' },
  [PTW_STATUS.menungguPenomoranHSSE]: { module: 'ptw', action: 'numbering_hsse' },
};

/**
 * Urutan lengkap tahap PTW (termasuk dua tahap review vendor) — satu-satunya
 * sumber kebenaran urutan tahap untuk timeline approval (lihat DocStageTimeline).
 */
export const PTW_STAGE_SEQUENCE = [
  { key: 'ptw.hse_vendor', label: 'Review HSE Vendor', status: PTW_STATUS.reviewHseVendor },
  { key: 'ptw.review_vendor', label: 'Review PM Vendor', status: PTW_STATUS.reviewPmVendor },
  { key: 'ptw.hse_pgsol', label: 'Review HSE PGSOL', status: PTW_STATUS.reviewHsePgsol },
  { key: 'ptw.review_pgsol', label: 'Review PM PGSOL', status: PTW_STATUS.reviewPmPgsol },
  { key: 'ptw.approve_pm', label: 'Approval PM', status: PTW_STATUS.menungguApprovalPM },
  { key: 'ptw.review_issuer', label: 'Review PTW Issuer', status: PTW_STATUS.reviewPtwIssuer },
  { key: 'ptw.numbering_hsse', label: 'Penomoran HSSE', status: PTW_STATUS.menungguPenomoranHSSE },
] as const;

/**
 * Index tahap saat ini di PTW_STAGE_SEQUENCE; -1 = belum mulai (Draft),
 * sequence.length = semua tahap selesai (Aktif/Expired/Dihentikan/Penutupan
 * Diajukan/Selesai — semuanya cuma dicapai setelah penomoran HSSE, jadi
 * diperlakukan sama untuk timeline).
 */
export function ptwStageIndex(status: string | null | undefined): number {
  if (
    status === PTW_STATUS.aktif || status === PTW_STATUS.expired || status === PTW_STATUS.stoppedSwa ||
    status === PTW_STATUS.penutupanDiajukan || status === PTW_STATUS.selesai
  ) {
    return PTW_STAGE_SEQUENCE.length;
  }
  return PTW_STAGE_SEQUENCE.findIndex(s => s.status === status);
}

/**
 * Single source of truth for whether an issued PTW has lapsed.
 *
 * The `ptw` table has no expiry job — `status` only flips to 'Expired'
 * lazily, as a side effect of loading /dashboard/approval (see
 * getAllProjectsWithRelations in app/dashboard/approval/actions.ts).
 * Anywhere else that displays PTW status must compute the *effective*
 * status live against the project's end_date instead of trusting a
 * possibly-stale stored value, or a lapsed PTW can still read "Aktif".
 */
export function isPtwExpired(rawStatus: string | null | undefined, endDate: string | null | undefined): boolean {
  if (rawStatus !== PTW_STATUS.aktif || !endDate) return false;
  // Bandingkan string tanggal YYYY-MM-DD (nilai DATE dari DB, tanpa zona
  // waktu) terhadap "hari ini" menurut Asia/Jakarta — `new Date()` murni
  // tidak dipakai karena server bisa beda waktu satu hari dengan DB.
  return endDate < todayDateString();
}

export function getEffectivePtwStatus<T extends string | null | undefined>(rawStatus: T, endDate?: string | null): T | 'Expired' {
  if (isPtwExpired(rawStatus, endDate)) return 'Expired';
  return rawStatus;
}
