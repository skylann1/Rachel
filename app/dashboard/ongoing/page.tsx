import { getCurrentUserProfile, getAllProjectsWithRelations } from '@/app/dashboard/approval/actions';
import React from 'react';
import Link from 'next/link';
import { Rocket, Briefcase, MapPin, Calendar, FileText } from 'lucide-react';
import { PTW_STATUS } from '@/lib/ptw-status';

export default async function OngoingProjectsPage() {
  const projects = await getAllProjectsWithRelations();

  // A project is ongoing if ANY of its PTWs is active or paused by a Stop
  // Work Authority (fieldwork can be under way with one permit type even
  // while another type is still pending) and project status is not completed.
  const ongoingProjects = projects.filter(project => {
    const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
    return ptws.some(p => p.status === PTW_STATUS.aktif || p.status === PTW_STATUS.stoppedSwa) && project.status !== 'Completed';
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
          <Rocket className="w-8 h-8 text-primary" /> Proyek Berjalan
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Daftar proyek yang dokumen PTW-nya sudah diterbitkan dan sedang dalam tahap pengerjaan.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ongoingProjects.length === 0 ? (
          <div className="col-span-full p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
            Tidak ada proyek yang sedang berjalan saat ini.
          </div>
        ) : (
          ongoingProjects.map(project => {
            const ptws: any[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
            const activeNumbers = ptws.filter(p => p.status === PTW_STATUS.aktif).map(p => p.ptw_number).filter(Boolean);
            const isStopped = ptws.some(p => p.status === PTW_STATUS.stoppedSwa);
            return (
              <div key={project.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <span className={`text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider ${isStopped ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {isStopped ? 'Stop Work' : activeNumbers.length > 0 ? activeNumbers.join(', ') : 'PTW Aktif'}
                  </span>
                </div>
                
                <h3 className="font-bold text-slate-800 text-lg mb-1 line-clamp-2">{project.name}</h3>
                <p className="text-sm text-slate-500 font-medium mb-4">{Array.isArray(project.vendor_profiles) ? (project.vendor_profiles as any)[0]?.company_name : (project.vendor_profiles as any)?.company_name || 'Vendor Tidak Ditemukan'}</p>
                
                <div className="space-y-2 text-xs text-slate-600 mt-auto mb-6">
                  <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {project.location}</div>
                  <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {project.start_date} s/d {project.end_date}</div>
                </div>

                <Link 
                  href={`/dashboard/projects/${project.id}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors"
                >
                  <FileText className="w-4 h-4" /> Lihat Detail
                </Link>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
