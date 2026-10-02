"use server";

import { createClient } from "@/utils/supabase/server";
import { notifyAssignees } from "@/app/dashboard/inbox/actions";
import { PROCEDURE_STATUS } from "@/lib/procedure-status";
import { logDocumentEvent } from "@/lib/document-logs";
import { resetStageAssignments } from "@/lib/stage-assignments";

export async function saveProsedur(projectId: string, payload: any) {
  // "Jenis PTW yang Dibutuhkan" wajib minimal 1 — sebelumnya cuma dicek di
  // client (form page.tsx), jadi bisa dilewati lewat panggilan langsung ke
  // Server Action ini (atau bundle lama yang belum punya field ini sama
  // sekali). Ditegakkan di sini juga supaya invariant-nya beneran berlaku.
  if (!Array.isArray(payload?.requiredPtwTypes) || payload.requiredPtwTypes.length === 0) {
    throw new Error('Pilih minimal satu jenis PTW yang dibutuhkan untuk pekerjaan ini.');
  }

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
    // Guard status: dokumen yang sudah berjalan melewati tahap review
    // internal vendor (misal sudah Disetujui) tidak boleh diajukan ulang.
    // Kalau dibiarkan, resubmit akan mereset stage_assignments yang sudah
    // 'approved' -- dan writeStageAssignment menolak menyunting baris itu,
    // sehingga ronde baru macet permanen tanpa jalan keluar selain SQL manual.
    const { data: current } = await supabase
      .from('procedures')
      .select('status')
      .eq('id', existing.id)
      .single();
    if (!current) throw new Error('Prosedur Kerja tidak ditemukan.');
    const resubmittable = [PROCEDURE_STATUS.draft, PROCEDURE_STATUS.reviewInternalVendor];
    if (!resubmittable.includes(current.status)) {
      throw new Error('Prosedur Kerja tidak bisa diajukan ulang karena sudah berjalan ke tahap berikutnya.');
    }

    const { data: updated, error } = await supabase
      .from('procedures')
      .update({ content: payload, status: PROCEDURE_STATUS.reviewInternalVendor })
      .eq('id', existing.id)
      .eq('status', current.status)
      .select('id');

    if (error) throw new Error(error.message);
    if (!updated || updated.length === 0) {
      throw new Error('Prosedur Kerja baru saja diproses oleh pengguna lain. Muat ulang halaman untuk melihat status terbaru.');
    }
  } else {
    const { data: created, error } = await supabase
      .from('procedures')
      .insert({
        project_id: projectId,
        content: payload,
        status: PROCEDURE_STATUS.reviewInternalVendor
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    procedureId = created?.id;
  }

  // Dokumen ini baru saja (kembali) masuk tahap `procedure.review_vendor`,
  // tapi jalur ini BUKAN lewat rejectVendorInternalReview — jadi baris
  // stage_assignments tahap itu bisa saja masih menyimpan keputusan ronde
  // sebelumnya. writeStageAssignment menolak menyunting baris non-'pending'
  // dan reviewer tidak punya baris 'pending' untuk ditindaklanjuti, sehingga
  // ronde baru macet permanen tanpa reset ini.
  await resetStageAssignments(supabase, projectId, 'procedure', 'procedure.review_vendor');

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
    stageKey: 'procedure.review_vendor',
    type: 'action_required',
    title: 'Prosedur Kerja Menunggu Review Internal',
    message: `Prosedur kerja untuk proyek "${project?.name}" telah diajukan dan menunggu review internal Anda sebelum diteruskan ke PM.`,
    link: `/vendor/dashboard/projects/${projectId}/prosedur`,
  });
}

export async function getProsedur(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('procedures')
    .select('id, content, status')
    .eq('project_id', projectId)
    .single();
    
  if (error && error.code !== 'PGRST116') {
    console.error(error);
  }

  const { data: project } = await supabase
    .from('projects')
    .select('name, location, contract_number')
    .eq('id', projectId)
    .maybeSingle();

  return { ...data, project: project || null };
}
