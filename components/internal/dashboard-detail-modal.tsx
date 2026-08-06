"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, Inbox, ArrowRight } from 'lucide-react';
import { DetailRecord } from '@/app/dashboard/actions/dashboard-detail';

const GOOD_STATUSES = ['Selesai', 'Prosedur Disetujui', 'JSA Disetujui', 'PTW Aktif', 'Disetujui', 'Closed', 'On Schedule', 'Safe Act', 'Safe Condition'];
const CRITICAL_STATUSES = ['Ditolak', 'Terlambat', 'Open', 'Unsafe Act', 'Unsafe Condition'];

function statusTone(status: string): string {
  if (GOOD_STATUSES.includes(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (CRITICAL_STATUSES.includes(status)) return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export interface DetailModalConfig {
  title: string;
  fetchFn: () => Promise<DetailRecord[]>;
  viewAllHref: string;
  viewAllLabel: string;
}

export function DashboardDetailModal({ config, onClose }: { config: DetailModalConfig | null; onClose: () => void }) {
  const router = useRouter();
  const [records, setRecords] = useState<DetailRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    setLoading(true);
    setRecords([]);
    config.fetchFn().then((data) => {
      if (!cancelled) {
        setRecords(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [config]);

  if (!config) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800">{config.title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-xs">Memuat data...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Inbox className="w-8 h-8" />
              <p className="text-xs">Belum ada data.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {records.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => { router.push(r.href); onClose(); }}
                    className="w-full text-left py-3 flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-primary transition-colors">{r.title}</p>
                      <p className="text-xs text-slate-400 truncate">{r.subtitle}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${statusTone(r.status)}`}>
                      {r.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 shrink-0">
          <button
            onClick={() => { router.push(config.viewAllHref); onClose(); }}
            className="w-full flex items-center justify-center gap-1.5 text-sm font-bold text-primary hover:text-primary/80 transition-colors py-1.5"
          >
            {config.viewAllLabel} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
