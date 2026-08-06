"use server";

import { createClient } from "@/utils/supabase/server";
import { getNotifications } from "@/app/dashboard/inbox/actions";
import { getEffectivePtwStatus } from "@/lib/ptw-status";
import { JSA_STATUS, isJsaPending } from "@/lib/jsa-status";

// Mirrors the real status strings written by the approval workflow
// (see app/dashboard/approval/actions.ts and app/vendor/dashboard/projects/[id]/VendorProjectClient.tsx)
function mapJsaStatus(jsa?: { status: string; rejection_note?: string | null }): 'Approved' | 'Pending' | 'Rejected' | 'Belum Ada' {
  if (!jsa) return 'Belum Ada';
  if (jsa.status === JSA_STATUS.approved) return 'Approved';
  if (isJsaPending(jsa.status)) {
    return jsa.rejection_note ? 'Rejected' : 'Pending';
  }
  return 'Belum Ada'; // Draft: created but not yet submitted
}

function mapPtwStatus(ptw?: { status: string; rejection_note?: string | null }, endDate?: string | null): 'Aktif' | 'Menunggu Persetujuan' | 'Ditolak' | 'Expired' | 'Belum Terbit' {
  if (!ptw) return 'Belum Terbit';
  const status = getEffectivePtwStatus(ptw.status, endDate);
  if (status === 'PTW Aktif') return 'Aktif';
  if (status === 'Expired') return 'Expired';
  if (status === 'Draft') return ptw.rejection_note ? 'Ditolak' : 'Belum Terbit';
  return 'Menunggu Persetujuan'; // Menunggu Approval PM / Review PTW Issuer / Menunggu Penomoran HSSE
}

export async function getVendorDashboardData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { projects: [], stats: { total: 0, pendingJsa: 0, activePtw: 0, needsAction: 0 } };

  // Fetch projects
  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      start_date,
      end_date,
      jsa ( status, rejection_note ),
      ptw ( status, rejection_note )
    `)
    .eq('vendor_id', user.id)
    .order('created_at', { ascending: false });

  if (projectsError) {
    console.error(projectsError);
    return { projects: [], stats: { total: 0, pendingJsa: 0, activePtw: 0, needsAction: 0 } };
  }

  let totalProjects = projectsData.length;
  let pendingJsa = 0;
  let activePtw = 0;
  let needsAction = 0;

  const formattedProjects = projectsData.map(p => {
    const jsaStatus = mapJsaStatus(p.jsa?.[0]);
    const ptwStatus = mapPtwStatus(p.ptw?.[0], p.end_date);

    if (jsaStatus === 'Pending') pendingJsa++;
    if (ptwStatus === 'Aktif') activePtw++;
    if (jsaStatus === 'Rejected' || ptwStatus === 'Ditolak') needsAction++;

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
      activePtw,
      needsAction
    }
  };
}

export interface VendorActivityItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: 'success' | 'danger' | 'info';
  link: string | null;
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'Baru saja';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit yang lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam yang lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari yang lalu`;
  return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function getVendorRecentActivity(): Promise<VendorActivityItem[]> {
  const notifications = await getNotifications();

  return notifications.slice(0, 6).map(n => ({
    id: n.id,
    title: n.title,
    desc: n.message,
    time: timeAgo(n.created_at),
    type: n.type === 'approval' ? 'success' : n.type === 'warning' ? 'danger' : 'info',
    link: n.link,
  }));
}
