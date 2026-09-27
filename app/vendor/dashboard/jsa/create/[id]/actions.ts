"use server";

import { createClient } from "@/utils/supabase/server";
import { notifyAssignees } from "@/app/dashboard/inbox/actions";
import { JSA_STATUS } from "@/lib/jsa-status";
import { APPROVED_PROCEDURE } from "@/lib/project-stage";
import { logDocumentEvent } from "@/lib/document-logs";
import { resetStageAssignments } from "@/lib/stage-assignments";
import { normalizeTahapanPekerjaan, TahapanSection } from "@/lib/procedure-kebutuhan";

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
        status: JSA_STATUS.reviewInternalVendor
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    jsaId = newJsa.id;
  } else {
    // Guard status: JSA yang sudah berjalan melewati tahap review internal
    // vendor (misal sudah Disetujui) tidak boleh diajukan ulang. Kalau
    // dibiarkan, resubmit mereset stage_assignments yang sudah 'approved',
    // dan writeStageAssignment menolak menyunting baris itu -- ronde baru
    // macet permanen tanpa jalan keluar selain SQL manual.
    const { data: current } = await supabase
      .from('jsa')
      .select('status')
      .eq('id', jsaId)
      .single();
    if (!current) throw new Error('JSA tidak ditemukan.');
    const resubmittable = [JSA_STATUS.draft, JSA_STATUS.reviewInternalVendor];
    if (!resubmittable.includes(current.status)) {
      throw new Error('JSA tidak bisa diajukan ulang karena sudah berjalan ke tahap berikutnya.');
    }

    const { data: updated, error } = await supabase
      .from('jsa')
      .update({ status: JSA_STATUS.reviewInternalVendor, rejection_note: null })
      .eq('id', jsaId)
      .eq('status', current.status)
      .select('id');
    if (error) throw new Error(error.message);
    if (!updated || updated.length === 0) {
      throw new Error('JSA baru saja diproses oleh pengguna lain. Muat ulang halaman untuk melihat status terbaru.');
    }
  }

  // JSA (kembali) berada di tahap `jsa.review_vendor` tanpa melewati
  // rejectVendorInternalReview, jadi baris stage_assignments tahap itu bisa
  // masih memuat keputusan ronde sebelumnya. Tanpa reset ini reviewer
  // internal vendor tidak punya baris 'pending' untuk ditindaklanjuti dan
  // admin pun tidak bisa mengganti assignee (writeStageAssignment menolak
  // menyunting baris non-'pending').
  // `jsa.review_pgsol` sengaja TIDAK direset di sini — tahap itu memang
  // belum dimulai untuk ronde ini (baru dimulai kalau review internal
  // vendor selesai, lihat approveVendorInternalReview).
  await resetStageAssignments(supabase, projectId, 'jsa', 'jsa.review_vendor');

  // Delete existing steps
  await supabase.from('jsa_steps').delete().eq('jsa_id', jsaId);

  // Insert new steps
  if (jsaData.steps && jsaData.steps.length > 0) {
    const stepsToInsert = jsaData.steps.map((step: any, index: number) => ({
      jsa_id: jsaId,
      step_number: index + 1,
      pekerjaan: step.langkah,
      kebutuhan: step.kebutuhan ?? {},
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
  await notifyAssignees({
    projectId,
    docType: 'jsa',
    stageKey: 'jsa.review_vendor',
    type: 'action_required',
    title: 'JSA Menunggu Review Internal',
    message: `JSA untuk proyek "${project?.name}" telah diajukan dan menunggu review internal Anda sebelum diteruskan ke PGSOL.`,
    link: `/vendor/dashboard/jsa/create/${projectId}`,
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
    
  const procedureSteps: string[] = [];
  let procedureSections: TahapanSection[] = [];
  if (proc?.content?.tahapanPekerjaan) {
    procedureSections = normalizeTahapanPekerjaan(proc.content.tahapanPekerjaan);
    procedureSections.forEach((section: TahapanSection) => {
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

    const { data: project } = await supabase
      .from('projects')
      .select('name, contract_number, location, vendor_id')
      .eq('id', projectId)
      .maybeSingle();

    let companyName: string | null = null;
    if (project?.vendor_id) {
      const { data: vp } = await supabase
        .from('vendor_profiles')
        .select('company_name')
        .eq('id', project.vendor_id)
        .single();
      companyName = vp?.company_name || null;
    }

    return {
      jsa,
      steps: steps || [],
      procedureSteps,
      procedureSections,
      project: project
        ? { name: project.name, contract_number: project.contract_number, location: project.location, companyName }
        : null,
    };
  }

  return { jsa: null, steps: [], procedureSteps, procedureSections, project: null };
}
