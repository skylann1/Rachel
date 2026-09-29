import { redirect } from 'next/navigation';

// /pgsol/login dulu adalah pintu masuk terbrand realm PGSOL sendiri. PGSOL
// sekarang login lewat /auth/login yang sama dengan PGN — lihat
// docs/superpowers/specs/2026-09-29-pgsol-dashboard-merge-design.md.
// Halaman ini disisakan tipis (bukan dihapus) supaya bookmark/link lama
// tidak 404.
export default function PgsolLoginRedirect() {
  redirect('/auth/login');
}
