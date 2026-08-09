/**
 * Alur persetujuan PTW — tiga tahap internal.
 *
 *   Menunggu Approval PM -> Review PTW Issuer -> Menunggu Penomoran HSSE -> PTW Aktif
 *
 * Reject di tahap manapun mengembalikan status ke Draft; vendor merevisi
 * lalu mengajukan ulang (balik ke Menunggu Approval PM).
 */
export const PTW_STATUS = {
  draft: 'Draft',
  menungguApprovalPM: 'Menunggu Approval PM',
  reviewPtwIssuer: 'Review PTW Issuer',
  menungguPenomoranHSSE: 'Menunggu Penomoran HSSE',
  aktif: 'PTW Aktif',
  expired: 'Expired',
} as const;

/** Status yang berarti PTW sedang menunggu tindakan pihak internal. */
export const PTW_PENDING_STATUSES: string[] = [
  PTW_STATUS.menungguApprovalPM,
  PTW_STATUS.reviewPtwIssuer,
  PTW_STATUS.menungguPenomoranHSSE,
];

export function isPtwPending(status: string | null | undefined): boolean {
  return !!status && PTW_PENDING_STATUSES.includes(status);
}

/** Role yang berhak bertindak pada tiap tahap. */
export const PTW_STAGE_ROLES: Record<string, string[]> = {
  [PTW_STATUS.menungguApprovalPM]: ['ptw_authority'],
  [PTW_STATUS.reviewPtwIssuer]: ['ptw_issuer'],
  [PTW_STATUS.menungguPenomoranHSSE]: ['hse'],
};

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
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  return end < now;
}

export function getEffectivePtwStatus<T extends string | null | undefined>(rawStatus: T, endDate?: string | null): T | 'Expired' {
  if (isPtwExpired(rawStatus, endDate)) return 'Expired';
  return rawStatus;
}
