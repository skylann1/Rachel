import { redirect } from 'next/navigation';
import { hasPermission } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

export default async function ActivityLogLayout({ children }: { children: React.ReactNode }) {
  const isAllowed = await hasPermission('activityLog', 'view');
  if (!isAllowed) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
