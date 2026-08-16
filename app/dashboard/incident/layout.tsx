import { redirect } from 'next/navigation';
import { hasPermission } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

export default async function IncidentLayout({ children }: { children: React.ReactNode }) {
  const isAllowed = await hasPermission('incident', 'view');
  if (!isAllowed) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
