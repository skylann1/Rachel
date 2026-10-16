'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import {
  PTW_TYPES, PtwType, PtwSafetyChecklistData, flattenSafetyChecklist, ptwValidDayDates,
} from '@/lib/ptw-types';
import { updatePtwSafetyChecklist } from '@/lib/ptw-safety-checklist';

export interface PtwSafetyChecklistFormProps {
  ptwId: string;
  ptwType: PtwType;
  validFrom?: string | null;
  validTo?: string | null;
  initialChecklist?: PtwSafetyChecklistData;
  editable: boolean;
  /** true = panel langsung terbuka (dipakai tab Safety Check). */
  defaultOpen?: boolean;
}

const formatDayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
};

export default function PtwSafetyChecklistForm({
  ptwId, ptwType, validFrom, validTo, initialChecklist, editable, defaultOpen = false,
}: PtwSafetyChecklistFormProps) {
  const router = useRouter();
  const [checklist, setChecklist] = useState<PtwSafetyChecklistData>(initialChecklist || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  /** Hari yang sedang dibuka di tampilan HP (indeks kolom hari). */
  const [mobileDay, setMobileDay] = useState(0);

  const dayDates = ptwValidDayDates(validFrom, validTo);
  const typeDef = PTW_TYPES.find(t => t.id === ptwType) || PTW_TYPES[0];
  const rows = flattenSafetyChecklist(typeDef);

  if (dayDates.length === 0) return null;

  const entryFor = (key: string): { days: (boolean | null)[]; keterangan: string } =>
    checklist[key] || { days: Array(dayDates.length).fill(null), keterangan: '' };

  const toggleDay = (key: string, dayIndex: number, value: boolean) => {
    if (!editable) return;
    setChecklist(prev => {
      const current = prev[key] || { days: Array(dayDates.length).fill(null), keterangan: '' };
      const days = [...current.days];
      days[dayIndex] = days[dayIndex] === value ? null : value;
      return { ...prev, [key]: { ...current, days } };
    });
  };

  const setKeterangan = (key: string, value: string) => {
    if (!editable) return;
    setChecklist(prev => {
      const current = prev[key] || { days: Array(dayDates.length).fill(null), keterangan: '' };
      return { ...prev, [key]: { ...current, keterangan: value } };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const res = await updatePtwSafetyChecklist(ptwId, checklist);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSavedAt(Date.now());
    router.refresh();
  };

  return (
    <details open={defaultOpen} className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
      <summary className="cursor-pointer px-4 py-3 bg-slate-50 text-sm font-bold text-slate-700 hover:bg-slate-100">
        Safety Checklist Harian {editable ? '' : '(hanya lihat — PTW tidak aktif)'}
      </summary>
      <div className="p-4 space-y-3">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-2 py-2 font-bold min-w-[220px]">Item</th>
                {dayDates.map((d, i) => (
                  <th key={d} className="px-1 py-2 font-bold text-center min-w-[70px]">
                    Hari {i + 1}
                    <div className="font-normal text-slate-400">{formatDayLabel(d)}</div>
                  </th>
                ))}
                <th className="px-2 py-2 font-bold min-w-[160px]">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.key ?? `hdr-${i}`} className="border-b border-slate-100">
                  <td className={`px-2 py-1.5 ${row.indent ? 'pl-6' : ''} ${row.bold ? 'font-bold' : ''}`}>
                    {row.marker ? `${row.marker} ` : ''}{row.label}
                  </td>
                  {row.checkable ? dayDates.map((_, dayIndex) => {
                    const entry = entryFor(row.key!);
                    const state = entry.days[dayIndex];
                    return (
                      <td key={dayIndex} className="px-1 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={() => toggleDay(row.key!, dayIndex, true)}
                            className={`w-6 h-6 rounded text-[10px] font-bold border ${state === true ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-400 border-slate-200'} disabled:opacity-50`}
                            title="Sudah"
                          >S</button>
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={() => toggleDay(row.key!, dayIndex, false)}
                            className={`w-6 h-6 rounded text-[10px] font-bold border ${state === false ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-400 border-slate-200'} disabled:opacity-50`}
                            title="Belum"
                          >B</button>
                        </div>
                      </td>
                    );
                  }) : dayDates.map((_, dayIndex) => <td key={dayIndex}></td>)}
                  <td className="px-2 py-1.5">
                    {row.checkable ? (
                      <input
                        type="text"
                        disabled={!editable}
                        value={entryFor(row.key!).keterangan}
                        onChange={e => setKeterangan(row.key!, e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 disabled:opacity-50 disabled:bg-slate-50"
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tampilan HP: satu hari per layar, satu kartu per item */}
        <div className="md:hidden space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
            {dayDates.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => setMobileDay(i)}
                aria-pressed={mobileDay === i}
                className={`shrink-0 px-3 py-2 rounded-xl border text-xs font-bold text-left transition-colors ${
                  mobileDay === i ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Hari {i + 1}
                <span className={`block font-normal ${mobileDay === i ? 'text-white/80' : 'text-slate-400'}`}>{formatDayLabel(d)}</span>
              </button>
            ))}
          </div>

          <ul className="space-y-2">
            {rows.map((row, i) => {
              if (!row.checkable) {
                return (
                  <li key={row.key ?? `hdr-${i}`} className="pt-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                    {row.marker ? `${row.marker} ` : ''}{row.label}
                  </li>
                );
              }
              const entry = entryFor(row.key!);
              const state = entry.days[mobileDay] ?? null;
              return (
                <li key={row.key!} className={`rounded-xl border p-3 space-y-2.5 ${
                  state === false ? 'border-rose-200 bg-rose-50/50' : state === true ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'
                } ${row.indent ? 'ml-3' : ''}`}>
                  <p className="text-sm text-slate-800 leading-snug">{row.marker ? `${row.marker} ` : ''}{row.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => toggleDay(row.key!, mobileDay, true)}
                      aria-pressed={state === true}
                      className={`h-11 rounded-lg border text-sm font-bold disabled:opacity-60 ${state === true ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-500 border-slate-200'}`}
                    >Sudah</button>
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => toggleDay(row.key!, mobileDay, false)}
                      aria-pressed={state === false}
                      className={`h-11 rounded-lg border text-sm font-bold disabled:opacity-60 ${state === false ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-500 border-slate-200'}`}
                    >Belum</button>
                  </div>
                  <input
                    type="text"
                    disabled={!editable}
                    value={entry.keterangan}
                    onChange={e => setKeterangan(row.key!, e.target.value)}
                    placeholder="Keterangan (jika ada)"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 disabled:opacity-60 disabled:bg-slate-50"
                  />
                </li>
              );
            })}
          </ul>
        </div>

        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

        {editable && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="w-full sm:w-auto justify-center px-4 py-3 sm:py-2 text-sm sm:text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {saving ? 'Menyimpan...' : 'Simpan Checklist'}
            </button>
            {savedAt && !saving && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Tersimpan
              </span>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
