"use server";

import { createClient } from "@/utils/supabase/server";
import { getEffectivePtwStatus, PTW_STATUS, PTW_PENDING_STATUSES, PTW_STAGE_PERMISSION } from "@/lib/ptw-status";
import { JSA_STATUS, JSA_STAGE_PERMISSION, JSA_PENDING_STATUSES } from "@/lib/jsa-status";
import { PROCEDURE_STATUS, PROCEDURE_STAGE_PERMISSION, PROCEDURE_PENDING_STATUSES } from "@/lib/procedure-status";
import { hasPermissionForUser } from "@/utils/permissions";

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

  const tasks: TaskItem[] = [];

  // 1. Fetch Procedures — dua tahap: Review PGSOL, lalu Menunggu Review PM.
  // Pola sama seperti blok JSA di bawah: ambil dulu stage_assignments
  // pending user ini untuk kedua stage_key Prosedur, per proyek, baru
  // cocokkan ke status Prosedur saat ini lewat PROCEDURE_STAGE_PERMISSION.
  // Filter status memakai PROCEDURE_PENDING_STATUSES secara presisi
  // (bukan hardcode string lepas) supaya PM/PGSOL tidak melihat entri
  // phantom saat dokumen masih Draft menunggu vendor merevisi.
  {
    const procStageKeys = Object.values(PROCEDURE_STAGE_PERMISSION).map(p => `${p.module}.${p.action}`);
    const { data: myAssignments } = await supabase
      .from('stage_assignments')
      .select('project_id, stage_key')
      .eq('doc_type', 'procedure').in('stage_key', procStageKeys)
      .eq('assignee_id', user.id).eq('status', 'pending');

    const myStageKeysByProject = new Map<string, Set<string>>();
    (myAssignments || []).forEach((a: any) => {
      if (!myStageKeysByProject.has(a.project_id)) myStageKeysByProject.set(a.project_id, new Set());
      myStageKeysByProject.get(a.project_id)!.add(a.stage_key);
    });
    const projectIds = Array.from(myStageKeysByProject.keys());

    if (projectIds.length > 0) {
      const { data: procedures } = await supabase
        .from('procedures')
        .select(`
          id, status, created_at, project_id,
          projects ( name, vendor_profiles ( company_name ) )
        `)
        .in('project_id', projectIds)
        .in('status', PROCEDURE_PENDING_STATUSES);

      if (procedures) {
        procedures.forEach((proc: any) => {
          const perm = PROCEDURE_STAGE_PERMISSION[proc.status];
          const stageKey = perm ? `${perm.module}.${perm.action}` : null;
          const myStageKeys = myStageKeysByProject.get(proc.project_id);
          const isMyTask = !!stageKey && !!myStageKeys?.has(stageKey);

          if (isMyTask) {
            const proj = Array.isArray(proc.projects) ? proc.projects[0] : proc.projects;
            const vendor = proj?.vendor_profiles;
            const companyName = Array.isArray(vendor) ? vendor[0]?.company_name : vendor?.company_name;
            tasks.push({
              id: proc.id,
              title: proc.status === PROCEDURE_STATUS.reviewPgsol
                ? `Review Prosedur Kerja (PGSOL)`
                : proc.status === PROCEDURE_STATUS.reviewHsePgsol
                  ? `Review Prosedur Kerja (HSE PGSOL)`
                  : proc.status === PROCEDURE_STATUS.reviewHssePgn
                    ? `Review Prosedur Kerja (HSSE PGN)`
                    : `Review Prosedur Kerja (PM Zona)`,
              type: 'Prosedur',
              projectName: proj?.name || 'Unknown Project', vendorName: companyName || 'Internal',
              date: proc.created_at, url: `/dashboard/projects/${proc.project_id}`,
              status: proc.status, urgency: getUrgency(proc.created_at),
              timeInQueue: formatTimeInQueue(proc.created_at)
            });
          }
        });
      }
    }
  }

  // 2. Fetch JSA — dua tahap: Review PGSOL, lalu Persetujuan PGN (orang
  // berbeda). Ambil dulu stage_assignments pending user ini untuk kedua
  // stage_key JSA, per proyek, baru cocokkan ke status JSA saat ini lewat
  // JSA_STAGE_PERMISSION (dipakai murni untuk terjemahan status -> stage_key,
  // bukan pengecekan permission).
  {
    const jsaStageKeys = Object.values(JSA_STAGE_PERMISSION).map(p => `${p.module}.${p.action}`);
    const { data: myAssignments } = await supabase
      .from('stage_assignments')
      .select('project_id, stage_key')
      .eq('doc_type', 'jsa').in('stage_key', jsaStageKeys)
      .eq('assignee_id', user.id).eq('status', 'pending');

    const myStageKeysByProject = new Map<string, Set<string>>();
    (myAssignments || []).forEach((a: any) => {
      if (!myStageKeysByProject.has(a.project_id)) myStageKeysByProject.set(a.project_id, new Set());
      myStageKeysByProject.get(a.project_id)!.add(a.stage_key);
    });
    const projectIds = Array.from(myStageKeysByProject.keys());

    if (projectIds.length > 0) {
      const { data: jsas } = await supabase
        .from('jsa')
        .select(`
          id, status, created_at, project_id, reviewer_id,
          projects ( name, vendor_profiles ( company_name ) )
        `)
        .in('project_id', projectIds)
        .in('status', JSA_PENDING_STATUSES);

      if (jsas) {
        jsas.forEach((jsa: any) => {
          const perm = JSA_STAGE_PERMISSION[jsa.status];
          const stageKey = perm ? `${perm.module}.${perm.action}` : null;
          const myStageKeys = myStageKeysByProject.get(jsa.project_id);
          // Pemisahan wewenang: yang sudah mereview tidak boleh muncul lagi sebagai approver.
          const sudahDireviewOlehSaya =
            jsa.status === JSA_STATUS.approvalPgn && jsa.reviewer_id === user.id;
          const isMyTask = !!stageKey && !!myStageKeys?.has(stageKey) && !sudahDireviewOlehSaya;

          if (isMyTask) {
             const proj = Array.isArray(jsa.projects) ? jsa.projects[0] : jsa.projects;
             const vendor = proj?.vendor_profiles;
             const companyName = Array.isArray(vendor) ? vendor[0]?.company_name : vendor?.company_name;

            tasks.push({
              id: jsa.id,
              title: jsa.status === JSA_STATUS.reviewPgsol
                ? `Review JSA (PGSOL)`
                : jsa.status === JSA_STATUS.reviewHsePgsol
                  ? `Review JSA (HSE PGSOL)`
                  : jsa.status === JSA_STATUS.reviewHssePgn
                    ? `Review JSA (HSSE PGN)`
                    : `Persetujuan JSA (PM Zona)`,
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
  }

  // 3. Fetch PTW — tiga tahap, pola sama seperti JSA di atas.
  {
    const ptwStageKeys = Object.values(PTW_STAGE_PERMISSION).map(p => `${p.module}.${p.action}`);
    const { data: myAssignments } = await supabase
      .from('stage_assignments')
      .select('project_id, stage_key')
      .eq('doc_type', 'ptw').in('stage_key', ptwStageKeys)
      .eq('assignee_id', user.id).eq('status', 'pending');

    const myStageKeysByProject = new Map<string, Set<string>>();
    (myAssignments || []).forEach((a: any) => {
      if (!myStageKeysByProject.has(a.project_id)) myStageKeysByProject.set(a.project_id, new Set());
      myStageKeysByProject.get(a.project_id)!.add(a.stage_key);
    });
    const projectIds = Array.from(myStageKeysByProject.keys());

    if (projectIds.length > 0) {
      const { data: ptws } = await supabase
        .from('ptw')
        .select(`
          id, status, created_at, project_id,
          projects ( name, vendor_profiles ( company_name ) )
        `)
        .in('project_id', projectIds)
        .in('status', PTW_PENDING_STATUSES);

      if (ptws) {
        ptws.forEach((ptw: any) => {
          const perm = PTW_STAGE_PERMISSION[ptw.status];
          const stageKey = perm ? `${perm.module}.${perm.action}` : null;
          const myStageKeys = myStageKeysByProject.get(ptw.project_id);
          const isMyTask = !!stageKey && !!myStageKeys?.has(stageKey);

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
  }

  // 4. Fetch Incidents
  //
  // Sebelumnya dicek lewat hardcode role === 'admin' || role === 'hse' —
  // menyimpang dari pola permission-driven yang dipakai modul lain di app
  // ini. Akibatnya role custom mana pun yang diberi incident.investigate
  // (lihat allPermissionModules) tapi namanya bukan persis 'hse' tidak
  // pernah melihat task investigasi insiden di sini, walau dia punya
  // haknya. Dicek lewat permission, bukan nama role literal.
  if (await hasPermissionForUser(supabase, user.id, 'incident', 'investigate')) {
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

  // 5. Fetch Monitoring Tasks (Pengawasan) — sudah discope lewat assigned_inspector
  // di query, jadi tidak perlu gerbang role/permission tambahan di sini. Role
  // apa pun bisa jadi assigned_inspector (di-set otomatis saat PTW aktif, lihat
  // approvePtw di app/dashboard/approval/actions.ts).
  {
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Disposisi = menyerahkan tugas pengawasan sendiri, jadi pemanggil harus
  // memang inspector proyek tersebut (sama seperti syarat munculnya tombol
  // Disposisi di UI). Pemegang inspection:manage boleh mendisposisikan proyek
  // siapa pun. Tanpa ini, user internal mana pun bisa mengganti pengawas
  // proyek apa pun cukup dengan memanggil Server Action ini langsung.
  const { data: project } = await supabase
    .from('projects')
    .select('assigned_inspector')
    .eq('id', projectId)
    .single();
  if (!project) throw new Error('Proyek tidak ditemukan.');

  if (project.assigned_inspector !== user.id) {
    const canManage = await hasPermissionForUser(supabase, user.id, 'inspection', 'manage');
    if (!canManage) throw new Error('Anda tidak memiliki izin untuk mendisposisikan pengawasan proyek ini.');
  }

  const { error } = await supabase
    .from('projects')
    .update({ assigned_inspector: assigneeId })
    .eq('id', projectId);

  if (error) {
    console.error("Disposisi Pengawasan Error:", error);
    throw new Error(error.message);
  }
}
