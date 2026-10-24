'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X, Loader2 } from 'lucide-react';
import { ModalPortal } from '@/components/ui/modal-portal';
import { loadPtwForEdit, editPtwAsReviewer, getProjectRoster } from '@/app/dashboard/approval/doc-edit-actions';
import { Chip, type ProjectRoster } from '@/components/prosedur/KebutuhanEditor';
import { APD_ITEMS, APD_CATEGORY_LABELS, HOT_WORK_JOB_TYPES, PTW_GAS_TEST_TYPES, PTW_MAX_VALID_DAYS, hazardLabel, hazardSourcesFor, type PtwType } from '@/lib/ptw-types';
import type { PtwEditable } from '@/lib/ptw-diff';

const field = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary';
const lbl = 'text-xs font-bold text-slate-600 block mb-1.5';

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-2xl p-4 space-y-2.5">
      <p className="text-xs font-black text-slate-700 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * Reviewer mengubah isi PTW langsung: masa berlaku, jam kerja, pekerja,
 * peralatan, sumber bahaya, APD, jenis pekerjaan panas, frekuensi uji gas.
 * (Baris hasil uji gas tidak diubah di sini.)
 */
export function PtwReviewerEditor({ ptwId, label = 'Ubah Dokumen' }: { ptwId: string; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PtwEditable | null>(null);
  const [ptwType, setPtwType] = useState<PtwType>('dingin' as PtwType);
  const [roster, setRoster] = useState<ProjectRoster | null>(null);
  const [note, setNote] = useState('');

  const openEditor = async () => {
    setOpen(true); setLoading(true); setError(null); setNote('');
    try {
      const res = await loadPtwForEdit(ptwId);
      setData(res.editable);
      setPtwType(res.ptwType as PtwType);
      getProjectRoster(res.projectId).then(setRoster).catch(() => setRoster(null));
    } catch (e) {
      setError((e as Error).message || 'Gagal memuat PTW.');
    } finally {
      setLoading(false);
    }
  };

  const set = (p: Partial<PtwEditable>) => setData((d) => (d ? { ...d, ...p } : d));

  const save = async () => {
    if (!data) return;
    setSaving(true); setError(null);
    try {
      const res = await editPtwAsReviewer(ptwId, data, note);
      setOpen(false);
      if (res.changed === 0) alert('Tidak ada perubahan untuk disimpan.');
      router.refresh();
    } catch (e) {
      setError((e as Error).message || 'Gagal menyimpan perubahan.');
    } finally {
      setSaving(false);
    }
  };

  // Item tersimpan yang sudah tidak ada di roster tetap tampil supaya bisa dilepas.
  const workerOptions = data ? [
    ...(roster?.workers ?? []).map((w) => ({ id: w.id, worker_name: w.full_name, worker_role: w.position, certification: w.certification })),
    ...data.workers.filter((w) => !(roster?.workers ?? []).some((r) => r.id === w.id)),
  ] : [];
  const equipmentOptions = data ? [
    ...(roster?.equipment ?? []).map((e) => ({ id: e.id, name: e.name, type: e.category, certificate_number: e.certificate_number })),
    ...data.equipment.filter((e) => !(roster?.equipment ?? []).some((r) => r.id === e.id)),
  ] : [];

  return (
    <>
      <button type="button" onClick={openEditor}
        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors">
        <Pencil className="w-4 h-4" /> {label}
      </button>

      {open && (
        <ModalPortal onClose={() => setOpen(false)} blocking={saving} zIndex={110}>
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl ring-1 ring-black/5">
            <div className="h-1.5 bg-gradient-to-r from-sky-500 to-sky-400 shrink-0" />
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-lg text-slate-800">Ubah PTW</h3>
                <p className="text-xs text-slate-500">Perubahan tercatat (siapa, kapan, apa yang berubah) dan terlihat oleh semua pihak yang ditugaskan.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {loading || !data ? (
                <div className="flex justify-center p-12">{error ? null : <Loader2 className="w-6 h-6 animate-spin text-primary" />}</div>
              ) : (
                <>
                  <Box title="Masa berlaku & jam kerja">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={lbl}>Mulai</label><input type="date" className={field} value={data.valid_from || ''} onChange={(e) => set({ valid_from: e.target.value })} /></div>
                      <div><label className={lbl}>Selesai (maks. {PTW_MAX_VALID_DAYS} hari)</label><input type="date" className={field} value={data.valid_to || ''} onChange={(e) => set({ valid_to: e.target.value })} /></div>
                      <div><label className={lbl}>Jam mulai</label><input type="time" className={field} value={data.work_start || ''} onChange={(e) => set({ work_start: e.target.value })} /></div>
                      <div><label className={lbl}>Jam selesai</label><input type="time" className={field} value={data.work_end || ''} onChange={(e) => set({ work_end: e.target.value })} /></div>
                    </div>
                  </Box>

                  <Box title="Pekerja">
                    <div className="flex flex-wrap gap-1.5">
                      {workerOptions.map((w) => (
                        <Chip key={w.id} on={data.workers.some((x) => x.id === w.id)}
                          onClick={() => set({ workers: data.workers.some((x) => x.id === w.id) ? data.workers.filter((x) => x.id !== w.id) : [...data.workers, w] })}>
                          {w.worker_name}{w.worker_role ? ` · ${w.worker_role}` : ''}
                        </Chip>
                      ))}
                      {workerOptions.length === 0 && <p className="text-xs text-slate-400">Belum ada pekerja.</p>}
                    </div>
                  </Box>

                  <Box title="Peralatan">
                    <div className="flex flex-wrap gap-1.5">
                      {equipmentOptions.map((e) => (
                        <Chip key={e.id} on={data.equipment.some((x) => x.id === e.id)}
                          onClick={() => set({ equipment: data.equipment.some((x) => x.id === e.id) ? data.equipment.filter((x) => x.id !== e.id) : [...data.equipment, e] })}>
                          {e.name}
                        </Chip>
                      ))}
                      {equipmentOptions.length === 0 && <p className="text-xs text-slate-400">Belum ada peralatan.</p>}
                    </div>
                  </Box>

                  <Box title="Sumber bahaya">
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(new Set(hazardSourcesFor(ptwType))).map((h) => (
                        <Chip key={h} tone="rose" on={data.hazards.includes(h)} onClick={() => set({ hazards: toggle(data.hazards, h) })}>{hazardLabel(h)}</Chip>
                      ))}
                    </div>
                  </Box>

                  <Box title="APD">
                    {Object.entries(APD_ITEMS).map(([cat, items]) => (
                      <div key={cat}>
                        <p className="text-[11px] font-bold text-slate-500 mb-1">{APD_CATEGORY_LABELS[cat] || cat}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {items.map((it) => (
                            <Chip key={it} on={(data.apd[cat] || []).includes(it)} onClick={() => set({ apd: { ...data.apd, [cat]: toggle(data.apd[cat] || [], it) } })}>{it}</Chip>
                          ))}
                        </div>
                      </div>
                    ))}
                  </Box>

                  {ptwType === 'panas' && (
                    <Box title="Jenis pekerjaan panas">
                      <div className="flex flex-wrap gap-1.5">
                        {HOT_WORK_JOB_TYPES.map((t) => (
                          <Chip key={t} on={data.hot_work_types.includes(t)} onClick={() => set({ hot_work_types: toggle(data.hot_work_types, t) })}>{t}</Chip>
                        ))}
                      </div>
                    </Box>
                  )}

                  {PTW_GAS_TEST_TYPES.includes(ptwType) && (
                    <Box title="Frekuensi pengujian gas">
                      <div className="grid grid-cols-3 gap-3">
                        {(['o2', 'toxic', 'combustible'] as const).map((k) => (
                          <div key={k}>
                            <label className={lbl}>{k.toUpperCase()}</label>
                            <input className={field} value={data.gas_test_frequency[k] || ''} placeholder="mis. 2 jam"
                              onChange={(e) => set({ gas_test_frequency: { ...data.gas_test_frequency, [k]: e.target.value } })} />
                          </div>
                        ))}
                      </div>
                    </Box>
                  )}

                  <div>
                    <label className={lbl}>Catatan perubahan (opsional)</label>
                    <input className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mis. Tambah APD harness untuk kerja ketinggian" />
                  </div>
                </>
              )}
              {error && <p className="text-sm font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200">Batal</button>
              <button type="button" onClick={save} disabled={saving || loading || !data} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan Perubahan
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
