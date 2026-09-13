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
}

const formatDayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
};

export default function PtwSafetyChecklistForm({
  ptwId, ptwType, validFrom, validTo, initialChecklist, editable,
}: PtwSafetyChecklistFormProps) {
  const router = useRouter();
  const [checklist, setChecklist] = useState<PtwSafetyChecklistData>(initialChecklist || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dayDates = ptwValidDayDates(validFrom, validTo);
  const typeDef = PTW_TYPES.find(t => t.id === ptwType) || PTW_TYPES[0];
  const rows = flattenSafetyChecklist(typeDef);

  if (dayDates.length === 0) return null;

  const entryFor = (key: string): { days: (boolean | null)[]; keterangan: string } =>
    checklist[key] || { days: Array(dayDates.length).fill(null), keterangan: '' };

  const toggleDay = (key: string, dayIndex: number, value: boolean) => {
    if (!editable) return;
    setChecklist(prev => {
      const current = entryFor(key);
      const days = [...current.days];
      days[dayIndex] = days[dayIndex] === value ? null : value;
      return { ...prev, [key]: { ...current, days } };
    });
  };

  const setKeterangan = (key: string, value: string) => {
    if (!editable) return;
    setChecklist(prev => {
      const current = entryFor(key);
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
    <details className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
      <summary className="cursor-pointer px-4 py-3 bg-slate-50 text-sm font-bold text-slate-700 hover:bg-slate-100">
        Safety Checklist Harian {editable ? '' : '(hanya lihat — PTW tidak aktif)'}
      </summary>
      <div className="p-4 space-y-3">
        <div className="overflow-x-auto">
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
                            className={`w-5 h-5 rounded text-[10px] font-bold border ${state === true ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-400 border-slate-200'} disabled:opacity-50`}
                            title="Sudah"
                          >S</button>
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={() => toggleDay(row.key!, dayIndex, false)}
                            className={`w-5 h-5 rounded text-[10px] font-bold border ${state === false ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-400 border-slate-200'} disabled:opacity-50`}
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

        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

        {editable && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
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
