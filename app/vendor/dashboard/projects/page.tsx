'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RISK_META, parseRiskLevel, riskCardClasses } from '@/lib/project-risk';
import { Search, Briefcase, MapPin, Calendar, ArrowRight, FileSignature, Loader2, CalendarClock } from 'lucide-react';
import { getVendorProjects } from './actions';
import { getEffectivePtwStatus, PTW_STATUS } from '@/lib/ptw-status';
import { PROCEDURE_STATUS, isProcedurePending } from '@/lib/procedure-status';
import { JSA_STATUS } from '@/lib/jsa-status';
import { getExpiry } from '@/lib/document-expiry';
import { DataTable, DataHead, EmptyRow, ROW_CLS, CELL_CLS, ACTION_LINK_CLS } from '@/components/ui/data-table';

type ProsedurDocRow = { status: string };
type PtwRow = { status: string; valid_to: string | null };
interface VendorProjectRow {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  progress: number | null;
  contract_number: string | null;
  risk_level: string | null;
  procedures: ProsedurDocRow[] | ProsedurDocRow | null;
  jsa: ProsedurDocRow[] | ProsedurDocRow | null;
  ptw: PtwRow[] | PtwRow | null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    'Menunggu Review':                  'bg-amber-100 text-amber-700',
    [PROCEDURE_STATUS.menungguReviewPM]: 'bg-amber-100 text-amber-700',
    'Revisi Prosedur':                  'bg-rose-100 text-rose-700',
    [PROCEDURE_STATUS.approved]:        'bg-sky-100 text-sky-700',
    [JSA_STATUS.approved]:              'bg-violet-100 text-violet-700',
    [PTW_STATUS.aktif]:                 'bg-emerald-100 text-emerald-700',
    [PTW_STATUS.expired]:               'bg-slate-200 text-slate-600',
    'PTW Ditutup':                      'bg-emerald-100 text-emerald-700',
    'Selesai':                          'bg-slate-100 text-slate-600',
    'Ditolak':                          'bg-rose-100 text-rose-700',
  };
  return (
    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

type StatusFilter = 'semua' | 'berjalan' | 'selesai';

export default function VendorProjectsPage() {
  const [projects, setProjects] = useState<VendorProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('semua');

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getVendorProjects();
      if (alive) {
        setProjects(data);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter(p => {
        if (statusFilter === 'selesai') return p.status === 'Selesai';
        if (statusFilter === 'berjalan') return p.status !== 'Selesai';
        return true;
      })
      .filter(p => {
        if (!q) return true;
        return [p.name, p.location, p.contract_number].filter(Boolean).join(' ').toLowerCase().includes(q);
      });
  }, [projects, query, statusFilter]);

  // Sisa masa berlaku PTW aktif terdekat — untuk peringatan di kartu.
  const getPtwExpiry = (project: VendorProjectRow) => {
    const ptws: PtwRow[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
    const validTo = ptws
      .map(p => ({ eff: getEffectivePtwStatus(p.status, p.valid_to ?? project.end_date), vt: p.valid_to ?? project.end_date }))
      .filter(x => x.eff === PTW_STATUS.aktif && Boolean(x.vt))
      .map(x => x.vt)
      .sort()[0] || null;
    return validTo ? getExpiry(validTo) : null;
  };

  // Determine next action based on project status
  const getComputedStatus = (project: VendorProjectRow) => {
    // Satu proyek bisa punya beberapa PTW sekaligus (tipe berbeda).
    const ptws: PtwRow[] = Array.isArray(project.ptw) ? project.ptw : (project.ptw ? [project.ptw] : []);
    const jsa = Array.isArray(project.jsa) ? project.jsa[0] : project.jsa;
    const prosedur = Array.isArray(project.procedures) ? project.procedures[0] : project.procedures;

    const effectivePtwStatuses = ptws.map(p => getEffectivePtwStatus(p.status, p.valid_to ?? project.end_date));
    if (project.status === 'Selesai') return 'Selesai';
    if (effectivePtwStatuses.some(s => s === PTW_STATUS.expired)) return PTW_STATUS.expired;
    // Semua PTW sudah ditutup: langkah berikutnya mengajukan penyelesaian proyek.
    if (ptws.length > 0 && effectivePtwStatuses.every(s => s === PTW_STATUS.selesai)) return 'PTW Ditutup';
    // Aktif / sedang diajukan penutupannya / sudah ditutup — pekerjaan masih berjalan.
    if (ptws.length > 0 && effectivePtwStatuses.every(s => s === PTW_STATUS.aktif || s === PTW_STATUS.penutupanDiajukan || s === PTW_STATUS.selesai)) return PTW_STATUS.aktif;
    if (jsa?.status === JSA_STATUS.approved) return JSA_STATUS.approved;
    if (prosedur?.status === PROCEDURE_STATUS.approved) return PROCEDURE_STATUS.approved;
    // "Review HSE/PM Vendor" tidak masuk isProcedurePending (itu buat task
    // list internal) — tapi di sisi vendor dokumennya sedang direview, jadi
    // tetap tampilkan sebagai menunggu review, bukan jatuh ke status proyek.
    if (isProcedurePending(prosedur?.status) || prosedur?.status === PROCEDURE_STATUS.reviewHseVendor || prosedur?.status === PROCEDURE_STATUS.reviewPmVendor) return PROCEDURE_STATUS.menungguReviewPM;
    if (prosedur?.status === PROCEDURE_STATUS.draft) return 'Revisi Prosedur';
    return project.status;
  };

  const getActionButton = (project: VendorProjectRow) => {
    const computedStatus = getComputedStatus(project);
    switch (computedStatus) {
      case PROCEDURE_STATUS.menungguReviewPM:
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 py-2.5 rounded-xl transition-colors"
          >
            ⏳ Menunggu Review PM
          </Link>
        );
      case 'Revisi Prosedur':
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 py-3 rounded-xl transition-all shadow-sm shadow-rose-500/30"
          >
            ⚠️ Revisi Prosedur Kerja
          </Link>
        );
      case 'Menunggu Review':
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 py-3 rounded-xl transition-all shadow-sm shadow-primary/30"
          >
            <FileSignature className="w-4 h-4" /> Lengkapi Prosedur
          </Link>
        );
      case PROCEDURE_STATUS.approved:
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 py-2.5 rounded-xl transition-colors"
          >
            Buat JSA <ArrowRight className="w-4 h-4" />
          </Link>
        );
      case JSA_STATUS.approved:
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 py-2.5 rounded-xl transition-colors"
          >
            Ajukan PTW <ArrowRight className="w-4 h-4" />
          </Link>
        );
      case PTW_STATUS.aktif:
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 py-2.5 rounded-xl transition-colors"
          >
            ✅ PTW Aktif — Pekerjaan Berjalan <ArrowRight className="w-4 h-4" />
          </Link>
        );
      case 'PTW Ditutup':
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 py-3 rounded-xl transition-all shadow-sm shadow-emerald-600/30"
          >
            Ajukan Penyelesaian Proyek <ArrowRight className="w-4 h-4" />
          </Link>
        );
      case PTW_STATUS.expired:
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200 py-2.5 rounded-xl transition-colors"
          >
            PTW Kedaluwarsa — Ajukan Ulang
          </Link>
        );
      case 'Selesai':
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-white bg-slate-700 hover:bg-slate-800 py-3 rounded-xl transition-all shadow-sm shadow-slate-700/30"
          >
            Lihat Detail Proyek <ArrowRight className="w-4 h-4" />
          </Link>
        );
      default:
        return (
          <Link
            href={`/vendor/dashboard/projects/${encodeURIComponent(project.id)}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 py-2.5 rounded-xl transition-colors"
          >
            Lihat Detail <ArrowRight className="w-4 h-4" />
          </Link>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Proyek Saya</h1>
          <p className="text-sm text-slate-500 mt-1">
            Semua pekerjaan/proyek perusahaan Anda — yang sedang berjalan maupun yang sudah selesai.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm transition-all"
            placeholder="Cari nama proyek atau lokasi..."
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 w-full sm:w-auto">
          {([
            { key: 'semua', label: 'Semua' },
            { key: 'berjalan', label: 'Berjalan' },
            { key: 'selesai', label: 'Selesai' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === tab.key
                  ? 'bg-white text-primary shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
          <Loader2 className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Memuat proyek...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="font-bold text-slate-700 mb-1">Belum Ada Proyek</h3>
          <p className="text-sm text-slate-500">Proyek Anda akan muncul di sini setelah Admin/PM menetapkan pekerjaan untuk perusahaan Anda.</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="font-bold text-slate-700 mb-1">Tidak Ada Proyek Cocok</h3>
          <p className="text-sm text-slate-500">
            {query
              ? <>Tidak ada proyek yang cocok dengan &ldquo;{query}&rdquo;.</>
              : 'Tidak ada proyek pada filter ini.'}
          </p>
        </div>
      ) : (
        <DataTable minWidth={1000}>
          <DataHead columns={[
            { label: 'Proyek' }, { label: 'Lokasi / Periode' }, { label: 'Progres', className: 'w-44' }, { label: 'Status' }, { label: 'Aksi', className: 'text-right' },
          ]} />
          <tbody className="divide-y divide-slate-100">
            {filteredProjects.map((project) => {
              const ptwExpiry = getPtwExpiry(project);
              const risk = parseRiskLevel(project.risk_level);
              const progress = project.progress || 0;
              return (
                <tr key={project.id} className={ROW_CLS}>
                  <td className={`${CELL_CLS} max-w-xs`}>
                    <p className="font-semibold text-slate-800 line-clamp-2">{project.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 uppercase">No. {project.contract_number || '-'}</p>
                    {risk && (
                      <span className={`mt-1 inline-flex items-center gap-1.5 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${RISK_META[risk].badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${RISK_META[risk].dot}`} />
                        {RISK_META[risk].label}
                      </span>
                    )}
                  </td>
                  <td className={`${CELL_CLS} text-xs text-slate-600 space-y-1`}>
                    <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />{project.location || '-'}</div>
                    <div className="flex items-center gap-1.5 whitespace-nowrap"><Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />{project.start_date} s/d {project.end_date}</div>
                  </td>
                  <td className={CELL_CLS}>
                    <div className="flex justify-between text-[11px] font-bold mb-1">
                      <span className="text-slate-400 uppercase">Progres</span>
                      <span className="text-primary">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
                    </div>
                  </td>
                  <td className={`${CELL_CLS} space-y-1.5`}>
                    <StatusBadge status={getComputedStatus(project)} />
                    {ptwExpiry?.status === 'expiring' && (
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700">
                        <CalendarClock className="w-3.5 h-3.5 shrink-0" /> PTW berakhir {ptwExpiry.daysLeft} hari lagi
                      </div>
                    )}
                  </td>
                  <td className={`${CELL_CLS} text-right`}>
                    <div className="inline-block text-left [&>a]:w-full [&>a]:py-1.5 [&>a]:px-3 [&>a]:text-xs [&>a]:rounded-lg [&>a]:whitespace-nowrap [&>a]:shadow-none">
                      {getActionButton(project)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
