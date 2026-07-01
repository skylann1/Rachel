import React from 'react';
import { createClient } from "@/utils/supabase/server";
import Link from 'next/link';
import { 
  ClipboardList, 
  FileSignature, 
  Briefcase, 
  Plus, 
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity
} from 'lucide-react';import { getVendorDashboardData } from './actions';

const mockTimeline = [
  { id: 1, title: 'PTW Diterbitkan', desc: 'PM memvalidasi PTW untuk Penggalian Pipa Gas Area A.', time: '2 jam yang lalu', type: 'success' },
  { id: 2, title: 'JSA Direject', desc: 'HSE menolak JSA Pengecatan Fasilitas. Silakan perbaiki mitigasi.', time: '5 jam yang lalu', type: 'danger' },
  { id: 3, title: 'JSA Diajukan', desc: 'Anda berhasil mengajukan JSA untuk Maintenance Kompresor B.', time: '1 hari yang lalu', type: 'info' },
];

export default async function VendorDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { projects, stats } = await getVendorDashboardData();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">Dashboard Vendor</h1>
          <p className="text-slate-500 mt-1">
            Kelola pengajuan prosedur, pantau JSA, dan akses PTW proyek Anda.
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Link 
            href="/vendor/dashboard/jsa/create"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30"
          >
            <Plus className="w-4 h-4" />
            Buat JSA Baru
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Proyek</p>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
              <FileSignature className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">JSA Menunggu Review</p>
              <p className="text-2xl font-bold text-slate-800">{stats.pendingJsa}</p>
            </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">PTW Aktif</p>
              <p className="text-2xl font-bold text-slate-800">{stats.activePtw}</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Table Content - 2 Columns wide on Large Screens */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" /> Status Proyek Terkini
               </h2>
               <Link href="/vendor/dashboard/projects" className="text-sm font-bold text-primary hover:text-primary/80 flex items-center gap-1">
                 Lihat Semua <ArrowRight className="w-4 h-4" />
               </Link>
            </div>
            <div className="overflow-x-auto flex-1">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-white border-b border-slate-100">
                     <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Info Proyek</th>
                     <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status JSA (HSE)</th>
                     <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status PTW (PM)</th>
                     <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Update</th>
                     <th className="px-5 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {projects.map((project) => (
                      <tr key={project.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-5 py-4">
                           <div className="font-bold text-slate-800 mb-0.5">{project.name}</div>
                           <div className="text-xs text-slate-500 font-medium">ID: {project.id}</div>
                        </td>
                        <td className="px-5 py-4">
                           {project.jsaStatus === 'Approved' && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg"><CheckCircle2 className="w-3.5 h-3.5" /> Approved</span>}
                           {project.jsaStatus === 'Pending' && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg"><Clock className="w-3.5 h-3.5" /> Menunggu Review</span>}
                           {project.jsaStatus === 'Rejected' && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg"><AlertTriangle className="w-3.5 h-3.5" /> Ditolak</span>}
                           {project.jsaStatus === 'Belum Ada' && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg">Belum Ada</span>}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold border ${
                            project.ptwStatus === 'Aktif' ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50' : 
                            project.ptwStatus === 'Belum Terbit' ? 'bg-slate-50 text-slate-500 border-slate-200/50' :
                            project.ptwStatus === 'Ditolak' ? 'bg-rose-50 text-rose-600 border-rose-200/50' :
                            'bg-blue-50 text-blue-600 border-blue-200/50'
                          }`}>
                            {project.ptwStatus}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs font-medium text-slate-600">
                          {project.date}
                        </td>
                        <td className="px-5 py-4 text-right">
                           <Link href={`/vendor/dashboard/projects/${project.id}/prosedur`} className="text-sm font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-primary/20 inline-flex items-center gap-1.5">
                             Kelola K3 <ArrowRight className="w-3.5 h-3.5" />
                           </Link>
                        </td>
                      </tr>
                    ))}
                    {projects.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">Belum ada proyek yang dikerjakan.</td>
                      </tr>
                    )}
                 </tbody>
               </table>
            </div>
          </div>
        </div>

        {/* Sidebar Activity Timeline */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
             <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" /> Aktivitas Terakhir
             </h3>
             <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {mockTimeline.map((item) => (
                  <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                     <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm relative z-10 ${
                        item.type === 'success' ? 'bg-emerald-500 text-white' : 
                        item.type === 'danger' ? 'bg-rose-500 text-white' : 
                        'bg-blue-500 text-white'
                     }`}>
                        {item.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                        {item.type === 'danger' && <AlertTriangle className="w-5 h-5" />}
                        {item.type === 'info' && <ClipboardList className="w-5 h-5" />}
                     </div>
                     <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-100 bg-slate-50 shadow-sm transition-all group-hover:bg-white group-hover:shadow-md group-hover:border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                           <h4 className="font-bold text-slate-800 text-sm">{item.title}</h4>
                           <span className="text-[10px] font-bold text-slate-400">{item.time}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
