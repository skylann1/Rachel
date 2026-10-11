import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { ArrowLeft, Building2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { hasPermission } from '@/utils/permissions';
import { getStageAssignments, getEligibleAssignees, getPassedStageKeys, STAGE_KEY_PERMISSION } from '@/lib/stage-assignments';
import AssignStagesForm, { type AssignGroup } from '@/components/internal/assign-stages-form';
import { savePgnAssignment } from '../../actions';

// Urutan tahap per dokumen — sama dengan *_STAGE_SEQUENCE bagian PGN.
const GROUPS = [
  {
    docType: 'procedure', title: 'Prosedur Kerja',
    stages: [
      { stageKey: 'procedure.hsse_pgn', label: 'HSSE PGN', hint: 'Verifikasi aspek keselamatan sebelum ke PM Zona.' },
      { stageKey: 'procedure.review', label: 'PM Zona (Akhir)', hint: 'Persetujuan akhir Prosedur Kerja.' },
    ],
  },
  {
    docType: 'jsa', title: 'JSA',
    stages: [
      { stageKey: 'jsa.hsse_pgn', label: 'HSSE PGN', hint: 'Verifikasi aspek keselamatan JSA.' },
      { stageKey: 'jsa.approve_pgn', label: 'PM Zona (Akhir)', hint: 'Persetujuan akhir JSA. Harus orang berbeda dari HSSE PGN.' },
    ],
  },
  {
    docType: 'ptw', title: 'PTW (Permit to Work)',
    stages: [
      { stageKey: 'ptw.approve_pm', label: 'Approval PM', hint: 'PTW Authority — menyetujui permohonan PTW.' },
      { stageKey: 'ptw.review_issuer', label: 'PTW Issuer', hint: 'Memeriksa kesiapan lapangan.' },
      { stageKey: 'ptw.numbering_hsse', label: 'Penomoran HSSE', hint: 'Memberi nomor dan menerbitkan PTW.' },
    ],
  },
] as const;

export default async function AssignPgnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = decodeURIComponent(id);

  if (!(await hasPermission('masterData', 'manage_project'))) redirect('/dashboard');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: actorProfile } = await supabase.from('profiles').select('org_id').eq('id', user?.id).single();
  if (!actorProfile?.org_id) redirect('/dashboard');
  const orgId = actorProfile.org_id;

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, vendor_profiles ( company_name )')
    .eq('id', projectId)
    .single();
  if (!project) return notFound();
  const vendor: any = Array.isArray(project.vendor_profiles) ? project.vendor_profiles[0] : project.vendor_profiles;

  const passed = (await getPassedStageKeys(supabase, [projectId])).get(projectId) ?? new Set<string>();

  const groups: AssignGroup[] = await Promise.all(
    GROUPS.map(async ({ docType, title, stages }) => ({
      docType,
      title,
      stages: await Promise.all(
        stages.map(async ({ stageKey, label, hint }) => {
          const perm = STAGE_KEY_PERMISSION[stageKey];
          const [candidates, assignments] = await Promise.all([
            getEligibleAssignees(supabase, perm.module, perm.action, orgId),
            getStageAssignments(supabase, projectId, docType, stageKey),
          ]);
          return {
            stageKey, label, hint, candidates,
            currentIds: assignments.map(a => a.assignee_id),
            locked: assignments.some(a => a.status !== 'pending') || passed.has(stageKey),
            passed: passed.has(stageKey),
          };
        }),
      ),
    })),
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start gap-4">
        <Link
          href={`/dashboard/master-data/project/${projectId}`}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800">Penugasan Approver PGN</h1>
          <p className="text-sm font-semibold text-primary mt-0.5 truncate">{project.name}</p>
          {vendor?.company_name && (
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> {vendor.company_name}
            </p>
          )}
          <p className="text-sm text-slate-500 mt-2">
            Pilih siapa yang berwenang menyetujui di tiap tahap PGN. Semua orang yang ditunjuk di satu tahap
            harus menyetujui sebelum dokumen lanjut. Tahap yang kosong membuat dokumen tersangkut.
          </p>
        </div>
      </div>

      <AssignStagesForm
        projectId={projectId}
        groups={groups}
        save={savePgnAssignment}
        emptyHint="Belum ada staff PGN dengan izin tahap ini. Berikan izinnya lewat Role & Permission atau set role akun terkait."
      />
    </div>
  );
}
