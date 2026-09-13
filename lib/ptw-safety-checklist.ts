"use server";

import { createClient } from "@/utils/supabase/server";
import { PTW_STATUS } from "@/lib/ptw-status";
import type { PtwSafetyChecklistData } from "@/lib/ptw-types";

/**
 * Menyimpan seluruh objek safety_checklist (full overwrite, bukan merge —
 * client selalu mengirim state lengkap yang sudah dimuat + diedit, sama
 * seperti savePtw() menyimpan hazards/apd/gas_tests). Hanya boleh selama
 * PTW berstatus Aktif; RLS (lihat schema_ptw_safety_checklist.sql) sudah
 * membatasi ini untuk vendor, tapi dicek ulang di sini supaya errornya
 * jelas ketimbang UPDATE yang diam-diam tidak mengenai baris.
 */
export async function updatePtwSafetyChecklist(
  ptwId: string,
  checklist: PtwSafetyChecklistData
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: ptw, error: fetchError } = await supabase
    .from('ptw')
    .select('status')
    .eq('id', ptwId)
    .maybeSingle();

  if (fetchError || !ptw) {
    return { error: 'PTW tidak ditemukan.' };
  }
  if (ptw.status !== PTW_STATUS.aktif) {
    return { error: 'Safety checklist hanya bisa diisi selama PTW berstatus Aktif.' };
  }

  const { error } = await supabase
    .from('ptw')
    .update({ safety_checklist: checklist })
    .eq('id', ptwId);

  if (error) {
    return { error: error.message };
  }
  return {};
}
