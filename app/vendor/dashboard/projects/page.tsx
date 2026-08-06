import React from 'react';
import Link from 'next/link';
import { Search, Briefcase, MapPin, Calendar, ArrowRight, FileSignature } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { getEffectivePtwStatus } from '@/lib/ptw-status';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    'Menunggu Review':    'bg-amber-100 text-amber-700',
    'Menunggu Review PM': 'bg-amber-100 text-amber-700',
    'Revisi Prosedur':    'bg-rose-100 text-rose-700',
    'Prosedur Disetujui': 'bg-sky-100 text-sky-700',
    'JSA Disetujui':      'bg-violet-100 text-violet-700',
    'PTW Aktif':          'bg-emerald-100 text-emerald-700',
    'Expired':            'bg-slate-200 text-slate-600',
    'Selesai':            'bg-slate-100 text-slate-600',
    'Ditolak':            'bg-rose-100 text-rose-700',
  };
  return (
    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export default async function VendorProjectsPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id, name, description, location, start_date, end_date, status, progress, contract_number,
      procedures(status), jsa(status), ptw(status)
    `)
    .order('created_at', { ascending: false });

  const filteredProjects = projects || [];

  // Determine next action based on project status
  const getComputedStatus = (project: any) => {
    const ptw = Array.isArray(project.ptw) ? project.ptw[0] : project.ptw;
    const jsa = Array.isArray(project.jsa) ? project.jsa[0] : project.jsa;
    const prosedur = Array.isArray(project.procedures) ? project.procedures[0] : project.procedures;

    const effectivePtwStatus = getEffectivePtwStatus(ptw?.status, project.end_date);
    if (effectivePtwStatus === 'PTW Aktif') return 'PTW Aktif';
    if (effectivePtwStatus === 'Expired') return 'Expired';
    if (jsa?.status === 'JSA Disetujui') return 'JSA Disetujui';
    if (prosedur?.status === 'Prosedur Disetujui') return 'Prosedur Disetujui';
    if (prosedur?.status === 'Menunggu Review PM') return 'Menunggu Review PM';
    if (prosedur?.status === 'Draft') return 'Revisi Prosedur';
    return project.status;
  };

  const getActionButton = (project: any) => {
    const computedStatus = getComputedStatus(project);
    switch (computedStatus) {
      case 'Menunggu Review PM':
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 py-2.5 rounded-xl transition-colors"
          >
            ⏳ Menunggu Review PM
          </Link>
        );
      case 'Revisi Prosedur':
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 py-3 rounded-xl transition-all shadow-sm shadow-rose-500/30"
          >
            ⚠️ Revisi Prosedur Kerja
          </Link>
        );
      case 'Menunggu Review':
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 py-3 rounded-xl transition-all shadow-sm shadow-primary/30"
          >
            <FileSignature className="w-4 h-4" /> Lengkapi Prosedur
          </Link>
        );
      case 'Prosedur Disetujui':
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 py-2.5 rounded-xl transition-colors"
          >
            Buat JSA <ArrowRight className="w-4 h-4" />
          </Link>
        );
      case 'JSA Disetujui':
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 py-2.5 rounded-xl transition-colors"
          >
            Ajukan PTW <ArrowRight className="w-4 h-4" />
          </Link>
        );
      case 'PTW Aktif':
        return (
          <div className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 py-2.5 rounded-xl">
            ✅ PTW Aktif — Pekerjaan Berjalan
          </div>
        );
      case 'Expired':
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200 py-2.5 rounded-xl transition-colors"
          >
            PTW Kedaluwarsa — Ajukan Ulang
          </Link>
        );
      default:
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 py-2.5 rounded-xl transition-colors"
          >
            Lihat Detail <ArrowRight className="w-4 h-4" />
          </Link>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Proyek Aktif</h1>
          <p className="text-sm text-slate-500 mt-1">
            Daftar pekerjaan/proyek yang sedang dikerjakan atau dalam masa persiapan.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm transition-all"
            placeholder="Cari nama proyek atau lokasi..."
          />
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="font-bold text-slate-700 mb-1">Belum Ada Proyek</h3>
          <p className="text-sm text-slate-500">Proyek Anda akan muncul di sini setelah Admin/PM menetapkan pekerjaan untuk perusahaan Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProjects.map((project) => (
            <div key={project.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group flex flex-col relative overflow-hidden">
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 line-clamp-1">{project.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5 uppercase">No. {project.contract_number}</p>
                  </div>
                </div>
                <StatusBadge status={getComputedStatus(project)} />
              </div>
             
             <div className="mb-5 text-sm text-slate-600 leading-relaxed line-clamp-2">
                {project.description || 'Pekerjaan sesuai dengan kontrak dan Prosedur K3 PGN.'}
             </div>
             
             <div className="space-y-3 mb-6">
               <div className="flex items-center gap-3 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium">{project.location}</span>
               </div>
               <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium">{project.start_date} s/d {project.end_date}</span>
               </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-auto pt-4 border-t border-slate-100 space-y-2 mb-4">
               <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">Progres Pekerjaan</span>
                  <span className="text-xs font-black text-primary">{project.progress || 0}%</span>
               </div>
               <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-in-out ${(project.progress || 0) === 100 ? 'bg-emerald-500' : 'bg-primary'}`} 
                    style={{ width: `${project.progress || 0}%` }}
                  />
               </div>
            </div>

            {/* Action Button */}
            <div className="mt-auto">
              {getActionButton(project)}
            </div>

          </div>
        ))}
      </div>
    )}
    </div>
  );
}
