import { redirect } from 'next/navigation';

// Log Aktivitas dipindah ke modul Sistem. Halaman ini dipertahankan hanya
// supaya bookmark lama tidak 404.
export default function LegacyActivityLogRedirect() {
  redirect('/dashboard/system/activity-log');
}
