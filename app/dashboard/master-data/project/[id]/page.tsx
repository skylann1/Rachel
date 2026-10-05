import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Save, Briefcase, MapPin, Calendar, Building2, Activity, Users } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import AssignmentPanel from './AssignmentPanel';
import { getStageAssignments, getEligibleAssignees, PGN_STAGE_KEYS, STAGE_KEY_PERMISSION } from '@/lib/stage-assignments';

const STAGE_LABELS: Record<string, string> = {
  'procedure.hsse_pgn': 'Review Prosedur Kerja — HSSE PGN',
  'procedure.review': 'Review Prosedur Kerja — PM Zona (Akhir)',
  'jsa.hsse_pgn': 'Review JSA — HSSE PGN',
  'jsa.approve_pgn': 'Persetujuan JSA — PM Zona (Akhir)',
  'ptw.approve_pm': 'Approval PTW — PTW Authority (PM)',
  'ptw.review_issuer': 'Review PTW — PTW Issuer',
  'ptw.numbering_hsse': 'Penomoran PTW (HSSE)',
};

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = decodeURIComponent(id);
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      id, name, description, contract_number, location, start_date, end_date, status, progress, vendor_id,
      vendor_profiles ( id, company_name )
    `)
    .eq('id', projectId)
    .single();

  if (error || !project) return notFound();

  // Fetch all vendors for the dropdown
  const { data: vendors } = await supabase
    .from('vendor_profiles')
    .select('id, company_name')
    .order('company_name');

  const vendorList = vendors || [];

  // Kandidat assignment harus dibatasi ke org admin yang sedang login. Role
  // `admin` (PGN) memegang seluruh permission, jadi tanpa batas org daftar
  // kandidat tiap tahap akan tercampur lintas organisasi. Diambil dari profil
  // pengguna sendiri — persis cara writeStageAssignment menentukan "org milik
  // admin yang menugaskan".
  const { data: { user } } = await supabase.auth.getUser();
  const { data: actorProfile } = await supabase.from('profiles').select('org_id').eq('id', user?.id).single();
  const actorOrgId = actorProfile?.org_id ?? '';

  const slots = await Promise.all(PGN_STAGE_KEYS.map(async (stageKey) => {
    const docType = stageKey.split('.')[0];
    const permission = STAGE_KEY_PERMISSION[stageKey];
    const [candidates, assignments] = await Promise.all([
      getEligibleAssignees(supabase, permission.module, permission.action, actorOrgId),
      getStageAssignments(supabase, projectId, docType, stageKey),
    ]);
    return {
      stageKey,
      label: STAGE_LABELS[stageKey],
      candidates,
      currentAssigneeIds: assignments.map(a => a.assignee_id),
      locked: assignments.some(a => a.status !== 'pending'),
    };
  }));

  const statusOptions = [
    { value: 'Menunggu Review', label: 'Menunggu Review' },
    { value: 'Prosedur Disetujui', label: 'Prosedur Disetujui' },
    { value: 'JSA Disetujui', label: 'JSA Disetujui' },
    { value: 'PTW Aktif', label: 'PTW Aktif' },
    { value: 'Selesai', label: 'Selesai' },
    { value: 'Ditolak', label: 'Ditolak' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard/master-data/project"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Detail Proyek</h1>
            <p className="text-sm text-slate-500 mt-1">Kelola informasi pekerjaan, timeline, dan vendor yang bertugas.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Quick Stats & Status */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-6">
              <Briefcase className="w-8 h-8" />
            </div>
            
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">ID Proyek</h3>
            <p className="text-sm font-black text-slate-800 bg-slate-50 px-3 py-1.5 rounded-lg inline-block border border-slate-100 mb-6 font-mono">{project.id.slice(0, 8).toUpperCase()}</p>

            <div className="space-y-4">
               <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Status Pekerjaan</h3>
                  <div className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700">
                    {project.status}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Status diperbarui otomatis oleh sistem sesuai alur approval.</p>
               </div>
               
               <div>
                  <div className="flex justify-between items-end mb-2">
                     <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Progress Aktual</h3>
                     <span className="text-lg font-black text-primary">{project.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${project.progress || 0}%` }} />
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Right Column: Main Info (Read-only for now) */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-6 sm:p-8">
              
              {/* Seksi 1: Informasi Dasar */}
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-primary" />
                Informasi Utama Proyek
              </h2>
              
              <div className="space-y-5 mb-8">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Nama Pekerjaan / Proyek</label>
                  <div className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800">
                    {project.name}
                  </div>
                </div>

                {project.contract_number && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Nomor Kontrak</label>
                    <div className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 font-mono">
                      {project.contract_number}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Deskripsi Pekerjaan</label>
                  <div className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 min-h-[80px]">
                    {project.description || '-'}
                  </div>
                </div>
              </div>

              {/* Seksi 2: Pelaksana & Lokasi */}
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-6 pt-6 border-t border-slate-100">
                <Building2 className="w-5 h-5 text-primary" />
                Pelaksana &amp; Lokasi
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
                 <div className="space-y-2">
                   <label className="text-sm font-semibold text-slate-700">Vendor / Kontraktor</label>
                   <div className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 flex items-center gap-2">
                     <Building2 className="w-4 h-4 text-slate-400" />
                     {(project.vendor_profiles as any)?.company_name || 'Belum ditentukan'}
                   </div>
                 </div>

                 <div className="sm:col-span-2 space-y-2">
                   <label className="text-sm font-semibold text-slate-700">Lokasi / Area Kerja</label>
                   <div className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 flex items-center gap-2">
                     <MapPin className="w-4 h-4 text-slate-400" />
                     {project.location}
                   </div>
                 </div>
              </div>

              {/* Seksi 3: Timeline */}
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-6 pt-6 border-t border-slate-100">
                <Calendar className="w-5 h-5 text-primary" />
                Timeline Proyek
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                 <div className="space-y-2">
                   <label className="text-sm font-semibold text-slate-700">Tanggal Mulai Pekerjaan</label>
                   <div className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800">
                     {project.start_date}
                   </div>
                 </div>
                 <div className="space-y-2">
                   <label className="text-sm font-semibold text-slate-700">Target Tanggal Selesai</label>
                   <div className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800">
                     {project.end_date}
                   </div>
                 </div>
              </div>

              {/* Seksi 4: Assignment Approval PGN */}
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-6 pt-6 border-t border-slate-100">
                <Users className="w-5 h-5 text-primary" />
                Assignment Approval PGN
              </h2>
              <AssignmentPanel projectId={project.id} slots={slots} />

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
