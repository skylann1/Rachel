'use client';

import React, { useState } from 'react';
import { GitCompare, ChevronDown, ChevronRight, Plus, Minus, Pencil } from 'lucide-react';
import type { ChangeLogEntry, FieldChange } from '@/lib/prosedur-diff';

const DOC_LABEL: Record<string, string> = { jsa: 'JSA', ptw: 'PTW', procedure: 'Prosedur' };

function fmt(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
}

function ChangeRow({ c }: { c: FieldChange }) {
  const Icon = c.kind === 'add' ? Plus : c.kind === 'remove' ? Minus : Pencil;
  const tone = c.kind === 'add' ? 'text-emerald-600 bg-emerald-50' : c.kind === 'remove' ? 'text-rose-600 bg-rose-50' : 'text-amber-600 bg-amber-50';
  const side = (v: string | undefined, cls: string) =>
    v === undefined ? null : c.isImage
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={v} alt="" className="max-h-24 rounded-lg border border-slate-200 object-contain bg-white" />
      : <p className={`text-xs leading-relaxed whitespace-pre-wrap rounded-lg px-2.5 py-1.5 ${cls}`}>{v}</p>;
  return (
    <li className="flex gap-2.5">
      <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${tone}`}><Icon className="w-3 h-3" /></span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-bold text-slate-700">{c.label}</p>
        {side(c.before, 'bg-rose-50 text-rose-800 line-through decoration-rose-300')}
        {side(c.after, 'bg-emerald-50 text-emerald-800')}
      </div>
    </li>
  );
}

/**
 * Riwayat perubahan isi dokumen dari versi ke versi (content.changeLog) —
 * siapa mengubah apa dan kapan. Terlihat oleh semua pihak yang melihat dokumen.
 */
export function ChangeLogPanel({ entries }: { entries: ChangeLogEntry[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!entries || entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="bg-white border border-sky-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <GitCompare className="w-4 h-4 text-sky-600" />
        <h2 className="font-bold text-slate-800 text-sm">Riwayat Perubahan Dokumen</h2>
        <span className="text-[10px] font-bold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">{entries.length}x</span>
      </div>
      <ol className="space-y-2">
        {sorted.map((e) => {
          const isOpen = open === e.id;
          return (
            <li key={e.id} className="border border-slate-200 rounded-xl overflow-hidden">
              <button type="button" onClick={() => setOpen(isOpen ? null : e.id)} className="w-full flex items-start gap-2 px-3.5 py-3 text-left hover:bg-slate-50">
                {isOpen ? <ChevronDown className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">
                    {(e as any).docType && <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1.5">{DOC_LABEL[(e as any).docType] ?? (e as any).docType}</span>}
                    {e.actorName} <span className="text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-100 rounded px-1.5 py-0.5 ml-1">{e.actorLabel}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">{fmt(e.at)}</p>
                  <p className="text-xs text-slate-600 mt-1">{e.summary}</p>
                  {e.note && <p className="text-xs text-slate-500 italic mt-1">Catatan: {e.note}</p>}
                </div>
              </button>
              {isOpen && (
                <ul className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100">
                  {e.changes.map((c, i) => <ChangeRow key={i} c={c} />)}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
