'use client';

import { useState } from 'react';
import { RISK_LEVELS, RISK_META, parseRiskLevel, type RiskLevel } from '@/lib/project-risk';
import { updateProjectRisk } from '../actions';

export default function ProjectRiskEditor({ projectId, initialLevel }: { projectId: string; initialLevel: string | null }) {
  const [level, setLevel] = useState<RiskLevel | null>(parseRiskLevel(initialLevel));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function choose(next: RiskLevel) {
    if (next === level || saving) return;
    const previous = level;
    setLevel(next);
    setSaving(true);
    setError('');
    try {
      await updateProjectRisk(projectId, next);
    } catch (e) {
      setLevel(previous);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Kategori Risiko Proyek">
        {RISK_LEVELS.map(l => {
          const selected = level === l;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={saving}
              onClick={() => choose(l)}
              className={`px-2 py-2 rounded-xl border text-[11px] font-bold transition-all disabled:opacity-60 ${selected ? RISK_META[l].badge + ' ring-2 ring-offset-1 ring-current' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              {RISK_META[l].label.replace(' Risk', '')}
            </button>
          );
        })}
      </div>
      {!level && <p className="text-xs text-slate-400 mt-1">Belum diatur. Pilih level untuk membedakan kartu proyek.</p>}
      {error && <p className="text-xs text-rose-600 font-medium mt-1">{error}</p>}
    </div>
  );
}
