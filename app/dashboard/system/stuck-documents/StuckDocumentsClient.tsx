'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertOctagon, AlertTriangle, CheckCircle2, Clock, RefreshCw, ExternalLink, UserX, Briefcase } from 'lucide-react';
import type { StuckReport, StuckSeverity, StuckDocument } from './types';

const SEVERITY_META: Record<StuckSeverity, { label: string; chip: string; bar: string; icon: React.ElementType }> = {
  high: { label: 'Kritis', chip: 'bg-rose-100 text-rose-700 border-rose-200', bar: 'bg-rose-500', icon: AlertOctagon },
  medium: { label: 'Perlu perhatian', chip: 'bg-amber-100 text-amber-700 border-amber-200', bar: 'bg-amber-400', icon: AlertTriangle },
  info: { label: 'Info', chip: 'bg-slate-100 text-slate-600 border-slate-200', bar: 'bg-slate-300', icon: Clock },
};

const DOC_BADGE: Record<StuckDocument['docType'], string> = {
  procedure: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  jsa: 'bg-amber-50 text-amber-700 border-amber-100',
  ptw: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

export default function StuckDocumentsClient({ report }: { report: StuckReport }) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | StuckSeverity>('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => ({
    high: report.documents.filter(d => d.severity === 'high').length,
    medium: report.documents.filter(d => d.severity === 'medium').length,
  }), [report.documents]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return report.documents.filter(d =>
      (filter === 'all' || d.severity === filter) &&
      (!q || d.projectName.toLowerCase().includes(q) || (d.vendorName || '').toLowerCase().includes(q)),
    );
  }, [report.documents, filter, search]);

  const healthy = report.inReview - report.documents.length;

  return (
    <div className="space-y-5">
      {/* Ringkasan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Sedang direview" value={report.inReview} tone="slate" />
        <SummaryCard label="Kritis" value={counts.high} tone="rose" />
        <SummaryCard label="Perlu perhatian" value={counts.medium} tone="amber" />
        <SummaryCard label="Sehat" value={Math.max(healthy, 0)} tone="emerald" />
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm w-fit">
          {([['all', 'Semua'], ['high', 'Kritis'], ['medium', 'Perlu perhatian']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} aria-pressed={filter === id}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${
                filter === id ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari proyek atau vendor…"
            className="w-full sm:w-64 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button onClick={() => router.refresh()} title="Muat ulang"
            className="shrink-0 p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-primary hover:border-primary transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Daftar */}
      {visible.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-16 flex flex-col items-center gap-2 text-center px-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          <p className="font-bold text-slate-800">
            {report.documents.length === 0 ? 'Tidak ada dokumen yang tersangkut' : 'Tidak ada hasil untuk filter ini'}
          </p>
          <p className="text-sm text-slate-500 max-w-md">
            {report.documents.length === 0
              ? 'Semua dokumen yang sedang direview punya penugas yang berwenang dan bergerak sesuai jadwal.'
              : 'Ubah filter atau kata kunci pencarian.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map(doc => <DocCard key={doc.key} doc={doc} />)}
        </ul>
      )}

      <p className="text-[11px] text-slate-400">
        Diperiksa {new Date(report.generatedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.
        Dokumen dianggap lama menunggu setelah 3 hari (kritis setelah 7 hari).
      </p>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'rose' | 'amber' | 'emerald' }) {
  const toneCls = {
    slate: 'text-slate-800', rose: 'text-rose-600', amber: 'text-amber-600', emerald: 'text-emerald-600',
  }[tone];
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className={`text-3xl font-black ${toneCls}`}>{value}</div>
      <div className="text-xs font-semibold text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function DocCard({ doc }: { doc: StuckDocument }) {
  const meta = SEVERITY_META[doc.severity];
  const Icon = meta.icon;
  return (
    <li className="relative bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-1.5 ${meta.bar}`} />
      <div className="p-5 pl-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold border rounded-full px-2 py-0.5 ${meta.chip}`}>
                <Icon className="w-3 h-3" /> {meta.label}
              </span>
              <span className={`text-[11px] font-bold border rounded-full px-2 py-0.5 ${DOC_BADGE[doc.docType]}`}>{doc.docLabel}</span>
            </div>
            <h3 className="font-bold text-slate-900 mt-2 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{doc.projectName}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {doc.vendorName ? `${doc.vendorName} · ` : ''}Tahap: <strong className="text-slate-700">{doc.stageLabel}</strong> · Status: {doc.status}
              {doc.waitingDays !== null && <> · {doc.waitingDays} hari di tahap ini</>}
            </p>
          </div>
          <Link href={`/dashboard/projects/${doc.projectId}`}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80">
            Buka proyek <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <ul className="space-y-2">
          {doc.issues.map(issue => (
            <li key={issue.code} className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
              <p className="text-sm font-bold text-slate-800">{issue.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{issue.detail}</p>
            </li>
          ))}
        </ul>

        {doc.assignees.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Penugas tahap ini</p>
            <div className="flex flex-wrap gap-1.5">
              {doc.assignees.map(a => (
                <span key={a.id}
                  className={`inline-flex items-center gap-1 text-xs font-semibold rounded-lg border px-2 py-1 ${
                    a.unauthorized
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : a.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-white text-slate-600 border-slate-200'
                  }`}>
                  {a.unauthorized && <UserX className="w-3 h-3" />}
                  {a.name}
                  <span className="font-normal opacity-70">
                    {a.unauthorized ? '· tidak berwenang' : a.status === 'approved' ? '· sudah setuju' : '· menunggu'}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
          <span className="text-slate-500">Penugasan tahap ini dikelola oleh <strong className="text-slate-700">{doc.ownerLabel}</strong>.</span>
          {doc.fixHref ? (
            <Link href={doc.fixHref}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white font-bold hover:bg-primary/90 transition-colors">
              Atur penugasan
            </Link>
          ) : (
            <span className="text-slate-400">
              {doc.vendorName ? `Minta admin ${doc.vendorName} menugaskan HSE/PM Vendor.` : 'Minta admin vendor menugaskan HSE/PM Vendor.'}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
