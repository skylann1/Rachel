"use server";

import { createClient } from "@/utils/supabase/server";

export async function saveJsa(projectId: string, jsaData: any) {
  const supabase = await createClient();
  
  // check if JSA already exists
  const { data: existing } = await supabase
    .from('jsa')
    .select('id')
    .eq('project_id', projectId)
    .single();

  let jsaId = existing?.id;

  if (!jsaId) {
    const { data: newJsa, error } = await supabase
      .from('jsa')
      .insert({
        project_id: projectId,
        status: 'Draft'
      })
      .select('id')
      .single();
      
    if (error) throw new Error(error.message);
    jsaId = newJsa.id;
  }

  // Delete existing steps
  await supabase.from('jsa_steps').delete().eq('jsa_id', jsaId);

  // Insert new steps
  if (jsaData.steps && jsaData.steps.length > 0) {
    const stepsToInsert = jsaData.steps.map((step: any, index: number) => ({
      jsa_id: jsaId,
      step_number: index + 1,
      description: step.pekerjaan,
      hazards: JSON.stringify(step.bahaya),
      risks: JSON.stringify(step.risiko),
      controls: JSON.stringify(step.mitigasi),
    }));

    const { error: stepError } = await supabase.from('jsa_steps').insert(stepsToInsert);
    if (stepError) throw new Error(stepError.message);
  }
}

export async function getJsa(projectId: string) {
  const supabase = await createClient();
  const { data: jsa, error } = await supabase
    .from('jsa')
    .select('id, status')
    .eq('project_id', projectId)
    .single();
    
  if (error && error.code !== 'PGRST116') {
    console.error(error);
    return null;
  }
  
  if (jsa) {
    const { data: steps } = await supabase
      .from('jsa_steps')
      .select('*')
      .eq('jsa_id', jsa.id)
      .order('step_number', { ascending: true });
      
    return {
      jsa,
      steps: steps || []
    };
  }
  
  return null;
}
