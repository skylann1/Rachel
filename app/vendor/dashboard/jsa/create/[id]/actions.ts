"use server";

import { createClient } from "@/utils/supabase/server";
import { notifyUsersByPermission } from "@/app/dashboard/inbox/actions";
import { JSA_STATUS, JSA_STAGE_PERMISSION } from "@/lib/jsa-status";
import { APPROVED_PROCEDURE } from "@/lib/project-stage";
import { logDocumentEvent } from "@/lib/document-logs";

export async function saveJsa(projectId: string, jsaData: any) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: procedure } = await supabase
    .from('procedures')
    .select('status')
    .eq('project_id', projectId)
    .single();

  if (procedure?.status !== APPROVED_PROCEDURE) {
    throw new Error('Prosedur Kerja untuk proyek ini belum disetujui. JSA tidak dapat diajukan.');
  }

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
        status: JSA_STATUS.reviewPgsol
      })
      .select('id')
      .single();
      
    if (error) throw new Error(error.message);
    jsaId = newJsa.id;
  } else {
    await supabase.from('jsa').update({ status: JSA_STATUS.reviewPgsol, rejection_note: null }).eq('id', jsaId);
  }

  // Delete existing steps
  await supabase.from('jsa_steps').delete().eq('jsa_id', jsaId);

  // Insert new steps
  if (jsaData.steps && jsaData.steps.length > 0) {
    const stepsToInsert = jsaData.steps.map((step: any, index: number) => ({
      jsa_id: jsaId,
      step_number: index + 1,
      pekerjaan: step.langkah,
      bahaya: JSON.stringify({
        jenisBahaya: step.jenisBahaya,
        sebab: step.sebab,
        potensiBahaya: step.potensiBahaya
      }),
      risiko: JSON.stringify({
        faktorPositif: step.faktorPositif,
        inherentRisk: step.inherentRisk
      }),
      tindakan: JSON.stringify({
        mitigasi: step.mitigasi,
        residualRisk: step.residualRisk
      }),
    }));

    const { error: stepError } = await supabase.from('jsa_steps').insert(stepsToInsert);
    if (stepError) throw new Error(stepError.message);
  }

  await logDocumentEvent(supabase, {
    docType: 'jsa', docId: jsaId, projectId, actorId: user?.id,
    action: existing ? 'JSA Diajukan Ulang' : 'JSA Diajukan',
  });

  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
  await notifyUsersByPermission({
    ...JSA_STAGE_PERMISSION[JSA_STATUS.reviewPgsol],
    type: 'action_required',
    title: 'JSA Menunggu Review PGSOL',
    message: `JSA untuk proyek "${project?.name}" telah diajukan dan menunggu review Anda.`,
    link: `/dashboard/projects/${projectId}`,
  });
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
      if (section.title) {
        procedureSteps.push(section.title);
      }
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
