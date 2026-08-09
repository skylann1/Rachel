"use server";

import { createClient } from "@/utils/supabase/server";
import { notifyUsersByRole } from "@/app/dashboard/inbox/actions";
import { PROCEDURE_STATUS } from "@/lib/procedure-status";

export async function saveProsedur(projectId: string, payload: any) {
  const supabase = await createClient();

  // check if procedure already exists
  const { data: existing } = await supabase
    .from('procedures')
    .select('id')
    .eq('project_id', projectId)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('procedures')
      .update({ content: payload, status: PROCEDURE_STATUS.menungguReviewPM })
      .eq('id', existing.id);

    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('procedures')
      .insert({
        project_id: projectId,
        content: payload,
        status: PROCEDURE_STATUS.menungguReviewPM
      });

    if (error) throw new Error(error.message);
  }

  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
  await notifyUsersByRole({
    role: 'pm',
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
