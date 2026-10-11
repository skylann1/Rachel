import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { hasPermission } from '@/utils/permissions';
import { getStageAssignments, getEligibleAssignees } from '@/lib/stage-assignments';
import AssignPgsolForm, { type AssignGroup, type AssignStage } from './AssignPgsolForm';

const DOC_TYPES = [
  { docType: 'procedure', title: 'Prosedur Kerja' },
  { docType: 'jsa', title: 'JSA' },
  { docType: 'ptw', title: 'PTW (Permit to Work)' },
] as const;

// Urutan = urutan tahap: HSE PGSOL dulu, baru PM PGSOL (stage_key lama
// `review_pgsol` dipertahankan untuk PM PGSOL, lihat lib/jsa-status.ts).
const ROLES = [
  { role: 'HSE', suffix: 'hse_pgsol' },
  { role: 'PM PGSOL', suffix: 'review_pgsol' },
] as const;

export default async function ProjectPgsolAssignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  if (!(await hasPermission('jsa', 'manage_assignment_pgsol'))) redirect('/dashboard');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: actorProfile } = await supabase.from('profiles').select('org_id').eq('id', user?.id).single();
  if (!actorProfile?.org_id) redirect('/dashboard');
  const orgId = actorProfile.org_id;

  const { data: project } = await supabase.from('projects').select('id, name').eq('id', projectId).single();

  const groups: AssignGroup[] = await Promise.all(
    DOC_TYPES.map(async ({ docType, title }) => {
      const stages: AssignStage[] = await Promise.all(
        ROLES.map(async ({ role, suffix }) => {
          const stageKey = `${docType}.${suffix}`;
          const [candidates, assignments] = await Promise.all([
            getEligibleAssignees(supabase, docType, suffix, orgId),
            getStageAssignments(supabase, projectId, docType, stageKey),
          ]);
          return {
            stageKey,
            role,
            candidates,
            currentIds: assignments.map(a => a.assignee_id),
            locked: assignments.some(a => a.status !== 'pending'),
          };
        }),
      );
      return { docType, title, stages };
    }),
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start gap-4">
        <Link href="/dashboard/master-data/project-pgsol-assign" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">HSE & PM PGSOL</h1>
          <p className="text-sm font-semibold text-primary mt-0.5">{project?.name}</p>
          <p className="text-sm text-slate-500 mt-1">
            HSE PGSOL lalu PM PGSOL adalah dua tahap berurutan — semua yang ditunjuk di satu tahap harus menyetujui sebelum dokumen lanjut.
          </p>
        </div>
      </div>
      <AssignPgsolForm projectId={projectId} groups={groups} />
    </div>
  );
}
