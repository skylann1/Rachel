import { redirect } from 'next/navigation';
import { hasPermission } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const isAllowed = await hasPermission('masterData', 'view_vendor');
  if (!isAllowed) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
