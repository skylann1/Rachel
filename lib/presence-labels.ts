/**
 * Pemetaan path URL → label manusiawi untuk kolom "sedang di" pada daftar
 * pengguna online. Urutan PENTING: path paling spesifik harus di atas, karena
 * pencocokan memakai startsWith dan yang pertama cocok menang (mis.
 * '/dashboard/master-data/vendor' harus ketemu sebelum '/dashboard').
 */
const PRESENCE_PATH_LABELS: Array<[string, string]> = [
  ['/dashboard/master-data/activity-log', 'Log Aktivitas'],
  ['/dashboard/master-data/vendor', 'Master Data — Vendor'],
  ['/dashboard/master-data/account', 'Master Data — Akun'],
  ['/dashboard/master-data/role', 'Master Data — Role & Permission'],
  ['/dashboard/master-data/project-pgsol-assign', 'Kelola Reviewer PGSOL'],
  ['/dashboard/master-data/project', 'Master Data — Proyek'],
  ['/dashboard/master-data/announcement', 'Master Data — Pengumuman'],
  ['/dashboard/projects', 'Detail Proyek'],
  ['/dashboard/approval', 'Kelola Proyek (Approval K3)'],
  ['/dashboard/ongoing', 'Proyek Berjalan'],
  ['/dashboard/archive', 'Arsip Proyek'],
  ['/dashboard/my-task', 'My Task'],
  ['/dashboard/inspection', 'Inspeksi Proyek'],
  ['/dashboard/incident', 'Laporan Insiden'],
  ['/dashboard/vendor-docs', 'Dokumen Vendor'],
  ['/dashboard/site-status', 'Status Lapangan'],
  ['/dashboard/inbox', 'Kotak Masuk'],
  ['/dashboard/profile', 'Profil'],
  ['/dashboard/panduan', 'Panduan Alur K3'],
  ['/dashboard', 'Dashboard'],
  ['/vendor/dashboard/projects', 'Vendor — Proyek'],
  ['/vendor/dashboard/ptw', 'Vendor — Buat PTW'],
  ['/vendor/dashboard/jsa', 'Vendor — Buat JSA'],
  ['/vendor/dashboard/my-task', 'Vendor — My Task'],
  ['/vendor/dashboard/inspection', 'Vendor — Inspeksi'],
  ['/vendor/dashboard/incident', 'Vendor — Insiden'],
  ['/vendor/dashboard/pekerja', 'Vendor — Data Pekerja'],
  ['/vendor/dashboard/peralatan', 'Vendor — Data Peralatan'],
  ['/vendor/dashboard/material', 'Vendor — Data Material'],
  ['/vendor/dashboard/dokumen', 'Vendor — Dokumen K3'],
  ['/vendor/dashboard/staff', 'Vendor — Staff'],
  ['/vendor/dashboard', 'Vendor — Dashboard'],
];

export function labelForPath(path: string | null | undefined): string {
  if (!path) return 'Tidak diketahui';
  const hit = PRESENCE_PATH_LABELS.find(([prefix]) => path.startsWith(prefix));
  if (hit) return hit[1];
  // Belum dipetakan: pakai segmen terakhir URL supaya tetap terbaca, tidak
  // pernah kosong.
  const seg = path.split('/').filter(Boolean).pop() || path;
  return seg.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
}
