"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { notifyOrgMembers } from "@/app/dashboard/inbox/actions";
import { PROCEDURE_STAGE_SEQUENCE } from "@/lib/procedure-status";
import { logDocumentEvent } from "@/lib/document-logs";
import { getStageAssignments } from "@/lib/stage-assignments";
import {
  applyContentPatch, diffProsedurContent, summarizeChanges, readChangeLog,
  type ChangeLogEntry,
} from "@/lib/prosedur-diff";

/**
 * Reviewer yang sedang ditugaskan di tahap berjalan (vendor HSE/PM, PGSOL HSE/PM,
 * HSSE PGN, PM Zona) boleh mengubah isi Prosedur langsung — selain opsi Setujui /
 * Tolak. Hak ubah = punya baris stage_assignments 'pending' di tahap yang sedang
 * berjalan, sama dengan hak approve. Status dokumen TIDAK berubah; setiap
 * perubahan dicatat di content.changeLog + document_logs supaya semua yang
 * ditugaskan bisa melihat apa saja yang berubah dari versi sebelumnya.
 */
export async function editProsedurAsReviewer(
  procedureId: string,
  patch: Record<string, unknown>,
  note?: string,
): Promise<{ changed: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: current } = await supabase
    .from('procedures')
    .select('status, project_id, content, projects ( name, vendor_id )')
    .eq('id', procedureId)
    .single();
  if (!current?.project_id) throw new Error("Prosedur ini tidak terhubung ke proyek.");

  const stage = PROCEDURE_STAGE_SEQUENCE.find(s => s.status === current.status);
  if (!stage) throw new Error("Dokumen tidak sedang dalam tahap review, jadi tidak bisa diubah langsung.");

  const rows = await getStageAssignments(supabase, current.project_id, 'procedure', stage.key);
  if (!rows.some(r => r.assignee_id === user.id && r.status === 'pending')) {
    throw new Error("Anda tidak ditugaskan untuk tahap Prosedur Kerja ini, sehingga tidak bisa mengubah dokumen.");
  }

  const oldContent = current.content || {};
  const nextContent = applyContentPatch(oldContent, patch);
  const changes = diffProsedurContent(oldContent, nextContent);
  if (changes.length === 0) return { changed: 0 };

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const stageLabel = stage.label.replace(/^Review /, '');
  const summary = summarizeChanges(changes);
  const entry: ChangeLogEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actorId: user.id,
    actorName: profile?.full_name || 'Reviewer',
    actorLabel: stageLabel,
    summary,
    note: note?.trim() || null,
    changes,
  };

  const { data: updated, error } = await supabase
    .from('procedures')
    .update({ content: { ...nextContent, changeLog: [...readChangeLog(oldContent), entry] } })
    .eq('id', procedureId)
    .eq('status', current.status)
    .select('id');
  if (error) throw new Error(error.message);
  if (!updated || updated.length === 0) {
    throw new Error("Prosedur ini baru saja diproses oleh pengguna lain. Muat ulang halaman untuk melihat status terbaru.");
  }

  await logDocumentEvent(supabase, {
    docType: 'procedure', docId: procedureId, projectId: current.project_id, actorId: user.id,
    action: `Diubah langsung oleh ${stageLabel}`, notes: note?.trim() ? `${summary}. Catatan: ${note.trim()}` : summary,
  });

  const proj: any = Array.isArray(current.projects) ? current.projects[0] : current.projects;
  if (proj?.vendor_id) {
    await notifyOrgMembers({
      orgId: proj.vendor_id,
      type: 'info',
      title: 'Prosedur Kerja Diubah Reviewer',
      message: `Prosedur untuk proyek "${proj.name}" diubah langsung oleh ${stageLabel} (${changes.length} perubahan). Lihat riwayat perubahan di dokumen.`,
      link: `/vendor/dashboard/projects/${current.project_id}/prosedur`,
    });
  }

  revalidatePath('/dashboard/approval');
  revalidatePath(`/dashboard/projects/${current.project_id}`);
  revalidatePath(`/vendor/dashboard/projects/${current.project_id}`);
  return { changed: changes.length };
}
