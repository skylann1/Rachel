// lib/stage-assignments.ts
//
// Helper bersama untuk baca/tulis stage_assignments — dipakai baik oleh UI
// assignment (PGN di app/dashboard/master-data/project/actions.ts, PGSOL di
// app/dashboard/master-data/project-pgsol-assign/actions.ts) maupun oleh actions approval
// (app/dashboard/approval/actions.ts) dan filter tugas
// (app/dashboard/my-task/actions.ts). Bukan Server Action sendiri (tidak ada
// "use server" di sini) — dipanggil dari dalam file yang sudah "use server".

import { getRoleNamesWithPermission } from '@/utils/permissions';

export interface StageAssignmentRow {
  id: string;
  project_id: string;
  doc_type: string;
  stage_key: string;
  assignee_id: string;
  status: 'pending' | 'approved' | 'rejected';
  decided_at: string | null;
  note: string | null;
}

/** Ketujuh stage_key yang ditugaskan admin PGN — dipakai untuk membatasi apa yang boleh disimpan lewat saveStageAssignment (masterData.manage_project). */
export const PGN_STAGE_KEYS = [
  'procedure.hsse_pgn',
  'procedure.review',
  'jsa.hsse_pgn',
  'jsa.approve_pgn',
  'ptw.approve_pm',
  'ptw.review_issuer',
  'ptw.numbering_hsse',
] as const;

/** Ketiga stage_key yang ditugaskan admin vendor — dipakai untuk membatasi apa yang boleh disimpan lewat saveVendorStageAssignment (masterData.manage_org_staff). */
export const VENDOR_STAGE_KEYS = [
  'procedure.review_vendor',
  'jsa.review_vendor',
  'ptw.review_vendor',
] as const;

/** Keenam stage_key yang ditugaskan admin PGSOL (Reviewer + HSE, untuk Prosedur/JSA/PTW) — dipakai untuk membatasi apa yang boleh disimpan lewat savePgsolAssignment (jsa.manage_assignment_pgsol). */
export const PGSOL_STAGE_KEYS = [
  'procedure.review_pgsol',
  'procedure.hse_pgsol',
  'jsa.review_pgsol',
  'jsa.hse_pgsol',
  'ptw.review_pgsol',
  'ptw.hse_pgsol',
] as const;

export async function getStageAssignments(
  supabase: any, projectId: string, docType: string, stageKey: string
): Promise<StageAssignmentRow[]> {
  const { data } = await supabase
    .from('stage_assignments')
    .select('id, project_id, doc_type, stage_key, assignee_id, status, decided_at, note')
    .eq('project_id', projectId).eq('doc_type', docType).eq('stage_key', stageKey);
  return data || [];
}

export interface StageAssignmentRowWithName extends StageAssignmentRow {
  assignee_name: string | null;
  assignee_jabatan: string | null;
  assignee_role: string | null;
}

/**
 * Sama seperti getStageAssignments, plus nama penugas (profiles.full_name) —
 * dipakai timeline approval (DocStageTimeline) yang perlu menampilkan siapa
 * yang approve/sedang ditunggu, bukan cuma ID. Query nama dipisah dari
 * stage_assignments (bukan di-embed lewat relasi) karena tabel ini punya DUA
 * FK ke profiles (assignee_id dan assigned_by) — embed `profiles(...)` tanpa
 * nama relasi eksplisit akan ambigu di PostgREST.
 */
export async function getStageAssignmentsWithNames(
  supabase: any, projectId: string, docType: string, stageKey: string
): Promise<StageAssignmentRowWithName[]> {
  const rows = await getStageAssignments(supabase, projectId, docType, stageKey);
  if (rows.length === 0) return [];
  const assigneeIds = Array.from(new Set(rows.map(r => r.assignee_id)));
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, jabatan, role').in('id', assigneeIds);
  const byId = new Map<string, any>((profiles || []).map((p: any) => [p.id as string, p]));
  return rows.map(r => {
    const p = byId.get(r.assignee_id);
    return {
      ...r,
      assignee_name: p?.full_name ?? null,
      assignee_jabatan: p?.jabatan ?? null,
      assignee_role: p?.role ?? null,
    };
  });
}

/**
 * Kandidat yang boleh ditunjuk ke satu stage_key: role-nya harus punya
 * permission {module}.{action} yang bersangkutan DAN dia harus satu organisasi
 * dengan admin yang menugaskan (`orgId`). Filter org wajib: role `admin` (PGN)
 * memegang seluruh permission, jadi tanpa `.eq('org_id', ...)` admin PGN ikut
 * muncul di daftar kandidat milik PGSOL — dan sebaliknya. writeStageAssignment
 * menolak lintas-org, jadi kandidat lintas-org hanya akan jadi pilihan yang
 * pasti gagal saat disimpan.
 */
export async function getEligibleAssignees(
  supabase: any, module: string, action: string, orgId: string
): Promise<{ id: string; full_name: string }[]> {
  if (!orgId) return [];
  const roleNames = await getRoleNamesWithPermission(supabase, module, action);
  if (roleNames.length === 0) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('org_id', orgId)
    .in('role', roleNames)
    .order('full_name');
  return data || [];
}

/**
 * Satu-satunya sumber kebenaran pemetaan stage_key → permission
 * {module}.{action}. Dipakai writeStageAssignment untuk memastikan orang yang
 * ditunjuk memang berwenang di tahap itu; halaman assignment sebaiknya ikut
 * memakai ini alih-alih menyalin tabelnya sendiri.
 */
export const STAGE_KEY_PERMISSION: Record<string, { module: string; action: string }> = {
  'procedure.review_vendor': { module: 'procedure', action: 'review_vendor' },
  'procedure.review_pgsol': { module: 'procedure', action: 'review_pgsol' },
  'procedure.hse_pgsol': { module: 'procedure', action: 'hse_pgsol' },
  'procedure.hsse_pgn': { module: 'procedure', action: 'hsse_pgn' },
  'procedure.review': { module: 'procedure', action: 'review' },
  'jsa.review_vendor': { module: 'jsa', action: 'review_vendor' },
  'jsa.review_pgsol': { module: 'jsa', action: 'review_pgsol' },
  'jsa.hse_pgsol': { module: 'jsa', action: 'hse_pgsol' },
  'jsa.hsse_pgn': { module: 'jsa', action: 'hsse_pgn' },
  'jsa.approve_pgn': { module: 'jsa', action: 'approve_pgn' },
  'ptw.review_vendor': { module: 'ptw', action: 'review_vendor' },
  'ptw.review_pgsol': { module: 'ptw', action: 'review_pgsol' },
  'ptw.hse_pgsol': { module: 'ptw', action: 'hse_pgsol' },
  'ptw.approve_pm': { module: 'ptw', action: 'approve_pm' },
  'ptw.review_issuer': { module: 'ptw', action: 'review_issuer' },
  'ptw.numbering_hsse': { module: 'ptw', action: 'numbering_hsse' },
};

/**
 * Menyimpan daftar assignee untuk satu (project, doc_type, stage_key) —
 * full-replace: assignee yang tidak lagi ada di assigneeIds dihapus,
 * assignee baru ditambahkan sebagai 'pending'. Menolak kalau ADA baris
 * existing yang statusnya bukan 'pending' (sudah ada yang mulai
 * memutuskan) — mengedit assignment tahap yang sedang berjalan bukan
 * cakupan Fase 2 (lihat spec, Non-Goals).
 */
export async function writeStageAssignment(
  supabase: any, actorId: string,
  params: { projectId: string; docType: string; stageKey: string; assigneeIds: string[] }
): Promise<{ error?: string }> {
  const { projectId, docType, stageKey, assigneeIds } = params;

  const { data: existing } = await supabase
    .from('stage_assignments')
    .select('id, assignee_id, status')
    .eq('project_id', projectId).eq('doc_type', docType).eq('stage_key', stageKey);

  if ((existing || []).some((row: any) => row.status !== 'pending')) {
    return { error: 'Tahap ini sudah mulai diproses — assignment tidak bisa diubah sampai ditolak dan diajukan ulang.' };
  }

  const { data: actorProfile } = await supabase.from('profiles').select('org_id').eq('id', actorId).single();
  if (!actorProfile?.org_id) return { error: 'Organisasi Anda tidak ditemukan.' };

  if (assigneeIds.length > 0) {
    const permission = STAGE_KEY_PERMISSION[stageKey];
    if (!permission) return { error: 'Tahap ini tidak dikenali.' };

    const { data: assigneeProfiles } = await supabase.from('profiles').select('id, role, org_id').in('id', assigneeIds);
    const invalid = (assigneeProfiles || []).some((p: any) => p.org_id !== actorProfile.org_id);
    if (invalid || (assigneeProfiles || []).length !== assigneeIds.length) {
      return { error: 'Semua orang yang ditunjuk harus berasal dari organisasi Anda sendiri.' };
    }

    // Assignment MEMPERSEMPIT kumpulan pemegang permission jadi orang tertentu
    // untuk satu proyek — bukan menggantikan sistem permission. Tanpa cek ini,
    // seorang admin bisa menunjuk siapa pun di org-nya (mis. staff biasa) ke
    // tahap approval, dan orang itu langsung bisa menyetujui dokumen lewat
    // requireAssignedApprover di app/dashboard/approval/actions.ts — yang hanya
    // memeriksa keberadaan baris assignment 'pending', bukan permission lagi.
    const eligibleRoles = new Set(await getRoleNamesWithPermission(supabase, permission.module, permission.action));
    const ineligible = (assigneeProfiles || []).find((p: any) => !eligibleRoles.has(p.role));
    if (ineligible) {
      return { error: `Salah satu orang yang dipilih memiliki role ('${ineligible.role ?? '-'}') yang tidak berwenang untuk tahap ini.` };
    }
  }

  const existingIds = new Set((existing || []).map((r: any) => r.assignee_id));
  const newIds = new Set(assigneeIds);

  const toRemove = (existing || []).filter((r: any) => !newIds.has(r.assignee_id)).map((r: any) => r.id);
  if (toRemove.length > 0) {
    const { error } = await supabase.from('stage_assignments').delete().in('id', toRemove);
    if (error) return { error: error.message };
  }

  const toAdd = assigneeIds.filter(id => !existingIds.has(id));
  if (toAdd.length > 0) {
    const { error } = await supabase.from('stage_assignments').insert(
      toAdd.map(assigneeId => ({
        project_id: projectId, doc_type: docType, stage_key: stageKey,
        assignee_id: assigneeId, status: 'pending', assigned_by: actorId,
      }))
    );
    if (error) return { error: error.message };
  }

  return {};
}

/** True hanya kalau ADA minimal satu baris dan SEMUA baris untuk tahap ini berstatus 'approved'. */
export function isStageFullyApproved(rows: StageAssignmentRow[]): boolean {
  return rows.length > 0 && rows.every(r => r.status === 'approved');
}

/** Dipanggil saat vendor mengajukan ulang setelah reject — semua baris tahap ini kembali 'pending' supaya orang yang sama direview lagi dari nol. */
export async function resetStageAssignments(
  supabase: any, projectId: string, docType: string, stageKey: string
): Promise<void> {
  await supabase
    .from('stage_assignments')
    .update({ status: 'pending', decided_at: null, note: null })
    .eq('project_id', projectId).eq('doc_type', docType).eq('stage_key', stageKey);
}
