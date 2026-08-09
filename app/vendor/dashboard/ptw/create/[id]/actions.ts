"use server";

import { createClient } from "@/utils/supabase/server";
import { notifyUsersByRole } from "@/app/dashboard/inbox/actions";
import { APPROVED_JSA } from "@/lib/project-stage";
import { PTW_STATUS } from "@/lib/ptw-status";
import type { PtwFormDetails } from "@/lib/ptw-types";

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
    const { error } = await supabase
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
