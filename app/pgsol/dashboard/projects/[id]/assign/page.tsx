import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { hasPermission } from '@/utils/permissions';
import { getStageAssignments, getEligibleAssignees } from '@/lib/stage-assignments';
import AssignPgsolPanel from './AssignPgsolPanel';

export default async function PgsolAssignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  // Gerbang yang sama dengan savePgsolAssignment — pgsol_reviewer biasa tidak
  // boleh membuka layar penunjukan sama sekali (mengikuti pola halaman
  // /pgsol/dashboard/staff).
  if (!(await hasPermission('jsa', 'manage_assignment_pgsol'))) redirect('/pgsol/dashboard');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: actorProfile } = await supabase.from('profiles').select('org_id').eq('id', user?.id).single();
  if (!actorProfile?.org_id) redirect('/pgsol/dashboard');

  const { data: project } = await supabase.from('projects').select('id, name').eq('id', projectId).single();
  const [procCandidates, procAssignments, jsaCandidates, jsaAssignments] = await Promise.all([
    // Dibatasi ke org PGSOL milik admin ini — tanpa itu admin PGN (yang
    // memegang semua permission) ikut muncul sebagai kandidat reviewer.
    getEligibleAssignees(supabase, 'procedure', 'review_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'procedure', 'procedure.review_pgsol'),
    getEligibleAssignees(supabase, 'jsa', 'review_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'jsa', 'jsa.review_pgsol'),
  ]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/pgsol/dashboard/projects" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reviewer PGSOL — {project?.name}</h1>
          <p className="text-sm text-slate-500 mt-1">Semua yang ditunjuk di sini harus menyetujui sebelum dokumen lanjut ke tahap berikutnya.</p>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">Prosedur Kerja</h2>
        <AssignPgsolPanel
          projectId={projectId}
          docType="procedure"
          stageKey="procedure.review_pgsol"
          candidates={procCandidates}
          currentAssigneeIds={procAssignments.map(a => a.assignee_id)}
          locked={procAssignments.some(a => a.status !== 'pending')}
        />
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">JSA</h2>
        <AssignPgsolPanel
          projectId={projectId}
          docType="jsa"
          stageKey="jsa.review_pgsol"
          candidates={jsaCandidates}
          currentAssigneeIds={jsaAssignments.map(a => a.assignee_id)}
          locked={jsaAssignments.some(a => a.status !== 'pending')}
        />
      </div>
    </div>
  );
}
