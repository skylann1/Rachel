"use server";

import { createClient } from "@/utils/supabase/server";
import { getEffectivePtwStatus, PTW_STATUS, PTW_PENDING_STATUSES } from "@/lib/ptw-status";
import { JSA_STATUS, JSA_STAGE_ROLES, JSA_PENDING_STATUSES } from "@/lib/jsa-status";
import { PROCEDURE_STATUS } from "@/lib/procedure-status";

export type TaskType = 'Prosedur' | 'JSA' | 'PTW' | 'Insiden' | 'Pengawasan';
export type UrgencyType = 'High' | 'Medium' | 'Low';

export interface TaskItem {
  id: string;
  title: string;
  type: TaskType;
  projectName: string;
  vendorName: string;
  date: string;
  url: string;
  status: string;
  urgency: UrgencyType;
  timeInQueue: string;
}

// Helper to determine mock urgency based on date
const getUrgency = (dateString: string): UrgencyType => {
  const days = (Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24);
  if (days > 2) return 'High';
  if (days > 1) return 'Medium';
  return 'Low';
};

const formatTimeInQueue = (dateString: string): string => {
  const hours = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60));
  if (hours < 24) return `${hours} Jam`;
  return `${Math.floor(hours / 24)} Hari`;
};

export async function getMyTasks(): Promise<TaskItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'vendor';
  const tasks: TaskItem[] = [];

  // 1. Fetch Procedures
  if (role === 'admin' || role === 'pm' || role === 'hse') {
    const { data: procedures } = await supabase
      .from('procedures')
      .select(`
        id, status, created_at, project_id,
        projects ( name, vendor_profiles ( company_name ) )
      `)
      .in('status', ['Submitted', PROCEDURE_STATUS.menungguReviewPM, PROCEDURE_STATUS.draft]);
    
    if (procedures) {
      procedures.forEach((proc: any) => {
        if (role === 'admin' || role === 'pm' || role === 'hse') {
           const proj = Array.isArray(proc.projects) ? proc.projects[0] : proc.projects;
           const vendor = proj?.vendor_profiles;
           const companyName = Array.isArray(vendor) ? vendor[0]?.company_name : vendor?.company_name;

           tasks.push({
             id: proc.id,
             title: `Review Prosedur Kerja`,
             type: 'Prosedur',
             projectName: proj?.name || 'Unknown Project',
             vendorName: companyName || 'Internal',
             date: proc.created_at,
             url: `/dashboard/projects/${proc.project_id}`,
             status: proc.status,
             urgency: getUrgency(proc.created_at),
             timeInQueue: formatTimeInQueue(proc.created_at)
           });
        }
      });
    }
  }

  // 2. Fetch JSA — dua tahap: Review PGSOL, lalu Persetujuan PGN (orang berbeda)
  if (role === 'admin' || role === 'pgsol_reviewer' || role === 'pgn_approver') {
    const { data: jsas } = await supabase
      .from('jsa')
      .select(`
        id, status, created_at, project_id, reviewer_id,
        projects ( name, vendor_profiles ( company_name ) )
      `)
      .in('status', JSA_PENDING_STATUSES);

    if (jsas) {
      jsas.forEach((jsa: any) => {
        const stageRoles = JSA_STAGE_ROLES[jsa.status] || [];
        // Pemisahan wewenang: yang sudah mereview tidak boleh muncul lagi sebagai approver.
        const sudahDireviewOlehSaya =
          jsa.status === JSA_STATUS.approvalPgn && jsa.reviewer_id === user.id;
        const isMyTask =
          (stageRoles.includes(role) || role === 'admin') && !sudahDireviewOlehSaya;

        if (isMyTask) {
           const proj = Array.isArray(jsa.projects) ? jsa.projects[0] : jsa.projects;
           const vendor = proj?.vendor_profiles;
           const companyName = Array.isArray(vendor) ? vendor[0]?.company_name : vendor?.company_name;

          tasks.push({
            id: jsa.id,
            title: jsa.status === JSA_STATUS.reviewPgsol
              ? `Review JSA (PGSOL)`
              : `Persetujuan JSA (PGN)`,
            type: 'JSA',
            projectName: proj?.name || 'Unknown Project',
            vendorName: companyName || 'Internal',
            date: jsa.created_at,
            url: `/dashboard/projects/${jsa.project_id}`,
            status: jsa.status,
            urgency: getUrgency(jsa.created_at),
            timeInQueue: formatTimeInQueue(jsa.created_at)
          });
        }
      });
    }
  }

  // 3. Fetch PTW
  if (role === 'admin' || role === 'pm' || role === 'hse') {
    const { data: ptws } = await supabase
      .from('ptw')
      .select(`
        id, status, created_at, project_id,
        projects ( name, vendor_profiles ( company_name ) )
      `)
      .in('status', PTW_PENDING_STATUSES);

    if (ptws) {
      ptws.forEach((ptw: any) => {
        let isMyTask = false;
        if (role === 'admin') isMyTask = true;
        if (role === 'pm' && ptw.status === PTW_STATUS.menungguApprovalPM) isMyTask = true;
        if (role === 'hse' && (ptw.status === PTW_STATUS.reviewPtwIssuer || ptw.status === PTW_STATUS.menungguPenomoranHSSE)) isMyTask = true;

        if (isMyTask) {
           const proj = Array.isArray(ptw.projects) ? ptw.projects[0] : ptw.projects;
           const vendor = proj?.vendor_profiles;
           const companyName = Array.isArray(vendor) ? vendor[0]?.company_name : vendor?.company_name;

          tasks.push({
            id: ptw.id,
            title: `Approval Permit to Work (PTW)`,
            type: 'PTW',
            projectName: proj?.name || 'Unknown Project',
            vendorName: companyName || 'Internal',
            date: ptw.created_at,
            url: `/dashboard/projects/${ptw.project_id}`,
            status: ptw.status,
            urgency: getUrgency(ptw.created_at),
            timeInQueue: formatTimeInQueue(ptw.created_at)
          });
        }
      });
    }
  }

  // 4. Fetch Incidents
  if (role === 'admin' || role === 'hse') {
    const { data: incidents } = await supabase
      .from('incidents')
      .select(`
        id, title, status, created_at, project_id,
        projects ( name, vendor_profiles ( company_name ) )
      `)
      .eq('status', 'Menunggu Investigasi');

    if (incidents) {
      incidents.forEach((inc: any) => {
         const proj = Array.isArray(inc.projects) ? inc.projects[0] : inc.projects;
         const vendor = proj?.vendor_profiles;
         const companyName = Array.isArray(vendor) ? vendor[0]?.company_name : vendor?.company_name;

        tasks.push({
          id: inc.id,
          title: `Investigasi Insiden: ${inc.title}`,
          type: 'Insiden',
          projectName: proj?.name || 'Unknown Project',
          vendorName: companyName || 'Internal',
          date: inc.created_at,
          url: `/dashboard/incident`,
          status: inc.status,
          urgency: getUrgency(inc.created_at),
          timeInQueue: formatTimeInQueue(inc.created_at)
        });
      });
    }
  }

  // 5. Fetch Monitoring Tasks (Pengawasan)
  if (role === 'admin' || role === 'hse' || role === 'pengawas') {
    const { data: monitoring, error } = await supabase
      .from('projects')
      .select(`
        id, name, start_date, end_date, status, assigned_inspector,
        vendor_profiles ( company_name ),
        ptw ( status, valid_to )
      `)
      .eq('assigned_inspector', user.id);

    if (error) {
      console.error('Monitoring tasks fetch error:', error.message);
    } else if (monitoring) {
      monitoring
        .filter((proj: any) => {
          // Satu proyek bisa punya beberapa PTW sekaligus — dianggap sedang
          // berjalan di lapangan selama ADA salah satu tipe yang aktif.
          const ptws: any[] = Array.isArray(proj.ptw) ? proj.ptw : (proj.ptw ? [proj.ptw] : []);
          return ptws.some(p => getEffectivePtwStatus(p.status, p.valid_to ?? proj.end_date) === PTW_STATUS.aktif);
        })
        .forEach((proj: any) => {
        const companyName = Array.isArray(proj.vendor_profiles) 
           ? proj.vendor_profiles[0]?.company_name 
           : proj.vendor_profiles?.company_name;
           
        tasks.push({
          id: proj.id, // we use project ID since this is monitoring a project
          title: `Pengawasan Proyek Lapangan`,
          type: 'Pengawasan',
          projectName: proj.name,
          vendorName: companyName || 'Internal',
          date: proj.start_date || new Date().toISOString(),
          url: `/dashboard/projects/${proj.id}`,
          status: 'Aktif',
          urgency: 'Medium',
          timeInQueue: 'Sedang Berjalan'
        });
      });
    }
  }

  // Sort tasks by date (newest first)
  const sortedTasks = tasks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return sortedTasks;
}

export async function delegateMonitoringTask(projectId: string, assigneeId: string, notes: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('projects')
    .update({ assigned_inspector: assigneeId })
    .eq('id', projectId);

  if (error) {
    console.error("Disposisi Pengawasan Error:", error);
    throw new Error(error.message);
  }
}
