'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Search, Calendar, FileText, ArrowRight, MapPin, Building2 } from 'lucide-react';
import Link from 'next/link';
import { getInternalIncidents } from './actions';

export default function InternalIncidentInboxPage() {
  const [incidents, setIncidents] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const data = await getInternalIncidents();
      const formatted = data.map((d: any) => ({
        id: d.id,
        vendor: d.projects?.vendor_profiles?.company_name || 'Unknown Vendor',
        type: d.type,
        date: d.incident_date,
        location: d.location,
        status: d.status,
        severity: ['Fatality', 'Lost Time Injury'].includes(d.type) ? 'High' : (d.type === 'First Aid' || d.type === 'Near Miss' ? 'Low' : 'Medium')
      }));
      setIncidents(formatted);
    }
    load();
  }, []);
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-4 items-center">
           <div className="w-14 h-14 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
             <AlertTriangle className="w-7 h-7" />
           </div>
           <div>
             <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Inbox Insiden K3</h1>
             <p className="text-sm text-slate-500 mt-1">Daftar laporan kecelakaan kerja dan near miss dari seluruh vendor.</p>
           </div>
        </div>
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
              placeholder="Cari ID Insiden atau Vendor..."
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold">ID Insiden</th>
                <th className="p-4 font-bold">Vendor Pelapor</th>
                <th className="p-4 font-bold">Jenis / Tingkat</th>
                <th className="p-4 font-bold">Waktu & Lokasi</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Belum ada insiden yang dilaporkan.
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{inc.id}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 font-semibold text-slate-700">
                        <Building2 className="w-4 h-4 text-slate-400" /> {inc.vendor}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{inc.type}</div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                        inc.severity === 'Medium' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-blue-600 bg-blue-50 border-blue-200'
                      }`}>{inc.severity}</span>
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
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                        inc.status === 'Menunggu Investigasi' ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      }`}>
                        {inc.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                       <Link 
                         href={`/dashboard/incident/${inc.id}`}
                         className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
                       >
                         Investigasi <ArrowRight className="w-4 h-4" />
                       </Link>
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
