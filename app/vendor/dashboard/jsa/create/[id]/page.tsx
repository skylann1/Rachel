'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, ShieldAlert, CheckCircle2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import JsaPDF from './JsaPDF';
import { saveJsa, getJsa } from './actions';
import JsaStepCard, { stepIssues, stepWarnings, type ControlDetail, type JsaStepData } from './JsaStepCard';
import { DEFAULT_RISK, RPN_LEVELS, calculateRisk, rpnLevel } from '@/lib/jsa-risk';
import { VendorInternalReviewActions } from '@/components/vendor/VendorInternalReviewActions';
import { aggregatePointNeeds, aggregateKebutuhan, isKebutuhanEmpty, hasStoredKebutuhan, emptyKebutuhan, StepKebutuhan, TahapanSection } from '@/lib/procedure-kebutuhan';

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false }
);

export type { ControlDetail, JsaStepData } from './JsaStepCard';

const defaultRisk = DEFAULT_RISK;

export default function JSACreatePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.id === 'string' ? decodeURIComponent(params.id) : 'PRJ-000';

  const [jsaSteps, setJsaSteps] = useState<JsaStepData[]>([
    { id: 1, langkah: '', jenisBahaya: 'Fisika', sebab: '', potensiBahaya: '', faktorPositif: { eliminasi: '', substitusi: '', rekayasa: '', administrasi: '', apd: '' }, inherentRisk: {...defaultRisk}, mitigasi: { eliminasi: '', substitusi: '', rekayasa: '', administrasi: '', apd: '' }, residualRisk: {...defaultRisk} }
  ]);
  const [procSteps, setProcSteps] = useState<string[]>([]);
  const [procSections, setProcSections] = useState<TahapanSection[]>([]);
  const [projectInfo, setProjectInfo] = useState<{ name: string; contract_number: string | null; location: string | null; companyName: string | null } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  // Tombol Submit hanya untuk penyusun (jsa.create); reviewer memakai Setujui/Tolak.
  const [canCreate, setCanCreate] = useState(false);
  const [jsaStatus, setJsaStatus] = useState<string | null>(null);
  const [preparer, setPreparer] = useState<{ nama: string; jabatan: string; satker: string | null } | null>(null);

  React.useEffect(() => {
    async function loadData() {
      if (projectId) {
        const data = await getJsa(projectId as string);
        if (data && 'canCreate' in data) setCanCreate(!!data.canCreate);
        if (data && data.jsa) {
          setDocId(data.jsa.id);
          setJsaStatus(data.jsa.status);
        }
        let finalSteps: any[] = [];

        if (data && data.procedureSteps && data.procedureSteps.length > 0) {
          finalSteps = data.procedureSteps.map((stepDesc: string, idx: number) => {
            const existing = (data.steps && data.steps[idx]) ? data.steps[idx] : null;

            if (existing) {
              const hazards = typeof existing.bahaya === 'string' ? JSON.parse(existing.bahaya) : (existing.bahaya || {});
              const risks = typeof existing.risiko === 'string' ? JSON.parse(existing.risiko) : (existing.risiko || {});
              const controls = typeof existing.tindakan === 'string' ? JSON.parse(existing.tindakan) : (existing.tindakan || {});
              
              const legacyBahaya = Array.isArray(hazards) ? hazards[0] : '';
              const legacyMitigasi = Array.isArray(controls) ? controls[0] : '';
              
              const parseControl = (val: any) => {
                if (typeof val === 'string') return { eliminasi: '', substitusi: '', rekayasa: '', administrasi: val, apd: '' };
                if (!val) return { eliminasi: '', substitusi: '', rekayasa: '', administrasi: '', apd: '' };
                return {
                  eliminasi: val.eliminasi || '',
                  substitusi: val.substitusi || '',
                  rekayasa: val.rekayasa || '',
                  administrasi: val.administrasi || '',
                  apd: val.apd || ''
                };
              };

              let storedKebutuhan: StepKebutuhan | null = existing.kebutuhan as StepKebutuhan | null;
              if (typeof storedKebutuhan === 'string') {
                try { storedKebutuhan = JSON.parse(storedKebutuhan) as StepKebutuhan; } catch { storedKebutuhan = null; }
              }
              if (storedKebutuhan && typeof storedKebutuhan !== 'object') storedKebutuhan = null;

              return {
                id: existing.id || Date.now() + Math.random(),
                langkah: stepDesc, // Always override with SOP step
                // Semai dari prosedur HANYA kalau belum pernah disimpan sama
                // sekali (kolom masih `{}`). Objek tersimpan yang array-nya
                // kosong berarti vendor sengaja melepas semua centangan.
                kebutuhan: hasStoredKebutuhan(storedKebutuhan)
                  ? { ...emptyKebutuhan(), ...storedKebutuhan }
                  : aggregatePointNeeds(data.procedureSections?.[idx]?.points || []),
                jenisBahaya: hazards.jenisBahaya || (legacyBahaya ? 'Fisika' : 'Fisika'),
                sebab: hazards.sebab || '',
                potensiBahaya: hazards.potensiBahaya || legacyBahaya || '',
                faktorPositif: parseControl(risks.faktorPositif || ''),
                inherentRisk: risks.inherentRisk || {...defaultRisk},
                mitigasi: parseControl(controls.mitigasi || legacyMitigasi || ''),
                residualRisk: controls.residualRisk || {...defaultRisk}
              };
            }

            return {
              id: Date.now() + idx,
              langkah: stepDesc,
              kebutuhan: aggregatePointNeeds(data.procedureSections?.[idx]?.points || []),
              jenisBahaya: 'Fisika',
              sebab: '',
              potensiBahaya: '',
              faktorPositif: { eliminasi: '', substitusi: '', rekayasa: '', administrasi: '', apd: '' },
              inherentRisk: {...defaultRisk},
              mitigasi: { eliminasi: '', substitusi: '', rekayasa: '', administrasi: '', apd: '' },
              residualRisk: {...defaultRisk}
            };
          });
        } else if (data && data.steps && data.steps.length > 0) {
          finalSteps = data.steps.map((step: any) => {
            const hazards = typeof step.bahaya === 'string' ? JSON.parse(step.bahaya) : (step.bahaya || {});
            const risks = typeof step.risiko === 'string' ? JSON.parse(step.risiko) : (step.risiko || {});
            const controls = typeof step.tindakan === 'string' ? JSON.parse(step.tindakan) : (step.tindakan || {});
            
            const legacyBahaya = Array.isArray(hazards) ? hazards[0] : '';
            const legacyMitigasi = Array.isArray(controls) ? controls[0] : '';
            
            const parseControl = (val: any) => {
              if (typeof val === 'string') return { eliminasi: '', substitusi: '', rekayasa: '', administrasi: val, apd: '' };
              if (!val) return { eliminasi: '', substitusi: '', rekayasa: '', administrasi: '', apd: '' };
              return {
                eliminasi: val.eliminasi || '',
                substitusi: val.substitusi || '',
                rekayasa: val.rekayasa || '',
                administrasi: val.administrasi || '',
                apd: val.apd || ''
              };
            };

            let storedKebutuhan: StepKebutuhan | null = step.kebutuhan as StepKebutuhan | null;
            if (typeof storedKebutuhan === 'string') {
              try { storedKebutuhan = JSON.parse(storedKebutuhan) as StepKebutuhan; } catch { storedKebutuhan = null; }
            }
            if (storedKebutuhan && typeof storedKebutuhan !== 'object') storedKebutuhan = null;

            return {
              id: step.id || Date.now() + Math.random(),
              langkah: step.description || '',
              kebutuhan: hasStoredKebutuhan(storedKebutuhan)
                ? { ...emptyKebutuhan(), ...storedKebutuhan }
                : undefined,
              jenisBahaya: hazards.jenisBahaya || (legacyBahaya ? 'Fisika' : 'Fisika'),
              sebab: hazards.sebab || '',
              potensiBahaya: hazards.potensiBahaya || legacyBahaya || '',
              faktorPositif: parseControl(risks.faktorPositif || ''),
              inherentRisk: risks.inherentRisk || {...defaultRisk},
              mitigasi: parseControl(controls.mitigasi || legacyMitigasi || ''),
              residualRisk: controls.residualRisk || {...defaultRisk}
            };
          });
        }

        setJsaSteps(finalSteps.length > 0 ? finalSteps : [{ id: 1, langkah: '', jenisBahaya: 'Fisika', sebab: '', potensiBahaya: '', faktorPositif: { eliminasi: '', substitusi: '', rekayasa: '', administrasi: '', apd: '' }, inherentRisk: {...defaultRisk}, mitigasi: { eliminasi: '', substitusi: '', rekayasa: '', administrasi: '', apd: '' }, residualRisk: {...defaultRisk} }]);
        
        if (data && data.procedureSteps) {
          setProcSteps(data.procedureSteps);
        }
        setProcSections(data?.procedureSections || []);
        if (data?.project) {
          setProjectInfo(data.project);
        }
        if (data && 'preparer' in data && data.preparer) {
          setPreparer(data.preparer as any);
        }
      }
    }
    loadData();
  }, [projectId]);

  const emptyControl = (): ControlDetail => ({ eliminasi: '', substitusi: '', rekayasa: '', administrasi: '', apd: '' });
  const blankStep = (): JsaStepData => ({
    id: Date.now() + Math.random(),
    langkah: '', jenisBahaya: 'Fisika', sebab: '', potensiBahaya: '',
    faktorPositif: emptyControl(), inherentRisk: { ...defaultRisk },
    mitigasi: emptyControl(), residualRisk: { ...defaultRisk },
  });

  // Langkah mengikuti Prosedur Kerja kalau prosedur sudah punya tahapan — jumlah
  // & urutannya dipetakan per index saat dimuat, jadi tambah/hapus/duplikat
  // hanya bermakna saat JSA berdiri sendiri (tanpa tahapan prosedur).
  const followsProcedure = procSteps.length > 0;

  const addStep = () => setJsaSteps(prev => [...prev, blankStep()]);

  const removeStep = (id: number) =>
    setJsaSteps(prev => (prev.length > 1 ? prev.filter(step => step.id !== id) : prev));

  const duplicateStep = (id: number) =>
    setJsaSteps(prev => {
      const i = prev.findIndex(s => s.id === id);
      if (i < 0) return prev;
      const copy: JsaStepData = JSON.parse(JSON.stringify(prev[i]));
      copy.id = Date.now() + Math.random();
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });

  const patchStep = (id: number, patch: Partial<JsaStepData>) =>
    setJsaSteps(prev => prev.map(step => (step.id === id ? { ...step, ...patch } : step)));

  const updateControl = (id: number, which: 'faktorPositif' | 'mitigasi', field: keyof ControlDetail, value: string) =>
    setJsaSteps(prev => prev.map(step =>
      step.id === id ? { ...step, [which]: { ...step[which], [field]: value } } : step));

  const updateRisk = (id: number, which: 'inherentRisk' | 'residualRisk', field: string, value: number) =>
    setJsaSteps(prev => prev.map(step =>
      step.id === id ? { ...step, [which]: calculateRisk({ ...step[which], [field]: value }) } : step));

  const toggleStepKebutuhan = (stepIdx: number, mutate: (k: StepKebutuhan) => StepKebutuhan) => {
    setJsaSteps(prev => prev.map((s, i) =>
      i === stepIdx ? { ...s, kebutuhan: mutate({ ...emptyKebutuhan(), ...s.kebutuhan }) } : s
    ));
  };

  const handleSimpan = async () => {
    setIsSaving(true);
    try {
      await saveJsa(projectId, { steps: jsaSteps });
      alert("JSA berhasil disimpan dan diajukan ke tim HSE!");
      router.push(`/vendor/dashboard/projects/${encodeURIComponent(projectId)}`);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan JSA.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderKebutuhan = (step: JsaStepData, index: number) => {

                        const cur = { ...emptyKebutuhan(), ...step.kebutuhan };
                        // Union kandidat dari prosedur DENGAN kebutuhan yang sudah tersimpan —
                        // supaya kalau urutan step bergeser (mis. setelah hapus langkah), item
                        // yang sudah tersimpan tetap terlihat & bisa dilepas walau prosedur di
                        // index ini sudah tidak lagi menawarkannya.
                        const cand = aggregateKebutuhan([aggregatePointNeeds(procSections?.[index]?.points || []), cur]);
                        if (isKebutuhanEmpty(cand)) return null;
                        const chip = (on: boolean, key: string, label: string, onClick: () => void) => (
                          <button key={key} type="button" onClick={onClick}
                            className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${on ? 'bg-primary text-white border-primary' : 'bg-white text-slate-400 border-slate-200 line-through hover:border-primary'}`}>
                            {label}
                          </button>
                        );
                        return (
                          <div className="mt-2 border border-slate-200 rounded-lg bg-slate-50 p-2 space-y-2">
                            <p className="text-[10px] font-bold text-slate-600">
                              Kebutuhan dari Prosedur — lepas centang yang tidak dipakai di langkah ini
                            </p>
                            {cand.workers.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {cand.workers.map(w => chip(
                                  cur.workers.some(x => x.id === w.id), `w-${w.id}`, w.label,
                                  () => toggleStepKebutuhan(index, k => ({ ...k, workers: k.workers.some(x => x.id === w.id) ? k.workers.filter(x => x.id !== w.id) : [...k.workers, w] }))
                                ))}
                              </div>
                            )}
                            {cand.equipment.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {cand.equipment.map(e => chip(
                                  cur.equipment.some(x => x.id === e.id), `e-${e.id}`, e.label,
                                  () => toggleStepKebutuhan(index, k => ({ ...k, equipment: k.equipment.some(x => x.id === e.id) ? k.equipment.filter(x => x.id !== e.id) : [...k.equipment, e] }))
                                ))}
                              </div>
                            )}
                            {cand.materials.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {cand.materials.map(m => chip(
                                  cur.materials.some(x => x.id === m.id), `m-${m.id}`, m.label,
                                  () => toggleStepKebutuhan(index, k => ({ ...k, materials: k.materials.some(x => x.id === m.id) ? k.materials.filter(x => x.id !== m.id) : [...k.materials, m] }))
                                ))}
                              </div>
                            )}
                            {Object.entries(cand.apd).map(([cat, items]) => items.length > 0 && (
                              <div key={cat} className="flex flex-wrap gap-1.5">
                                {items.map(item => chip(
                                  (cur.apd[cat] || []).includes(item), `a-${cat}-${item}`, item,
                                  () => toggleStepKebutuhan(index, k => {
                                    const list = k.apd[cat] || [];
                                    return { ...k, apd: { ...k.apd, [cat]: list.includes(item) ? list.filter(x => x !== item) : [...list, item] } };
                                  })
                                ))}
                              </div>
                            ))}
                            {cand.hazards.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {cand.hazards.map(hz => chip(
                                  cur.hazards.includes(hz), `h-${hz}`, hz,
                                  () => toggleStepKebutuhan(index, k => ({ ...k, hazards: k.hazards.includes(hz) ? k.hazards.filter(x => x !== hz) : [...k.hazards, hz] }))
                                ))}
                              </div>
                            )}
                          </div>
                        );
  };

  const incompleteCount = jsaSteps.filter(st => stepIssues(st).length > 0).length;
  const warningCount = jsaSteps.reduce((n, st) => n + stepWarnings(st).length, 0);
  const maxInherent = Math.max(...jsaSteps.map(st => st.inherentRisk.rpn), 0);
  const maxResidual = Math.max(...jsaSteps.map(st => st.residualRisk.rpn), 0);

  // Minimal satu langkah kerja harus terisi sebelum JSA bisa diajukan.
  const canSubmitJsa = jsaSteps.some(s => (s.langkah || '').trim().length > 0);
  // Sama dengan guard di saveJsa: hanya JSA baru / Draft / masih di review vendor yang boleh diajukan (ulang).
  const canResubmit = !jsaStatus || ['Draft', 'Review HSE Vendor', 'Review PM Vendor'].includes(jsaStatus);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 gap-4">
        <div>
          <Link href={`/vendor/dashboard/projects/${encodeURIComponent(projectId)}`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Proyek
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-500" />
            Formulir JSA
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {canCreate && canResubmit && (
          <button onClick={handleSimpan} disabled={isSaving || !canSubmitJsa} className="flex-1 md:flex-none justify-center px-6 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-primary/30 flex items-center gap-2">
            {isSaving ? (
              <span className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</span>
            ) : (
              <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> {jsaStatus && jsaStatus !== 'Draft' ? 'Ajukan Ulang JSA' : 'Submit JSA'}</span>
            )}
          </button>
          )}
          {canCreate && canResubmit && !canSubmitJsa && (
            <p className="w-full md:text-right text-xs font-semibold text-rose-600">Isi minimal satu langkah pekerjaan sebelum menekan Submit.</p>
          )}
        </div>
      </div>

      {/* Ringkasan risiko seluruh langkah */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Langkah</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{jsaSteps.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Belum lengkap</p>
          <p className={`text-2xl font-black mt-1 ${incompleteCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{incompleteCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">RPN tertinggi (awal → akhir)</p>
          <p className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded-lg text-sm font-black ${rpnLevel(maxInherent).badge}`}>{maxInherent}</span>
            <span className="text-slate-400">→</span>
            <span className={`px-2 py-0.5 rounded-lg text-sm font-black ${rpnLevel(maxResidual).badge}`}>{maxResidual}</span>
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Peringatan risiko</p>
          <p className={`text-2xl font-black mt-1 ${warningCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{warningCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[11px] text-slate-500">
        <span className="font-bold text-slate-600">Nilai RPN:</span>
        {[...RPN_LEVELS].reverse().map((l, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: l.level.hex }} />
            {l.range} · {l.level.label}
          </span>
        ))}
        {followsProcedure && (
          <span className="ml-auto text-slate-400">Langkah mengikuti Prosedur Kerja ({procSteps.length} tahapan)</span>
        )}
      </div>

      <div className="space-y-4">
        {jsaSteps.map((step, index) => (
          <JsaStepCard
            key={step.id}
            step={step}
            index={index}
            langkahLocked={followsProcedure}
            canRemove={!followsProcedure && jsaSteps.length > 1}
            canDuplicate={!followsProcedure}
            kebutuhan={renderKebutuhan(step, index)}
            onPatch={patch => patchStep(step.id, patch)}
            onRisk={(which, field, value) => updateRisk(step.id, which, field, value)}
            onControl={(which, field, value) => updateControl(step.id, which, field, value)}
            onRemove={() => removeStep(step.id)}
            onDuplicate={() => duplicateStep(step.id)}
          />
        ))}
      </div>

      {!followsProcedure && (
        <button
          type="button"
          onClick={addStep}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-slate-300 text-slate-600 text-sm font-bold rounded-2xl hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="w-4 h-4" /> Tambah Langkah Baru
        </button>
      )}

      <VendorInternalReviewActions projectId={projectId as string} docType="jsa" docId={docId} />

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="font-bold text-slate-800 mb-4">Preview PDF Analisa Keselamatan Kerja</h2>
        <div className="w-full bg-slate-500 rounded-xl overflow-hidden" style={{ height: '700px' }}>
          <PDFViewer width="100%" height="100%" className="border-none"><JsaPDF projectId={projectId as string} steps={jsaSteps as any} projectInfo={projectInfo as any} preparer={preparer ?? undefined} preparerSigned={false} /></PDFViewer>
        </div>
      </div>
    </div>
  );
}
