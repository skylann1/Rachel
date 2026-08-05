import { getAllProjectsWithRelations } from '@/app/dashboard/approval/actions';
import React from 'react';
import Link from 'next/link';
import { Archive, Briefcase, MapPin, Calendar, FileText } from 'lucide-react';

export default async function ArchiveProjectsPage() {
  const projects = await getAllProjectsWithRelations();
  
  // A project is archived if its status is 'Completed'
  const archivedProjects = projects.filter(project => project.status === 'Completed' || project.status === 'Selesai');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
          <Archive className="w-8 h-8 text-slate-400" /> Arsip Proyek
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Daftar riwayat proyek yang telah selesai dikerjakan.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {archivedProjects.length === 0 ? (
          <div className="col-span-full p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
            Belum ada proyek yang masuk ke arsip.
          </div>
        ) : (
          archivedProjects.map(project => {
            return (
              <div key={project.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <span className="bg-slate-200 text-slate-600 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">
                    Selesai
                  </span>
                </div>
                
                <h3 className="font-bold text-slate-600 text-lg mb-1 line-clamp-2">{project.name}</h3>
                <p className="text-sm text-slate-400 font-semibold mb-4">
                  {Array.isArray(project.vendor_profiles) ? (project.vendor_profiles as any)[0]?.company_name : (project.vendor_profiles as any)?.company_name || 'Vendor Tidak Ditemukan'}
                </p>
                
                <div className="space-y-2 text-xs text-slate-500 mt-auto mb-6">
                  <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {project.location}</div>
                  <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {project.start_date} s/d {project.end_date}</div>
                </div>

                <Link 
                  href={`/dashboard/projects/${project.id}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <FileText className="w-4 h-4" /> Lihat Riwayat Dokumen
                </Link>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
