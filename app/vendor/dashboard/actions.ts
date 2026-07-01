"use server";

import { createClient } from "@/utils/supabase/server";

export async function getVendorDashboardData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { projects: [], stats: { total: 0, pendingJsa: 0, activePtw: 0 } };

  // Fetch projects
  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      start_date,
      end_date,
      jsa ( status ),
      ptw ( status )
    `)
    .eq('vendor_id', user.id)
    .order('created_at', { ascending: false });

  if (projectsError) {
    console.error(projectsError);
    return { projects: [], stats: { total: 0, pendingJsa: 0, activePtw: 0 } };
  }

  let totalProjects = projectsData.length;
  let pendingJsa = 0;
  let activePtw = 0;

  const formattedProjects = projectsData.map(p => {
    // Basic rules to extract status
    const jsaStatuses = p.jsa?.map((j: any) => j.status) || [];
    const ptwStatuses = p.ptw?.map((ptw: any) => ptw.status) || [];

    let jsaStatus = 'Belum Ada';
    if (jsaStatuses.includes('Approved')) jsaStatus = 'Approved';
    else if (jsaStatuses.includes('Menunggu Review')) jsaStatus = 'Pending';
    else if (jsaStatuses.includes('Rejected')) jsaStatus = 'Rejected';
    
    let ptwStatus = 'Belum Terbit';
    if (ptwStatuses.includes('Disetujui')) ptwStatus = 'Aktif';
    else if (ptwStatuses.includes('Menunggu Approval PM') || ptwStatuses.includes('Menunggu Approval HSE')) ptwStatus = 'Menunggu Persetujuan';
    else if (ptwStatuses.includes('Ditolak')) ptwStatus = 'Ditolak';

    if (jsaStatus === 'Pending') pendingJsa++;
    if (ptwStatus === 'Aktif') activePtw++;

    return {
      id: p.id,
      name: p.name,
      jsaStatus,
      ptwStatus,
      date: p.start_date || 'N/A'
    };
  });

  return {
    projects: formattedProjects,
    stats: {
      total: totalProjects,
      pendingJsa,
      activePtw
    }
  };
}
