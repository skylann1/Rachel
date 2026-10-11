// lib/assignment-gaps.ts
//
// "Gap penugasan": slot approval proyek yang belum punya satu pun penanggung
// jawab. Approval bersifat assignment-driven & fail-closed (lihat
// lib/stage-assignments.ts) — slot kosong berarti dokumen tersangkut diam-diam
// karena tidak ada yang bisa approve dan tidak ada yang dinotifikasi. Modul ini
// menghitung slot kosong itu untuk admin tiap pihak (PGN / PGSOL / Vendor) supaya
// tampil di My Task, badge sidebar, dan dipakai pengirim notifikasi.
//
// Bukan Server Action ("use server" tidak ada di sini) — dipanggil dari
// dalam file yang sudah "use server".

import { hasPermissionForUser } from '@/utils/permissions';
import { PGN_STAGE_KEYS, PGSOL_STAGE_KEYS, VENDOR_STAGE_KEYS, getPassedStageKeys } from '@/lib/stage-assignments';

export type AssignmentParty = 'pgn' | 'pgsol' | 'vendor';

/** Urutan = urutan tampil & urutan tahap dalam dokumen. */
export const PARTY_STAGE_KEYS: Record<AssignmentParty, readonly string[]> = {
  pgn: PGN_STAGE_KEYS,
  pgsol: PGSOL_STAGE_KEYS,
  vendor: VENDOR_STAGE_KEYS,
};

export const PARTY_LABEL: Record<AssignmentParty, string> = {
  pgn: 'Admin PGN',
  pgsol: 'Admin PGSOL',
  vendor: 'Admin Vendor',
};

/** Label singkat per slot — dipakai di daftar "tahap yang belum ditugaskan". */
export const STAGE_SHORT_LABEL: Record<string, string> = {
  'procedure.hse_vendor': 'Prosedur · HSE Vendor',
  'procedure.review_vendor': 'Prosedur · PM Vendor',
  'jsa.hse_vendor': 'JSA · HSE Vendor',
  'jsa.review_vendor': 'JSA · PM Vendor',
  'ptw.hse_vendor': 'PTW · HSE Vendor',
  'ptw.review_vendor': 'PTW · PM Vendor',
  'procedure.hse_pgsol': 'Prosedur · HSE PGSOL',
  'procedure.review_pgsol': 'Prosedur · PM PGSOL',
  'jsa.hse_pgsol': 'JSA · HSE PGSOL',
  'jsa.review_pgsol': 'JSA · PM PGSOL',
  'ptw.hse_pgsol': 'PTW · HSE PGSOL',
  'ptw.review_pgsol': 'PTW · PM PGSOL',
  'procedure.hsse_pgn': 'Prosedur · HSSE PGN',
  'procedure.review': 'Prosedur · PM Zona',
  'jsa.hsse_pgn': 'JSA · HSSE PGN',
  'jsa.approve_pgn': 'JSA · PM Zona',
  'ptw.approve_pm': 'PTW · Approval PM',
  'ptw.review_issuer': 'PTW · Issuer',
  'ptw.numbering_hsse': 'PTW · Penomoran HSSE',
};

export function partyOfStageKey(stageKey: string): AssignmentParty | null {
  for (const party of Object.keys(PARTY_STAGE_KEYS) as AssignmentParty[]) {
    if (PARTY_STAGE_KEYS[party].includes(stageKey)) return party;
  }
  return null;
}

/** Halaman tempat admin pihak itu menugaskan slot proyek. */
export function assignmentUrl(party: AssignmentParty, projectId: string): string {
  if (party === 'pgn') return `/dashboard/master-data/project/${projectId}/assign`;
  if (party === 'pgsol') return `/dashboard/master-data/project-pgsol-assign/${projectId}`;
  return `/vendor/dashboard/projects/${projectId}`;
}

/** Proyek yang sudah final tidak butuh penugasan lagi. */
const FINAL_PROJECT_STATUSES = ['Selesai', 'Completed', 'Ditolak'];

export interface AssignmentGap {
  projectId: string;
  projectName: string;
  vendorName: string;
  createdAt: string;
  party: AssignmentParty;
  missing: string[];
  total: number;
  url: string;
}

/**
 * Pihak admin si pemanggil, atau null kalau dia bukan admin penugasan.
 * Permission saja tidak cukup: role `admin` (PGN) memegang SELURUH permission,
 * jadi tipe organisasi ikut menentukan pihak (sama seperti requiresOrgType di
 * sidebar-nav).
 */
export async function getAdminParty(supabase: any, userId: string): Promise<AssignmentParty | null> {
  const { data: profile } = await supabase.from('profiles').select('type').eq('id', userId).single();
  const type = profile?.type as string | undefined;
  if (type === 'pgn' && await hasPermissionForUser(supabase, userId, 'masterData', 'manage_project')) return 'pgn';
  if (type === 'pgsol' && await hasPermissionForUser(supabase, userId, 'jsa', 'manage_assignment_pgsol')) return 'pgsol';
  if (type === 'vendor' && await hasPermissionForUser(supabase, userId, 'masterData', 'manage_org_staff')) return 'vendor';
  return null;
}

/**
 * Proyek aktif yang masih punya slot kosong untuk pihak si pemanggil. Kosong
 * kalau pemanggil bukan admin penugasan. Scoping proyek mengikuti RLS:
 * vendor hanya melihat proyek organisasinya sendiri.
 */
export async function getAssignmentGaps(supabase: any, userId: string): Promise<AssignmentGap[]> {
  const party = await getAdminParty(supabase, userId);
  if (!party) return [];

  let projectQuery = supabase
    .from('projects')
    .select('id, name, status, created_at, vendor_profiles ( company_name )')
    .order('created_at', { ascending: false });
  if (party === 'vendor') {
    // Jangan hanya mengandalkan RLS: vendor hanya menugaskan proyek organisasinya sendiri.
    const { data: me } = await supabase.from('profiles').select('org_id').eq('id', userId).single();
    if (!me?.org_id) return [];
    projectQuery = projectQuery.eq('vendor_id', me.org_id);
  }
  const { data: projects } = await projectQuery;

  const active = (projects || []).filter((p: any) => !FINAL_PROJECT_STATUSES.includes(p.status));
  if (active.length === 0) return [];

  const keys = PARTY_STAGE_KEYS[party];
  const { data: rows } = await supabase
    .from('stage_assignments')
    .select('project_id, stage_key')
    .in('project_id', active.map((p: any) => p.id))
    .in('stage_key', keys as string[]);

  // Tahap yang sudah dilewati dokumennya tidak lagi butuh penugasan.
  const passedByProject = await getPassedStageKeys(supabase, active.map((p: any) => p.id));

  const filled = new Map<string, Set<string>>();
  (rows || []).forEach((r: any) => {
    if (!filled.has(r.project_id)) filled.set(r.project_id, new Set());
    filled.get(r.project_id)!.add(r.stage_key);
  });

  const gaps: AssignmentGap[] = [];
  for (const p of active) {
    const have = filled.get(p.id) ?? new Set<string>();
    const passed = passedByProject.get(p.id) ?? new Set<string>();
    const missing = keys.filter(k => !have.has(k) && !passed.has(k));
    if (missing.length === 0) continue;
    const vendor = Array.isArray(p.vendor_profiles) ? p.vendor_profiles[0] : p.vendor_profiles;
    gaps.push({
      projectId: p.id,
      projectName: p.name,
      vendorName: vendor?.company_name || 'Internal',
      createdAt: p.created_at,
      party,
      missing: [...missing],
      total: keys.length,
      url: assignmentUrl(party, p.id),
    });
  }
  return gaps;
}
