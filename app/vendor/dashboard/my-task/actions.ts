"use server";

import { createClient } from "@/utils/supabase/server";
import { PROCEDURE_STATUS } from "@/lib/procedure-status";
import { JSA_STATUS } from "@/lib/jsa-status";
import { PTW_STATUS } from "@/lib/ptw-status";
import { PTW_TYPES } from "@/lib/ptw-types";

export type VendorTaskType = 'Prosedur' | 'JSA' | 'PTW' | 'Temuan';
export type VendorUrgencyType = 'High' | 'Medium' | 'Low';

export interface VendorTaskItem {
  id: string;
  title: string;
  type: VendorTaskType;
  projectName: string;
  date: string;
  url: string;
  status: string;
  urgency: VendorUrgencyType;
  timeInQueue: string;
}

const getUrgency = (dateString: string): VendorUrgencyType => {
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

const ptwTypeTitle = (ptwType: string) =>
  PTW_TYPES.find(t => t.id === ptwType)?.title.split('(')[0].trim() || ptwType;

/**
 * Antrean tugas vendor sendiri — kebalikan dari My Task internal
 * (app/dashboard/my-task/actions.ts): di situ "tugas" berarti dokumen yang
 * menunggu approval SAYA (reviewer internal); di sini "tugas" berarti
 * dokumen yang butuh tindakan SAYA (vendor) — ditolak dan perlu direvisi,
 * belum diajukan padahal tahap sebelumnya sudah disetujui, atau temuan K3
 * yang masih terbuka.
 */
export async function getVendorMyTasks(): Promise<VendorTaskItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const tasks: VendorTaskItem[] = [];

  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id, name, created_at,
      procedures ( status, content, created_at ),
      jsa ( status, rejection_note, created_at ),
      ptw ( id, status, ptw_type, rejection_note, created_at )
    `)
    .eq('vendor_id', user.id);

  (projects || []).forEach((project: any) => {
    const prosedur = Array.isArray(project.procedures) ? project.procedures[0] : project.procedures;
    const jsa = Array.isArray(project.jsa) ? project.jsa[0] : project.jsa;
    const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);

    // 1. Prosedur ditolak — perlu revisi
    const revisions = prosedur?.content?.revisions || [];
    const lastNote = revisions.length > 0 ? revisions[revisions.length - 1].note : null;
    if (prosedur?.status === PROCEDURE_STATUS.draft && lastNote) {
      const date = prosedur.created_at || project.created_at;
      tasks.push({
        id: `prosedur-revisi-${project.id}`,
        title: 'Revisi Prosedur Kerja',
        type: 'Prosedur',
        projectName: project.name,
        date,
        url: `/vendor/dashboard/projects/${project.id}/prosedur`,
        status: 'Perlu Revisi',
        urgency: getUrgency(date),
        timeInQueue: formatTimeInQueue(date),
      });
    }

    // 2. JSA ditolak — perlu revisi
    if (jsa?.rejection_note) {
      const date = jsa.created_at || project.created_at;
      tasks.push({
        id: `jsa-revisi-${project.id}`,
        title: 'Revisi Job Safety Analysis',
        type: 'JSA',
        projectName: project.name,
        date,
        url: `/vendor/dashboard/jsa/create/${project.id}`,
        status: 'Perlu Revisi',
        urgency: getUrgency(date),
        timeInQueue: formatTimeInQueue(date),
      });
    }

    // 3. PTW ditolak — perlu revisi (per tipe, satu proyek bisa punya beberapa PTW sekaligus)
    ptws.forEach(ptw => {
      if (ptw.status === PTW_STATUS.draft && ptw.rejection_note) {
        const date = ptw.created_at || project.created_at;
        tasks.push({
          id: `ptw-revisi-${ptw.id}`,
          title: `Revisi PTW — ${ptwTypeTitle(ptw.ptw_type)}`,
          type: 'PTW',
          projectName: project.name,
          date,
          url: `/vendor/dashboard/ptw/create/${project.id}/${ptw.ptw_type}`,
          status: 'Perlu Revisi',
          urgency: getUrgency(date),
          timeInQueue: formatTimeInQueue(date),
        });
      }
    });

    // 4. Belum diajukan — pengingat proaktif buat tahap yang sudah bisa dikerjakan
    if (!prosedur) {
      tasks.push({
        id: `prosedur-baru-${project.id}`,
        title: 'Ajukan Prosedur Kerja',
        type: 'Prosedur',
        projectName: project.name,
        date: project.created_at,
        url: `/vendor/dashboard/projects/${project.id}/prosedur`,
        status: 'Belum Diajukan',
        urgency: getUrgency(project.created_at),
        timeInQueue: formatTimeInQueue(project.created_at),
      });
    } else if (prosedur.status === PROCEDURE_STATUS.approved && !jsa) {
      const date = prosedur.created_at || project.created_at;
      tasks.push({
        id: `jsa-baru-${project.id}`,
        title: 'Ajukan Job Safety Analysis',
        type: 'JSA',
        projectName: project.name,
        date,
        url: `/vendor/dashboard/jsa/create/${project.id}`,
        status: 'Belum Diajukan',
        urgency: getUrgency(date),
        timeInQueue: formatTimeInQueue(date),
      });
    } else if (jsa?.status === JSA_STATUS.approved && ptws.length === 0) {
      const date = jsa.created_at || project.created_at;
      tasks.push({
        id: `ptw-baru-${project.id}`,
        title: 'Ajukan Permit to Work',
        type: 'PTW',
        projectName: project.name,
        date,
        url: `/vendor/dashboard/ptw/create/${project.id}`,
        status: 'Belum Diajukan',
        urgency: getUrgency(date),
        timeInQueue: formatTimeInQueue(date),
      });
    }
  });

  // 5. Temuan K3 yang masih terbuka
  const { data: inspections } = await supabase
    .from('inspections')
    .select('id, title, created_at, projects ( name )')
    .eq('target_vendor', user.id)
    .eq('status', 'Open');

  (inspections || []).forEach((insp: any) => {
    const proj = Array.isArray(insp.projects) ? insp.projects[0] : insp.projects;
    tasks.push({
      id: `temuan-${insp.id}`,
      title: `Tindak Lanjuti Temuan: ${insp.title}`,
      type: 'Temuan',
      projectName: proj?.name || 'Proyek',
      date: insp.created_at,
      url: `/vendor/dashboard/inspection`,
      status: 'Open',
      urgency: getUrgency(insp.created_at),
      timeInQueue: formatTimeInQueue(insp.created_at),
    });
  });

  return tasks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
