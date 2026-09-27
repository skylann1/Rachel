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
  const [
    procReviewCandidates, procReviewAssignments, procHseCandidates, procHseAssignments,
    jsaReviewCandidates, jsaReviewAssignments, jsaHseCandidates, jsaHseAssignments,
    ptwReviewCandidates, ptwReviewAssignments, ptwHseCandidates, ptwHseAssignments,
  ] = await Promise.all([
    // Dibatasi ke org PGSOL milik admin ini — tanpa itu admin PGN (yang
    // memegang semua permission) ikut muncul sebagai kandidat reviewer.
    getEligibleAssignees(supabase, 'procedure', 'review_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'procedure', 'procedure.review_pgsol'),
    getEligibleAssignees(supabase, 'procedure', 'hse_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'procedure', 'procedure.hse_pgsol'),
    getEligibleAssignees(supabase, 'jsa', 'review_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'jsa', 'jsa.review_pgsol'),
    getEligibleAssignees(supabase, 'jsa', 'hse_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'jsa', 'jsa.hse_pgsol'),
    getEligibleAssignees(supabase, 'ptw', 'review_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'ptw', 'ptw.review_pgsol'),
    getEligibleAssignees(supabase, 'ptw', 'hse_pgsol', actorProfile.org_id),
    getStageAssignments(supabase, projectId, 'ptw', 'ptw.hse_pgsol'),
  ]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/pgsol/dashboard/projects" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reviewer & HSE PGSOL — {project?.name}</h1>
          <p className="text-sm text-slate-500 mt-1">Reviewer dan HSE adalah dua tahap berurutan — semua yang ditunjuk di satu tahap harus menyetujui sebelum dokumen lanjut.</p>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">Prosedur Kerja</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Reviewer</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="procedure"
              stageKey="procedure.review_pgsol"
              candidates={procReviewCandidates}
              currentAssigneeIds={procReviewAssignments.map(a => a.assignee_id)}
              locked={procReviewAssignments.some(a => a.status !== 'pending')}
            />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">HSE</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="procedure"
              stageKey="procedure.hse_pgsol"
              candidates={procHseCandidates}
              currentAssigneeIds={procHseAssignments.map(a => a.assignee_id)}
              locked={procHseAssignments.some(a => a.status !== 'pending')}
            />
          </div>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">JSA</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Reviewer</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="jsa"
              stageKey="jsa.review_pgsol"
              candidates={jsaReviewCandidates}
              currentAssigneeIds={jsaReviewAssignments.map(a => a.assignee_id)}
              locked={jsaReviewAssignments.some(a => a.status !== 'pending')}
            />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">HSE</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="jsa"
              stageKey="jsa.hse_pgsol"
              candidates={jsaHseCandidates}
              currentAssigneeIds={jsaHseAssignments.map(a => a.assignee_id)}
              locked={jsaHseAssignments.some(a => a.status !== 'pending')}
            />
          </div>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">PTW (Permit to Work)</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Reviewer</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="ptw"
              stageKey="ptw.review_pgsol"
              candidates={ptwReviewCandidates}
              currentAssigneeIds={ptwReviewAssignments.map(a => a.assignee_id)}
              locked={ptwReviewAssignments.some(a => a.status !== 'pending')}
            />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">HSE</p>
            <AssignPgsolPanel
              projectId={projectId}
              docType="ptw"
              stageKey="ptw.hse_pgsol"
              candidates={ptwHseCandidates}
              currentAssigneeIds={ptwHseAssignments.map(a => a.assignee_id)}
              locked={ptwHseAssignments.some(a => a.status !== 'pending')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
