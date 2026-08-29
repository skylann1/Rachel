export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  pm: 'Project Manager',
  hse: 'HSE Manager',
  pengawas: 'Pengawas Lapangan',
  pgsol_reviewer: 'Reviewer PGSOL',
  pgn_approver: 'Approver PGN',
  asset_manager: 'Asset Manager',
  ptw_authority: 'PTW Authority',
  ptw_issuer: 'PTW Issuer',
  vendor: 'Vendor',
  vendor_admin: 'Admin Vendor',
  pgsol_admin: 'Admin PGSOL',
};

/**
 * Label tampilan untuk sebuah role.
 *
 * Role bersifat data-driven (tabel public.roles, dikelola di halaman
 * Role & Permission), sehingga slug apa pun bisa muncul. ROLE_LABELS hanya
 * berisi override agar role bawaan tampil rapi; slug lain diformat otomatis
 * dari snake_case menjadi Title Case — bukan jatuh ke "Pengguna".
 */
export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return 'Pengguna';
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  return role
    .split('_')
    .filter(Boolean)
    .map(kata => kata.charAt(0).toUpperCase() + kata.slice(1))
    .join(' ');
}

/**
 * `profiles.type` sekarang ada 3 nilai (pgn/pgsol/vendor) — helper ini
 * menggantikan perbandingan string literal langsung yang tersebar di kode,
 * supaya kalau nanti ada perubahan lagi cukup diubah di satu tempat.
 */
export function isPgn(type: string | null | undefined): boolean {
  return type === 'pgn';
}

export function isPgsol(type: string | null | undefined): boolean {
  return type === 'pgsol';
}

export function isVendor(type: string | null | undefined): boolean {
  return type === 'vendor';
}
