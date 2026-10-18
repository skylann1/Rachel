"use server";

import { createClient, getCallerVendorOrgId } from "@/utils/supabase/server";
import { PROCEDURE_STATUS } from "@/lib/procedure-status";
import { JSA_STATUS } from "@/lib/jsa-status";
import { getEffectivePtwStatus, PTW_STATUS } from "@/lib/ptw-status";
import { PTW_TYPES, PTW_TRACK_MAX_DAYS } from "@/lib/ptw-types";
import { getAssignmentGaps, PARTY_LABEL, STAGE_SHORT_LABEL } from "@/lib/assignment-gaps";
import { dayIndexForDate, FIELD_PERAN_LABEL, type FieldPeran } from "@/lib/ptw-field";
import { todayDateString } from "@/lib/site-ops";
import { hasPermissionForUser } from "@/utils/permissions";

export type VendorTaskType = 'Prosedur' | 'JSA' | 'PTW' | 'Temuan' | 'Penugasan' | 'DailyCheck' | 'Penyelesaian';
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
      id, name, created_at, end_date, status, completion_requested_at, completion_rejection_note,
      procedures ( status, content, created_at ),
      jsa ( status, rejection_note, created_at ),
      ptw ( id, status, ptw_type, ptw_number, rejection_note, created_at, valid_from, valid_to, closure_rejection_note, extension_rejection_note, extension_requested_to )
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

  // 7. Daily check PTW — Pemegang aktif (staf vendor) yang belum isi check
  // hari ini. Hilang otomatis setelah kirim (lihat submitDailyCheck di
  // app/dashboard/projects/[id]/actions.ts, dipakai lintas realm).
  {
    const { data: myActive } = await supabase
      .from('ptw_field_assignments')
      .select('ptw_id, peran')
      .eq('user_id', user.id)
      .is('aktif_sampai', null);

    if (myActive && myActive.length > 0) {
      const today = todayDateString();
      for (const a of myActive) {
        let ptw: any = null;
        let projectForPtw: any = null;
        for (const project of projects || []) {
          const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
          const found = ptws.find((p: any) => p.id === a.ptw_id);
          if (found) { ptw = found; projectForPtw = project; break; }
        }
        if (!ptw || !projectForPtw) continue;

        const effective = getEffectivePtwStatus(ptw.status, ptw.valid_to ?? projectForPtw.end_date);
        if (effective !== PTW_STATUS.aktif) continue;
        const todayHari = dayIndexForDate(ptw.valid_from, ptw.valid_to, today, PTW_TRACK_MAX_DAYS);
        if (todayHari === null) continue;

        const { data: existingCheck } = await supabase
          .from('ptw_daily_checks')
          .select('id')
          .eq('ptw_id', ptw.id).eq('hari_ke', todayHari).eq('peran', a.peran)
          .maybeSingle();
        if (existingCheck) continue;

        tasks.push({
          id: `dailycheck-${ptw.id}-${a.peran}`,
          title: `Daily Check PTW — ${FIELD_PERAN_LABEL[a.peran as FieldPeran]} (Hari ke-${todayHari})`,
          type: 'DailyCheck',
          projectName: projectForPtw.name,
          date: new Date().toISOString(),
          url: `/vendor/dashboard/projects/${projectForPtw.id}`,
          status: 'Belum diisi hari ini',
          urgency: 'High',
          timeInQueue: 'Hari ini',
        });
      }
    }
  }

  // 8. Penugasan Pemegang PTW — khusus pemegang izin ptw.assign_holder (admin
  // vendor): PTW Aktif perusahaan ini yang belum punya Pemegang. Hilang
  // otomatis begitu Pemegang ditugaskan (tab Penugasan di detail proyek).
  if (await hasPermissionForUser(supabase, user.id, 'ptw', 'assign_holder')) {
    const activePtws: { ptw: any; project: any }[] = [];
    for (const project of projects || []) {
      const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
      for (const ptw of ptws) {
        if (getEffectivePtwStatus(ptw.status, ptw.valid_to ?? project.end_date) === PTW_STATUS.aktif) {
          activePtws.push({ ptw, project });
        }
      }
    }
    const ptwIds = activePtws.map(x => x.ptw.id);
    const { data: withHolder } = ptwIds.length > 0
      ? await supabase.from('ptw_field_assignments').select('ptw_id').in('ptw_id', ptwIds).eq('peran', 'pemegang').is('aktif_sampai', null)
      : { data: [] as any[] };
    const covered = new Set((withHolder || []).map((r: any) => r.ptw_id));

    for (const { ptw, project } of activePtws) {
      if (covered.has(ptw.id)) continue;
      tasks.push({
        id: `assign-pemegang-${ptw.id}`,
        title: `Tugaskan Pemegang PTW — ${ptwTypeTitle(ptw.ptw_type)}`,
        type: 'Penugasan',
        projectName: project.name,
        date: ptw.created_at,
        url: `/vendor/dashboard/projects/${project.id}`,
        status: 'PTW aktif belum punya Pemegang',
        urgency: 'High',
        timeInQueue: formatTimeInQueue(ptw.created_at),
      });
    }
  }

  // 9. Tindak lanjut penutupan / perpanjangan / penyelesaian — sisi vendor.
  //  * penutupan PTW ditolak HSSE   -> perbaiki lalu ajukan lagi (pemegang izin ptw.request_closure)
  //  * perpanjangan PTW ditolak HSSE -> ajukan ulang bila masih perlu (ptw.request_extension)
  //  * semua PTW sudah Selesai       -> ajukan penyelesaian proyek (ptw.request_project_completion);
  //    kalau pernah ditolak PM, alasannya ikut ditampilkan.
  {
    const [canClose, canExtend, canComplete] = await Promise.all([
      hasPermissionForUser(supabase, user.id, 'ptw', 'request_closure'),
      hasPermissionForUser(supabase, user.id, 'ptw', 'request_extension'),
      hasPermissionForUser(supabase, user.id, 'ptw', 'request_project_completion'),
    ]);

    for (const project of projects || []) {
      const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);

      for (const ptw of ptws) {
        const eff = getEffectivePtwStatus(ptw.status, ptw.valid_to ?? project.end_date);
        if (eff !== PTW_STATUS.aktif) continue;
        const label = `${ptwTypeTitle(ptw.ptw_type)}${ptw.ptw_number ? ` (${ptw.ptw_number})` : ''}`;

        if (canClose && ptw.closure_rejection_note) {
          tasks.push({
            id: `closure-rejected-${ptw.id}`,
            title: `Penutupan PTW ditolak — ${label}`,
            type: 'PTW',
            projectName: project.name,
            date: ptw.created_at,
            url: `/vendor/dashboard/projects/${project.id}`,
            status: `Alasan: ${ptw.closure_rejection_note}`,
            urgency: 'High',
            timeInQueue: formatTimeInQueue(ptw.created_at),
          });
        }
        if (canExtend && ptw.extension_rejection_note && !ptw.extension_requested_to) {
          tasks.push({
            id: `extension-rejected-${ptw.id}`,
            title: `Perpanjangan PTW ditolak — ${label}`,
            type: 'PTW',
            projectName: project.name,
            date: ptw.created_at,
            url: `/vendor/dashboard/projects/${project.id}`,
            status: `Alasan: ${ptw.extension_rejection_note}`,
            urgency: 'Medium',
            timeInQueue: formatTimeInQueue(ptw.created_at),
          });
        }
      }

      const allClosed = ptws.length > 0 && ptws.every((p: any) => p.status === PTW_STATUS.selesai);
      if (canComplete && allClosed && project.status !== 'Selesai' && !project.completion_requested_at) {
        tasks.push({
          id: `completion-${project.id}`,
          title: 'Ajukan Penyelesaian Proyek',
          type: 'Penyelesaian',
          projectName: project.name,
          date: project.created_at,
          url: `/vendor/dashboard/projects/${project.id}`,
          status: project.completion_rejection_note
            ? `Ditolak PM: ${project.completion_rejection_note}`
            : 'Semua PTW sudah ditutup',
          urgency: project.completion_rejection_note ? 'High' : 'Medium',
          timeInQueue: formatTimeInQueue(project.created_at),
        });
      }
    }
  }

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
