'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, CheckCircle2, Lock, Check, FileText, ShieldAlert, ClipboardList, Undo2, UserCheck, HardHat } from 'lucide-react';
import { savePgsolAssignment } from '../actions';

type DocType = 'procedure' | 'jsa' | 'ptw';

export interface AssignCandidate { id: string; full_name: string; }

export interface AssignStage {
  stageKey: string;
  role: 'HSE' | 'PM PGSOL';
  candidates: AssignCandidate[];
  currentIds: string[];
  locked: boolean;
}

export interface AssignGroup {
  docType: DocType;
  title: string;
  stages: AssignStage[];
}

const GROUP_ICON: Record<DocType, typeof FileText> = {
  procedure: FileText,
  jsa: ClipboardList,
  ptw: ShieldAlert,
};

function sameSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every(x => s.has(x));
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
}

export default function AssignPgsolForm({ projectId, groups }: { projectId: string; groups: AssignGroup[] }) {
  // Baseline = apa yang tersimpan di server. Diperbarui setelah simpan berhasil
  // supaya hitungan "belum disimpan" langsung nol tanpa menunggu refresh.
  const [baseline, setBaseline] = useState<Record<string, string[]>>(() => {
    const m: Record<string, string[]> = {};
    groups.forEach(g => g.stages.forEach(s => { m[s.stageKey] = s.currentIds; }));
    return m;
  });
  const [selected, setSelected] = useState<Record<string, string[]>>(baseline);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedFlash, setSavedFlash] = useState(false);
  const [pending, startTransition] = useTransition();

  const allStages = useMemo(
    () => groups.flatMap(g => g.stages.map(s => ({ ...s, docType: g.docType }))),
    [groups],
  );
  const dirtyStages = allStages.filter(s => !s.locked && !sameSet(selected[s.stageKey] ?? [], baseline[s.stageKey] ?? []));

  function toggle(stageKey: string, id: string) {
    setSavedFlash(false);
    setSelected(prev => {
      const cur = prev[stageKey] ?? [];
      return { ...prev, [stageKey]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] };
    });
  }

  function setAll(stage: AssignStage, on: boolean) {
    setSavedFlash(false);
    setSelected(prev => ({ ...prev, [stage.stageKey]: on ? stage.candidates.map(c => c.id) : [] }));
  }

  function reset() {
    setSelected(baseline);
    setErrors({});
  }

  function saveAll() {
    startTransition(async () => {
      const nextErrors: Record<string, string> = {};
      const nextBaseline = { ...baseline };
      for (const s of dirtyStages) {
        const ids = selected[s.stageKey] ?? [];
        const res = await savePgsolAssignment(projectId, s.docType, s.stageKey, ids);
        if (res.error) nextErrors[s.stageKey] = res.error;
        else nextBaseline[s.stageKey] = ids;
      }
      setBaseline(nextBaseline);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length === 0) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2500);
      }
    });
  }

  return (
    <div className="space-y-6 pb-24">
      {groups.map(group => {
        const Icon = GROUP_ICON[group.docType];
        return (
          <section key={group.docType} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <header className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">{group.title}</h2>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-slate-100">
              {group.stages.map(stage => {
                const sel = selected[stage.stageKey] ?? [];
                const dirty = !stage.locked && !sameSet(sel, baseline[stage.stageKey] ?? []);
                const RoleIcon = stage.role === 'PM PGSOL' ? UserCheck : HardHat;
                const allOn = stage.candidates.length > 0 && sel.length === stage.candidates.length;
                return (
                  <div key={stage.stageKey} className="p-5 space-y-3 border-t border-slate-100 first:border-t-0 md:border-t-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <RoleIcon className="w-4 h-4 text-slate-400 shrink-0" />
                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">{stage.role}</h3>
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                          {sel.length}/{stage.candidates.length}
                        </span>
                        {dirty && <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Diubah</span>}
                      </div>
                      {!stage.locked && stage.candidates.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setAll(stage, !allOn)}
                          className="text-xs font-semibold text-primary hover:underline shrink-0"
                        >
                          {allOn ? 'Kosongkan' : 'Pilih semua'}
                        </button>
                      )}
                    </div>

                    {stage.locked && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                        <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>Tahap ini sedang diproses — terkunci sampai ditolak/diajukan ulang.</span>
                      </div>
                    )}

                    {errors[stage.stageKey] && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">{errors[stage.stageKey]}</div>
                    )}

                    {stage.candidates.length === 0 ? (
                      <p className="text-sm text-slate-400 py-2">Tidak ada staff PGSOL dengan izin {stage.role.toLowerCase()} tahap ini.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {stage.candidates.map(c => {
                          const on = sel.includes(c.id);
                          return (
                            <li key={c.id}>
                              <button
                                type="button"
                                disabled={stage.locked}
                                onClick={() => toggle(stage.stageKey, c.id)}
                                aria-pressed={on}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                                  on ? 'border-primary/40 bg-primary/5' : 'border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                  on ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {initials(c.full_name)}
                                </span>
                                <span className="flex-1 text-sm font-medium text-slate-700 truncate">{c.full_name}</span>
                                <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                                  on ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white'
                                }`}>
                                  {on && <Check className="w-3.5 h-3.5" />}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Bar simpan — satu tombol untuk semua perubahan */}
      <div className="fixed bottom-0 inset-x-0 z-30 pointer-events-none">
        <div className="max-w-4xl mx-auto px-4 pb-4">
          <div className="pointer-events-auto flex items-center justify-between gap-3 bg-white border border-slate-200 shadow-lg rounded-2xl px-4 py-3">
            <p className="text-sm text-slate-600 min-w-0">
              {savedFlash ? (
                <span className="flex items-center gap-1.5 text-emerald-600 font-semibold"><CheckCircle2 className="w-4 h-4" /> Tersimpan</span>
              ) : dirtyStages.length > 0 ? (
                <><span className="font-bold text-slate-800">{dirtyStages.length} tahap</span> belum disimpan</>
              ) : (
                'Tidak ada perubahan'
              )}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={reset}
                disabled={dirtyStages.length === 0 || pending}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Undo2 className="w-4 h-4" /> Batal
              </button>
              <button
                type="button"
                onClick={saveAll}
                disabled={dirtyStages.length === 0 || pending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors disabled:opacity-50"
              >
                {pending && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan semua
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
