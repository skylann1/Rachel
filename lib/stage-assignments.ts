// lib/stage-assignments.ts
//
// Helper bersama untuk baca/tulis stage_assignments — dipakai baik oleh UI
// assignment (PGN di app/dashboard/master-data/project/actions.ts, PGSOL di
// app/pgsol/dashboard/projects/actions.ts) maupun oleh actions approval
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

/** Kelima stage_key yang ditugaskan admin PGN — dipakai untuk membatasi apa yang boleh disimpan lewat saveStageAssignment (masterData.manage_project). */
export const PGN_STAGE_KEYS = [
  'procedure.review',
  'jsa.approve_pgn',
  'ptw.approve_pm',
  'ptw.review_issuer',
  'ptw.numbering_hsse',
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

/** Kandidat yang boleh ditunjuk ke satu stage_key: role-nya harus punya permission {module}.{action} yang bersangkutan. */
export async function getEligibleAssignees(
  supabase: any, module: string, action: string
): Promise<{ id: string; full_name: string }[]> {
  const roleNames = await getRoleNamesWithPermission(supabase, module, action);
  if (roleNames.length === 0) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', roleNames)
    .order('full_name');
  return data || [];
}

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
    const { data: assigneeProfiles } = await supabase.from('profiles').select('id, org_id').in('id', assigneeIds);
    const invalid = (assigneeProfiles || []).some((p: any) => p.org_id !== actorProfile.org_id);
    if (invalid || (assigneeProfiles || []).length !== assigneeIds.length) {
      return { error: 'Semua orang yang ditunjuk harus berasal dari organisasi Anda sendiri.' };
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
