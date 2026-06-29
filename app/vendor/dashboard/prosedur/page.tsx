import React from 'react';
import Link from 'next/link';
import { Search, Plus, ClipboardList, Clock, CheckCircle2, AlertTriangle, Calendar, Eye, Trash2, FileSignature } from 'lucide-react';

const mockProsedur = [
  { id: 'SOP-2026-001', project: 'Perbaikan Pos Security Stasiun Muara Bekasi', date: '2026-06-25', status: 'Approved' },
  { id: 'SOP-2026-002', project: 'Maintenance Kompresor Stasiun B', date: '2026-06-26', status: 'Pending Review' },
  { id: 'SOP-2026-003', project: 'Pengecatan Fasilitas Pipa', date: '2026-06-20', status: 'Rejected' },
];

export default function ProsedurVendorPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Prosedur Kerja</h1>
          <p className="text-sm text-slate-500 mt-1">Daftar dokumen prosedur kerja yang telah diajukan untuk proyek Anda.</p>
        </div>
        <Link 
          href="/vendor/dashboard/projects"
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30"
        >
          <Plus className="w-4 h-4" />
          Buat Prosedur Baru
        </Link>
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
            placeholder="Cari ID Prosedur atau nama proyek..."
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select className="block w-full sm:w-48 pl-3 pr-10 py-2 text-base border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm rounded-xl bg-slate-50">
            <option>Semua Status</option>
            <option>Approved</option>
            <option>Pending Review</option>
            <option>Rejected</option>
          </select>
        </div>
      </div>

      {/* List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockProsedur.map((item) => (
          <div key={item.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group">
            
            <div className="p-5 border-b border-slate-100">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                  <FileSignature className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-end">
                   {item.status === 'Approved' && <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg"><CheckCircle2 className="w-3.5 h-3.5" /> Disetujui</span>}
                   {item.status === 'Pending Review' && <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg"><Clock className="w-3.5 h-3.5" /> Menunggu Review</span>}
                   {item.status === 'Rejected' && <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg"><AlertTriangle className="w-3.5 h-3.5" /> Ditolak</span>}
                </div>
              </div>
              
              <h3 className="text-sm font-bold text-primary mb-1">{item.id}</h3>
              <p className="text-base font-bold text-slate-800 line-clamp-2 leading-tight mb-4" title={item.project}>{item.project}</p>
              
              <div className="flex items-center justify-between mt-auto">
                 <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    {item.date}
                 </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
               <button className="text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Detail
               </button>
               {item.status !== 'Approved' && (
                 <button className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                 </button>
               )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
