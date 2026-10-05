import { VendorProjectClient } from './VendorProjectClient';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { getJsaSignatories } from '@/lib/jsa-signatories';
import { getPtwSignatories } from '@/lib/ptw-signatories';
import { hasPermission } from '@/utils/permissions';
import { getStageAssignments, getEligibleAssignees, VENDOR_STAGE_KEYS, STAGE_KEY_PERMISSION } from '@/lib/stage-assignments';
import { getDocumentLogs } from '@/app/dashboard/approval/actions';

export default async function ProjectDetailTrackerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = decodeURIComponent(id);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const canManageAssignments = await hasPermission('masterData', 'manage_org_staff');
  const canEditSafetyChecklist = await hasPermission('ptw', 'edit_safety_checklist');
  const { data: actorProfile } = await supabase.from('profiles').select('org_id').eq('id', user?.id).single();
  const actorOrgId = actorProfile?.org_id ?? '';

  const VENDOR_STAGE_LABELS: Record<string, string> = {
    'procedure.review_vendor': 'Review Internal — Prosedur Kerja',
    'jsa.review_vendor': 'Review Internal — JSA',
    'ptw.review_vendor': 'Review Internal — PTW',
  };

  const assignmentSlots = canManageAssignments ? await Promise.all(VENDOR_STAGE_KEYS.map(async (stageKey) => {
    const docType = stageKey.split('.')[0];
    const permission = STAGE_KEY_PERMISSION[stageKey];
    const [candidates, assignments] = await Promise.all([
      getEligibleAssignees(supabase, permission.module, permission.action, actorOrgId),
      getStageAssignments(supabase, projectId, docType, stageKey),
    ]);
    return {
      stageKey,
      label: VENDOR_STAGE_LABELS[stageKey],
      candidates,
      currentAssigneeIds: assignments.map(a => a.assignee_id),
      locked: assignments.some(a => a.status !== 'pending'),
    };
  })) : [];

  // Fetch project + its JSA + its PTW + its procedure
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      id, name, location, start_date, end_date, description, status,
      vendor_profiles ( company_name, organizations ( profiles ( full_name ) ) ),
      jsa ( id, status, rejection_note, reviewer_id, reviewed_at, approver_id, approved_at, jsa_steps ( id, step_number, pekerjaan, bahaya, risiko, tindakan ) ),
      ptw ( id, status, rejection_note, ptw_number, workers, equipment, ptw_type, hazards, apd, gas_tests,
            created_at, authority_id, authority_approved_at, issuer_id, issuer_approved_at, hsse_id,
            valid_from, valid_to, work_start, work_end, hot_work_types, gas_test_frequency,
            field_token, stopped_at, stopped_reason, stopped_by_name, safety_checklist ),
      procedures ( id, status, content )
    `)
    .eq('id', projectId)
    .single();

  if (error || !project) return notFound();

  const documentLogs = await getDocumentLogs(projectId);

  const jsa = Array.isArray(project.jsa) ? project.jsa[0] : project.jsa;

  // Nama & jabatan penandatangan JSA untuk blok "Direview Oleh" / "Disetujui Oleh" pada form
  const jsaSignatories = await getJsaSignatories(supabase, projectId, jsa);

  // Blok tanda tangan PTW — satu set per PTW karena tiap tipe punya alur
  // approval sendiri.
  const vendorProfile: any = Array.isArray(project.vendor_profiles) ? project.vendor_profiles[0] : project.vendor_profiles;
  const vendorPic = {
    nama: (Array.isArray(vendorProfile?.organizations?.profiles) ? vendorProfile.organizations.profiles[0] : vendorProfile?.organizations?.profiles)?.full_name,
    perusahaan: vendorProfile?.company_name,
  };
  const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
  const ptwSignatories = Object.fromEntries(
    await Promise.all(ptws.map(async (p) => [p.id, await getPtwSignatories(supabase, projectId, p, vendorPic)] as const))
  );

  // Tab "Status Lapangan": check-in dan toolbox meeting lintas semua tipe PTW proyek ini.
  const ptwIds = ptws.map(p => p.id);
  const [{ data: siteCheckins }, { data: toolboxMeetings }] = await Promise.all([
    ptwIds.length > 0
      ? supabase.from('site_checkins').select('*').in('ptw_id', ptwIds).order('checked_in_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    ptwIds.length > 0
      ? supabase.from('toolbox_meetings').select('*').in('ptw_id', ptwIds).order('meeting_date', { ascending: false }).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  return (
    <VendorProjectClient
      project={project}
      currentUserId={user?.id || ''}
      jsaSignatories={jsaSignatories}
      ptwSignatories={ptwSignatories}
      siteCheckins={siteCheckins ?? []}
      toolboxMeetings={toolboxMeetings ?? []}
      canManageAssignments={canManageAssignments}
      canEditSafetyChecklist={canEditSafetyChecklist}
      assignmentSlots={assignmentSlots}
      documentLogs={documentLogs}
    />
  );
}
