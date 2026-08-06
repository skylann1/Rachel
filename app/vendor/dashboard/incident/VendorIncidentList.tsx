'use client';

import React, { useMemo, useState } from 'react';
import { Search, Calendar, MapPin, ChevronDown, ChevronUp, FileSearch } from 'lucide-react';
import { VendorIncidentItem } from './actions';

const SEVERITY_BY_TYPE: Record<string, { label: string; cls: string }> = {
  Fatality: { label: 'Kritis', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  LTI: { label: 'Tinggi', cls: 'bg-rose-50 text-rose-600 border-rose-200' },
  'Medical Treatment': { label: 'Sedang', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  Environmental: { label: 'Sedang', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  'Property Damage': { label: 'Sedang', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  'First Aid': { label: 'Rendah', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  'Near Miss': { label: 'Rendah', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const STATUS_BADGE: Record<string, string> = {
  'Menunggu Investigasi': 'bg-amber-50 text-amber-700 border-amber-200',
  'Dalam Investigasi': 'bg-blue-50 text-blue-700 border-blue-200',
  'Investigasi Selesai': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Closed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export function VendorIncidentList({ incidents }: { incidents: VendorIncidentItem[] }) {
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return incidents;
    return incidents.filter(i =>
      i.id.toLowerCase().includes(q) ||
      i.location.toLowerCase().includes(q) ||
      i.type.toLowerCase().includes(q)
    );
  }, [incidents, query]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
            placeholder="Cari ID Insiden, jenis, atau lokasi..."
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center text-center">
          <FileSearch className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">
            {incidents.length === 0 ? 'Belum ada riwayat insiden yang dilaporkan.' : 'Tidak ada insiden yang cocok dengan pencarian.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold">Jenis / Tingkat</th>
                <th className="p-4 font-bold">Tanggal & Lokasi</th>
                <th className="p-4 font-bold">Status Internal</th>
                <th className="p-4 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inc) => {
                const severity = SEVERITY_BY_TYPE[inc.type] ?? { label: 'Rendah', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
                const isExpanded = expandedId === inc.id;
                return (
                  <React.Fragment key={inc.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{inc.type}</div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${severity.cls}`}>{severity.label}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-1">
                          <Calendar className="w-3.5 h-3.5" /> {new Date(inc.incident_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="w-3.5 h-3.5" /> {inc.location}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${STATUS_BADGE[inc.status] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {inc.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                         <button
                           onClick={() => setExpandedId(isExpanded ? null : inc.id)}
                           className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
                         >
                           Detail {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                         </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={4} className="p-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kronologi</p>
                              <p className="text-slate-700">{inc.chronology}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tindakan Segera</p>
                              <p className="text-slate-700">{inc.immediate_action || '—'}</p>
                            </div>
                            {(inc.rca_root_cause || inc.rca_corrective || inc.rca_preventive) && (
                              <>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Akar Masalah (RCA)</p>
                                  <p className="text-slate-700">{inc.rca_root_cause || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tindakan Korektif & Preventif</p>
                                  <p className="text-slate-700">{[inc.rca_corrective, inc.rca_preventive].filter(Boolean).join(' · ') || '—'}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
