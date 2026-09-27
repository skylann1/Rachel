"use server";

import { createClient } from "@/utils/supabase/server";
import { getEffectivePtwStatus, PTW_STATUS } from "@/lib/ptw-status";
import type { PtwSafetyChecklistData } from "@/lib/ptw-types";

/**
 * Menyimpan seluruh objek safety_checklist (full overwrite, bukan merge —
 * client selalu mengirim state lengkap yang sudah dimuat + diedit, sama
 * seperti savePtw() menyimpan hazards/apd/gas_tests). Hanya boleh selama
 * PTW berstatus Aktif (status EFEKTIF — lihat getEffectivePtwStatus di
 * lib/ptw-status.ts; kolom `status` di tabel hanya di-flip ke 'Expired'
 * secara lazy di tempat lain, jadi PTW yang sudah lewat end_date-nya bisa
 * saja masih terbaca 'PTW Aktif' di sini).
 *
 * Penulisan sesungguhnya dilakukan lewat RPC update_ptw_safety_checklist
 * (lihat supabase/schema_ptw_safety_checklist_fix.sql), bukan .update()
 * langsung ke tabel — fungsi itu SECURITY DEFINER dan mengecek ulang
 * status + kepemilikan di layer DB (defense in depth), lalu benar-benar
 * RAISE EXCEPTION kalau ditolak. Jadi walau pre-check di bawah ini
 * ketinggalan zaman/dilewati, RPC tetap mengembalikan error yang jelas
 * ketimbang UPDATE yang diam-diam tidak mengenai baris (seperti yang bisa
 * terjadi dengan RLS + .update() tanpa .select()).
 */
export async function updatePtwSafetyChecklist(
  ptwId: string,
  checklist: PtwSafetyChecklistData
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: ptw, error: fetchError } = await supabase
    .from('ptw')
    .select('status, valid_to, project_id, projects ( end_date )')
    .eq('id', ptwId)
    .maybeSingle();

  if (fetchError || !ptw) {
    return { error: 'PTW tidak ditemukan.' };
  }

  const project = Array.isArray((ptw as any).projects) ? (ptw as any).projects[0] : (ptw as any).projects;
  const effectiveStatus = getEffectivePtwStatus(ptw.status, ptw.valid_to ?? project?.end_date);
  if (effectiveStatus !== PTW_STATUS.aktif) {
    return { error: 'Safety checklist hanya bisa diisi selama PTW berstatus Aktif.' };
  }

  const { error } = await supabase.rpc('update_ptw_safety_checklist', {
    p_ptw_id: ptwId,
    p_checklist: checklist,
  });

  if (error) {
    return { error: error.message };
  }
  return {};
}
