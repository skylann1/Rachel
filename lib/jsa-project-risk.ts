import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';
import { logActivity } from '@/lib/activity-log';
import { parseRiskLevel, riskLevelFromRpn } from '@/lib/project-risk';

/**
 * Kategori Risiko Proyek yang dipilih saat membuat proyek hanyalah perkiraan.
 * Begitu JSA terisi, kategori disesuaikan dengan Inherent Risk (RPN) tertinggi
 * di JSA. Dipanggil saat JSA diajukan dan saat reviewer mengubah langkah JSA.
 * Memakai admin client karena vendor/reviewer tidak punya hak ubah projects.
 */
export async function syncProjectRiskFromJsa(
  supabase: any,
  projectId: string,
  steps: { inherentRisk?: { rpn?: number } | null }[],
  actorId?: string | null,
) {
  const rpns = steps.map((s) => Number(s?.inherentRisk?.rpn)).filter((n) => Number.isFinite(n));
  if (rpns.length === 0) return;
  const next = riskLevelFromRpn(Math.max(...rpns));

  const admin = createAdminClient();
  const { data: project } = await admin.from('projects').select('name, risk_level').eq('id', projectId).maybeSingle();
  if (!project) return;
  const prev = parseRiskLevel(project.risk_level);
  if (prev === next) return;

  const { error } = await admin.from('projects').update({ risk_level: next }).eq('id', projectId);
  if (error) { console.error('syncProjectRiskFromJsa error:', error.message); return; }

  if (actorId) {
    await logActivity(supabase, {
      actorId, action: 'Kategori risiko proyek disesuaikan dari JSA', entityType: 'project', entityId: projectId,
      notes: `${project.name}: ${prev ?? 'belum diatur'} → ${next}`,
    });
  }
  revalidatePath('/dashboard/master-data/project');
  revalidatePath(`/dashboard/master-data/project/${projectId}`);
  revalidatePath('/vendor/dashboard/projects');
  revalidatePath('/dashboard/my-projects');
}
