"use server";

import { createClient, getCallerVendorOrgId } from "@/utils/supabase/server";
import { PROCEDURE_STATUS } from "@/lib/procedure-status";
import { JSA_STATUS } from "@/lib/jsa-status";
import { PTW_STATUS } from "@/lib/ptw-status";
import { PTW_TYPES } from "@/lib/ptw-types";
import { getAssignmentGaps, PARTY_LABEL, STAGE_SHORT_LABEL } from "@/lib/assignment-gaps";

export type VendorTaskType = 'Prosedur' | 'JSA' | 'PTW' | 'Temuan' | 'Penugasan';
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
  const vendorOrgId = await getCallerVendorOrgId(supabase);
  if (!vendorOrgId) return [];

  const tasks: VendorTaskItem[] = [];

  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id, name, created_at,
      procedures ( status, content, created_at ),
      jsa ( status, rejection_note, created_at ),
      ptw ( id, status, ptw_type, rejection_note, created_at )
    `)
    .eq('vendor_id', vendorOrgId);

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
    // target_vendor menunjuk vendor_profiles(id) = id organisasi vendor
    .select('id, title, created_at, projects ( name )')
    .eq('target_vendor', vendorOrgId)
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

  // 6. Dokumen menunggu review internal SAYA (assignee-perspective — beda
  // dari bullet-bullet di atas yang submitter-perspective/org-wide).
  const { data: myAssignments } = await supabase
    .from('stage_assignments')
    .select('id, project_id, doc_type, assigned_at, stage_key')
    .eq('assignee_id', user.id)
    .eq('status', 'pending')
    .in('stage_key', [
      'procedure.hse_vendor', 'procedure.review_vendor',
      'jsa.hse_vendor', 'jsa.review_vendor',
      'ptw.hse_vendor', 'ptw.review_vendor',
    ]);

  (myAssignments || []).forEach((a: any) => {
    const project = (projects || []).find((p: any) => p.id === a.project_id);
    if (!project) return;
    const date = a.assigned_at;
    const isHse = String(a.stage_key).endsWith('.hse_vendor');
    const tahap = isHse ? 'HSE Vendor' : 'PM Vendor';

    // Baris assignment sudah 'pending' sejak admin menugaskan, jadi tanpa
    // cek ini tugas muncul walau dokumen belum/tidak sedang di tahap itu
    // (masih Draft, atau masih di HSE Vendor padahal ini slot PM Vendor).
    const prosedurDoc = Array.isArray(project.procedures) ? project.procedures[0] : project.procedures;
    const jsaDoc = Array.isArray(project.jsa) ? project.jsa[0] : project.jsa;
    const ptwDocs: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
    const wantedStatus = isHse
      ? { procedure: PROCEDURE_STATUS.reviewHseVendor, jsa: JSA_STATUS.reviewHseVendor, ptw: PTW_STATUS.reviewHseVendor }
      : { procedure: PROCEDURE_STATUS.reviewPmVendor, jsa: JSA_STATUS.reviewPmVendor, ptw: PTW_STATUS.reviewPmVendor };
    const inStage =
      a.doc_type === 'procedure' ? prosedurDoc?.status === wantedStatus.procedure
      : a.doc_type === 'jsa' ? jsaDoc?.status === wantedStatus.jsa
      : ptwDocs.some((p: any) => p.status === wantedStatus.ptw);
    if (!inStage) return;

    if (a.doc_type === 'procedure') {
      tasks.push({
        id: `review-vendor-procedure-${a.id}`,
        title: `Review ${tahap} — Prosedur Kerja`,
        type: 'Prosedur',
        projectName: project.name,
        date,
        url: `/vendor/dashboard/projects/${project.id}/prosedur`,
        status: 'Menunggu Review Saya',
        urgency: getUrgency(date),
        timeInQueue: formatTimeInQueue(date),
      });
    } else if (a.doc_type === 'jsa') {
      tasks.push({
        id: `review-vendor-jsa-${a.id}`,
        title: `Review ${tahap} — JSA`,
        type: 'JSA',
        projectName: project.name,
        date,
        url: `/vendor/dashboard/jsa/create/${project.id}`,
        status: 'Menunggu Review Saya',
        urgency: getUrgency(date),
        timeInQueue: formatTimeInQueue(date),
      });
    } else if (a.doc_type === 'ptw') {
      const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
      const pendingPtw = ptws.find((p: any) => p.status === (isHse ? PTW_STATUS.reviewHseVendor : PTW_STATUS.reviewPmVendor));
      tasks.push({
        id: `review-vendor-ptw-${a.id}`,
        title: `Review ${tahap} — PTW${pendingPtw ? ` (${ptwTypeTitle(pendingPtw.ptw_type)})` : ''}`,
        type: 'PTW',
        projectName: project.name,
        date,
        url: pendingPtw ? `/vendor/dashboard/ptw/create/${project.id}/${pendingPtw.ptw_type}` : `/vendor/dashboard/ptw/create/${project.id}`,
        status: 'Menunggu Review Saya',
        urgency: getUrgency(date),
        timeInQueue: formatTimeInQueue(date),
      });
    }
  });

  // Penugasan HSE/PM Vendor — khusus admin vendor: slot approval internal yang
  // masih kosong membuat dokumen tersangkut di tahap review vendor.
  const gaps = await getAssignmentGaps(supabase, user.id);
  gaps.forEach(g => {
    const preview = g.missing.slice(0, 3).map(k => STAGE_SHORT_LABEL[k] ?? k).join(', ');
    const more = g.missing.length > 3 ? ` +${g.missing.length - 3} lainnya` : '';
    tasks.push({
      id: `gap-${g.projectId}`,
      title: `Tugaskan HSE & PM Vendor — ${g.missing.length} dari ${g.total} tahap kosong`,
      type: 'Penugasan',
      projectName: g.projectName,
      date: g.createdAt,
      url: g.url,
      status: `${PARTY_LABEL[g.party]}: ${preview}${more}`,
      urgency: getUrgency(g.createdAt),
      timeInQueue: formatTimeInQueue(g.createdAt),
    });
  });

  return tasks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
