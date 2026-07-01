"use server";

import { createClient } from "@/utils/supabase/server";

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
      .update({ content: payload })
      .eq('id', existing.id);
      
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('procedures')
      .insert({
        project_id: projectId,
        content: payload,
        status: 'Draft'
      });
      
    if (error) throw new Error(error.message);
  }
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
