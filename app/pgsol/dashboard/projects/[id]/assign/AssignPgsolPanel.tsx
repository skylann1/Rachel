'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { savePgsolAssignment } from '../../actions';

interface Candidate { id: string; full_name: string; }

export default function AssignPgsolPanel({
  projectId, docType, stageKey, candidates, currentAssigneeIds, locked,
}: {
  projectId: string; docType: 'procedure' | 'jsa' | 'ptw'; stageKey: string;
  candidates: Candidate[]; currentAssigneeIds: string[]; locked: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(currentAssigneeIds);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await savePgsolAssignment(projectId, docType, stageKey, selected);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
      {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">{error}</div>}
      {locked && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          Tahap ini sedang diproses — assignment terkunci sampai ditolak/diajukan ulang.
        </div>
      )}
      <div className="space-y-2">
        {candidates.length === 0 && <p className="text-sm text-slate-400">Tidak ada staff PGSOL dengan izin review tahap ini.</p>}
        {candidates.map(c => (
          <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              disabled={locked}
              checked={selected.includes(c.id)}
              onChange={(e) => setSelected(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))}
            />
            {c.full_name}
          </label>
        ))}
      </div>
      {!locked && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : null}
          Simpan
        </button>
      )}
    </div>
  );
}
