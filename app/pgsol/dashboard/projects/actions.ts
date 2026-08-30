'use server';

import { createClient } from '@/utils/supabase/server';
import { hasPermissionForUser } from '@/utils/permissions';
import { writeStageAssignment } from '@/lib/stage-assignments';
import { revalidatePath } from 'next/cache';

export async function getPgsolProjects() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id, name, status, created_at,
      vendor_profiles ( company_name ),
      jsa ( id, status )
    `)
    .order('created_at', { ascending: false });
  if (error) { console.error('getPgsolProjects error:', error.message); return []; }
  // Hanya proyek yang sudah punya JSA (tahap PGSOL baru relevan sejak JSA diajukan).
  return (data || []).filter((p: any) => {
    const jsaRows = Array.isArray(p.jsa) ? p.jsa : (p.jsa ? [p.jsa] : []);
    return jsaRows.length > 0;
  });
}

export async function savePgsolAssignment(projectId: string, assigneeIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const allowed = await hasPermissionForUser(supabase, user.id, 'jsa', 'manage_assignment_pgsol');
  if (!allowed) return { error: 'Anda tidak memiliki izin untuk menunjuk reviewer PGSOL.' };

  // Permission saja tidak cukup: role `admin` (PGN) mendapat SELURUH permission
  // lewat fullAccessPermissions(), jadi tanpa cek tipe org ini admin PGN bisa
  // ikut menunjuk reviewer tahap PGSOL. Slot jsa.review_pgsol adalah wewenang
  // PGSOL sendiri (lihat spec Fase 2, "Admin Assignment UI").
  const { data: actorProfile } = await supabase.from('profiles').select('type').eq('id', user.id).single();
  if (actorProfile?.type !== 'pgsol') return { error: 'Aksi ini hanya untuk admin PGSOL.' };

  const result = await writeStageAssignment(supabase, user.id, {
    projectId, docType: 'jsa', stageKey: 'jsa.review_pgsol', assigneeIds,
  });
  if (result.error) return { error: result.error };

  revalidatePath(`/pgsol/dashboard/projects/${projectId}/assign`);
  return { success: true };
}
