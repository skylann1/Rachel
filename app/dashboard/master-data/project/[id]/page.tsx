import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Briefcase, MapPin, Calendar, Building2, Activity, Users, CheckCircle } from 'lucide-react';

const getMockProject = (id: string) => {
  return {
    id: decodeURIComponent(id),
    name: 'Penggalian Pipa Gas Area A - Tahap 2',
    vendorId: 'VND-001',
    vendorName: 'PT. Konstruksi Sejahtera',
    location: 'Plant A, Zona Merah',
    startDate: '2026-06-01',
    endDate: '2026-08-30',
    status: 'On Progress',
    progress: 45,
    description: 'Proyek penggalian dan pemasangan pipa gas bawah tanah sepanjang 2km di area plant A, mencakup pengelasan dan coating pipa.',
    picProject: 'Ahmad Maulana (PM Internal)'
  };
};

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const project = getMockProject(resolvedParams.id);

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
        <div className="flex gap-2 w-full sm:w-auto">
           <button 
             type="button" 
             className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
           >
             Batal
           </button>
           <button 
             type="button" 
             className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-sm shadow-primary/30"
           >
             <Save className="w-4 h-4" />
             Simpan Perubahan
           </button>
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
            <p className="text-lg font-black text-slate-800 bg-slate-50 px-3 py-1.5 rounded-lg inline-block border border-slate-100 mb-6">{project.id}</p>

            <div className="space-y-4">
               <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Status Pekerjaan</h3>
                  <select 
                     defaultValue={project.status}
                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm font-bold"
                  >
                     <option value="Preparation">Persiapan (Preparation)</option>
                     <option value="On Progress">Sedang Berjalan (On Progress)</option>
                     <option value="On Hold">Ditunda (On Hold)</option>
                     <option value="Completed">Selesai (Completed)</option>
                  </select>
               </div>
               
               <div>
                  <div className="flex justify-between items-end mb-2">
                     <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Progress Aktual</h3>
                     <span className="text-lg font-black text-primary">{project.progress}%</span>
                  </div>
                  <input 
                     type="range" 
                     min="0" max="100" 
                     defaultValue={project.progress}
                     className="w-full accent-primary"
                  />
               </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
             <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                   <CheckCircle className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                   <p className="text-sm font-bold text-slate-800">Status K3 Proyek</p>
                   <p className="text-xs text-slate-500 mt-1">Zero accident tercatat sejauh ini. JSA aktif ditaati dengan baik.</p>
                </div>
             </div>
          </div>
        </div>

        {/* Right Column: Main Form */}
        <div className="lg:col-span-2">
          <form className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-6 sm:p-8">
              
              {/* Seksi 1: Informasi Dasar */}
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-primary" />
                Informasi Utama Proyek
              </h2>
              
              <div className="space-y-5 mb-8">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Nama Pekerjaan / Proyek</label>
                  <input 
                    type="text" 
                    defaultValue={project.name}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm font-medium"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Deskripsi Pekerjaan</label>
                  <textarea 
                    defaultValue={project.description}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                  />
                </div>
              </div>

              {/* Seksi 2: Pelaksana & Lokasi */}
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-6 pt-6 border-t border-slate-100">
                <Building2 className="w-5 h-5 text-primary" />
                Pelaksana & Lokasi
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
                 <div className="space-y-2">
                   <label className="text-sm font-semibold text-slate-700">Vendor / Kontraktor</label>
                   <select 
                     defaultValue={project.vendorId}
                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                   >
                     <option value="VND-001">PT. Konstruksi Sejahtera</option>
                     <option value="VND-002">CV. Teknik Mesin Nusantara</option>
                     <option value="VND-003">PT. Solusi Elektrik</option>
                   </select>
                 </div>

                 <div className="space-y-2">
                   <label className="text-sm font-semibold text-slate-700">PIC Internal (Project Manager)</label>
                   <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <Users className="w-4 h-4 text-slate-400" />
                     </div>
                     <input 
                       type="text" 
                       defaultValue={project.picProject}
                       className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                     />
                   </div>
                 </div>

                 <div className="sm:col-span-2 space-y-2">
                   <label className="text-sm font-semibold text-slate-700">Lokasi / Area Kerja</label>
                   <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <MapPin className="w-4 h-4 text-slate-400" />
                     </div>
                     <input 
                       type="text" 
                       defaultValue={project.location}
                       className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                     />
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
                   <input 
                     type="date" 
                     defaultValue={project.startDate}
                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-sm font-semibold text-slate-700">Target Tanggal Selesai</label>
                   <input 
                     type="date" 
                     defaultValue={project.endDate}
                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                   />
                 </div>
              </div>

            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
