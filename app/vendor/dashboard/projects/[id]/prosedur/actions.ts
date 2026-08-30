"use server";

import { createClient } from "@/utils/supabase/server";
import { notifyAssignees } from "@/app/dashboard/inbox/actions";
import { PROCEDURE_STATUS } from "@/lib/procedure-status";
import { logDocumentEvent } from "@/lib/document-logs";
import { resetStageAssignments } from "@/lib/stage-assignments";

export async function saveProsedur(projectId: string, payload: any) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // check if procedure already exists
  const { data: existing } = await supabase
    .from('procedures')
    .select('id')
    .eq('project_id', projectId)
    .single();

  let procedureId = existing?.id;

  if (existing) {
    const { error } = await supabase
      .from('procedures')
      .update({ content: payload, status: PROCEDURE_STATUS.menungguReviewPM })
      .eq('id', existing.id);

    if (error) throw new Error(error.message);
  } else {
    const { data: created, error } = await supabase
      .from('procedures')
      .insert({
        project_id: projectId,
        content: payload,
        status: PROCEDURE_STATUS.menungguReviewPM
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    procedureId = created?.id;
  }

  // Dokumen ini baru saja (kembali) masuk tahap `procedure.review`, tapi jalur
  // ini BUKAN lewat rejectProcedure — jadi baris stage_assignments tahap itu
  // bisa saja masih menyimpan keputusan ronde sebelumnya ('approved' dari
  // siklus yang sudah selesai, misalnya). writeStageAssignment menolak
  // menyunting baris non-'pending' dan approver tidak punya baris 'pending'
  // untuk ditindaklanjuti, sehingga ronde baru macet permanen tanpa reset ini.
  await resetStageAssignments(supabase, projectId, 'procedure', 'procedure.review');

  if (procedureId) {
    await logDocumentEvent(supabase, {
      docType: 'procedure', docId: procedureId, projectId, actorId: user?.id,
      action: existing ? 'Revisi Diajukan Ulang' : 'Prosedur Kerja Diajukan',
    });
  }

  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
  await notifyAssignees({
    projectId,
    docType: 'procedure',
    stageKey: 'procedure.review',
    type: 'action_required',
    title: 'Prosedur Kerja Menunggu Review',
    message: `Prosedur kerja untuk proyek "${project?.name}" telah diajukan dan menunggu review Anda.`,
    link: `/dashboard/projects/${projectId}`,
  });
}

export async function getProsedur(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('procedures')
    .select('content, status')
    .eq('project_id', projectId)
    .single();
    
  if (error && error.code !== 'PGRST116') {
    console.error(error);
  }
  return data;
}
