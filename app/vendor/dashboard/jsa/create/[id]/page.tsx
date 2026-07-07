'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import JsaPDF from './JsaPDF';
import { saveJsa, getJsa } from './actions';

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false }
);

export interface JsaStepData {
  id: number;
  langkah: string;
  jenisBahaya: string;
  sebab: string;
  potensiBahaya: string;
  faktorPositif: string;
  inherentRisk: { severity: number, intensitas: number, kapabilitas: number, history: number, total: number, probability: number, rpn: number };
  mitigasi: string;
  residualRisk: { severity: number, intensitas: number, kapabilitas: number, history: number, total: number, probability: number, rpn: number };
}

const defaultRisk = { severity: 1, intensitas: 1, kapabilitas: 1, history: 1, total: 3, probability: 1, rpn: 1 };
const BAHAYA_OPTIONS = ['Fisika', 'Kimia', 'Biologi', 'Ergonomi', 'Psikologi'];

export default function JSACreatePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.id === 'string' ? decodeURIComponent(params.id) : 'PRJ-000';

  const [jsaSteps, setJsaSteps] = useState<JsaStepData[]>([
    { id: 1, langkah: '', jenisBahaya: 'Fisika', sebab: '', potensiBahaya: '', faktorPositif: '', inherentRisk: {...defaultRisk}, mitigasi: '', residualRisk: {...defaultRisk} }
  ]);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    async function loadData() {
      if (projectId) {
        const data = await getJsa(projectId);
        if (data && data.steps && data.steps.length > 0) {
          setJsaSteps(data.steps.map((step: any) => {
            const hazards = typeof step.hazards === 'string' ? JSON.parse(step.hazards) : (step.hazards || {});
            const risks = typeof step.risks === 'string' ? JSON.parse(step.risks) : (step.risks || {});
            const controls = typeof step.controls === 'string' ? JSON.parse(step.controls) : (step.controls || {});
            
            const legacyBahaya = Array.isArray(hazards) ? hazards[0] : '';
            const legacyMitigasi = Array.isArray(controls) ? controls[0] : '';
            
            return {
              id: step.id || Date.now() + Math.random(),
              langkah: step.description || '',
              jenisBahaya: hazards.jenisBahaya || (legacyBahaya ? 'Fisika' : 'Fisika'),
              sebab: hazards.sebab || '',
              potensiBahaya: hazards.potensiBahaya || legacyBahaya || '',
              faktorPositif: risks.faktorPositif || '',
              inherentRisk: risks.inherentRisk || {...defaultRisk},
              mitigasi: controls.mitigasi || legacyMitigasi || '',
              residualRisk: controls.residualRisk || {...defaultRisk}
            };
          }));
        } else if (data && data.procedureSteps && data.procedureSteps.length > 0) {
          setJsaSteps(data.procedureSteps.map((stepDesc: string, idx: number) => ({
            id: Date.now() + idx,
            langkah: stepDesc,
            jenisBahaya: 'Fisika',
            sebab: '',
            potensiBahaya: '',
            faktorPositif: '',
            inherentRisk: {...defaultRisk},
            mitigasi: '',
            residualRisk: {...defaultRisk}
          })));
        }
      }
    }
    loadData();
  }, [projectId]);

  const addStep = () => {
    setJsaSteps([...jsaSteps, { id: Date.now(), langkah: '', jenisBahaya: 'Fisika', sebab: '', potensiBahaya: '', faktorPositif: '', inherentRisk: {...defaultRisk}, mitigasi: '', residualRisk: {...defaultRisk} }]);
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

  const updateStepText = (id: number, field: keyof JsaStepData, value: string) => {
    setJsaSteps(jsaSteps.map(step => step.id === id ? { ...step, [field]: value } : step));
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
      alert("Terjadi kesalahan saat menyimpan JSA.");
    } finally {
      setIsSaving(false);
    }
  };

  const getRpnColor = (rpn: number) => {
    if (rpn >= 15) return 'bg-red-500 text-white';
    if (rpn >= 8) return 'bg-yellow-400 text-black';
    if (rpn >= 4) return 'bg-green-500 text-white';
    return 'bg-green-300 text-black';
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 px-4">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <Link href={`/vendor/dashboard/projects/${encodeURIComponent(projectId)}`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Proyek
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-orange-500" />
            Formulir JSA
          </h1>
        </div>
        <button onClick={handleSimpan} disabled={isSaving} className="px-6 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 disabled:bg-primary/50 transition-colors shadow-sm shadow-primary/30 flex items-center gap-2">
          {isSaving ? (
            <span className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</span>
          ) : (
            <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Submit JSA</span>
          )}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h2 className="font-bold text-slate-800">Tabel Analisa Keselamatan Kerja (JSA)</h2>
          <p className="text-xs text-slate-500 mt-1">Scroll ke kanan untuk melihat seluruh kolom matriks risiko.</p>
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
                <th rowSpan={3} className="border border-slate-300 px-2 py-3 text-center w-20 bg-slate-200 font-bold align-middle">Paraf /<br/>Verifikasi<br/><span className="text-[9px] font-normal text-slate-500">(21)</span></th>
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
              {jsaSteps.map((step, index) => (
                <tr key={step.id} className="hover:bg-slate-50/50 border-b border-slate-200">
                  <td className="border border-slate-300 p-2 text-center align-top font-bold text-slate-500">{index + 1}</td>
                  <td className="border border-slate-300 p-1 align-top"><textarea value={step.langkah} onChange={(e) => updateStepText(step.id, 'langkah', e.target.value)} className="w-full p-2 min-h-[100px] text-xs border-none focus:ring-1 focus:ring-primary bg-transparent resize-y rounded" placeholder="Tuliskan langkah pekerjaan..." /></td>
                  <td className="border border-slate-300 p-1 align-top"><select value={step.jenisBahaya} onChange={(e) => updateStepText(step.id, 'jenisBahaya', e.target.value)} className="w-full p-1.5 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-primary">{BAHAYA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></td>
                  <td className="border border-slate-300 p-1 align-top"><textarea value={step.sebab} onChange={(e) => updateStepText(step.id, 'sebab', e.target.value)} className="w-full p-2 min-h-[100px] text-xs border-none focus:ring-1 focus:ring-primary bg-transparent resize-y rounded" placeholder="Sebab / sumber bahaya..." /></td>
                  <td className="border border-slate-300 p-1 align-top"><textarea value={step.potensiBahaya} onChange={(e) => updateStepText(step.id, 'potensiBahaya', e.target.value)} className="w-full p-2 min-h-[100px] text-xs border-none focus:ring-1 focus:ring-primary bg-transparent resize-y rounded" placeholder="Potensi bahaya..." /></td>
                  <td className="border border-slate-300 p-1 align-top"><textarea value={step.faktorPositif} onChange={(e) => updateStepText(step.id, 'faktorPositif', e.target.value)} className="w-full p-2 min-h-[100px] text-xs border-none focus:ring-1 focus:ring-primary bg-transparent resize-y rounded" placeholder="Pengendalian yang sudah ada..." /></td>
                  
                  {/* Inherent Risk: Severity */}
                  <td className="border border-slate-300 p-1 align-top bg-orange-50/30"><input type="number" min="1" max="5" value={step.inherentRisk.severity} onChange={(e) => updateInherentRisk(step.id, 'severity', e.target.value)} className="w-full p-1 text-center text-xs bg-transparent border border-slate-200 rounded" /></td>
                  {/* Inherent Risk: Probability -> Intensitas, Kapabilitas, History, Total */}
                  <td className="border border-slate-300 p-1 align-top bg-orange-50/20"><input type="number" min="1" max="5" value={step.inherentRisk.intensitas} onChange={(e) => updateInherentRisk(step.id, 'intensitas', e.target.value)} className="w-full p-1 text-center text-xs bg-transparent border border-slate-200 rounded" /></td>
                  <td className="border border-slate-300 p-1 align-top bg-orange-50/20"><input type="number" min="1" max="5" value={step.inherentRisk.kapabilitas} onChange={(e) => updateInherentRisk(step.id, 'kapabilitas', e.target.value)} className="w-full p-1 text-center text-xs bg-transparent border border-slate-200 rounded" /></td>
                  <td className="border border-slate-300 p-1 align-top bg-orange-50/20"><input type="number" min="1" max="5" value={step.inherentRisk.history} onChange={(e) => updateInherentRisk(step.id, 'history', e.target.value)} className="w-full p-1 text-center text-xs bg-transparent border border-slate-200 rounded" /></td>
                  <td className="border border-slate-300 p-1 align-middle text-center font-bold bg-slate-100">{step.inherentRisk.total}</td>
                  {/* Inherent Risk: Prob, RPN */}
                  <td className="border border-slate-300 p-1 align-middle text-center font-bold bg-slate-100">{step.inherentRisk.probability}</td>
                  <td className={`border border-slate-300 p-1 align-middle text-center font-black text-sm ${getRpnColor(step.inherentRisk.rpn)}`}>{step.inherentRisk.rpn}</td>
                  
                  {/* Mitigasi */}
                  <td className="border border-slate-300 p-1 align-top"><textarea value={step.mitigasi} onChange={(e) => updateStepText(step.id, 'mitigasi', e.target.value)} className="w-full p-2 min-h-[100px] text-xs border-none focus:ring-1 focus:ring-primary bg-transparent resize-y rounded" placeholder="Tindakan mitigasi..." /></td>
                  
                  {/* Residual Risk: Severity */}
                  <td className="border border-slate-300 p-1 align-top bg-emerald-50/30"><input type="number" min="1" max="5" value={step.residualRisk.severity} onChange={(e) => updateResidualRisk(step.id, 'severity', e.target.value)} className="w-full p-1 text-center text-xs bg-transparent border border-slate-200 rounded" /></td>
                  {/* Residual Risk: Probability -> Intensitas, Kapabilitas, History, Total */}
                  <td className="border border-slate-300 p-1 align-top bg-emerald-50/20"><input type="number" min="1" max="5" value={step.residualRisk.intensitas} onChange={(e) => updateResidualRisk(step.id, 'intensitas', e.target.value)} className="w-full p-1 text-center text-xs bg-transparent border border-slate-200 rounded" /></td>
                  <td className="border border-slate-300 p-1 align-top bg-emerald-50/20"><input type="number" min="1" max="5" value={step.residualRisk.kapabilitas} onChange={(e) => updateResidualRisk(step.id, 'kapabilitas', e.target.value)} className="w-full p-1 text-center text-xs bg-transparent border border-slate-200 rounded" /></td>
                  <td className="border border-slate-300 p-1 align-top bg-emerald-50/20"><input type="number" min="1" max="5" value={step.residualRisk.history} onChange={(e) => updateResidualRisk(step.id, 'history', e.target.value)} className="w-full p-1 text-center text-xs bg-transparent border border-slate-200 rounded" /></td>
                  <td className="border border-slate-300 p-1 align-middle text-center font-bold bg-slate-100">{step.residualRisk.total}</td>
                  {/* Residual Risk: Prob, RPN */}
                  <td className="border border-slate-300 p-1 align-middle text-center font-bold bg-slate-100">{step.residualRisk.probability}</td>
                  <td className={`border border-slate-300 p-1 align-middle text-center font-black text-sm ${getRpnColor(step.residualRisk.rpn)}`}>{step.residualRisk.rpn}</td>
                  
                  {/* Paraf / Verifikasi + Delete */}
                  <td className="border border-slate-300 p-2 text-center align-middle"><button onClick={() => removeStep(step.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Hapus langkah"><Trash2 className="w-4 h-4 mx-auto" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end"><button onClick={addStep} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-100 flex gap-2 items-center"><Plus className="w-4 h-4" /> Tambah Langkah</button></div>

      </div>
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="font-bold text-slate-800 mb-4">Preview PDF Analisa Keselamatan Kerja</h2>
        <div className="w-full bg-slate-500 rounded-xl overflow-hidden" style={{ height: '700px' }}>
          <PDFViewer width="100%" height="100%" className="border-none"><JsaPDF projectId={projectId as string} steps={jsaSteps as any} /></PDFViewer>
        </div>
      </div>
    </div>
  );
}
