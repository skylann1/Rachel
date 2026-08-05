"use server";

import { createClient } from "@/utils/supabase/server";

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
      .in('status', ['Submitted', 'Menunggu Review PM', 'Draft']); 
    
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

  // 2. Fetch JSA
  if (role === 'admin' || role === 'pm' || role === 'hse') {
    const { data: jsas } = await supabase
      .from('jsa')
      .select(`
        id, status, created_at, project_id,
        projects ( name, vendor_profiles ( company_name ) )
      `)
      .in('status', ['Menunggu Approval PM', 'Pembahasan JSA', 'Menunggu Review HSE', 'Draft']);

    if (jsas) {
      jsas.forEach((jsa: any) => {
        let isMyTask = false;
        if (role === 'admin') isMyTask = true;
        if (role === 'pm' && (jsa.status === 'Menunggu Approval PM' || jsa.status === 'Pembahasan JSA' || jsa.status === 'Draft')) isMyTask = true;
        if (role === 'hse' && (jsa.status === 'Menunggu Review HSE' || jsa.status === 'Draft' || jsa.status === 'Pembahasan JSA')) isMyTask = true;

        if (isMyTask) {
           const proj = Array.isArray(jsa.projects) ? jsa.projects[0] : jsa.projects;
           const vendor = proj?.vendor_profiles;
           const companyName = Array.isArray(vendor) ? vendor[0]?.company_name : vendor?.company_name;

          tasks.push({
            id: jsa.id,
            title: `Review Job Safety Analysis (JSA)`,
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
      .in('status', ['Menunggu Approval PM', 'Review PTW Issuer', 'Menunggu Penomoran HSSE']);

    if (ptws) {
      ptws.forEach((ptw: any) => {
        let isMyTask = false;
        if (role === 'admin') isMyTask = true;
        if (role === 'pm' && ptw.status === 'Menunggu Approval PM') isMyTask = true;
        if (role === 'hse' && (ptw.status === 'Review PTW Issuer' || ptw.status === 'Menunggu Penomoran HSSE')) isMyTask = true;

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
        id, name, start_date, status, assigned_inspector,
        vendor_profiles ( company_name )
      `)
      .eq('status', 'PTW Aktif')
      .eq('assigned_inspector', user.id);

    if (error) {
      // Fallback for UI dummy data before SQL migration
      tasks.push({
        id: "dummy-monitoring-123",
        title: "Pengawasan Pekerjaan Ngelas Pipa",
        type: 'Pengawasan',
        projectName: "Dummy Project: Instalasi Pipa Gas",
        vendorName: "PT. Maju Bersama",
        date: new Date().toISOString(),
        url: `/dashboard/projects`,
        status: "Aktif",
        urgency: "Medium",
        timeInQueue: "Monitoring"
      });
    } else if (monitoring) {
      monitoring.forEach((proj: any) => {
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
