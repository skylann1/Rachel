import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getUserPermissionsForUser } from '@/utils/permissions';
import AdminProjectClient from './AdminProjectClient';
import { getJsaSignatories } from '@/lib/jsa-signatories';
import { getPtwSignatories } from '@/lib/ptw-signatories';
import { worstExpiry } from '@/lib/document-expiry';
import { getDocumentLogs } from '@/app/dashboard/approval/actions';

export default async function AdminProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = decodeURIComponent(id);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return notFound();

  // roles.permissions milik user saat ini — dipakai AdminProjectClient untuk
  // gerbang approve/reject Prosedur/JSA/PTW, lihat utils/permissions.ts.
  const permissions = await getUserPermissionsForUser(supabase, user.id);

  // Fetch project + its JSA (including steps) + its PTW (including relations) + its procedure
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      id, name, location, start_date, end_date, description, status,
      vendor_profiles ( company_name, profiles ( full_name ) ),
      jsa ( id, status, rejection_note, reviewer_id, reviewed_at, approver_id, approved_at, jsa_steps ( id, step_number, pekerjaan, bahaya, risiko, tindakan ) ),
      ptw ( id, status, rejection_note, ptw_number, workers, equipment, ptw_type, hazards, apd, gas_tests,
            created_at, authority_id, authority_approved_at, issuer_id, issuer_approved_at, hsse_id,
            valid_from, valid_to, work_start, work_end, hot_work_types, gas_test_frequency,
            field_token, stopped_at, stopped_reason, stopped_by_name ),
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

  // Safety gate: cross-check the workers/equipment snapshotted onto each PTW
  // against their *current* master-data expiry, so an approver sees when
  // someone they're about to authorize has a lapsed competency or
  // certificate — the snapshot itself only carries a name and role, not a
  // validity date, so this can't be read off the PTW row alone.
  const workerIds = Array.from(new Set(
    ptws.flatMap((p: any) => (p.workers || []).map((w: any) => w.id).filter(Boolean)),
  ));
  const equipmentIds = Array.from(new Set(
    ptws.flatMap((p: any) => (p.equipment || []).map((e: any) => e.id).filter(Boolean)),
  ));

  const [{ data: competencies }, { data: equipmentDocs }] = await Promise.all([
    workerIds.length > 0
      ? supabase.from('vendor_worker_competencies').select('worker_id, valid_to').in('worker_id', workerIds)
      : Promise.resolve({ data: [] as { worker_id: string; valid_to: string | null }[] }),
    equipmentIds.length > 0
      ? supabase.from('vendor_equipment_documents').select('equipment_id, valid_to').in('equipment_id', equipmentIds)
      : Promise.resolve({ data: [] as { equipment_id: string; valid_to: string | null }[] }),
  ]);

  const workerExpiry: Record<string, string> = {};
  for (const id of workerIds) {
    workerExpiry[id] = worstExpiry((competencies || []).filter(c => c.worker_id === id).map(c => c.valid_to));
  }
  const equipmentExpiry: Record<string, string> = {};
  for (const id of equipmentIds) {
    equipmentExpiry[id] = worstExpiry((equipmentDocs || []).filter(d => d.equipment_id === id).map(d => d.valid_to));
  }

  const documentLogs = await getDocumentLogs(projectId);

  // Tab "Status Lapangan": check-in dan toolbox meeting lintas semua tipe PTW proyek ini.
  const ptwIds = ptws.map((p: any) => p.id);
  const [{ data: siteCheckins }, { data: toolboxMeetings }] = await Promise.all([
    ptwIds.length > 0
      ? supabase.from('site_checkins').select('*').in('ptw_id', ptwIds).order('checked_in_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    ptwIds.length > 0
      ? supabase.from('toolbox_meetings').select('*').in('ptw_id', ptwIds).order('meeting_date', { ascending: false }).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  return (
    <div className="p-8 pb-20 bg-slate-50 min-h-screen">
      <AdminProjectClient
        project={project}
        currentUserId={user.id}
        jsaSignatories={jsaSignatories}
        ptwSignatories={ptwSignatories}
        workerExpiry={workerExpiry}
        equipmentExpiry={equipmentExpiry}
        documentLogs={documentLogs}
        permissions={permissions}
        siteCheckins={siteCheckins ?? []}
        toolboxMeetings={toolboxMeetings ?? []}
      />
    </div>
  );
}
