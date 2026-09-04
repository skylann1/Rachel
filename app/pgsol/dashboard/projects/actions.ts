'use server';

import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { writeStageAssignment, PGSOL_STAGE_KEYS } from '@/lib/stage-assignments';
import { revalidatePath } from 'next/cache';

export async function getPgsolProjects() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id, name, status, created_at,
      vendor_profiles ( company_name ),
      procedures ( id, status ),
      jsa ( id, status )
    `)
    .order('created_at', { ascending: false });
  if (error) { console.error('getPgsolProjects error:', error.message); return []; }
  // Proyek relevan buat PGSOL begitu punya Prosedur Kerja ATAU JSA — bukan
  // cuma JSA lagi, karena tahap PGSOL sekarang juga ada di Prosedur Kerja.
  return (data || []).filter((p: any) => {
    const procRows = Array.isArray(p.procedures) ? p.procedures : (p.procedures ? [p.procedures] : []);
    const jsaRows = Array.isArray(p.jsa) ? p.jsa : (p.jsa ? [p.jsa] : []);
    return procRows.length > 0 || jsaRows.length > 0;
  });
}

export async function savePgsolAssignment(
  projectId: string, docType: 'procedure' | 'jsa', stageKey: string, assigneeIds: string[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // Satu permission menggerbangi kemampuan menugaskan reviewer PGSOL untuk
  // KEDUA doc_type (jsa & procedure) — sengaja tidak dipecah jadi permission
  // baru per doc_type supaya grant yang sudah ada di production (Fase 2)
  // tidak perlu dimigrasikan ulang. Lihat spec untuk keputusan ini.
  const allowed = await hasPermissionForUser(supabase, user.id, 'jsa', 'manage_assignment_pgsol');
  if (!allowed) return { error: 'Anda tidak memiliki izin untuk menunjuk reviewer PGSOL.' };

  if (!(PGSOL_STAGE_KEYS as readonly string[]).includes(stageKey)) {
    return { error: 'Tahap ini tidak dikenali.' };
  }

  // Permission saja tidak cukup: role `admin` (PGN) mendapat SELURUH permission
  // lewat fullAccessPermissions(), jadi tanpa cek tipe org ini admin PGN bisa
  // ikut muncul sebagai kandidat reviewer PGSOL.
  const { data: actorProfile } = await supabase.from('profiles').select('type').eq('id', user.id).single();
  if (actorProfile?.type !== 'pgsol') return { error: 'Aksi ini hanya untuk admin PGSOL.' };

  const result = await writeStageAssignment(supabase, user.id, {
    projectId, docType, stageKey, assigneeIds,
  });
  if (result.error) return { error: result.error };

  revalidatePath(`/pgsol/dashboard/projects/${projectId}/assign`);
  return { success: true };
}
