import { redirect } from 'next/navigation';
import { hasPermission } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

export default async function StuckDocumentsLayout({ children }: { children: React.ReactNode }) {
  // Izin yang sama dengan Log Aktivitas — keduanya modul pemantauan sistem.
  const isAllowed = await hasPermission('activityLog', 'view');
  if (!isAllowed) redirect('/dashboard');
  return <>{children}</>;
}
