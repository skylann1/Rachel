"use server";

import { createClient } from "@/utils/supabase/server";
import { getMyTasks } from "@/app/dashboard/my-task/actions";
import { PTW_STATUS } from "@/lib/ptw-status";

export interface SidebarBadges {
  myTask: number;
  pendingApproval: number;
  ongoingProjects: number;
  openIncidents: number;
  openInspections: number;
}

const EMPTY_BADGES: SidebarBadges = {
  myTask: 0,
  pendingApproval: 0,
  ongoingProjects: 0,
  openIncidents: 0,
  openInspections: 0,
};

/**
 * Angka badge di sidebar — dihitung ulang server-side tiap kali layout
 * dashboard di-render (sama seperti getUserPermissions/getUnreadCount).
 * pendingApproval & ongoingProjects SENGAJA meniru persis filter yang
 * sudah dipakai halamannya sendiri (ApprovalPageClient.tsx &
 * ongoing/page.tsx) supaya angka di sidebar tidak pernah menyimpang dari
 * isi halaman yang ditunjuknya.
 */
export async function getSidebarBadges(): Promise<SidebarBadges> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY_BADGES;

  const [myTasks, projectsResult, incidentsResult, inspectionsResult] = await Promise.all([
    getMyTasks(),
    supabase.from('projects').select('status, ptw ( status )'),
    supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('status', 'Menunggu Investigasi'),
    supabase.from('inspections').select('id', { count: 'exact', head: true }).eq('status', 'Open'),
  ]);

  const projects = projectsResult.data || [];

  // Kelola Proyek: proyek yang belum selesai & belum semua PTW-nya aktif —
  // persis filter `pendingProjects` di app/dashboard/approval/ApprovalPageClient.tsx.
  const pendingApproval = projects.filter((project: any) => {
    const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
    const isCompleted = project.status === 'Completed' || project.status === 'Selesai';
    const allPtwAktif = ptws.length > 0 && ptws.every((p) => p.status === PTW_STATUS.aktif);
    return !isCompleted && !allPtwAktif;
  }).length;

  // Proyek Berjalan: persis filter `ongoingProjects` di app/dashboard/ongoing/page.tsx.
  const ongoingProjects = projects.filter((project: any) => {
    const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
    return ptws.some((p) => p.status === PTW_STATUS.aktif || p.status === PTW_STATUS.stoppedSwa) && project.status !== 'Completed';
  }).length;

  return {
    myTask: myTasks.length,
    pendingApproval,
    ongoingProjects,
    openIncidents: incidentsResult.count || 0,
    openInspections: inspectionsResult.count || 0,
  };
}
