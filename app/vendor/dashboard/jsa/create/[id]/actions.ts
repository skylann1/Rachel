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
        status: 'Pembahasan JSA'
      })
      .select('id')
      .single();
      
    if (error) throw new Error(error.message);
    jsaId = newJsa.id;
  } else {
    await supabase.from('jsa').update({ status: 'Pembahasan JSA' }).eq('id', jsaId);
  }

  // Delete existing steps
  await supabase.from('jsa_steps').delete().eq('jsa_id', jsaId);

  // Insert new steps
  if (jsaData.steps && jsaData.steps.length > 0) {
    const stepsToInsert = jsaData.steps.map((step: any, index: number) => ({
      jsa_id: jsaId,
      step_number: index + 1,
      description: step.langkah,
      hazards: JSON.stringify({
        jenisBahaya: step.jenisBahaya,
        sebab: step.sebab,
        potensiBahaya: step.potensiBahaya
      }),
      risks: JSON.stringify({
        faktorPositif: step.faktorPositif,
        inherentRisk: step.inherentRisk
      }),
      controls: JSON.stringify({
        mitigasi: step.mitigasi,
        residualRisk: step.residualRisk
      }),
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
    
  // Fetch procedure to extract default steps
  const { data: proc } = await supabase
    .from('procedures')
    .select('content')
    .eq('project_id', projectId)
    .single();
    
  let procedureSteps: string[] = [];
  if (proc?.content?.tahapanPekerjaan) {
    proc.content.tahapanPekerjaan.forEach((section: any) => {
      procedureSteps.push(...(section.points || []));
    });
  }
    
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
      steps: steps || [],
      procedureSteps
    };
  }
  
  return { jsa: null, steps: [], procedureSteps };
}
