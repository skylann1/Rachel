import { VendorProjectClient } from './VendorProjectClient';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { getJsaSignatories } from '@/lib/jsa-signatories';

export default async function ProjectDetailTrackerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = decodeURIComponent(id);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch project + its JSA + its PTW + its procedure
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      id, name, location, start_date, end_date, description, status,
      vendor_profiles ( company_name ),
      jsa ( id, status, rejection_note, reviewer_id, reviewed_at, approver_id, approved_at, jsa_steps ( id, step_number, pekerjaan, bahaya, risiko, tindakan ) ),
      ptw ( id, status, rejection_note, ptw_number, workers, equipment, ptw_type, hazards, apd ),
      procedures ( id, status, content )
    `)
    .eq('id', projectId)
    .single();

  if (error || !project) return notFound();

  const jsa = Array.isArray(project.jsa) ? project.jsa[0] : project.jsa;
  const ptw = Array.isArray(project.ptw) ? project.ptw[0] : project.ptw;
  const prosedur = Array.isArray(project.procedures) ? project.procedures[0] : project.procedures;

  const prosedurRevisions = prosedur?.content?.revisions || [];
  const prosedurLastNote = prosedurRevisions.length > 0 ? prosedurRevisions[prosedurRevisions.length - 1].note : null;

  // Nama & jabatan penandatangan JSA untuk blok "Direview Oleh" / "Disetujui Oleh" pada form
  const jsaSignatories = await getJsaSignatories(supabase, jsa);

  return (
    <VendorProjectClient
      project={project}
      currentUserId={user?.id || ''}
      jsaSignatories={jsaSignatories}
    />
  );
}
