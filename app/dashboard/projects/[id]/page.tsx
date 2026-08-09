import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getUserPermissions } from '@/utils/permissions';
import AdminProjectClient from './AdminProjectClient';
import { getJsaSignatories } from '@/lib/jsa-signatories';
import { getPtwSignatories } from '@/lib/ptw-signatories';

export default async function AdminProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = decodeURIComponent(id);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return notFound();

  // Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const userRole = profile?.role || '';

  // Fetch project + its JSA (including steps) + its PTW (including relations) + its procedure
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

  if (error) {
    return (
      <div className="p-10">
        <h1 className="text-3xl font-bold text-red-600">Database Query Error</h1>
        <pre className="mt-4 p-4 bg-slate-900 text-green-400 rounded-lg overflow-auto">
          {JSON.stringify(error, null, 2)}
        </pre>
      </div>
    );
  }

  if (!project) return notFound();

  // Nama & jabatan penandatangan JSA untuk blok "Direview Oleh" / "Disetujui Oleh" pada form
  const jsaRow = Array.isArray(project.jsa) ? project.jsa[0] : project.jsa;
  const jsaSignatories = await getJsaSignatories(supabase, jsaRow);

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
    <div className="p-8 pb-20 bg-slate-50 min-h-screen">
      <AdminProjectClient
        project={project}
        userRole={userRole}
        currentUserId={user.id}
        jsaSignatories={jsaSignatories}
        ptwSignatories={ptwSignatories}
      />
    </div>
  );
}
