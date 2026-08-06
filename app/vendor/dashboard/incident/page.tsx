import React from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import Link from 'next/link';
import { getVendorIncidents } from './actions';
import { VendorIncidentList } from './VendorIncidentList';

export default async function VendorIncidentInboxPage() {
  const incidents = await getVendorIncidents();

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

      <VendorIncidentList incidents={incidents} />
    </div>
  );
}
