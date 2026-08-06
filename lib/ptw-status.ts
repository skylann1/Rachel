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
  if (rawStatus !== 'PTW Aktif' || !endDate) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  return end < now;
}

export function getEffectivePtwStatus<T extends string | null | undefined>(rawStatus: T, endDate?: string | null): T | 'Expired' {
  if (isPtwExpired(rawStatus, endDate)) return 'Expired';
  return rawStatus;
}
