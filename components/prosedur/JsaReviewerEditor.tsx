'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X, Plus, Loader2 } from 'lucide-react';
import { ModalPortal } from '@/components/ui/modal-portal';
import JsaStepCard, { type ControlDetail, type JsaStepData } from '@/app/vendor/dashboard/jsa/create/[id]/JsaStepCard';
import { DEFAULT_RISK, calculateRisk } from '@/lib/jsa-risk';
import { emptyKebutuhan } from '@/lib/procedure-kebutuhan';
import { loadJsaForEdit, editJsaAsReviewer, getProjectRoster } from '@/app/dashboard/approval/doc-edit-actions';
import { KebutuhanEditor, type ProjectRoster } from '@/components/prosedur/KebutuhanEditor';

const emptyControl = (): ControlDetail => ({ eliminasi: '', substitusi: '', rekayasa: '', administrasi: '', apd: '' });
const blankStep = (): JsaStepData => ({
  id: Date.now() + Math.random(), langkah: '', kebutuhan: emptyKebutuhan(), jenisBahaya: 'Fisika', sebab: '', potensiBahaya: '',
  faktorPositif: emptyControl(), inherentRisk: { ...DEFAULT_RISK }, mitigasi: emptyControl(), residualRisk: { ...DEFAULT_RISK },
});

/** Reviewer mengubah langkah JSA langsung; perubahan tercatat di riwayat dokumen. */
export function JsaReviewerEditor({ jsaId, label = 'Ubah Dokumen' }: { jsaId: string; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<JsaStepData[]>([]);
  const [note, setNote] = useState('');
  const [roster, setRoster] = useState<ProjectRoster | null>(null);

  const openEditor = async () => {
    setOpen(true); setLoading(true); setError(null); setNote('');
    try {
      const { steps: loaded, projectId } = await loadJsaForEdit(jsaId);
      setSteps(loaded.map((s, i) => ({ ...s, id: Date.now() + i })));
      getProjectRoster(projectId).then(setRoster).catch(() => setRoster(null));
    } catch (e) {
      setError((e as Error).message || 'Gagal memuat JSA.');
    } finally {
      setLoading(false);
    }
  };

  const patch = (id: number, p: Partial<JsaStepData>) => setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)));

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const res = await editJsaAsReviewer(jsaId, steps, note);
      setOpen(false);
      if (res.changed === 0) alert('Tidak ada perubahan untuk disimpan.');
      router.refresh();
    } catch (e) {
      setError((e as Error).message || 'Gagal menyimpan perubahan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button type="button" onClick={openEditor}
        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors">
        <Pencil className="w-4 h-4" /> {label}
      </button>

      {open && (
        <ModalPortal onClose={() => setOpen(false)} blocking={saving} zIndex={110}>
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl ring-1 ring-black/5">
            <div className="h-1.5 bg-gradient-to-r from-sky-500 to-sky-400 shrink-0" />
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-lg text-slate-800">Ubah JSA</h3>
                <p className="text-xs text-slate-500">Perubahan tercatat (siapa, kapan, apa yang berubah) dan terlihat oleh semua pihak yang ditugaskan.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto bg-slate-50/50">
              {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (
                <>
                  {steps.map((step, i) => (
                    <JsaStepCard
                      key={step.id}
                      step={step}
                      index={i}
                      langkahLocked={false}
                      canRemove={steps.length > 1}
                      canDuplicate
                      kebutuhan={<KebutuhanEditor roster={roster} value={step.kebutuhan} onChange={(k) => patch(step.id, { kebutuhan: k })} />}
                      onPatch={(p) => patch(step.id, p)}
                      onRisk={(which, field, value) => setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, [which]: calculateRisk({ ...s[which], [field]: value }) } : s)))}
                      onControl={(which, field, value) => setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, [which]: { ...s[which], [field]: value } } : s)))}
                      onRemove={() => setSteps((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== step.id) : prev))}
                      onDuplicate={() => setSteps((prev) => {
                        const idx = prev.findIndex((s) => s.id === step.id);
                        const copy: JsaStepData = JSON.parse(JSON.stringify(prev[idx]));
                        copy.id = Date.now() + Math.random();
                        return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
                      })}
                    />
                  ))}
                  <button type="button" onClick={() => setSteps((p) => [...p, blankStep()])} className="text-sm font-bold text-primary flex items-center gap-1.5"><Plus className="w-4 h-4" /> Tambah langkah</button>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">Catatan perubahan (opsional)</label>
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mis. Koreksi nilai risiko dan tambah mitigasi" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </>
              )}
              {error && <p className="text-sm font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200">Batal</button>
              <button type="button" onClick={save} disabled={saving || loading} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan Perubahan
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
