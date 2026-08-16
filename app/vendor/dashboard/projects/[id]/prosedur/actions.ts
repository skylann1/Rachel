"use server";

import { createClient } from "@/utils/supabase/server";
import { notifyUsersByPermission } from "@/app/dashboard/inbox/actions";
import { PROCEDURE_STATUS, PROCEDURE_STAGE_PERMISSION } from "@/lib/procedure-status";
import { logDocumentEvent } from "@/lib/document-logs";

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

  if (procedureId) {
    await logDocumentEvent(supabase, {
      docType: 'procedure', docId: procedureId, projectId, actorId: user?.id,
      action: existing ? 'Revisi Diajukan Ulang' : 'Prosedur Kerja Diajukan',
    });
  }

  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
  await notifyUsersByPermission({
    ...PROCEDURE_STAGE_PERMISSION[PROCEDURE_STATUS.menungguReviewPM],
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
