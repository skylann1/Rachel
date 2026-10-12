'use client';

import React from 'react';
import { ClipboardCheck, ShieldCheck, Lock } from 'lucide-react';
import {
  PTW_TYPES, PtwType, PtwSafetyChecklistData, flattenSafetyChecklist, ptwValidDayDates,
} from '@/lib/ptw-types';
import { PTW_STATUS } from '@/lib/ptw-status';
import PtwSafetyChecklistForm from '@/components/ptw/PtwSafetyChecklistForm';

export interface SafetyCheckPtw {
  id: string;
  ptw_type?: string | null;
  ptw_number?: string | null;
  /** Status EFEKTIF (sudah memperhitungkan Expired), bukan nilai mentah di DB. */
  status: string;
  valid_from?: string | null;
  valid_to?: string | null;
  safety_checklist?: PtwSafetyChecklistData | null;
}

interface Props {
  ptws: SafetyCheckPtw[];
  /** true kalau caller punya ptw.edit_safety_checklist. Form hanya bisa diedit saat PTW Aktif. */
  canEdit: boolean;
}

/** Checklist baru relevan setelah PTW terbit; sebelum itu belum ada yang bisa diisi. */
const OPENED_STATUSES: string[] = [PTW_STATUS.aktif, PTW_STATUS.expired, PTW_STATUS.stoppedSwa];

function progressOf(ptw: SafetyCheckPtw) {
  const typeDef = PTW_TYPES.find(t => t.id === ptw.ptw_type) || PTW_TYPES[0];
  const days = ptwValidDayDates(ptw.valid_from, ptw.valid_to).length;
  const keys = flattenSafetyChecklist(typeDef).filter(r => r.checkable && r.key).map(r => r.key as string);
  const total = keys.length * days;
  let filled = 0;
  let belum = 0;
  const data = ptw.safety_checklist || {};
  keys.forEach(k => {
    (data[k]?.days || []).slice(0, days).forEach(v => {
      if (v === true || v === false) filled += 1;
      if (v === false) belum += 1;
    });
  });
  return { days, total, filled, belum, title: typeDef.title.split('(')[0].trim() };
}

const STATUS_CHIP: Record<string, string> = {
  [PTW_STATUS.aktif]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  [PTW_STATUS.expired]: 'bg-slate-100 text-slate-600 border-slate-200',
  [PTW_STATUS.stoppedSwa]: 'bg-rose-100 text-rose-700 border-rose-200',
};

const fmt = (iso?: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function PtwSafetyCheckTab({ ptws, canEdit }: Props) {
  if (ptws.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
        <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">Belum ada PTW di proyek ini.</p>
        <p className="text-xs mt-1">Safety Check tersedia setelah PTW diajukan dan diterbitkan.</p>
      </div>
    );
  }

  const opened = ptws.filter(p => OPENED_STATUSES.includes(p.status));
  const waiting = ptws.filter(p => !OPENED_STATUSES.includes(p.status));

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl border border-primary/10 px-5 py-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-slate-800">Safety Check Harian</p>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
            Ceklist keselamatan per PTW untuk setiap hari masa berlakunya. Tandai <strong>S</strong> (sudah) atau <strong>B</strong> (belum)
            per item. Hanya bisa diisi saat PTW berstatus <strong>Aktif</strong>.
          </p>
        </div>
      </div>

      {opened.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
          Belum ada PTW yang aktif. Checklist dibuka otomatis saat PTW terbit.
        </div>
      )}

      {opened.map(p => {
        const pr = progressOf(p);
        const pct = pr.total > 0 ? Math.round((pr.filled / pr.total) * 100) : 0;
        const editable = p.status === PTW_STATUS.aktif && canEdit;
        return (
          <section key={p.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">{pr.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {p.ptw_number ? <>No. <span className="font-mono">{p.ptw_number}</span> · </> : null}
                  Berlaku {fmt(p.valid_from)} – {fmt(p.valid_to)} · {pr.days} hari
                </p>
              </div>
              <span className={`self-start sm:self-auto text-[11px] font-bold border rounded-full px-2.5 py-1 ${STATUS_CHIP[p.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {p.status}
              </span>
            </div>

            <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-slate-600">Terisi {pr.filled} dari {pr.total} kolom</span>
                <span className="font-bold text-slate-500">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              {pr.belum > 0 && (
                <p className="text-[11px] font-bold text-rose-600 mt-2">{pr.belum} item ditandai Belum (B) — perlu ditindaklanjuti.</p>
              )}
            </div>

            <div className="px-5 pb-5">
              {pr.days === 0 ? (
                <p className="text-xs text-slate-500 mt-4">PTW ini belum punya masa berlaku, jadi belum ada kolom hari untuk diisi.</p>
              ) : (
                <>
                  {!editable && (
                    <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1.5">
                      <Lock className="w-3 h-3" />
                      {p.status !== PTW_STATUS.aktif ? 'Hanya lihat — PTW tidak aktif.' : 'Hanya lihat — Anda tidak punya izin mengisi checklist.'}
                    </p>
                  )}
                  <PtwSafetyChecklistForm
                    ptwId={p.id}
                    ptwType={(p.ptw_type || 'dingin') as PtwType}
                    validFrom={p.valid_from}
                    validTo={p.valid_to}
                    initialChecklist={p.safety_checklist || {}}
                    editable={editable}
                    defaultOpen
                  />
                </>
              )}
            </div>
          </section>
        );
      })}

      {waiting.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <p className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
            Menunggu terbit ({waiting.length})
          </p>
          <ul className="divide-y divide-slate-100">
            {waiting.map(p => (
              <li key={p.id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-700 truncate">{progressOf(p).title}</span>
                <span className="text-xs text-slate-500 shrink-0">{p.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
