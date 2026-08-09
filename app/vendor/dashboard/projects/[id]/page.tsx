import { VendorProjectClient } from './VendorProjectClient';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { getJsaSignatories } from '@/lib/jsa-signatories';
import { getPtwSignatories } from '@/lib/ptw-signatories';

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
      vendor_profiles ( company_name, profiles ( full_name ) ),
      jsa ( id, status, rejection_note, reviewer_id, reviewed_at, approver_id, approved_at, jsa_steps ( id, step_number, pekerjaan, bahaya, risiko, tindakan ) ),
      ptw ( id, status, rejection_note, ptw_number, workers, equipment, ptw_type, hazards, apd, gas_tests,
            created_at, authority_id, authority_approved_at, issuer_id, issuer_approved_at, hsse_id,
            valid_from, valid_to, work_start, work_end, hot_work_types, gas_test_frequency ),
      procedures ( id, status, content )
    `)
    .eq('id', projectId)
    .single();

  if (error || !project) return notFound();

  const jsa = Array.isArray(project.jsa) ? project.jsa[0] : project.jsa;

  // Nama & jabatan penandatangan JSA untuk blok "Direview Oleh" / "Disetujui Oleh" pada form
  const jsaSignatories = await getJsaSignatories(supabase, jsa);

  // Blok tanda tangan PTW — satu set per PTW karena tiap tipe punya alur
  // approval sendiri.
  const vendorProfile: any = Array.isArray(project.vendor_profiles) ? project.vendor_profiles[0] : project.vendor_profiles;
  const vendorPic = {
    nama: (Array.isArray(vendorProfile?.profiles) ? vendorProfile.profiles[0] : vendorProfile?.profiles)?.full_name,
    perusahaan: vendorProfile?.company_name,
  };
  const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
  const ptwSignatories = Object.fromEntries(
    await Promise.all(ptws.map(async (p) => [p.id, await getPtwSignatories(supabase, p, vendorPic)] as const))
  );

  return (
    <VendorProjectClient
      project={project}
      currentUserId={user?.id || ''}
      jsaSignatories={jsaSignatories}
      ptwSignatories={ptwSignatories}
    />
  );
}
