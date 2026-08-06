import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { EditableProfile } from "./EditableProfile";
import { getRoleLabel } from "@/lib/roles";

export const metadata = {
  title: 'Profil Pengguna | Smart System K3',
};

export default async function InternalProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  const { data: internalProfile } = await supabase
    .from('internal_profiles')
    .select('nip')
    .eq('id', user.id)
    .single();

  // Org-wide K3 snapshot for the stats row
  const [
    { count: activeProjectsCount },
    { count: jsaApprovedCount },
    { count: ptwWaitingCount },
    { count: incidentsCount },
  ] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).neq('status', 'Selesai').neq('status', 'Ditolak'),
    supabase.from('jsa').select('*', { count: 'exact', head: true }).eq('status', 'JSA Disetujui'),
    supabase.from('ptw').select('*', { count: 'exact', head: true }).eq('status', 'Menunggu Approval PM'),
    supabase.from('incidents').select('*', { count: 'exact', head: true }),
  ]);

  // Data relevant to the K3 System
  const userData = {
    fullName: profile?.full_name || user.user_metadata?.full_name || 'Admin K3',
    role: getRoleLabel(profile?.role),
    nip: internalProfile?.nip || '',
    joinedDate: new Date(user.created_at || Date.now()).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  };

  const stats = {
    activeProjects: activeProjectsCount || 0,
    jsaApproved: jsaApprovedCount || 0,
    ptwWaiting: ptwWaitingCount || 0,
    incidents: incidentsCount || 0,
  };

  return <EditableProfile user={user} initialUserData={userData} stats={stats} />;
}
