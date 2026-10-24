"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import { notifyOrgMembers } from "@/app/dashboard/inbox/actions";
import { JSA_STAGE_SEQUENCE } from "@/lib/jsa-status";
import { PTW_STAGE_SEQUENCE } from "@/lib/ptw-status";
import { logDocumentEvent } from "@/lib/document-logs";
import { getStageAssignments } from "@/lib/stage-assignments";
import { recordDocumentChange } from "@/lib/document-changes";
import { summarizeChanges } from "@/lib/prosedur-diff";
import { parseJsaStepRow, serializeJsaStep, sanitizeJsaSteps, diffJsaSteps } from "@/lib/jsa-steps";
import { pickPtwEditable, sanitizePtwPatch, diffPtw, type PtwEditable } from "@/lib/ptw-diff";
import type { JsaStepData } from "@/app/vendor/dashboard/jsa/create/[id]/JsaStepCard";

type Sequence = readonly { key: string; label: string; status: string }[];

/**
 * Hak ubah = ditugaskan (pending) di tahap yang SEDANG berjalan, sama dengan
 * hak approve. Mengembalikan data dokumen + tahap + profil pengubah.
 */
async function authorizeReviewer(table: 'jsa' | 'ptw', docId: string, seq: Sequence, docType: 'jsa' | 'ptw') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: current } = await supabase.from(table).select('*').eq('id', docId).single();
  if (!current?.project_id) throw new Error("Dokumen ini tidak terhubung ke proyek.");
  const stage = seq.find(s => s.status === current.status);
  if (!stage) throw new Error("Dokumen tidak sedang dalam tahap review, jadi tidak bisa diubah langsung.");

  const rows = await getStageAssignments(supabase, current.project_id, docType, stage.key);
  if (!rows.some(r => r.assignee_id === user.id && r.status === 'pending')) {
    throw new Error("Anda tidak ditugaskan untuk tahap ini, sehingga tidak bisa mengubah dokumen.");
  }
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  return {
    supabase, user, current, stage,
    actorName: profile?.full_name || 'Reviewer',
    actorLabel: stage.label.replace(/^Review /, ''),
  };
}

async function notifyVendor(projectId: string, label: string, docName: string, count: number, link: string) {
  const supabase = await createClient();
  const { data: proj } = await supabase.from('projects').select('name, vendor_id').eq('id', projectId).maybeSingle();
  if (!proj?.vendor_id) return;
  await notifyOrgMembers({
    orgId: proj.vendor_id, type: 'info',
    title: `${docName} Diubah Reviewer`,
    message: `${docName} untuk proyek "${proj.name}" diubah langsung oleh ${label} (${count} perubahan). Lihat riwayat perubahan di dokumen.`,
    link,
  });
}

// ----------------------------------------------------------------- Roster

/** Pekerja / peralatan / material milik vendor proyek ini — untuk picker di editor reviewer. */
export async function getProjectRoster(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: mine } = await supabase
    .from('stage_assignments').select('id')
    .eq('project_id', projectId).eq('assignee_id', user.id).eq('status', 'pending').limit(1);
  if (!mine || mine.length === 0) throw new Error("Anda tidak ditugaskan pada proyek ini.");

  const admin = createAdminClient();
  const { data: proj } = await admin.from('projects').select('vendor_id').eq('id', projectId).maybeSingle();
  if (!proj?.vendor_id) return { workers: [], equipment: [], materials: [] };

  const [w, e, m] = await Promise.all([
    admin.from('vendor_workers').select('id, full_name, position, status, vendor_worker_competencies ( title )').eq('vendor_id', proj.vendor_id).order('full_name'),
    admin.from('vendor_equipment').select('id, name, category, certificate_number').eq('vendor_id', proj.vendor_id).order('name'),
    admin.from('vendor_materials').select('id, name').eq('vendor_id', proj.vendor_id).order('name'),
  ]);
  return {
    workers: (w.data || []).filter((x: any) => x.status !== 'Inactive').map((x: any) => ({
      id: x.id as string, full_name: x.full_name as string, position: (x.position || '') as string,
      certification: ((x.vendor_worker_competencies || []).map((c: any) => c.title).join(', ') || null) as string | null,
    })),
    equipment: (e.data || []).map((x: any) => ({ id: x.id as string, name: x.name as string, category: (x.category || '') as string, certificate_number: (x.certificate_number || null) as string | null })),
    materials: (m.data || []).map((x: any) => ({ id: x.id as string, name: x.name as string })),
  };
}

// -------------------------------------------------------------------- JSA

export async function loadJsaForEdit(jsaId: string): Promise<{ steps: JsaStepData[]; projectId: string }> {
  const { current } = await authorizeReviewer('jsa', jsaId, JSA_STAGE_SEQUENCE, 'jsa');
  const { data: rows } = await createAdminClient().from('jsa_steps').select('*').eq('jsa_id', jsaId).order('step_number', { ascending: true });
  return { steps: (rows || []).map((r: any, i: number) => parseJsaStepRow(r, i)), projectId: current.project_id };
}

export async function editJsaAsReviewer(jsaId: string, rawSteps: unknown, note?: string): Promise<{ changed: number }> {
  const { supabase, user, current, stage, actorName, actorLabel } = await authorizeReviewer('jsa', jsaId, JSA_STAGE_SEQUENCE, 'jsa');
  const admin = createAdminClient();

  const { data: oldRows } = await admin.from('jsa_steps').select('*').eq('jsa_id', jsaId).order('step_number', { ascending: true });
  const oldSteps = (oldRows || []).map((r: any, i: number) => parseJsaStepRow(r, i));
  const newSteps = sanitizeJsaSteps(rawSteps);
  if (newSteps.length === 0) throw new Error("JSA minimal punya satu langkah.");

  const changes = diffJsaSteps(oldSteps, newSteps);
  if (changes.length === 0) return { changed: 0 };
  const summary = summarizeChanges(changes);

  await recordDocumentChange(supabase, {
    docType: 'jsa', docId: jsaId, projectId: current.project_id, actorId: user.id,
    actorName, actorLabel, summary, note: note?.trim() || null, changes,
  });

  // Kunci status terakhir sebelum menulis ulang langkah.
  const { data: still } = await admin.from('jsa').select('status').eq('id', jsaId).single();
  if (still?.status !== current.status) {
    throw new Error("JSA ini baru saja diproses oleh pengguna lain. Muat ulang halaman untuk melihat status terbaru.");
  }

  await admin.from('jsa_steps').delete().eq('jsa_id', jsaId);
  const { error } = await admin.from('jsa_steps').insert(newSteps.map((s, i) => serializeJsaStep(s, jsaId, i)));
  if (error) {
    // Kembalikan langkah lama supaya dokumen tidak kosong.
    await admin.from('jsa_steps').insert(oldSteps.map((s, i) => serializeJsaStep(s, jsaId, i)));
    throw new Error(error.message);
  }

  await logDocumentEvent(supabase, {
    docType: 'jsa', docId: jsaId, projectId: current.project_id, actorId: user.id,
    action: `Diubah langsung oleh ${actorLabel}`, notes: note?.trim() ? `${summary}. Catatan: ${note.trim()}` : summary,
  });
  await notifyVendor(current.project_id, actorLabel, 'JSA', changes.length, `/vendor/dashboard/jsa/create/${current.project_id}`);
  void stage;
  revalidatePath(`/dashboard/projects/${current.project_id}`);
  revalidatePath(`/vendor/dashboard/projects/${current.project_id}`);
  return { changed: changes.length };
}

// -------------------------------------------------------------------- PTW

export async function loadPtwForEdit(ptwId: string): Promise<{ editable: PtwEditable; ptwType: string; projectId: string }> {
  const { current } = await authorizeReviewer('ptw', ptwId, PTW_STAGE_SEQUENCE, 'ptw');
  return { editable: pickPtwEditable(current), ptwType: current.ptw_type, projectId: current.project_id };
}

export async function editPtwAsReviewer(ptwId: string, rawPatch: unknown, note?: string): Promise<{ changed: number }> {
  const { supabase, user, current, actorName, actorLabel } = await authorizeReviewer('ptw', ptwId, PTW_STAGE_SEQUENCE, 'ptw');
  const admin = createAdminClient();

  const before = pickPtwEditable(current);
  const after = sanitizePtwPatch(rawPatch, before);

  // Pekerja & peralatan harus milik organisasi vendor proyek ini.
  const { data: proj } = await admin.from('projects').select('vendor_id').eq('id', current.project_id).maybeSingle();
  if (!proj?.vendor_id) throw new Error("Vendor proyek tidak ditemukan.");
  const wIds = Array.from(new Set(after.workers.map(w => w.id)));
  const eIds = Array.from(new Set(after.equipment.map(e => e.id)));
  if (wIds.length) {
    const { data: ok } = await admin.from('vendor_workers').select('id').eq('vendor_id', proj.vendor_id).in('id', wIds);
    if ((ok?.length ?? 0) !== wIds.length) throw new Error("Ada pekerja yang bukan milik vendor proyek ini.");
  }
  if (eIds.length) {
    const { data: ok } = await admin.from('vendor_equipment').select('id').eq('vendor_id', proj.vendor_id).in('id', eIds);
    if ((ok?.length ?? 0) !== eIds.length) throw new Error("Ada peralatan yang bukan milik vendor proyek ini.");
  }

  const changes = diffPtw(before, after);
  if (changes.length === 0) return { changed: 0 };
  const summary = summarizeChanges(changes);

  await recordDocumentChange(supabase, {
    docType: 'ptw', docId: ptwId, projectId: current.project_id, actorId: user.id,
    actorName, actorLabel, summary, note: note?.trim() || null, changes,
  });

  const { data: updated, error } = await admin.from('ptw').update(after).eq('id', ptwId).eq('status', current.status).select('id');
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) {
    throw new Error("PTW ini baru saja diproses oleh pengguna lain. Muat ulang halaman untuk melihat status terbaru.");
  }

  await logDocumentEvent(supabase, {
    docType: 'ptw', docId: ptwId, projectId: current.project_id, actorId: user.id,
    action: `Diubah langsung oleh ${actorLabel}`, notes: note?.trim() ? `${summary}. Catatan: ${note.trim()}` : summary,
  });
  await notifyVendor(current.project_id, actorLabel, 'PTW', changes.length, `/vendor/dashboard/ptw/create/${current.project_id}/${current.ptw_type}`);
  revalidatePath(`/dashboard/projects/${current.project_id}`);
  revalidatePath(`/vendor/dashboard/projects/${current.project_id}`);
  return { changed: changes.length };
}
