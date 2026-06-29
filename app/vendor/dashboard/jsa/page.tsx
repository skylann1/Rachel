import React from 'react';
import Link from 'next/link';
import { Search, Plus, ClipboardList, Clock, CheckCircle2, AlertTriangle, FileText, Calendar, Eye, Trash2 } from 'lucide-react';

const mockJSAs = [
  { id: 'JSA-2026-001', project: 'Penggalian Pipa Gas Area A - Tahap 2', date: '2026-06-25', status: 'Approved', riskLevel: 'High' },
  { id: 'JSA-2026-002', project: 'Maintenance Kompresor Stasiun B', date: '2026-06-26', status: 'Pending Review', riskLevel: 'Medium' },
  { id: 'JSA-2026-003', project: 'Pengecatan Fasilitas Pipa', date: '2026-06-20', status: 'Rejected', riskLevel: 'Low' },
];

export default function JSAVendorPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Pengajuan JSA</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola dan pantau status dokumen Job Safety Analysis (JSA) Anda.</p>
        </div>
        <Link 
          href="/vendor/dashboard/jsa/create"
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30"
        >
          <Plus className="w-4 h-4" />
          Buat JSA Baru
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
            placeholder="Cari ID JSA atau nama proyek..."
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select className="block w-full sm:w-48 pl-3 pr-10 py-2 text-base border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm rounded-xl bg-slate-50">
            <option>Semua Status</option>
            <option>Approved</option>
            <option>Pending Review</option>
            <option>Rejected</option>
            <option>Draft</option>
          </select>
        </div>
      </div>

      {/* JSA List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockJSAs.map((jsa) => (
          <div key={jsa.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group">
            
            <div className="p-5 border-b border-slate-100">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-end">
                   {jsa.status === 'Approved' && <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg"><CheckCircle2 className="w-3.5 h-3.5" /> Disetujui</span>}
                   {jsa.status === 'Pending Review' && <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg"><Clock className="w-3.5 h-3.5" /> Menunggu Review</span>}
                   {jsa.status === 'Rejected' && <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg"><AlertTriangle className="w-3.5 h-3.5" /> Ditolak</span>}
                </div>
              </div>
              
              <h3 className="text-sm font-bold text-primary mb-1">{jsa.id}</h3>
              <p className="text-base font-bold text-slate-800 line-clamp-2 leading-tight mb-4" title={jsa.project}>{jsa.project}</p>
              
              <div className="flex items-center justify-between mt-auto">
                 <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    {jsa.date}
                 </div>
                 <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="text-slate-400 uppercase tracking-wider text-[10px]">Tingkat Risiko:</span>
                    <span className={`${jsa.riskLevel === 'High' ? 'text-rose-600' : jsa.riskLevel === 'Medium' ? 'text-amber-600' : 'text-emerald-600'}`}>
                       {jsa.riskLevel}
                    </span>
                 </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
               <button className="text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Detail
               </button>
               {jsa.status !== 'Approved' && (
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
