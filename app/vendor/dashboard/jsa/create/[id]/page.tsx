'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, ShieldAlert, FileSignature, CheckCircle2 } from 'lucide-react';
import { PDFViewer } from '@react-pdf/renderer';
import JsaPDF from './JsaPDF';
import { saveJsa, getJsa } from './actions';

export default function JSACreatePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.id === 'string' ? decodeURIComponent(params.id) : 'PRJ-000';

  const [jsaSteps, setJsaSteps] = useState([
    { id: 1, langkah: '', bahaya: '', mitigasi: '' }
  ]);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    async function loadData() {
      if (projectId) {
        const data = await getJsa(projectId);
        if (data && data.steps && data.steps.length > 0) {
          setJsaSteps(data.steps.map((step: any) => ({
            id: step.id || Date.now() + Math.random(),
            langkah: step.description || '',
            bahaya: (typeof step.hazards === 'string' ? JSON.parse(step.hazards)[0] : step.hazards?.[0]) || '',
            mitigasi: (typeof step.controls === 'string' ? JSON.parse(step.controls)[0] : step.controls?.[0]) || '',
          })));
        }
      }
    }
    loadData();
  }, [projectId]);

  const addStep = () => {
    setJsaSteps([...jsaSteps, { id: Date.now(), langkah: '', bahaya: '', mitigasi: '' }]);
  };

  const removeStep = (id: number) => {
    if (jsaSteps.length > 1) {
      setJsaSteps(jsaSteps.filter(step => step.id !== id));
    }
  };

  const updateStep = (id: number, field: string, value: string) => {
    setJsaSteps(jsaSteps.map(step => 
      step.id === id ? { ...step, [field]: value } : step
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
      alert("Terjadi kesalahan saat menyimpan JSA.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Nav */}
      <div>
        <Link href={`/vendor/dashboard/projects/${encodeURIComponent(projectId)}`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Detail Proyek
        </Link>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex gap-4 items-center">
            <div className="w-14 h-14 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Formulir JSA & HIRADC</h1>
              <div className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wider">Project ID: {projectId}</div>
            </div>
          </div>
          <button onClick={handleSimpan} disabled={isSaving} className="px-6 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 disabled:bg-primary/50 transition-colors shadow-sm shadow-primary/30 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> {isSaving ? 'Menyimpan...' : 'Submit JSA'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Form Builder */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
              Langkah Kerja & Analisis Risiko
              <button onClick={addStep} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">
                <Plus className="w-3.5 h-3.5" /> Tambah Baris
              </button>
            </h2>

            <div className="space-y-6">
              {jsaSteps.map((step, index) => (
                <div key={step.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 relative group">
                  <div className="absolute -top-3 -left-3 w-6 h-6 bg-slate-800 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                    {index + 1}
                  </div>
                  
                  {jsaSteps.length > 1 && (
                     <button onClick={() => removeStep(step.id)} className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                     </button>
                  )}

                  <div className="space-y-4 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Langkah Kerja</label>
                      <textarea 
                        value={step.langkah}
                        onChange={(e) => updateStep(step.id, 'langkah', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/30 outline-none text-sm resize-none" 
                        rows={2} 
                        placeholder="Contoh: Mengangkat material menggunakan crane"
                      ></textarea>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Potensi Bahaya</label>
                      <textarea 
                        value={step.bahaya}
                        onChange={(e) => updateStep(step.id, 'bahaya', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/30 outline-none text-sm resize-none" 
                        rows={2} 
                        placeholder="Contoh: Material terjatuh menimpa pekerja"
                      ></textarea>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mitigasi / Pengendalian</label>
                      <textarea 
                        value={step.mitigasi}
                        onChange={(e) => updateStep(step.id, 'mitigasi', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/30 outline-none text-sm resize-none" 
                        rows={2} 
                        placeholder="Contoh: Menggunakan tagline, sterilisasi area angkat, memakai helm safety"
                      ></textarea>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={addStep} className="w-full mt-4 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 rounded-xl transition-all font-bold text-sm">
               <Plus className="w-4 h-4" /> Tambah Langkah Kerja Baru
            </button>
          </div>
        </div>

        {/* Right Column: PDF Preview */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[800px] sticky top-24">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-2 font-bold text-sm text-slate-700">
               <FileSignature className="w-4 h-4 text-slate-400" /> Preview JSA PDF (Otomatis)
             </div>
          </div>
          <div className="flex-1 w-full bg-slate-500">
             <PDFViewer width="100%" height="100%" className="border-none">
               <JsaPDF projectId={projectId} steps={jsaSteps} />
             </PDFViewer>
          </div>
        </div>
      </div>
    </div>
  );
}
