'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, ShieldAlert, CheckCircle2, FileText } from 'lucide-react';
import dynamic from 'next/dynamic';
import JsaPDF from './JsaPDF';
import { saveJsa, getJsa } from './actions';
import { VendorInternalReviewActions } from '@/components/vendor/VendorInternalReviewActions';
import { aggregatePointNeeds, isKebutuhanEmpty, hasStoredKebutuhan, emptyKebutuhan, StepKebutuhan, TahapanSection } from '@/lib/procedure-kebutuhan';

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false }
);

export interface ControlDetail {
  eliminasi: string;
  substitusi: string;
  rekayasa: string;
  administrasi: string;
  apd: string;
}

export interface JsaStepData {
  id: number;
  langkah: string;
  kebutuhan?: StepKebutuhan;
  jenisBahaya: string;
  sebab: string;
  potensiBahaya: string;
  faktorPositif: ControlDetail;
  inherentRisk: { severity: number, intensitas: number, kapabilitas: number, history: number, total: number, probability: number, rpn: number };
  mitigasi: ControlDetail;
  residualRisk: { severity: number, intensitas: number, kapabilitas: number, history: number, total: number, probability: number, rpn: number };
}

const defaultRisk = { severity: 1, intensitas: 1, kapabilitas: 1, history: 1, total: 3, probability: 1, rpn: 1 };
const BAHAYA_OPTIONS = ['Fisika', 'Kimia', 'Biologi', 'Ergonomi', 'Psikologi'];

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

  React.useEffect(() => {
    async function loadData() {
      if (projectId) {
        const data = await getJsa(projectId as string);
        if (data && data.jsa) {
          setDocId(data.jsa.id);
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
      }
    }
    loadData();
  }, [projectId]);

  const addStep = () => {
    setJsaSteps([...jsaSteps, { id: Date.now(), langkah: '', jenisBahaya: 'Fisika', sebab: '', potensiBahaya: '', faktorPositif: { eliminasi: '', substitusi: '', rekayasa: '', administrasi: '', apd: '' }, inherentRisk: {...defaultRisk}, mitigasi: { eliminasi: '', substitusi: '', rekayasa: '', administrasi: '', apd: '' }, residualRisk: {...defaultRisk} }]);
  };

  const removeStep = (id: number) => {
    if (jsaSteps.length > 1) {
      setJsaSteps(jsaSteps.filter(step => step.id !== id));
    }
  };

  const calculateRisk = (r: any) => {
    const total = Number(r.intensitas) + Number(r.kapabilitas) + Number(r.history);
    let probability = 1;
    if (total >= 13) probability = 5;
    else if (total >= 10) probability = 4;
    else if (total >= 7) probability = 3;
    else if (total >= 4) probability = 2;
    return { ...r, total, probability, rpn: Number(r.severity) * probability };
  };

  const updateControlField = (id: number, field: 'faktorPositif' | 'mitigasi', subField: keyof ControlDetail, value: string) => {
    setJsaSteps(jsaSteps.map(step => {
      if (step.id === id) {
        return { ...step, [field]: { ...(step[field] as ControlDetail), [subField]: value } };
      }
      return step;
    }));
  };

  const updateStepText = (id: number, field: keyof JsaStepData, value: string) => {
    setJsaSteps(jsaSteps.map(step => step.id === id ? { ...step, [field]: value } : step));
  };

  const toggleStepKebutuhan = (stepIdx: number, mutate: (k: StepKebutuhan) => StepKebutuhan) => {
    setJsaSteps(prev => prev.map((s, i) =>
      i === stepIdx ? { ...s, kebutuhan: mutate({ ...emptyKebutuhan(), ...s.kebutuhan }) } : s
    ));
  };

  const updateInherentRisk = (id: number, field: string, value: string) => {
    setJsaSteps(jsaSteps.map(step => {
      if (step.id === id) {
        const updated = { ...step.inherentRisk, [field]: Number(value) };
        return { ...step, inherentRisk: calculateRisk(updated) };
      }
      return step;
    }));
  };

  const updateResidualRisk = (id: number, field: string, value: string) => {
    setJsaSteps(jsaSteps.map(step => {
      if (step.id === id) {
        const updated = { ...step.residualRisk, [field]: Number(value) };
        return { ...step, residualRisk: calculateRisk(updated) };
      }
      return step;
    }));
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

  const getRpnColor = (rpn: number) => {
    if (rpn >= 15) return 'bg-rose-500 text-white';
    if (rpn >= 8) return 'bg-amber-400 text-black';
    if (rpn >= 4) return 'bg-emerald-500 text-white';
    return 'bg-emerald-300 text-black';
  };

  // Minimal satu langkah kerja harus terisi sebelum JSA bisa diajukan.
  const canSubmitJsa = jsaSteps.some(s => (s.langkah || '').trim().length > 0);

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
          <button onClick={handleSimpan} disabled={isSaving || !canSubmitJsa} className="flex-1 md:flex-none justify-center px-6 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-primary/30 flex items-center gap-2">
            {isSaving ? (
              <span className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</span>
            ) : (
              <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Submit JSA</span>
            )}
          </button>
          {!canSubmitJsa && (
            <p className="w-full md:text-right text-xs font-semibold text-rose-600">Isi minimal satu langkah pekerjaan sebelum menekan Submit.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-slate-800">Tabel Analisa Keselamatan Kerja (JSA)</h2>
            <p className="text-xs text-slate-500 mt-1">Isi potensi bahaya dan tindakan mitigasi untuk setiap langkah kerja.</p>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[2800px] text-xs text-left border-collapse">
            <thead className="text-[10px] text-slate-700 bg-slate-100 sticky top-0 z-10">
              {/* Row 1: Top-level headers */}
              <tr>
                <th rowSpan={3} className="border border-slate-300 px-2 py-3 text-center w-12 bg-slate-200 font-bold align-middle">No</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-3 w-52 bg-slate-200 text-center font-bold align-middle">Langkah-langkah pekerjaan<br/><span className="text-[9px] font-normal text-slate-500">(1)</span></th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-3 w-28 bg-slate-200 text-center font-bold align-middle">Jenis Bahaya<br/><span className="text-[9px] font-normal text-slate-500">(2)</span></th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-3 w-36 bg-slate-200 text-center font-bold align-middle">Sebab / Sumber<br/><span className="text-[9px] font-normal text-slate-500">(3)</span></th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-3 w-40 bg-slate-200 text-center font-bold align-middle">Potensi Bahaya<br/><span className="text-[9px] font-normal text-slate-500">(4)</span></th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-3 w-48 bg-slate-200 text-center font-bold align-middle">Faktor Positif<br/><span className="text-[9px] font-normal text-slate-500">(Pengendalian yang ada)</span><br/><span className="text-[9px] font-normal text-slate-500">(5)</span></th>
                <th colSpan={7} className="border border-slate-300 px-2 py-2 text-center bg-orange-100 text-orange-800 font-bold text-[11px]">Inherent Risk</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-3 w-56 bg-slate-200 text-center font-bold align-middle">Pengendalian tambahan /<br/>Tindakan Mitigasi<br/><span className="text-[9px] font-normal text-slate-500">(13)</span></th>
                <th colSpan={7} className="border border-slate-300 px-2 py-2 text-center bg-emerald-100 text-emerald-800 font-bold text-[11px]">Residual Risk</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-3 text-center w-20 bg-slate-200 font-bold align-middle">Aksi</th>
              </tr>
              {/* Row 2: Severity + Probability group */}
              <tr>
                {/* Inherent Risk sub-headers */}
                <th rowSpan={2} className="border border-slate-300 px-1 py-2 w-20 text-center bg-orange-50 font-bold align-middle">Severity<br/><span className="text-[9px] font-normal text-slate-500">(6)</span></th>
                <th colSpan={4} className="border border-slate-300 px-1 py-1 text-center bg-orange-50 font-bold">Probability</th>
                <th rowSpan={2} className="border border-slate-300 px-1 py-2 w-20 text-center bg-orange-50 font-bold align-middle">Prob<br/><span className="text-[9px] font-normal text-slate-500">(11)</span></th>
                <th rowSpan={2} className="border border-slate-300 px-1 py-2 w-20 text-center bg-orange-200 font-bold align-middle">RPN<br/><span className="text-[9px] font-normal text-slate-500">(12)</span></th>
                {/* Residual Risk sub-headers */}
                <th rowSpan={2} className="border border-slate-300 px-1 py-2 w-20 text-center bg-emerald-50 font-bold align-middle">Severity<br/><span className="text-[9px] font-normal text-slate-500">(14)</span></th>
                <th colSpan={4} className="border border-slate-300 px-1 py-1 text-center bg-emerald-50 font-bold">Probability</th>
                <th rowSpan={2} className="border border-slate-300 px-1 py-2 w-20 text-center bg-emerald-50 font-bold align-middle">Prob<br/><span className="text-[9px] font-normal text-slate-500">(19)</span></th>
                <th rowSpan={2} className="border border-slate-300 px-1 py-2 w-20 text-center bg-emerald-200 font-bold align-middle">RPN<br/><span className="text-[9px] font-normal text-slate-500">(20)</span></th>
              </tr>
              {/* Row 3: Probability sub-columns */}
              <tr>
                {/* Inherent Probability breakdown */}
                <th className="border border-slate-300 px-1 py-2 w-20 text-center bg-orange-50/50 font-normal">Intensitas<br/><span className="text-slate-500">(7)</span></th>
                <th className="border border-slate-300 px-1 py-2 w-20 text-center bg-orange-50/50 font-normal">Kapabilitas<br/><span className="text-slate-500">(8)</span></th>
                <th className="border border-slate-300 px-1 py-2 w-20 text-center bg-orange-50/50 font-normal">History<br/><span className="text-slate-500">(9)</span></th>
                <th className="border border-slate-300 px-1 py-2 w-20 text-center bg-orange-50/50 font-normal">Total<br/><span className="text-slate-500">(10)</span></th>
                {/* Residual Probability breakdown */}
                <th className="border border-slate-300 px-1 py-2 w-20 text-center bg-emerald-50/50 font-normal">Intensitas<br/><span className="text-slate-500">(15)</span></th>
                <th className="border border-slate-300 px-1 py-2 w-20 text-center bg-emerald-50/50 font-normal">Kapabilitas<br/><span className="text-slate-500">(16)</span></th>
                <th className="border border-slate-300 px-1 py-2 w-20 text-center bg-emerald-50/50 font-normal">History<br/><span className="text-slate-500">(17)</span></th>
                <th className="border border-slate-300 px-1 py-2 w-20 text-center bg-emerald-50/50 font-normal">Total<br/><span className="text-slate-500">(18)</span></th>
              </tr>
            </thead>
            <tbody>
              {jsaSteps.map((step, index) => {
                return (
                  <tr
                    key={step.id}
                    className="border-l-4 border-l-transparent bg-white hover:bg-slate-50 border-b border-slate-200"
                  >
                    <td className="border border-slate-300 p-2 text-center align-top font-bold text-slate-500">
                      {index + 1}
                    </td>
                    <td className="border border-slate-300 p-1 align-top">
                      <textarea value={step.langkah} onChange={(e) => updateStepText(step.id, 'langkah', e.target.value)} className="w-full p-2 min-h-[100px] text-xs border-none focus:ring-1 focus:ring-primary bg-white/50 resize-y rounded" placeholder="Tuliskan langkah pekerjaan..." />
                      {(() => {
                        const cand = aggregatePointNeeds(procSections?.[index]?.points || []);
                        const cur = { ...emptyKebutuhan(), ...step.kebutuhan };
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
                      })()}
                    </td>
                    <td className="border border-slate-300 p-1 align-top">
                      <select value={step.jenisBahaya} onChange={(e) => updateStepText(step.id, 'jenisBahaya', e.target.value)} className="w-full p-1.5 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-primary bg-white">
                        {BAHAYA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </td>
                    <td className="border border-slate-300 p-1 align-top">
                      <textarea value={step.sebab} onChange={(e) => updateStepText(step.id, 'sebab', e.target.value)} className="w-full p-2 min-h-[100px] text-xs border-none focus:ring-1 focus:ring-primary bg-white/50 resize-y rounded" placeholder="Sebab / sumber bahaya..." />
                    </td>
                    <td className="border border-slate-300 p-1 align-top">
                      <textarea value={step.potensiBahaya} onChange={(e) => updateStepText(step.id, 'potensiBahaya', e.target.value)} className="w-full p-2 min-h-[100px] text-xs border-none focus:ring-1 focus:ring-primary bg-white/50 resize-y rounded" placeholder="Potensi bahaya..." />
                    </td>
                    <td className="border border-slate-300 p-1 align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500">Eliminasi:</label><textarea value={step.faktorPositif.eliminasi || ''} onChange={(e) => updateControlField(step.id, 'faktorPositif', 'eliminasi', e.target.value)} className="w-full p-1 text-xs border border-slate-200 bg-white rounded min-h-[40px] resize-y focus:ring-1 focus:ring-primary" /></div>
                        <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500">Substitusi:</label><textarea value={step.faktorPositif.substitusi || ''} onChange={(e) => updateControlField(step.id, 'faktorPositif', 'substitusi', e.target.value)} className="w-full p-1 text-xs border border-slate-200 bg-white rounded min-h-[40px] resize-y focus:ring-1 focus:ring-primary" /></div>
                        <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500">Rekayasa Alat:</label><textarea value={step.faktorPositif.rekayasa || ''} onChange={(e) => updateControlField(step.id, 'faktorPositif', 'rekayasa', e.target.value)} className="w-full p-1 text-xs border border-slate-200 bg-white rounded min-h-[40px] resize-y focus:ring-1 focus:ring-primary" /></div>
                        <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500">Administrasi:</label><textarea value={step.faktorPositif.administrasi || ''} onChange={(e) => updateControlField(step.id, 'faktorPositif', 'administrasi', e.target.value)} className="w-full p-1 text-xs border border-slate-200 bg-white rounded min-h-[40px] resize-y focus:ring-1 focus:ring-primary" /></div>
                        <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500">APD:</label><textarea value={step.faktorPositif.apd || ''} onChange={(e) => updateControlField(step.id, 'faktorPositif', 'apd', e.target.value)} className="w-full p-1 text-xs border border-slate-200 bg-white rounded min-h-[40px] resize-y focus:ring-1 focus:ring-primary" /></div>
                      </div>
                    </td>
                    {/* Inherent Risk: Severity */}
                    <td className="border border-slate-300 p-1 align-top bg-orange-50/50"><input type="number" min="1" max="5" value={step.inherentRisk.severity} onChange={(e) => updateInherentRisk(step.id, 'severity', e.target.value)} className="w-full p-1 text-center text-xs bg-white border border-slate-200 rounded" /></td>
                    {/* Inherent Risk: Probability -> Intensitas, Kapabilitas, History, Total */}
                    <td className="border border-slate-300 p-1 align-top bg-orange-50/30"><input type="number" min="1" max="5" value={step.inherentRisk.intensitas} onChange={(e) => updateInherentRisk(step.id, 'intensitas', e.target.value)} className="w-full p-1 text-center text-xs bg-white border border-slate-200 rounded" /></td>
                    <td className="border border-slate-300 p-1 align-top bg-orange-50/30"><input type="number" min="1" max="5" value={step.inherentRisk.kapabilitas} onChange={(e) => updateInherentRisk(step.id, 'kapabilitas', e.target.value)} className="w-full p-1 text-center text-xs bg-white border border-slate-200 rounded" /></td>
                    <td className="border border-slate-300 p-1 align-top bg-orange-50/30"><input type="number" min="1" max="5" value={step.inherentRisk.history} onChange={(e) => updateInherentRisk(step.id, 'history', e.target.value)} className="w-full p-1 text-center text-xs bg-white border border-slate-200 rounded" /></td>
                    <td className="border border-slate-300 p-1 align-middle text-center font-bold bg-slate-100">{step.inherentRisk.total}</td>
                    {/* Inherent Risk: Prob, RPN */}
                    <td className="border border-slate-300 p-1 align-middle text-center font-bold bg-slate-100">{step.inherentRisk.probability}</td>
                    <td className={`border border-slate-300 p-1 align-middle text-center font-black text-sm ${getRpnColor(step.inherentRisk.rpn)}`}>{step.inherentRisk.rpn}</td>
                    
                    {/* Mitigasi */}
                    <td className="border border-slate-300 p-1 align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500">Eliminasi:</label><textarea value={step.mitigasi.eliminasi || ''} onChange={(e) => updateControlField(step.id, 'mitigasi', 'eliminasi', e.target.value)} className="w-full p-1 text-xs border border-slate-200 bg-white rounded min-h-[40px] resize-y focus:ring-1 focus:ring-primary" /></div>
                        <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500">Substitusi:</label><textarea value={step.mitigasi.substitusi || ''} onChange={(e) => updateControlField(step.id, 'mitigasi', 'substitusi', e.target.value)} className="w-full p-1 text-xs border border-slate-200 bg-white rounded min-h-[40px] resize-y focus:ring-1 focus:ring-primary" /></div>
                        <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500">Rekayasa Alat:</label><textarea value={step.mitigasi.rekayasa || ''} onChange={(e) => updateControlField(step.id, 'mitigasi', 'rekayasa', e.target.value)} className="w-full p-1 text-xs border border-slate-200 bg-white rounded min-h-[40px] resize-y focus:ring-1 focus:ring-primary" /></div>
                        <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500">Administrasi:</label><textarea value={step.mitigasi.administrasi || ''} onChange={(e) => updateControlField(step.id, 'mitigasi', 'administrasi', e.target.value)} className="w-full p-1 text-xs border border-slate-200 bg-white rounded min-h-[40px] resize-y focus:ring-1 focus:ring-primary" /></div>
                        <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500">APD:</label><textarea value={step.mitigasi.apd || ''} onChange={(e) => updateControlField(step.id, 'mitigasi', 'apd', e.target.value)} className="w-full p-1 text-xs border border-slate-200 bg-white rounded min-h-[40px] resize-y focus:ring-1 focus:ring-primary" /></div>
                      </div>
                    </td>
                    
                    {/* Residual Risk: Severity */}
                    <td className="border border-slate-300 p-1 align-top bg-emerald-50/50"><input type="number" min="1" max="5" value={step.residualRisk.severity} onChange={(e) => updateResidualRisk(step.id, 'severity', e.target.value)} className="w-full p-1 text-center text-xs bg-white border border-slate-200 rounded" /></td>
                    {/* Residual Risk: Probability -> Intensitas, Kapabilitas, History, Total */}
                    <td className="border border-slate-300 p-1 align-top bg-emerald-50/30"><input type="number" min="1" max="5" value={step.residualRisk.intensitas} onChange={(e) => updateResidualRisk(step.id, 'intensitas', e.target.value)} className="w-full p-1 text-center text-xs bg-white border border-slate-200 rounded" /></td>
                    <td className="border border-slate-300 p-1 align-top bg-emerald-50/30"><input type="number" min="1" max="5" value={step.residualRisk.kapabilitas} onChange={(e) => updateResidualRisk(step.id, 'kapabilitas', e.target.value)} className="w-full p-1 text-center text-xs bg-white border border-slate-200 rounded" /></td>
                    <td className="border border-slate-300 p-1 align-top bg-emerald-50/30"><input type="number" min="1" max="5" value={step.residualRisk.history} onChange={(e) => updateResidualRisk(step.id, 'history', e.target.value)} className="w-full p-1 text-center text-xs bg-white border border-slate-200 rounded" /></td>
                    <td className="border border-slate-300 p-1 align-middle text-center font-bold bg-slate-100">{step.residualRisk.total}</td>
                    {/* Residual Risk: Prob, RPN */}
                    <td className="border border-slate-300 p-1 align-middle text-center font-bold bg-slate-100">{step.residualRisk.probability}</td>
                    <td className={`border border-slate-300 p-1 align-middle text-center font-black text-sm ${getRpnColor(step.residualRisk.rpn)}`}>{step.residualRisk.rpn}</td>
                    
                    {/* Paraf / Verifikasi + Delete */}
                    <td className="border border-slate-300 p-2 text-center align-middle"><button onClick={() => removeStep(step.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Hapus langkah"><Trash2 className="w-4 h-4 mx-auto" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end"><button onClick={addStep} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-100 flex gap-2 items-center shadow-sm"><Plus className="w-4 h-4" /> Tambah Langkah Baru</button></div>

      </div>

      <VendorInternalReviewActions projectId={projectId as string} docType="jsa" docId={docId} />

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="font-bold text-slate-800 mb-4">Preview PDF Analisa Keselamatan Kerja</h2>
        <div className="w-full bg-slate-500 rounded-xl overflow-hidden" style={{ height: '700px' }}>
          <PDFViewer width="100%" height="100%" className="border-none"><JsaPDF projectId={projectId as string} steps={jsaSteps as any} projectInfo={projectInfo as any} /></PDFViewer>
        </div>
      </div>
    </div>
  );
}
