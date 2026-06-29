import React from 'react';
import Link from 'next/link';
import { Search, Briefcase, MapPin, Calendar, ArrowRight, Activity, Plus, FileSignature } from 'lucide-react';

const mockProjects = [
  { 
    id: 'PRJ-001', 
    name: 'Perbaikan Pos Security Stasiun Muara Bekasi', 
    location: 'Stasiun Muara Bekasi', 
    startDate: '2026-06-20',
    endDate: '2026-07-20',
    status: 'MENUNGGU SUBMISSION',
    progress: 0
  },
  { 
    id: 'PRJ-002', 
    name: 'Maintenance Kompresor Stasiun B', 
    location: 'Stasiun Kompresor B', 
    startDate: '2026-07-01',
    endDate: '2026-07-15',
    status: 'Persiapan',
    progress: 0
  },
  { 
    id: 'PRJ-003', 
    name: 'Pengecatan Fasilitas Pipa', 
    location: 'Fasilitas Utama', 
    startDate: '2026-06-10',
    endDate: '2026-06-30',
    status: 'Aktif',
    progress: 80
  },
  { 
    id: 'PRJ-004', 
    name: 'Inspeksi Tangki T-04', 
    location: 'Area Tangki Timbun', 
    startDate: '2026-06-28',
    endDate: '2026-07-05',
    status: 'Selesai',
    progress: 100
  },
];

export default function VendorProjectsPage() {
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
        <div className="flex gap-2 w-full sm:w-auto">
          <select className="block w-full sm:w-48 pl-3 pr-10 py-2 text-base border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm rounded-xl bg-slate-50">
            <option>Semua Status</option>
            <option>MENUNGGU SUBMISSION</option>
            <option>Aktif</option>
            <option>Persiapan</option>
            <option>Selesai</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mockProjects.map((project) => (
          <div key={project.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group flex flex-col relative overflow-hidden">
            
            {/* Status Ribbon/Badge */}
            <div className="absolute top-6 right-6">
               <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  project.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' :
                  project.status === 'Persiapan' ? 'bg-amber-100 text-amber-700' :
                  project.status === 'MENUNGGU SUBMISSION' ? 'bg-rose-100 text-rose-700' :
                  'bg-slate-100 text-slate-700'
               }`}>
                 {project.status}
               </span>
            </div>

            <div className="flex items-center gap-4 mb-4">
               <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Briefcase className="w-6 h-6" />
               </div>
               <div>
                  <h3 className="text-lg font-bold text-slate-800 leading-tight pr-20">{project.name}</h3>
                  <div className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">ID: {project.id}</div>
               </div>
            </div>
            
            <div className="space-y-3 mb-6">
               <div className="flex items-center gap-3 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium">{project.location}</span>
               </div>
               <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium">{project.startDate} s/d {project.endDate}</span>
               </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-auto pt-4 border-t border-slate-100 space-y-2 mb-6">
               <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">Progres Pekerjaan</span>
                  <span className="text-xs font-black text-primary">{project.progress}%</span>
               </div>
               <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-in-out ${project.progress === 100 ? 'bg-emerald-500' : 'bg-primary'}`} 
                    style={{ width: `${project.progress}%` }}
                  />
               </div>
            </div>

            {/* Action Buttons */}
            <div className={`grid gap-3 mt-auto ${project.status === 'MENUNGGU SUBMISSION' ? 'grid-cols-1' : 'grid-cols-2'}`}>
               {project.status === 'MENUNGGU SUBMISSION' ? (
                 <Link 
                   href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}/prosedur`}
                   className="flex items-center justify-center gap-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 py-3 rounded-xl transition-all shadow-sm shadow-primary/30"
                 >
                   <FileSignature className="w-4 h-4" /> Mulai Pengajuan Dokumen K3
                 </Link>
               ) : (
                 <>
                   <button className="flex items-center justify-center gap-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 py-2.5 rounded-xl transition-colors">
                     Detail Proyek
                   </button>
                   <button 
                     disabled
                     className="flex items-center justify-center gap-2 text-sm font-bold text-slate-400 bg-slate-100 py-2.5 rounded-xl cursor-not-allowed"
                   >
                     Pengajuan Selesai
                   </button>
                 </>
               )}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
