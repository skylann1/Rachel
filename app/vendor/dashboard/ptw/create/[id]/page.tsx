'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Stamp, CheckCircle2, Clock, XCircle, FileText, Plus } from 'lucide-react';
import { getPtwList } from './actions';
import { PTW_TYPES } from '@/lib/ptw-types';
import { PTW_STATUS, isPtwPending } from '@/lib/ptw-status';

interface PtwRow {
  id: string;
  ptw_type: string;
  status: string;
  ptw_number: string | null;
}

export default function PtwListPage() {
  const params = useParams();
  const projectId = typeof params.id === 'string' ? decodeURIComponent(params.id) : '';

  const [ptws, setPtws] = useState<PtwRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!projectId) return;
      const data = await getPtwList(projectId);
      setPtws(data as PtwRow[]);
      setIsLoading(false);
    }
    load();
  }, [projectId]);

  const rowFor = (typeId: string) => ptws.find(p => p.ptw_type === typeId);

  const statusBadge = (row?: PtwRow) => {
    if (!row) {
      return <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">Belum Diajukan</span>;
    }
    if (row.status === PTW_STATUS.aktif) {
      return (
        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Aktif{row.ptw_number ? ` — ${row.ptw_number}` : ''}
        </span>
      );
    }
    if (row.status === PTW_STATUS.draft) {
      return (
        <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full flex items-center gap-1">
          <XCircle className="w-3 h-3" /> Ditolak — Perlu Revisi
        </span>
      );
    }
    if (isPtwPending(row.status)) {
      return (
        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full flex items-center gap-1">
          <Clock className="w-3 h-3" /> {row.status}
        </span>
      );
    }
    return <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{row.status}</span>;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <Link href={`/vendor/dashboard/projects/${encodeURIComponent(projectId)}`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Detail Proyek
        </Link>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Stamp className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Permit to Work (PTW)</h1>
            <p className="text-sm text-slate-500 mt-1">
              Satu pekerjaan bisa membutuhkan lebih dari satu jenis izin kerja sekaligus (mis. Kerja Dingin + Kerja di Ketinggian + Kerja Panas). Pilih tipe yang dibutuhkan di bawah.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {isLoading ? (
          <p className="text-sm text-slate-400 text-center py-8">Memuat data PTW...</p>
        ) : (
          PTW_TYPES.map(type => {
            const row = rowFor(type.id);
            return (
              <Link
                key={type.id}
                href={`/vendor/dashboard/ptw/create/${encodeURIComponent(projectId)}/${type.id}`}
                className="flex items-center justify-between gap-4 p-5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: `${type.color}20`, color: type.color }}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-800">{type.title.split('(')[0].trim()}</div>
                    <div className="text-xs text-slate-400">{row ? 'Klik untuk lihat / revisi' : 'Klik untuk mengajukan'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {statusBadge(row)}
                  {!row && <Plus className="w-4 h-4 text-slate-400" />}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
