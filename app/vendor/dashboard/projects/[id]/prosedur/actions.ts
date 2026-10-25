"use server";

import { createClient } from "@/utils/supabase/server";
import { notifyAssignees } from "@/app/dashboard/inbox/actions";
import { PROCEDURE_STATUS } from "@/lib/procedure-status";
import { logDocumentEvent } from "@/lib/document-logs";
import { resetStageAssignments, getStageAssignments } from "@/lib/stage-assignments";
import { syncFromProcedure, clearReviewFlag } from "@/lib/doc-sync";
import { diffProsedurContent, summarizeChanges, readChangeLog, type ChangeLogEntry } from "@/lib/prosedur-diff";

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
    .select('id, content')
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

    // Reviewer yang sedang ditugaskan menilai lewat Setujui/Tolak, bukan
    // mengajukan ulang (resubmit mereset penugasan tahap review).
    if (user) {
      for (const stageKey of ['procedure.hse_vendor', 'procedure.review_vendor']) {
        const rows = await getStageAssignments(supabase, projectId, 'procedure', stageKey);
        if (rows.some(r => r.assignee_id === user.id && r.status === 'pending')) {
          throw new Error('Anda ditugaskan sebagai reviewer dokumen ini. Gunakan Setujui / Tolak, bukan mengajukan ulang.');
        }
      }
    }
    const resubmittable = [PROCEDURE_STATUS.draft, PROCEDURE_STATUS.reviewHseVendor, PROCEDURE_STATUS.reviewPmVendor];
    if (!resubmittable.includes(current.status)) {
      throw new Error('Prosedur Kerja tidak bisa diajukan ulang karena sudah berjalan ke tahap berikutnya.');
    }

    // Jejak perubahan: bandingkan isi pengajuan ulang dengan versi sebelumnya
    // dan pertahankan changeLog lama (payload form tidak membawanya).
    const previousLog = readChangeLog(existing.content);
    const changes = diffProsedurContent(existing.content, payload);
    let changeLog = previousLog;
    if (changes.length > 0) {
      const { data: me } = user
        ? await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
        : { data: null };
      const entry: ChangeLogEntry = {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        actorId: user?.id ?? null,
        actorName: me?.full_name || 'Vendor',
        actorLabel: 'Vendor (pengajuan ulang)',
        summary: summarizeChanges(changes),
        note: null,
        changes,
      };
      changeLog = [...previousLog, entry];
    }

    const { data: updated, error } = await supabase
      .from('procedures')
      .update({ content: { ...payload, changeLog }, status: PROCEDURE_STATUS.reviewHseVendor })
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
        status: PROCEDURE_STATUS.reviewHseVendor
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
  await resetStageAssignments(supabase, projectId, 'procedure', 'procedure.hse_vendor');
  await resetStageAssignments(supabase, projectId, 'procedure', 'procedure.review_vendor');

  // Pengajuan ulang: penanda "perlu review ulang" dibersihkan, dan perubahan isi
  // mengalir ke JSA / PTW yang sudah dibuat paralel.
  if (procedureId) await clearReviewFlag('procedure', procedureId);
  if (existing) await syncFromProcedure(projectId, existing.content, payload, user?.id ?? null);

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
    stageKey: 'procedure.hse_vendor',
    type: 'action_required',
    title: 'Prosedur Kerja Menunggu Review HSE Vendor',
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
    .select('name, location, contract_number, vendor_profiles ( company_name )')
    .eq('id', projectId)
    .maybeSingle();

  return { ...data, project: project || null };
}
