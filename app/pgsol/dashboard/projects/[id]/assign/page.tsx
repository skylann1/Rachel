import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { getStageAssignments, getEligibleAssignees } from '@/lib/stage-assignments';
import AssignPgsolPanel from './AssignPgsolPanel';

export default async function PgsolAssignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase.from('projects').select('id, name').eq('id', projectId).single();
  const [candidates, assignments] = await Promise.all([
    getEligibleAssignees(supabase, 'jsa', 'review_pgsol'),
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
          <p className="text-sm text-slate-500 mt-1">Semua yang ditunjuk di sini harus menyetujui sebelum JSA lanjut ke tahap PGN.</p>
        </div>
      </div>
      <AssignPgsolPanel
        projectId={projectId}
        candidates={candidates}
        currentAssigneeIds={assignments.map(a => a.assignee_id)}
        locked={assignments.some(a => a.status !== 'pending')}
      />
    </div>
  );
}
