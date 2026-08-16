"use server";

import { createClient } from "@/utils/supabase/server";
import { notifyUsersByPermission } from "@/app/dashboard/inbox/actions";
import { APPROVED_JSA } from "@/lib/project-stage";
import { PTW_STATUS, PTW_STAGE_PERMISSION } from "@/lib/ptw-status";
import type { PtwFormDetails } from "@/lib/ptw-types";
import { logDocumentEvent } from "@/lib/document-logs";

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
    const { error } = await supabase
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
      .eq('id', existing.id);

    if (error) {
      console.error(error);
      throw new Error(error.message);
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

  if (ptwId) {
    await logDocumentEvent(supabase, {
      docType: 'ptw', docId: ptwId, projectId, actorId: user?.id,
      action: existing ? `PTW Diajukan Ulang (${ptwType})` : `PTW Diajukan (${ptwType})`,
    });
  }

  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
  await notifyUsersByPermission({
    ...PTW_STAGE_PERMISSION[PTW_STATUS.menungguApprovalPM],
    type: 'action_required',
    title: 'PTW Menunggu Persetujuan',
    message: `PTW untuk proyek "${project?.name}" telah diajukan dan menunggu persetujuan Anda.`,
    link: `/dashboard/projects/${projectId}`,
  });
}
