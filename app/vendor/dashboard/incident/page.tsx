'use client';

import React from 'react';
import { AlertTriangle, Plus, Search, Calendar, FileText, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const mockIncidents = [
  {
    id: 'INC-2026-001',
    type: 'Near Miss',
    date: '2026-06-28',
    location: 'Area Boiler 1',
    status: 'Investigasi Selesai',
    severity: 'Medium'
  }
];

export default function VendorIncidentInboxPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-4 items-center">
           <div className="w-14 h-14 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
             <AlertTriangle className="w-7 h-7" />
           </div>
           <div>
             <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Laporan Insiden K3</h1>
             <p className="text-sm text-slate-500 mt-1">Riwayat pelaporan insiden dan kecelakaan kerja di proyek Anda.</p>
           </div>
        </div>
        <Link 
          href="/vendor/dashboard/incident/create"
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm shadow-rose-600/30"
        >
          <Plus className="w-5 h-5" />
          Lapor Insiden Baru
        </Link>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
              placeholder="Cari ID Insiden atau Lokasi..."
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold">ID Insiden</th>
                <th className="p-4 font-bold">Jenis / Tingkat</th>
                <th className="p-4 font-bold">Tanggal & Lokasi</th>
                <th className="p-4 font-bold">Status Internal</th>
                <th className="p-4 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mockIncidents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Belum ada riwayat insiden yang dilaporkan.
                  </td>
                </tr>
              ) : (
                mockIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{inc.id}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{inc.type}</div>
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">{inc.severity}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-1">
                        <Calendar className="w-3.5 h-3.5" /> {inc.date}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5" /> {inc.location}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                        {inc.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                       <button className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:text-primary/80 transition-colors">
                         Detail <ArrowRight className="w-4 h-4" />
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
