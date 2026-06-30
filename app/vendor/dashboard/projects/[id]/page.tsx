'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  Briefcase, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  FileSignature,
  ShieldAlert,
  Stamp,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

export default function ProjectDetailTrackerPage() {
  const params = useParams();
  const projectId = typeof params.id === 'string' ? decodeURIComponent(params.id) : 'PRJ-000';

  // Mock data for this specific project.
  // In a real app, you would fetch this from Supabase using projectId
  const project = {
    id: projectId,
    name: 'Pekerjaan Perbaikan Pos Security',
    location: 'Stasiun Muara Bekasi',
    startDate: '2026-06-20',
    endDate: '2026-07-20',
    description: 'Pekerjaan perbaikan struktur pos penjagaan termasuk penggantian atap kanopi dan pengecatan ulang.',
    
    // Status tracking for the 3 main documents
    prosedurStatus: 'Approved', // Draft, Pending, Approved, Rejected
    jsaStatus: 'Rejected',      // Draft, Pending, Approved, Rejected
    ptwStatus: 'Draft',         // Draft, Pending, Approved, Rejected

    feedback: {
      prosedur: null,
      jsa: 'Langkah kerja nomor 3 mitigasinya kurang detail, tolong tambahkan penggunaan full body harness karena bekerja di atas 1.8 meter.',
      ptw: null
    }
  };

  // Helper to determine step visual state
  const getStepStyle = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-emerald-500 text-white border-emerald-500';
      case 'Pending': return 'bg-amber-400 text-white border-amber-400';
      case 'Rejected': return 'bg-rose-500 text-white border-rose-500';
      default: return 'bg-slate-100 text-slate-400 border-slate-200'; // Draft or Not Started
    }
  };

  const getStepLineStyle = (status: string) => {
    return status === 'Approved' ? 'bg-emerald-500' : 'bg-slate-200';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved': return <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded font-bold uppercase">Approved</span>;
      case 'Pending': return <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded font-bold uppercase">Menunggu Review</span>;
      case 'Rejected': return <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded font-bold uppercase">Perlu Revisi</span>;
      default: return <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded font-bold uppercase">Belum Dibuat</span>;
    }
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
              <div className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wider">ID: {project.id}</div>
              
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-600">
                <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /> {project.location}</div>
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" /> {project.startDate} s/d {project.endDate}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The Stepper / Pipeline */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-8">Status Pengajuan PTW</h2>
        
        <div className="relative flex justify-between items-start max-w-3xl mx-auto">
          {/* Background Line */}
          <div className="absolute top-6 left-0 right-0 h-1 bg-slate-100 -z-0"></div>
          
          {/* Progress Lines */}
          <div className={`absolute top-6 left-0 w-1/2 h-1 -z-0 transition-all ${getStepLineStyle(project.prosedurStatus)}`}></div>
          <div className={`absolute top-6 left-1/2 w-1/2 h-1 -z-0 transition-all ${getStepLineStyle(project.jsaStatus)}`}></div>

          {/* Step 1: Prosedur */}
          <div className="relative z-10 flex flex-col items-center gap-3 w-1/3 text-center">
            <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-colors ${getStepStyle(project.prosedurStatus)}`}>
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-800">Prosedur Kerja</div>
              <div className="mt-1">{getStatusBadge(project.prosedurStatus)}</div>
            </div>
          </div>

          {/* Step 2: JSA */}
          <div className="relative z-10 flex flex-col items-center gap-3 w-1/3 text-center">
            <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-colors ${getStepStyle(project.jsaStatus)}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-800">JSA & HIRADC</div>
              <div className="mt-1">{getStatusBadge(project.jsaStatus)}</div>
            </div>
          </div>

          {/* Step 3: PTW */}
          <div className="relative z-10 flex flex-col items-center gap-3 w-1/3 text-center">
            <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-colors ${getStepStyle(project.ptwStatus)}`}>
              <Stamp className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-800">Permit to Work</div>
              <div className="mt-1">{getStatusBadge(project.ptwStatus)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action / Detail Section based on current bottleneck */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Prosedur Action Box */}
        <div className={`rounded-2xl border p-6 flex flex-col ${project.prosedurStatus === 'Rejected' ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600"><FileSignature className="w-5 h-5" /></div>
            <h3 className="font-bold text-slate-800">Prosedur Kerja</h3>
          </div>
          
          {project.feedback.prosedur && (
            <div className="mb-4 p-3 bg-white/60 rounded-xl text-sm text-rose-700 font-medium border border-rose-100/50">
              <AlertTriangle className="w-4 h-4 inline mr-1 -mt-0.5" />
              {project.feedback.prosedur}
            </div>
          )}

          <div className="mt-auto pt-4">
            {project.prosedurStatus === 'Approved' ? (
              <button disabled className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-400 font-bold text-sm cursor-not-allowed">Sudah Disetujui</button>
            ) : (
              <Link href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}/prosedur`} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors shadow-sm shadow-primary/30">
                {project.prosedurStatus === 'Rejected' ? 'Revisi Dokumen' : 'Lengkapi Dokumen'} <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>

        {/* JSA Action Box */}
        <div className={`rounded-2xl border p-6 flex flex-col ${project.jsaStatus === 'Rejected' ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600"><ShieldAlert className="w-5 h-5" /></div>
            <h3 className="font-bold text-slate-800">Pengajuan JSA</h3>
          </div>
          
          {project.feedback.jsa && (
            <div className="mb-4 p-3 bg-white/60 rounded-xl text-sm text-rose-700 font-medium border border-rose-100/50">
              <AlertTriangle className="w-4 h-4 inline mr-1 -mt-0.5" />
              Catatan HSE: {project.feedback.jsa}
            </div>
          )}

          <div className="mt-auto pt-4">
            {project.prosedurStatus !== 'Approved' ? (
              <button disabled className="w-full py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 font-bold text-sm cursor-not-allowed text-left px-4">Tunggu Prosedur Disetujui</button>
            ) : project.jsaStatus === 'Approved' ? (
              <button disabled className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-400 font-bold text-sm cursor-not-allowed">Sudah Disetujui</button>
            ) : (
              <Link href={`/vendor/dashboard/jsa/create/${encodeURIComponent(project.id)}`} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors shadow-sm shadow-primary/30">
                {project.jsaStatus === 'Rejected' ? 'Revisi Dokumen JSA' : 'Lengkapi JSA'} <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>

        {/* PTW Action Box */}
        <div className={`rounded-2xl border p-6 flex flex-col ${project.ptwStatus === 'Rejected' ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600"><Stamp className="w-5 h-5" /></div>
            <h3 className="font-bold text-slate-800">Permit to Work</h3>
          </div>
          
          {project.feedback.ptw && (
            <div className="mb-4 p-3 bg-white/60 rounded-xl text-sm text-rose-700 font-medium border border-rose-100/50">
              <AlertTriangle className="w-4 h-4 inline mr-1 -mt-0.5" />
              {project.feedback.ptw}
            </div>
          )}

          <div className="mt-auto pt-4">
            {project.jsaStatus !== 'Approved' ? (
               <button disabled className="w-full py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 font-bold text-sm cursor-not-allowed text-left px-4">Tunggu JSA Disetujui</button>
            ) : project.ptwStatus === 'Approved' ? (
              <button className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-colors shadow-sm shadow-emerald-500/30">
                Download PTW
              </button>
            ) : (
              <Link href={`/vendor/dashboard/ptw/create/${encodeURIComponent(project.id)}`} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors shadow-sm shadow-primary/30">
                {project.ptwStatus === 'Rejected' ? 'Revisi Pengajuan PTW' : 'Ajukan PTW'} <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
