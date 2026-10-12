'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { hasPermissionForUser } from '@/utils/permissions';
import { PROCEDURE_STAGE_SEQUENCE, procedureStageIndex } from '@/lib/procedure-status';
import { JSA_STAGE_SEQUENCE, jsaStageIndex } from '@/lib/jsa-status';
import { PTW_STAGE_SEQUENCE, ptwStageIndex } from '@/lib/ptw-status';
import { PTW_TYPES } from '@/lib/ptw-types';
import { STAGE_KEY_PERMISSION } from '@/lib/stage-assignments';
import { STAGE_SHORT_LABEL, PARTY_LABEL, partyOfStageKey } from '@/lib/assignment-gaps';
import type { StuckDocument, StuckIssue, StuckReport, StuckSeverity } from './types';

const AGING_MEDIUM_DAYS = 3;
const AGING_HIGH_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const SEVERITY_RANK: Record<StuckSeverity, number> = { high: 0, medium: 1, info: 2 };

interface DocRow { id: string; project_id: string; docType: 'procedure' | 'jsa' | 'ptw'; status: string; ptw_type?: string | null; created_at: string }

const SEQ: Record<'procedure' | 'jsa' | 'ptw', { seq: readonly { key: string; status: string }[]; index: (s: string | null) => number }> = {
  procedure: { seq: PROCEDURE_STAGE_SEQUENCE, index: procedureStageIndex },
  jsa: { seq: JSA_STAGE_SEQUENCE, index: jsaStageIndex },
  ptw: { seq: PTW_STAGE_SEQUENCE, index: ptwStageIndex },
};

const DOC_LABEL = { procedure: 'Prosedur Kerja', jsa: 'JSA', ptw: 'PTW' } as const;

/**
 * Laporan dokumen yang tersangkut di tahap review. Semua dokumen proyek aktif
 * yang sedang berada di salah satu tahap review diperiksa terhadap
 * stage_assignments & izin role penugasnya (assignment-driven, fail-closed —
 * lihat lib/stage-assignments.ts). Hanya untuk pemegang activityLog.view;
 * lintas organisasi, jadi membaca lewat service role setelah gerbang izin.
 */
export async function getStuckDocuments(): Promise<StuckReport> {
  const empty: StuckReport = { generatedAt: new Date().toISOString(), inReview: 0, documents: [] };

  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return empty;
  if (!(await hasPermissionForUser(userClient, user.id, 'activityLog', 'view'))) return empty;

  const admin = createAdminClient();

  const { data: projects, error } = await admin
    .from('projects')
    .select(`
      id, name, status, vendor_id,
      vendor_profiles ( company_name ),
      procedures ( id, status, created_at ),
      jsa ( id, status, created_at ),
      ptw ( id, status, ptw_type, created_at )
    `)
    .neq('status', 'Selesai');
  if (error) { console.error('getStuckDocuments error:', error.message); return empty; }

  const docs: Array<DocRow & { project: any }> = [];
  for (const p of (projects || []) as any[]) {
    const asArr = (v: any) => (Array.isArray(v) ? v : v ? [v] : []);
    asArr(p.procedures).forEach((d: any) => docs.push({ ...d, project_id: p.id, docType: 'procedure', project: p }));
    asArr(p.jsa).forEach((d: any) => docs.push({ ...d, project_id: p.id, docType: 'jsa', project: p }));
    asArr(p.ptw).forEach((d: any) => docs.push({ ...d, project_id: p.id, docType: 'ptw', project: p }));
  }

  // Hanya dokumen yang SEDANG di tahap review (bukan Draft / sudah final).
  const inReviewDocs = docs.filter(d => {
    const cfg = SEQ[d.docType];
    const i = cfg.index(d.status);
    return i >= 0 && i < cfg.seq.length;
  });
  if (inReviewDocs.length === 0) return empty;

  const projectIds = [...new Set(inReviewDocs.map(d => d.project_id))];
  const docIds = inReviewDocs.map(d => d.id);

  const [assignRes, logsRes, rolesRes] = await Promise.all([
    admin.from('stage_assignments').select('project_id, doc_type, stage_key, assignee_id, status').in('project_id', projectIds),
    admin.from('document_logs').select('doc_id, created_at').in('doc_id', docIds).order('created_at', { ascending: false }),
    admin.from('roles').select('name, permissions'),
  ]);

  const assignRows = (assignRes.data || []) as Array<{ project_id: string; doc_type: string; stage_key: string; assignee_id: string; status: string }>;
  const assigneeIds = [...new Set(assignRows.map(a => a.assignee_id))];
  const { data: profiles } = assigneeIds.length > 0
    ? await admin.from('profiles').select('id, full_name, role').in('id', assigneeIds)
    : { data: [] as any[] };
  const profileById = new Map<string, { full_name: string | null; role: string | null }>(
    (profiles || []).map((p: any) => [p.id, { full_name: p.full_name, role: p.role }]),
  );

  const rolePerms = new Map<string, Record<string, string[]>>(
    ((rolesRes.data || []) as any[]).map(r => [r.name, r.permissions || {}]),
  );
  const holds = (roleName: string | null, stageKey: string) => {
    const need = STAGE_KEY_PERMISSION[stageKey];
    if (!need || !roleName) return false;
    const perms = rolePerms.get(roleName)?.[need.module];
    return Array.isArray(perms) && perms.includes(need.action);
  };

  // created_at TERBARU per dokumen (query diurutkan menurun → yang pertama menang).
  const lastEvent = new Map<string, string>();
  (logsRes.data || []).forEach((l: any) => { if (!lastEvent.has(l.doc_id)) lastEvent.set(l.doc_id, l.created_at); });

  const now = Date.now();
  const out: StuckDocument[] = [];

  for (const d of inReviewDocs) {
    const cfg = SEQ[d.docType];
    const stage = cfg.seq[cfg.index(d.status)];
    const stageKey = stage.key;
    const rows = assignRows.filter(a => a.project_id === d.project_id && a.doc_type === d.docType && a.stage_key === stageKey);
    const pending = rows.filter(r => r.status === 'pending');

    const assignees = rows.map(r => {
      const prof = profileById.get(r.assignee_id);
      return {
        id: r.assignee_id,
        name: prof?.full_name || 'Tanpa nama',
        status: r.status,
        unauthorized: r.status === 'pending' && !holds(prof?.role ?? null, stageKey),
      };
    });

    const issues: StuckIssue[] = [];
    if (rows.length === 0) {
      issues.push({
        code: 'no_assignee', severity: 'high',
        title: 'Belum ada penugas di tahap ini',
        detail: 'Tidak ada satu pun orang yang ditugaskan, jadi tidak ada yang bisa menyetujui dan tidak ada yang dinotifikasi.',
      });
    } else if (pending.length === 0) {
      issues.push({
        code: 'all_decided', severity: 'high',
        title: 'Semua penugas sudah memutuskan, tapi dokumen belum bergerak',
        detail: 'Status dokumen masih di tahap ini padahal seluruh penugasnya sudah menyetujui. Kemungkinan data tidak sinkron — periksa riwayat dokumen.',
      });
    } else {
      const authorized = pending.filter(r => holds(profileById.get(r.assignee_id)?.role ?? null, stageKey));
      if (authorized.length === 0) {
        issues.push({
          code: 'no_authorized', severity: 'high',
          title: 'Penugas ada, tapi tak satu pun berwenang',
          detail: 'Role semua penugas sudah tidak memegang izin tahap ini (role berubah), jadi mereka tidak bisa menyetujui. Tugaskan ulang ke orang yang berwenang.',
        });
      } else if (authorized.length < pending.length) {
        issues.push({
          code: 'some_unauthorized', severity: 'medium',
          title: 'Sebagian penugas tidak lagi berwenang',
          detail: `${pending.length - authorized.length} dari ${pending.length} penugas tidak bisa menindaklanjuti. Dokumen tetap bisa jalan lewat yang berwenang, tapi daftar penugasnya perlu dirapikan.`,
        });
      }
    }

    const since = lastEvent.get(d.id) ?? d.created_at;
    const waitingDays = since ? Math.floor((now - new Date(since).getTime()) / DAY_MS) : null;
    if (waitingDays !== null && waitingDays >= AGING_MEDIUM_DAYS) {
      const high = waitingDays >= AGING_HIGH_DAYS;
      issues.push({
        code: 'aging', severity: high ? 'high' : 'medium',
        title: `Menunggu ${waitingDays} hari di tahap ini`,
        detail: 'Dokumen belum bergerak sejak aktivitas terakhirnya. Ingatkan penugas yang masih pending.',
      });
    }

    if (issues.length === 0) continue;

    const party = partyOfStageKey(stageKey);
    const project = d.project;
    const vendorProfile = Array.isArray(project.vendor_profiles) ? project.vendor_profiles[0] : project.vendor_profiles;
    const ptwTitle = d.docType === 'ptw'
      ? PTW_TYPES.find(t => t.id === d.ptw_type)?.title.split('(')[0].trim() || d.ptw_type || ''
      : '';
    const fixHref =
      party === 'pgn' ? `/dashboard/master-data/project/${project.id}/assign`
      : party === 'pgsol' ? `/dashboard/master-data/project-pgsol-assign/${project.id}`
      : null;

    out.push({
      key: `${d.docType}-${d.id}`,
      projectId: project.id,
      projectName: project.name,
      vendorName: vendorProfile?.company_name ?? null,
      docType: d.docType,
      docLabel: ptwTitle ? `${DOC_LABEL.ptw} — ${ptwTitle}` : DOC_LABEL[d.docType],
      status: d.status,
      stageKey,
      stageLabel: STAGE_SHORT_LABEL[stageKey] ?? stage.key,
      ownerParty: party,
      ownerLabel: party ? PARTY_LABEL[party] : '—',
      fixHref,
      waitingDays,
      severity: issues.reduce<StuckSeverity>((m, i) => (SEVERITY_RANK[i.severity] < SEVERITY_RANK[m] ? i.severity : m), 'info'),
      issues,
      assignees,
    });
  }

  out.sort((a, b) =>
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || (b.waitingDays ?? 0) - (a.waitingDays ?? 0),
  );

  return { generatedAt: new Date().toISOString(), inReview: inReviewDocs.length, documents: out };
}
