import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { 
  Briefcase, MapPin, Calendar, AlertTriangle,
  FileSignature, ShieldAlert, Stamp, ArrowRight, ArrowLeft
} from 'lucide-react';
import { createClient } from '@/utils/supabase/server';

export default async function ProjectDetailTrackerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = decodeURIComponent(id);
  const supabase = await createClient();

  // Fetch project + its JSA + its PTW + its procedure
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      id, name, location, start_date, end_date, description, status,
      jsa ( id, status, rejection_note ),
      ptw ( id, status, rejection_note, ptw_number ),
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

  // Normalize statuses for UI logic
  const prosedurStatus = prosedur?.status === 'Prosedur Disetujui' ? 'Approved' : prosedur?.status === 'Menunggu Review PM' ? 'Pending' : (prosedur?.status === 'Draft' && prosedurLastNote) ? 'Rejected' : prosedur ? 'Draft' : 'Draft';
  const jsaStatus = jsa?.status === 'JSA Disetujui' ? 'Approved' : jsa?.status === 'Pembahasan JSA' || jsa?.status === 'Review PM' || jsa?.status === 'Review Asset Manager' ? 'Pending' : jsa?.rejection_note ? 'Rejected' : jsa ? 'Draft' : 'Draft';
  const ptwStatus = ptw?.status === 'PTW Aktif' ? 'Approved' : ptw?.status === 'Draft' ? 'Rejected' : ptw ? 'Pending' : 'Draft';

  const getStepStyle = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-emerald-500 text-white border-emerald-500';
      case 'Pending': return 'bg-amber-400 text-white border-amber-400';
      case 'Rejected': return 'bg-rose-500 text-white border-rose-500';
      default: return 'bg-slate-100 text-slate-400 border-slate-200';
    }
  };

  const getStepLineStyle = (status: string) => status === 'Approved' ? 'bg-emerald-500' : 'bg-slate-200';

  const getStatusBadge = (status: string, detailedStatus?: string) => {
    if (status === 'Approved') return <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded font-bold uppercase">Disetujui</span>;
    if (status === 'Pending') return <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded font-bold uppercase">{detailedStatus || 'Dalam Review'}</span>;
    if (status === 'Rejected') return <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded font-bold uppercase">Perlu Revisi</span>;
    return <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded font-bold uppercase">Belum Dibuat</span>;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      
      {/* Top Nav */}
      <div>
        <Link href="/vendor/dashboard/projects" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Proyek
        </Link>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start">
          <div className="flex gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Briefcase className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{project.name}</h1>
              <div className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wider">ID: {project.id.slice(0, 8).toUpperCase()}</div>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-600">
                <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /> {project.location}</div>
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" /> {project.start_date} s/d {project.end_date}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The Stepper / Pipeline */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-8">Status Pengajuan PTW</h2>
        
        <div className="relative flex justify-between items-start max-w-3xl mx-auto">
          <div className="absolute top-6 left-0 right-0 h-1 bg-slate-100 -z-0"></div>
          <div className={`absolute top-6 left-0 w-1/2 h-1 -z-0 transition-all ${getStepLineStyle(prosedurStatus)}`}></div>
          <div className={`absolute top-6 left-1/2 w-1/2 h-1 -z-0 transition-all ${getStepLineStyle(jsaStatus)}`}></div>

          <div className="relative z-10 flex flex-col items-center gap-3 w-1/3 text-center">
            <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-colors ${getStepStyle(prosedurStatus)}`}>
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-800">Prosedur Kerja</div>
              <div className="mt-1">{getStatusBadge(prosedurStatus)}</div>
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-3 w-1/3 text-center">
            <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-colors ${getStepStyle(jsaStatus)}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-800">JSA &amp; HIRADC</div>
              <div className="mt-1">{getStatusBadge(jsaStatus, jsa?.status)}</div>
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-3 w-1/3 text-center">
            <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-colors ${getStepStyle(ptwStatus)}`}>
              <Stamp className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-800">Permit to Work</div>
              <div className="mt-1">{getStatusBadge(ptwStatus, ptw?.status)}</div>
              {ptw?.ptw_number && <div className="text-xs font-black text-emerald-600 mt-1">{ptw.ptw_number}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Prosedur Action Box */}
        <div className={`rounded-2xl border p-6 flex flex-col ${prosedurStatus === 'Rejected' ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600"><FileSignature className="w-5 h-5" /></div>
            <h3 className="font-bold text-slate-800">Prosedur Kerja</h3>
          </div>
          {prosedurStatus === 'Rejected' && prosedurLastNote && (
            <div className="mb-4 p-3 bg-white/60 rounded-xl text-sm text-rose-700 font-medium border border-rose-100/50">
              <AlertTriangle className="w-4 h-4 inline mr-1 -mt-0.5" />
              Catatan Revisi: {prosedurLastNote}
            </div>
          )}
          <div className="mt-auto pt-4">
            {prosedurStatus === 'Approved' ? (
              <button disabled className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-400 font-bold text-sm cursor-not-allowed">✅ Sudah Disetujui</button>
            ) : prosedurStatus === 'Pending' ? (
              <div className="space-y-2">
                <button disabled className="w-full py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 font-bold text-sm cursor-not-allowed">⏳ Sedang Dalam Review PM...</button>
                <Link href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}/prosedur`} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold text-xs transition-colors">
                  Lihat / Revisi Dokumen <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <Link href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}/prosedur`} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors shadow-sm shadow-primary/30">
                Lengkapi Dokumen <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>

        {/* JSA Action Box */}
        <div className={`rounded-2xl border p-6 flex flex-col ${jsaStatus === 'Rejected' ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600"><ShieldAlert className="w-5 h-5" /></div>
            <h3 className="font-bold text-slate-800">Pengajuan JSA</h3>
          </div>
          {jsa?.rejection_note && (
            <div className="mb-4 p-3 bg-white/60 rounded-xl text-sm text-rose-700 font-medium border border-rose-100/50">
              <AlertTriangle className="w-4 h-4 inline mr-1 -mt-0.5" />
              Catatan Revisi: {jsa.rejection_note}
            </div>
          )}
          <div className="mt-auto pt-4">
            {prosedurStatus !== 'Approved' ? (
              <button disabled className="w-full py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 font-bold text-sm cursor-not-allowed text-left px-4">Tunggu Prosedur Disetujui</button>
            ) : jsaStatus === 'Approved' ? (
              <button disabled className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-400 font-bold text-sm cursor-not-allowed">Sudah Disetujui</button>
            ) : jsaStatus === 'Pending' ? (
              <button disabled className="w-full py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 font-bold text-sm cursor-not-allowed">Sedang Dalam Review...</button>
            ) : (
              <Link href={`/vendor/dashboard/jsa/create/${encodeURIComponent(project.id)}`} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors shadow-sm shadow-primary/30">
                {jsa ? 'Revisi Dokumen JSA' : 'Lengkapi JSA'} <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>

        {/* PTW Action Box */}
        <div className={`rounded-2xl border p-6 flex flex-col ${ptwStatus === 'Rejected' ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600"><Stamp className="w-5 h-5" /></div>
            <h3 className="font-bold text-slate-800">Permit to Work</h3>
          </div>
          {ptw?.rejection_note && (
            <div className="mb-4 p-3 bg-white/60 rounded-xl text-sm text-rose-700 font-medium border border-rose-100/50">
              <AlertTriangle className="w-4 h-4 inline mr-1 -mt-0.5" />
              Catatan Revisi: {ptw.rejection_note}
            </div>
          )}
          <div className="mt-auto pt-4">
            {jsaStatus !== 'Approved' ? (
              <button disabled className="w-full py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 font-bold text-sm cursor-not-allowed text-left px-4">Tunggu JSA Disetujui</button>
            ) : ptwStatus === 'Approved' ? (
              <button className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-colors shadow-sm shadow-emerald-500/30">
                PTW Aktif — {ptw?.ptw_number}
              </button>
            ) : ptwStatus === 'Pending' ? (
              <button disabled className="w-full py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 font-bold text-sm cursor-not-allowed">Sedang Dalam Review...</button>
            ) : (
              <Link href={`/vendor/dashboard/ptw/create/${encodeURIComponent(project.id)}`} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors shadow-sm shadow-primary/30">
                {ptw ? 'Revisi Pengajuan PTW' : 'Ajukan PTW'} <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
