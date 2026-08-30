'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { saveStageAssignment } from '../actions';

interface Candidate { id: string; full_name: string; }
interface StageSlot {
  stageKey: string;
  label: string;
  candidates: Candidate[];
  currentAssigneeIds: string[];
  locked: boolean; // true kalau ada baris non-pending, tidak bisa diedit
}

export default function AssignmentPanel({ projectId, slots }: { projectId: string; slots: StageSlot[] }) {
  const [selections, setSelections] = useState<Record<string, string[]>>(
    Object.fromEntries(slots.map(s => [s.stageKey, s.currentAssigneeIds]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [savedStageKey, setSavedStageKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(stageKey: string) {
    setSaving(stageKey);
    setError(null);
    const result = await saveStageAssignment(projectId, stageKey, selections[stageKey] || []);
    setSaving(null);
    if (result.error) {
      setError(result.error);
    } else {
      setSavedStageKey(stageKey);
      setTimeout(() => setSavedStageKey(null), 2000);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>
      )}
      {slots.map(slot => (
        <div key={slot.stageKey} className="border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-800">{slot.label}</h4>
            {slot.locked && (
              <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Sedang diproses — terkunci</span>
            )}
          </div>
          <div className="space-y-2">
            {slot.candidates.length === 0 && (
              <p className="text-xs text-slate-400">Tidak ada staff dengan izin untuk tahap ini.</p>
            )}
            {slot.candidates.map(c => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  disabled={slot.locked}
                  checked={(selections[slot.stageKey] || []).includes(c.id)}
                  onChange={(e) => {
                    setSelections(prev => {
                      const cur = prev[slot.stageKey] || [];
                      return {
                        ...prev,
                        [slot.stageKey]: e.target.checked ? [...cur, c.id] : cur.filter(id => id !== c.id),
                      };
                    });
                  }}
                />
                {c.full_name}
              </label>
            ))}
          </div>
          {!slot.locked && (
            <button
              onClick={() => handleSave(slot.stageKey)}
              disabled={saving === slot.stageKey}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
            >
              {saving === slot.stageKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : savedStageKey === slot.stageKey ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
              Simpan
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
