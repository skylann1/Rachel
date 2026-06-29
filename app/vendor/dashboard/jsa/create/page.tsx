"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Plus, Trash2, ClipboardList, AlertTriangle, ShieldCheck, HelpCircle, Sparkles, Loader2 } from 'lucide-react';

export default function CreateJSAPage() {
  const [jobSteps, setJobSteps] = useState([
    { id: 1, step: '', hazard: '', mitigation: '' }
  ]);
  const [isAILoading, setIsAILoading] = useState<{ [key: number]: boolean }>({});

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiEvaluation, setAiEvaluation] = useState<{ score: number, summary: string } | null>(null);

  const addStep = () => {
    setJobSteps([...jobSteps, { id: Date.now(), step: '', hazard: '', mitigation: '' }]);
  };

  const removeStep = (id: number) => {
    if (jobSteps.length > 1) {
      setJobSteps(jobSteps.filter(step => step.id !== id));
    }
  };

  const handleStepChange = (id: number, field: string, value: string) => {
    setJobSteps(prev => prev.map(step => step.id === id ? { ...step, [field]: value } : step));
    // Reset evaluation if user modifies after evaluation
    if (aiEvaluation) setAiEvaluation(null);
  };

  const handleStepBlur = async (id: number, stepText: string) => {
    const currentStep = jobSteps.find(s => s.id === id);
    if (!currentStep || stepText.trim() === '') return;
    
    if (currentStep.hazard.trim() !== '' && currentStep.mitigation.trim() !== '') return;

    setIsAILoading(prev => ({ ...prev, [id]: true }));

    try {
      const response = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobStep: stepText })
      });

      if (response.ok) {
        const data = await response.json();
        setJobSteps(prev => prev.map(step => {
          if (step.id === id) {
            return {
              ...step,
              hazard: step.hazard.trim() === '' ? data.hazard : step.hazard,
              mitigation: step.mitigation.trim() === '' ? data.mitigation : step.mitigation
            };
          }
          return step;
        }));
      }
    } catch (error) {
      console.error('AI Co-pilot failed', error);
    } finally {
      setIsAILoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleEvaluate = async () => {
    // Check if empty
    if (jobSteps.some(s => s.step.trim() === '' || s.hazard.trim() === '' || s.mitigation.trim() === '')) {
      alert("Harap lengkapi semua baris JSA sebelum evaluasi.");
      return;
    }

    setIsEvaluating(true);
    setAiEvaluation(null);

    try {
      const response = await fetch('/api/ai/gatekeeper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsaData: jobSteps })
      });

      if (response.ok) {
        const data = await response.json();
        setAiEvaluation(data);
      }
    } catch (error) {
      console.error('AI Gatekeeper failed', error);
    } finally {
      setIsEvaluating(false);
    }
  };

  const isSubmitDisabled = aiEvaluation ? aiEvaluation.score < 80 : true;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link 
            href="/vendor/dashboard/jsa"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              Form Pengajuan JSA 
              <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                 <Sparkles className="w-3 h-3" /> AI CO-PILOT
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">Isi formulir Job Safety Analysis secara mendetail sebelum memulai pekerjaan.</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
           <button 
             type="button" 
             onClick={handleEvaluate}
             disabled={isEvaluating}
             className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl transition-colors disabled:opacity-50"
           >
             {isEvaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
             Evaluasi Kelayakan AI
           </button>
           <button 
             type="button" 
             disabled={isSubmitDisabled}
             className={`flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-sm ${isSubmitDisabled ? 'bg-slate-300 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 shadow-primary/30'}`}
             title={isSubmitDisabled ? "Lakukan evaluasi AI dan capai skor >= 80 untuk mengirim" : ""}
           >
             <Save className="w-4 h-4" />
             Kirim Pengajuan
           </button>
        </div>
      </div>

      {aiEvaluation && (
        <div className={`p-6 rounded-2xl border flex items-start gap-4 ${aiEvaluation.score >= 80 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl font-black shadow-inner ${aiEvaluation.score >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {aiEvaluation.score}
          </div>
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              {aiEvaluation.score >= 80 ? '✅ JSA Layak Diajukan' : '❌ JSA Belum Memenuhi Standar'}
            </h3>
            <p className="text-sm mt-1 leading-relaxed opacity-90">{aiEvaluation.summary}</p>
            {aiEvaluation.score < 80 && (
              <p className="text-xs font-bold mt-2 text-rose-600">Anda harus merevisi mitigasi di bawah ini agar skor mencapai minimal 80 untuk mengaktifkan tombol Kirim Pengajuan.</p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-6">
        
        {/* Section 1: Informasi Umum */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              1. Informasi Umum Pekerjaan
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Pilih Proyek / Pekerjaan</label>
              <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm">
                <option value="">-- Pilih Proyek Aktif --</option>
                <option value="PRJ-001">Penggalian Pipa Gas Area A</option>
                <option value="PRJ-002">Maintenance Kompresor B</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Area / Lokasi Spesifik</label>
              <input type="text" placeholder="Misal: Plant A, Zona Merah" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Tanggal Pelaksanaan JSA</label>
              <input type="date" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Pelaksana Pekerjaan (Tim / Grup)</label>
              <input type="text" placeholder="Misal: Tim Mekanik Regu 2" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm" />
            </div>
          </div>
        </div>

        {/* Section 2: Prosedur Kerja / Instruksi Kerja */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              2. Referensi Prosedur Kerja / SOP
            </h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-600 mb-4">Sesuai dengan alur kerja, pastikan Anda telah memiliki Prosedur Kerja/Instruksi Kerja (SOP) yang disetujui. Langkah kerja pada JSA harus mengacu pada prosedur ini.</p>
            <div className="space-y-4">
               <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Upload Dokumen Prosedur Kerja (PDF/Word)</label>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                     <p className="text-sm text-slate-500">Klik di sini atau seret file dokumen prosedur ke area ini</p>
                  </div>
               </div>
               <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Atau, Ketik Ringkasan Prosedur (Opsional)</label>
                  <textarea 
                    rows={3} 
                    placeholder="Tuliskan ringkasan prosedur atau nomor dokumen referensi SOP..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                  ></textarea>
               </div>
            </div>
          </div>
        </div>

        {/* Section 3: Peralatan & APD */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              3. Peralatan & Alat Pelindung Diri (APD)
            </h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-600 mb-4">Centang perlengkapan keselamatan yang wajib digunakan selama pekerjaan ini berlangsung.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
               {['Helm Safety (Safety Helmet)', 'Kacamata Safety (Safety Glasses)', 'Sepatu Safety (Safety Shoes)', 'Sarung Tangan (Gloves)', 'Masker / Respirator', 'Pelindung Telinga (Ear Plug)', 'Rompi Reflektif', 'Body Harness (Pekerjaan Ketinggian)'].map((apd, idx) => (
                  <label key={idx} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                     <div className="flex h-5 items-center">
                        <input type="checkbox" className="w-4 h-4 rounded text-primary focus:ring-primary/30 border-slate-300" />
                     </div>
                     <span className="text-sm font-medium text-slate-700 leading-tight">{apd}</span>
                  </label>
               ))}
            </div>
          </div>
        </div>

        {/* Section 4: Tabel JSA (Langkah Kerja, Bahaya, Mitigasi) */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              4. Analisis Keselamatan Kerja (JSA Table)
            </h2>
            <button 
              type="button" 
              onClick={addStep}
              className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Baris
            </button>
          </div>
          <div className="p-6 overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse">
               <thead>
                  <tr className="bg-slate-50 border-y border-slate-200">
                     <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 w-10">No</th>
                     <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 w-1/3">Urutan Langkah Pekerjaan</th>
                     <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 w-1/3">Potensi Bahaya / Risiko</th>
                     <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 w-1/3">Tindakan Pengendalian (Mitigasi)</th>
                     <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 w-16">Aksi</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {jobSteps.map((step, index) => (
                     <tr key={step.id}>
                        <td className="px-4 py-4 align-top text-sm font-bold text-slate-400 pt-6">
                           {index + 1}
                        </td>
                        <td className="px-4 py-4 align-top">
                           <div className="relative">
                             <textarea 
                               rows={3} 
                               value={step.step}
                               onChange={(e) => handleStepChange(step.id, 'step', e.target.value)}
                               onBlur={(e) => handleStepBlur(step.id, e.target.value)}
                               placeholder="Ketik langkah, lalu klik di luar kotak agar AI menyarankan bahaya..."
                               className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                             ></textarea>
                           </div>
                        </td>
                        <td className="px-4 py-4 align-top relative">
                           {isAILoading[step.id] ? (
                             <div className="absolute inset-0 m-4 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10 rounded-xl border border-blue-100 text-blue-500">
                               <Loader2 className="w-5 h-5 animate-spin mb-1" />
                               <span className="text-[10px] font-bold">AI Analyzing...</span>
                             </div>
                           ) : null}
                           <textarea 
                             rows={3} 
                             value={step.hazard}
                             onChange={(e) => handleStepChange(step.id, 'hazard', e.target.value)}
                             placeholder="Contoh: Percikan api, tersengat listrik..."
                             className="w-full px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 outline-none transition-all text-sm"
                           ></textarea>
                        </td>
                        <td className="px-4 py-4 align-top relative">
                           {isAILoading[step.id] ? (
                             <div className="absolute inset-0 m-4 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10 rounded-xl border border-blue-100 text-blue-500">
                               <Loader2 className="w-5 h-5 animate-spin mb-1" />
                               <span className="text-[10px] font-bold">AI Suggesting...</span>
                             </div>
                           ) : null}
                           <textarea 
                             rows={3} 
                             value={step.mitigation}
                             onChange={(e) => handleStepChange(step.id, 'mitigation', e.target.value)}
                             placeholder="Contoh: Memakai sarung tangan tahan panas..."
                             className="w-full px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all text-sm"
                           ></textarea>
                        </td>
                        <td className="px-4 py-4 align-top text-center pt-6">
                           <button 
                             onClick={() => removeStep(step.id)}
                             disabled={jobSteps.length === 1}
                             className={`p-2 rounded-lg transition-colors ${jobSteps.length === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
                             title="Hapus Baris"
                           >
                              <Trash2 className="w-5 h-5" />
                           </button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
