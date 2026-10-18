// lib/assignment-notify.ts
//
// Notifikasi seputar penugasan approval:
//   - admin tiap pihak diberi tahu saat ada proyek/tahap yang belum ditugaskan;
//   - orang yang baru ditugaskan diberi tahu kalau dokumennya SUDAH berada di
//     tahap itu (kasus penugasan terlambat — tanpa ini tidak ada notifikasi
//     karena notifikasi tahap hanya dikirim saat dokumen pindah tahap).
//
// Bukan Server Action — dipanggil dari dalam file yang sudah "use server".

import { getRoleNamesWithPermission } from '@/utils/permissions';
import {
  type AssignmentParty, STAGE_SHORT_LABEL, assignmentUrl, partyOfStageKey,
} from '@/lib/assignment-gaps';
import { PROCEDURE_STAGE_PERMISSION } from '@/lib/procedure-status';
import { JSA_STAGE_PERMISSION } from '@/lib/jsa-status';
import { PTW_STAGE_PERMISSION } from '@/lib/ptw-status';
import { insertNotificationsWithPush } from '@/lib/push';

/** Permission yang menandai "admin penugasan" tiap pihak (sinkron dengan getAdminParty). */
const ADMIN_PERMISSION: Record<AssignmentParty, { module: string; action: string }> = {
  pgn: { module: 'masterData', action: 'manage_project' },
  pgsol: { module: 'jsa', action: 'manage_assignment_pgsol' },
  vendor: { module: 'masterData', action: 'manage_org_staff' },
};

const DOC_TABLE: Record<string, string> = { procedure: 'procedures', jsa: 'jsa', ptw: 'ptw' };
const DOC_LABEL: Record<string, string> = { procedure: 'Prosedur Kerja', jsa: 'JSA', ptw: 'PTW' };
const STAGE_PERMISSION_BY_DOC: Record<string, Record<string, { module: string; action: string }>> = {
  procedure: PROCEDURE_STAGE_PERMISSION,
  jsa: JSA_STAGE_PERMISSION,
  ptw: PTW_STAGE_PERMISSION,
};

/** User id admin penugasan satu pihak. Vendor dibatasi ke organisasi proyeknya. */
export async function getPartyAdminIds(
  supabase: any, party: AssignmentParty, vendorOrgId?: string | null,
): Promise<string[]> {
  const { module, action } = ADMIN_PERMISSION[party];
  const roleNames = await getRoleNamesWithPermission(supabase, module, action);
  // `admin` (super admin PGN) memegang seluruh permission tanpa harus tercantum.
  const names = party === 'pgn' && !roleNames.includes('admin') ? [...roleNames, 'admin'] : roleNames;
  if (names.length === 0) return [];

  let q = supabase.from('profiles').select('id').in('role', names).eq('type', party);
  if (party === 'vendor') {
    if (!vendorOrgId) return [];
    q = q.eq('org_id', vendorOrgId);
  }
  const { data } = await q;
  return (data || []).map((r: any) => r.id as string);
}

async function insertNotifications(supabase: any, userIds: string[], payload: {
  type: 'action_required' | 'info';
  title: string;
  message: string;
  link: string;
}) {
  if (userIds.length === 0) return;
  await insertNotificationsWithPush(
    supabase,
    [...new Set(userIds)].map(user_id => ({ user_id, ...payload })),
  );
}

/** Proyek baru: ingatkan admin PGN, PGSOL, dan vendor proyek itu untuk menugaskan approver. */
export async function notifyProjectNeedsAssignment(supabase: any, params: {
  projectId: string; projectName: string; vendorOrgId?: string | null; excludeUserId?: string;
}) {
  const { projectId, projectName, vendorOrgId, excludeUserId } = params;
  const parties: AssignmentParty[] = ['pgn', 'pgsol', 'vendor'];
  for (const party of parties) {
    const ids = (await getPartyAdminIds(supabase, party, vendorOrgId)).filter(id => id !== excludeUserId);
    await insertNotifications(supabase, ids, {
      type: 'action_required',
      title: 'Tugaskan Approver Proyek Baru',
      message: `Proyek "${projectName}" belum punya penanggung jawab approval untuk tahap bagian Anda. Tugaskan sebelum dokumen diajukan supaya tidak tersangkut.`,
      link: assignmentUrl(party, projectId),
    });
  }
}

/**
 * Dokumen pindah ke tahap yang SLOT-nya kosong: tidak ada yang bisa approve.
 * Kabari admin pihak pemilik tahap itu.
 */
export async function notifyEmptyStage(supabase: any, params: {
  projectId: string; docType: string; stageKey: string;
}) {
  const { projectId, docType, stageKey } = params;
  const party = partyOfStageKey(stageKey);
  if (!party) return;

  const { data: project } = await supabase
    .from('projects').select('name, vendor_id').eq('id', projectId).single();
  if (!project) return;

  const ids = await getPartyAdminIds(supabase, party, project.vendor_id);
  const slot = STAGE_SHORT_LABEL[stageKey] ?? stageKey;
  await insertNotifications(supabase, ids, {
    type: 'action_required',
    title: 'Dokumen Menunggu — Tahap Belum Ditugaskan',
    message: `${DOC_LABEL[docType] ?? docType} proyek "${project.name}" sudah sampai di tahap ${slot}, tetapi belum ada yang ditugaskan. Dokumen tidak bisa diproses sampai ditugaskan.`,
    link: assignmentUrl(party, projectId),
  });
}

/**
 * Orang yang baru ditugaskan ke tahap yang sedang berjalan → kabari. Hanya
 * jika dokumen proyek itu memang sedang berstatus tahap tersebut.
 */
export async function notifyAddedAssigneesIfActive(supabase: any, params: {
  projectId: string; docType: string; stageKey: string; addedIds: string[];
}) {
  const { projectId, docType, stageKey, addedIds } = params;
  if (addedIds.length === 0) return;

  const table = DOC_TABLE[docType];
  const statusMap = STAGE_PERMISSION_BY_DOC[docType];
  if (!table || !statusMap) return;

  const statuses = Object.entries(statusMap)
    .filter(([, p]) => `${p.module}.${p.action}` === stageKey)
    .map(([status]) => status);
  if (statuses.length === 0) return;

  const { data: docs } = await supabase
    .from(table).select('id').eq('project_id', projectId).in('status', statuses).limit(1);
  if (!docs || docs.length === 0) return;

  const party = partyOfStageKey(stageKey);
  const link = party === 'vendor'
    ? `/vendor/dashboard/projects/${projectId}`
    : `/dashboard/projects/${projectId}`;

  await insertNotifications(supabase, addedIds, {
    type: 'action_required',
    title: `${DOC_LABEL[docType] ?? docType} Menunggu Review Anda`,
    message: `Anda baru ditugaskan di tahap ${STAGE_SHORT_LABEL[stageKey] ?? stageKey} dan dokumennya sedang menunggu tindakan Anda.`,
    link,
  });
}
