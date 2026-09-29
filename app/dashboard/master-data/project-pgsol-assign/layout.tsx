import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { hasPermission } from '@/utils/permissions';

export const dynamic = 'force-dynamic';

export default async function ProjectPgsolAssignLayout({ children }: { children: React.ReactNode }) {
  // Gerbang tunggal untuk seluruh subtree ini — pola yang sama dengan
  // app/dashboard/master-data/project/layout.tsx (yang menggerbangi
  // manage_project). Permission saja TIDAK CUKUP: role `admin` (PGN)
  // mendapat SELURUH permission lewat fullAccessPermissions() di
  // utils/permissions.ts, terlepas dari allowedTypes yang dideklarasikan
  // di constants.ts (field itu cuma menyaring checkbox mana yang tampil di
  // UI Role & Permission, bukan penegakan runtime) — jadi admin PGN tetap
  // lolos hasPermission() di bawah kalau cuma dicek permission-nya saja.
  // Cek tipe organisasi aktor sendiri di sini, sama seperti yang sudah
  // dilakukan savePgsolAssignment() di ./actions.ts.
  const isAllowed = await hasPermission('jsa', 'manage_assignment_pgsol');
  if (!isAllowed) {
    redirect('/dashboard');
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: actorProfile } = await supabase.from('profiles').select('type').eq('id', user?.id).single();
  if (actorProfile?.type !== 'pgsol') {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
