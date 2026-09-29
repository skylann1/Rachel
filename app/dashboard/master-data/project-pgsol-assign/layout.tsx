import { redirect } from 'next/navigation';
import { hasPermission } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

export default async function ProjectPgsolAssignLayout({ children }: { children: React.ReactNode }) {
  // Gerbang tunggal untuk seluruh subtree ini — pola yang sama dengan
  // app/dashboard/master-data/project/layout.tsx (yang menggerbangi
  // manage_project). manage_assignment_pgsol allowedTypes: ['pgsol']
  // sehingga entri nav ini otomatis tidak pernah nongol untuk admin PGN
  // (lihat SidebarNav), tapi gate server-side ini tetap wajib ada karena
  // URL bisa diakses langsung.
  const isAllowed = await hasPermission('jsa', 'manage_assignment_pgsol');
  if (!isAllowed) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
