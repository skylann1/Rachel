"use server";

import { createClient } from "@/utils/supabase/server";
import { notifyAssignees } from "@/app/dashboard/inbox/actions";
import { APPROVED_JSA } from "@/lib/project-stage";
import { PTW_STATUS } from "@/lib/ptw-status";
import type { PtwFormDetails } from "@/lib/ptw-types";
import { logDocumentEvent } from "@/lib/document-logs";
import { resetStageAssignments } from "@/lib/stage-assignments";

/** Tanggal proyek, dipakai sebagai nilai awal masa berlaku PTW di form. */
export async function getProjectPeriod(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('projects')
    .select('start_date, end_date')
    .eq('id', projectId)
    .maybeSingle();
  return data;
}

export async function getPtw(projectId: string, ptwType: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('ptw')
    .select('*')
    .eq('project_id', projectId)
    .eq('ptw_type', ptwType)
    .maybeSingle();
  return data;
}

/** Semua PTW yang sudah diajukan untuk sebuah proyek, lintas tipe. */
export async function getPtwList(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('ptw')
    .select('*')
    .eq('project_id', projectId);
  return data ?? [];
}

export async function savePtw(
  projectId: string,
  workers: any[],
  equipment: any[],
  ptwType: string,
  hazards: string[],
  apd: Record<string, string[]>,
  gasTests: any[] = [],
  details: PtwFormDetails = {}
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: jsa } = await supabase
    .from('jsa')
    .select('status')
    .eq('project_id', projectId)
    .single();

  if (jsa?.status !== APPROVED_JSA) {
    throw new Error('JSA untuk proyek ini belum disetujui. PTW tidak dapat diajukan.');
  }

  const formDetails = {
    valid_from: details.validFrom || null,
    valid_to: details.validTo || null,
    work_start: details.workStart || null,
    work_end: details.workEnd || null,
    hot_work_types: details.hotWorkTypes ?? [],
    gas_test_frequency: details.gasTestFrequency ?? {},
  };

  const { data: existing } = await supabase
    .from('ptw')
    .select('id')
    .eq('project_id', projectId)
    .eq('ptw_type', ptwType)
    .maybeSingle();

  let ptwId = existing?.id;

  if (existing) {
    // .select() dipakai supaya update yang tidak mengenai baris (ditolak RLS,
    // atau PTW sudah lewat tahap yang boleh disunting vendor) ketahuan —
    // tanpa itu Postgres tidak mengembalikan error dan alur di bawah tetap
    // mencatat log "Diajukan Ulang" serta menotifikasi approver seolah sukses.
    const { data: updated, error } = await supabase
      .from('ptw')
      .update({
        workers,
        equipment,
        hazards,
        apd,
        gas_tests: gasTests,
        ...formDetails,
        status: PTW_STATUS.menungguApprovalPM,
        rejection_note: null
      })
      .eq('id', existing.id)
      .select('id');

    if (error) {
      console.error(error);
      throw new Error(error.message);
    }
    if (!updated || updated.length === 0) {
      throw new Error('PTW ini tidak dapat diubah lagi — kemungkinan sudah masuk tahap approval berikutnya.');
    }
  } else {
    const { data: created, error } = await supabase
      .from('ptw')
      .insert({
        project_id: projectId,
        workers,
        equipment,
        ptw_type: ptwType,
        hazards,
        apd,
        gas_tests: gasTests,
        ...formDetails,
        status: PTW_STATUS.menungguApprovalPM
      })
      .select('id')
      .single();

    if (error) {
      console.error(error);
      throw new Error(error.message);
    }
    ptwId = created?.id;
  }

  // PTW ini (baik tipe baru maupun pengajuan ulang) sekarang berada di tahap
  // `ptw.approve_pm` tanpa melewati rejectPtw, jadi baris stage_assignments
  // tahap itu bisa masih memuat keputusan dari ronde — atau dari tipe PTW —
  // sebelumnya. Tanpa reset ini approver tidak punya baris 'pending' untuk
  // ditindaklanjuti dan tahap macet permanen.
  //
  // KETERBATASAN YANG DIKETAHUI: stage_assignments belum menyimpan identitas
  // dokumen (hanya project_id + doc_type + stage_key), jadi dua PTW dengan
  // tipe berbeda pada satu proyek berbagi baris assignment yang sama. Reset di
  // sini benar untuk pengajuan yang berurutan, tapi kalau tipe kedua diajukan
  // saat tipe pertama MASIH mengambang di tahap yang sama, reset ini menghapus
  // keputusan yang sudah dibuat untuk tipe pertama. Perbaikan penuhnya butuh
  // perubahan skema (kolom identitas dokumen) — lihat catatan di
  // supabase/README_stage_assignment_migration_order.md.
  await resetStageAssignments(supabase, projectId, 'ptw', 'ptw.approve_pm');

  if (ptwId) {
    await logDocumentEvent(supabase, {
      docType: 'ptw', docId: ptwId, projectId, actorId: user?.id,
      action: existing ? `PTW Diajukan Ulang (${ptwType})` : `PTW Diajukan (${ptwType})`,
    });
  }

  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
  await notifyAssignees({
    projectId,
    docType: 'ptw',
    stageKey: 'ptw.approve_pm',
    type: 'action_required',
    title: 'PTW Menunggu Persetujuan',
    message: `PTW untuk proyek "${project?.name}" telah diajukan dan menunggu persetujuan Anda.`,
    link: `/dashboard/projects/${projectId}`,
  });
}
