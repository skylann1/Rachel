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
} from 'lucide-react';

const mockProjects = [
  { 
    id: 'PRJ-001', 
    name: 'Penggalian Pipa Gas Area A', 
    jsaStatus: 'Approved', 
    ptwStatus: 'Aktif',
    date: '2026-06-25' 
  },
  { 
    id: 'PRJ-002', 
    name: 'Maintenance Kompresor B', 
    jsaStatus: 'Pending', 
    ptwStatus: 'Belum Terbit',
    date: '2026-06-26' 
  },
  { 
    id: 'PRJ-003', 
    name: 'Pengecatan Fasilitas', 
    jsaStatus: 'Rejected', 
    ptwStatus: 'Belum Terbit',
    date: '2026-06-28' 
  },
  { 
    id: 'PRJ-004', 
    name: 'Inspeksi Tangki T-04', 
    jsaStatus: 'Approved', 
    ptwStatus: 'Menunggu PM',
    date: '2026-06-29' 
  },
];

const mockTimeline = [
  { id: 1, title: 'PTW Diterbitkan', desc: 'PM memvalidasi PTW untuk Penggalian Pipa Gas Area A.', time: '2 jam yang lalu', type: 'success' },
  { id: 2, title: 'JSA Direject', desc: 'HSE menolak JSA Pengecatan Fasilitas. Silakan perbaiki mitigasi.', time: '5 jam yang lalu', type: 'danger' },
  { id: 3, title: 'JSA Diajukan', desc: 'Anda berhasil mengajukan JSA untuk Maintenance Kompresor B.', time: '1 hari yang lalu', type: 'info' },
];

export default async function VendorDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Proyek Aktif</h3>
            <div className="text-3xl font-black text-slate-800">4</div>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group flex items-start gap-4 relative overflow-hidden">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 transition-transform">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">JSA Perlu Revisi</h3>
            <div className="text-3xl font-black text-rose-600">1</div>
            <p className="text-xs font-semibold text-rose-500 mt-1">Butuh perhatian segera</p>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-rose-100 to-transparent opacity-50 rounded-bl-full" />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
            <FileSignature className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">PTW Terbit (Aktif)</h3>
            <div className="text-3xl font-black text-emerald-600">1</div>
            <p className="text-xs font-semibold text-emerald-600 mt-1">Siap untuk eksekusi</p>
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
                     <th className="px-5 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {mockProjects.map((project) => (
                      <tr key={project.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-5 py-4">
                           <div className="font-bold text-slate-800 mb-0.5">{project.name}</div>
                           <div className="text-xs text-slate-500 font-medium">Update: {project.date}</div>
                        </td>
                        <td className="px-5 py-4">
                           {project.jsaStatus === 'Approved' && <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg"><CheckCircle2 className="w-3.5 h-3.5" /> Disetujui</span>}
                           {project.jsaStatus === 'Pending' && <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg"><Clock className="w-3.5 h-3.5" /> Menunggu</span>}
                           {project.jsaStatus === 'Rejected' && <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg"><AlertTriangle className="w-3.5 h-3.5" /> Ditolak (Revisi)</span>}
                        </td>
                        <td className="px-5 py-4">
                           {project.ptwStatus === 'Aktif' && <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg"><Activity className="w-3.5 h-3.5" /> PTW Aktif</span>}
                           {project.ptwStatus === 'Menunggu PM' && <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg"><Clock className="w-3.5 h-3.5" /> Validasi PM</span>}
                           {project.ptwStatus === 'Belum Terbit' && <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">Belum Terbit</span>}
                        </td>
                        <td className="px-5 py-4 text-right">
                           <button className="text-sm font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-primary/20">
                             Detail
                           </button>
                        </td>
                      </tr>
                    ))}
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
