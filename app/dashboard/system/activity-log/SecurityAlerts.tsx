'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, Info } from 'lucide-react';
import { getSecurityAlerts } from './actions';
import type { AlertSeverity, SecurityAlert } from './types';
import { timeAgo } from './activity-ui';

const REFRESH_MS = 60_000;

const SEVERITY: Record<AlertSeverity, { row: string; icon: React.ComponentType<{ className?: string }>; iconColor: string; label: string; chip: string }> = {
  high: { row: 'bg-rose-50 border-rose-200', icon: ShieldAlert, iconColor: 'text-rose-600', label: 'Tinggi', chip: 'bg-rose-200/80 text-rose-900' },
  medium: { row: 'bg-amber-50 border-amber-200', icon: AlertTriangle, iconColor: 'text-amber-600', label: 'Sedang', chip: 'bg-amber-200/80 text-amber-900' },
  info: { row: 'bg-sky-50 border-sky-200', icon: Info, iconColor: 'text-sky-600', label: 'Info', chip: 'bg-sky-200/80 text-sky-900' },
};

/**
 * Sinyal keamanan 24 jam terakhir dari log login (lihat getSecurityAlerts).
 * Kalau tidak ada yang perlu perhatian, ciut jadi satu baris tenang supaya
 * tidak memakan ruang di atas tab.
 */
export default function SecurityAlerts({ initialAlerts }: { initialAlerts: SecurityAlert[] }) {
  const [alerts, setAlerts] = useState(initialAlerts);

  useEffect(() => {
    const id = setInterval(() => { getSecurityAlerts().then(setAlerts).catch(() => {}); }, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 bg-emerald-50/60 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm text-emerald-800">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span className="font-semibold">Tidak ada peringatan keamanan dalam 24 jam terakhir.</span>
      </div>
    );
  }

  const highCount = alerts.filter(a => a.severity === 'high').length;

  return (
    <section aria-label="Peringatan keamanan" className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
        <ShieldAlert className={`w-4 h-4 ${highCount > 0 ? 'text-rose-600' : 'text-amber-600'}`} />
        <h2 className="text-sm font-bold text-slate-800">Peringatan Keamanan</h2>
        <span className="text-xs font-bold text-slate-400">{alerts.length} dalam 24 jam terakhir</span>
      </div>
      <ul className="p-3 space-y-2 max-h-72 overflow-y-auto">
        {alerts.map(a => {
          const s = SEVERITY[a.severity];
          const Icon = s.icon;
          return (
            <li key={a.id} className={`flex gap-3 rounded-xl border px-3.5 py-3 ${s.row}`}>
              <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${s.iconColor}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-800">{a.title}</span>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${s.chip}`}>{s.label}</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 break-words">{a.detail}</p>
              </div>
              <span className="text-[11px] text-slate-400 shrink-0">{timeAgo(a.at)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
