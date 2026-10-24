import { redirect } from 'next/navigation';
import { hasPermission } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

export default async function LocationLayout({ children }: { children: React.ReactNode }) {
  const isAllowed = await hasPermission('masterData', 'manage_location');
  if (!isAllowed) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
