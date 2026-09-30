import { redirect } from 'next/navigation';
import { hasPermission } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

export default async function AnnouncementLayout({ children }: { children: React.ReactNode }) {
  const isAllowed = await hasPermission('announcement', 'manage');
  if (!isAllowed) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
