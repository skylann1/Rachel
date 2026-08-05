"use server";

import { createClient } from "@/utils/supabase/server";
import { notifyUsersByRole } from "@/app/dashboard/inbox/actions";

export async function getPtw(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('ptw')
    .select('*')
    .eq('project_id', projectId)
    .single();
  return data;
}

export async function savePtw(projectId: string, workers: any[], equipment: any[]) {
  const supabase = await createClient();
  
  const { data: existing } = await supabase
    .from('ptw')
    .select('id')
    .eq('project_id', projectId)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('ptw')
      .update({
        workers,
        equipment,
        status: 'Menunggu Approval PM'
      })
      .eq('id', existing.id);
      
    if (error) {
      console.error(error);
      throw new Error(error.message);
    }
  } else {
    const { error } = await supabase
      .from('ptw')
      .insert({
        project_id: projectId,
        workers,
        equipment,
        status: 'Menunggu Approval PM'
      });
      
    if (error) {
      console.error(error);
      throw new Error(error.message);
    }
  }

  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
  await notifyUsersByRole({
    role: 'ptw_authority',
    type: 'action_required',
    title: 'PTW Menunggu Persetujuan',
    message: `PTW untuk proyek "${project?.name}" telah diajukan dan menunggu persetujuan Anda.`,
    link: `/dashboard/projects/${projectId}`,
  });
}
