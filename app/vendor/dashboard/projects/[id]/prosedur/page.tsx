"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  FileText, ArrowRight, ShieldCheck, Hammer, 
  UploadCloud, CheckCircle2, X, HardHat, Info, Download, Plus, Trash2, GripVertical
} from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ProsedurPDF } from './ProsedurPDF';

// Mock list APD
const apdList = [
  { id: 'Safety Helmet', label: 'Safety Helmet', icon: HardHat },
  { id: 'Safety Shoes', label: 'Safety Shoes', icon: ShieldCheck },
  { id: 'Safety Glasses', label: 'Safety Glasses', icon: ShieldCheck },
  { id: 'Safety Gloves', label: 'Safety Gloves', icon: ShieldCheck },
  { id: 'Reflective Vest', label: 'Reflective Vest', icon: ShieldCheck },
  { id: 'Full Body Harness', label: 'Full Body Harness', icon: ShieldCheck },
  { id: 'Respirator / Masker', label: 'Respirator / Masker', icon: ShieldCheck },
  { id: 'Ear Plug / Muff', label: 'Ear Plug / Muff', icon: ShieldCheck },
];

export default function ProsedurKerjaForm() {
  const router = useRouter();
  const params = useParams();
  
  // Hydration fix for PDFDownloadLink
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [isSaving, setIsSaving] = useState(false);

  // --- Form State ---
  const [docNo, setDocNo] = useState('');
  const [contractNo, setContractNo] = useState('006600.PMB-BP/LG.01/OP-CKR/PGAS/V/2026'); 
  const [submissionDate, setSubmissionDate] = useState('2026-06-29');
  
  // Section 1
  const [umum, setUmum] = useState('Pekerjaan Perbaikan Pos Security dilaksanakan untuk memperbaiki kondisi bangunan pos security agar berfungsi dengan baik, aman, dan sesuai standar operasional perusahaan. Seluruh pekerjaan harus dilaksanakan sesuai prosedur kerja, spesifikasi teknis, standar K3, dan peraturan yang berlaku di lokasi kerja.');

  // Section 2
  const [scopeOfWork, setScopeOfWork] = useState('- Mobilisasi dan demobilisasi peralatan serta material.\n- Pembongkaran keramik lantai existing.\n- Pembongkaran dinding existing.\n- Pengikisan lapisan cat existing.\n- Pekerjaan pasangan dinding bata.\n- Pekerjaan plesteran dan acian dinding.\n- Pemasangan keramik lantai.\n- Pengecatan dinding.\n- Pengecatan lisplang.\n- Pengecatan plafon.\n- Pemasangan built in railing tangga.\n- Pembersihan area kerja (housekeeping).\n- Demobilisasi peralatan dan penyelesaian pekerjaan.');
  
  // Section 3
  const [tools, setTools] = useState<string[]>(['Meteran', 'Waterpass', 'Palu', 'Pahat', 'Sekop', 'Cetok', 'Ember adukan', 'Tangga kerja', 'Scaffolding', 'Gerinda tangan', 'Mesin potong keramik', 'Mesin bor listrik', 'Wire brush', 'Scraper', 'Kuas cat', 'Roller cat', 'Jack Hammer (jika diperlukan)', 'Mesin las (jika diperlukan)', 'Sapu dan alat kebersihan']);
  const [toolInput, setToolInput] = useState('');
  
  // Section 4
  const [selectedApd, setSelectedApd] = useState<string[]>(['Safety Helmet', 'Safety Shoes', 'Safety Glasses', 'Safety Gloves', 'Reflective Vest']);

  // Section 5
  const [perlengkapanLainnya, setPerlengkapanLainnya] = useState<string[]>(['Barricade tape', 'Safety line', 'Rambu-rambu K3', 'APAR', 'Kotak P3K', 'Lampu kerja (bila diperlukan)', 'Tempat sampah/karung limbah', 'Form Permit To Work (PTW)', 'Form JSA', 'Checklist Peralatan']);
  const [perlengkapanInput, setPerlengkapanInput] = useState('');

  // Section 6
  const [tahapanPekerjaan, setTahapanPekerjaan] = useState<{title: string, points: string[]}[]>([
    {
      title: 'Persiapan',
      points: [
        'Melaksanakan Toolbox Meeting dan Safety Briefing.',
        'Memastikan Permit To Work (PTW) telah disetujui.',
        'Memastikan seluruh pekerja menggunakan APD lengkap.',
        'Memasang barricade dan rambu-rambu pengamanan area kerja.',
        'Melakukan inspeksi alat kerja sebelum digunakan.'
      ]
    },
    {
      title: 'Pembongkaran Keramik Existing',
      points: [
        'Menentukan area pembongkaran.',
        'Membongkar keramik menggunakan palu dan pahat.',
        'Mengumpulkan material hasil bongkaran pada area yang telah ditentukan.',
        'Membersihkan area kerja.'
      ]
    }
  ]);

  // Section 7
  const [penyelesaianAkhir, setPenyelesaianAkhir] = useState<string[]>([
    'Membersihkan seluruh area kerja dari material sisa pekerjaan.',
    'Mengumpulkan dan membuang limbah pada lokasi yang telah ditentukan.',
    'Melakukan housekeeping area kerja.',
    'Melakukan inspeksi akhir bersama pengawas pekerjaan.',
    'Membuka barricade setelah pekerjaan dinyatakan selesai dan aman.',
    'Melaksanakan demobilisasi peralatan dan personel dari area kerja.'
  ]);
  const [penyelesaianInput, setPenyelesaianInput] = useState('');


  // --- Handlers ---
  const handleAddStringItem = (
    e: React.KeyboardEvent<HTMLInputElement>, 
    list: string[], 
    setList: React.Dispatch<React.SetStateAction<string[]>>, 
    input: string, 
    setInput: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!list.includes(input.trim())) {
        setList([...list, input.trim()]);
      }
      setInput('');
    }
  };

  const removeStringItem = (
    itemToRemove: string, 
    list: string[], 
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setList(list.filter(item => item !== itemToRemove));
  };

  const toggleApd = (apdId: string) => {
    if (selectedApd.includes(apdId)) {
      setSelectedApd(selectedApd.filter(id => id !== apdId));
    } else {
      setSelectedApd([...selectedApd, apdId]);
    }
  };

  // Tahapan Pekerjaan Handlers
  const addTahapanSection = () => {
    setTahapanPekerjaan([...tahapanPekerjaan, { title: 'Pekerjaan Baru', points: [] }]);
  };

  const removeTahapanSection = (index: number) => {
    const newTahapan = [...tahapanPekerjaan];
    newTahapan.splice(index, 1);
    setTahapanPekerjaan(newTahapan);
  };

  const updateTahapanTitle = (index: number, newTitle: string) => {
    const newTahapan = [...tahapanPekerjaan];
    newTahapan[index].title = newTitle;
    setTahapanPekerjaan(newTahapan);
  };

  const addTahapanPoint = (sectionIndex: number) => {
    const newTahapan = [...tahapanPekerjaan];
    newTahapan[sectionIndex].points.push('Langkah baru...');
    setTahapanPekerjaan(newTahapan);
  };

  const updateTahapanPoint = (sectionIndex: number, pointIndex: number, newText: string) => {
    const newTahapan = [...tahapanPekerjaan];
    newTahapan[sectionIndex].points[pointIndex] = newText;
    setTahapanPekerjaan(newTahapan);
  };

  const removeTahapanPoint = (sectionIndex: number, pointIndex: number) => {
    const newTahapan = [...tahapanPekerjaan];
    newTahapan[sectionIndex].points.splice(pointIndex, 1);
    setTahapanPekerjaan(newTahapan);
  };

  const handleSimpanLanjut = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      router.push('/vendor/dashboard/jsa/create');
    }, 1500);
  };

  const pdfData = {
    projectName: 'Perbaikan Pos Security Stasiun Muara Bekasi', 
    docNo,
    contractNo,
    submissionDate,
    umum,
    scopeOfWork,
    tools,
    apd: selectedApd,
    perlengkapanLainnya,
    tahapanPekerjaan,
    penyelesaianAkhir
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      
      {/* Header Info */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-3xl p-8 border border-primary/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-primary rounded-xl text-white shadow-sm shadow-primary/30">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Formulir Prosedur Kerja (Dinamis)</h1>
            <p className="text-sm font-medium text-slate-500">Proyek: Perbaikan Pos Security Stasiun Muara Bekasi</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSimpanLanjut} className="space-y-8">
        
        {/* SECTION A: Administrasi */}
        <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Info className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-slate-800">Section A: Dokumen Kontrol Administrasi</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">Doc. No (Nomor Dokumen) <span className="text-rose-500">*</span></label>
              <input 
                required
                type="text" 
                value={docNo}
                onChange={(e) => setDocNo(e.target.value)}
                placeholder="Misal: SOP-K3-001/2026"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm font-medium"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">Contract No (Read-Only)</label>
              <input 
                disabled
                type="text" 
                value={contractNo}
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 cursor-not-allowed"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700 block mb-2">Submission Date <span className="text-rose-500">*</span></label>
              <input 
                required
                type="date" 
                value={submissionDate}
                onChange={(e) => setSubmissionDate(e.target.value)}
                className="w-full md:w-1/2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm font-medium"
              />
            </div>
          </div>
        </section>

        {/* SECTION B: Teknis */}
        <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Hammer className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-slate-800">Section B: Ringkasan Teknis Lapangan (Dinamis)</h2>
          </div>
          
          <div className="space-y-8">
            {/* 1. UMUM */}
            <div>
              <label className="text-sm font-bold text-slate-800 block mb-2">1. UMUM</label>
              <textarea 
                rows={4}
                value={umum}
                onChange={(e) => setUmum(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm leading-relaxed resize-y font-medium"
              />
            </div>

            {/* 2. RUANG LINGKUP */}
            <div>
              <label className="text-sm font-bold text-slate-800 block mb-2">2. RUANG LINGKUP (Scope of Work)</label>
              <p className="text-xs text-slate-500 mb-2">Pisahkan dengan baris baru (Enter) untuk membuat bullet point.</p>
              <textarea 
                required
                rows={6}
                value={scopeOfWork}
                onChange={(e) => setScopeOfWork(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm leading-relaxed resize-y font-medium"
              />
            </div>

            {/* 3. ALAT / TOOLS */}
            <div>
              <label className="text-sm font-bold text-slate-800 block mb-2">3. ALAT / TOOLS</label>
              <p className="text-xs text-slate-500 mb-2">Ketik nama alat lalu tekan <strong>Enter</strong>.</p>
              <div className="min-h-[52px] w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all flex flex-wrap gap-2 items-center">
                {tools.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary font-bold text-xs rounded-lg border border-primary/20">
                    {tag}
                    <button type="button" onClick={() => removeStringItem(tag, tools, setTools)} className="hover:bg-primary/20 p-0.5 rounded-full transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input 
                  type="text" 
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  onKeyDown={(e) => handleAddStringItem(e, tools, setTools, toolInput, setToolInput)}
                  placeholder="Ketik peralatan..."
                  className="flex-1 min-w-[150px] bg-transparent border-none outline-none text-sm font-medium text-slate-700 py-1 px-1"
                />
              </div>
            </div>

            {/* 4. APD */}
            <div>
              <label className="text-sm font-bold text-slate-800 block mb-3">4. ALAT PELINDUNG DIRI (APD)</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {apdList.map((apd) => {
                  const Icon = apd.icon;
                  const isChecked = selectedApd.includes(apd.id);
                  return (
                    <label key={apd.id} className="relative cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="peer sr-only" 
                        checked={isChecked}
                        onChange={() => toggleApd(apd.id)}
                      />
                      <div className={`h-full flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all text-center ${isChecked ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white hover:bg-slate-50'}`}>
                        <Icon className={`w-6 h-6 mb-2 transition-colors ${isChecked ? 'text-emerald-500' : 'text-slate-400'}`} />
                        <span className={`text-xs font-bold ${isChecked ? 'text-emerald-700' : 'text-slate-600'}`}>{apd.label}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 5. PERLENGKAPAN LAINNYA */}
            <div>
              <label className="text-sm font-bold text-slate-800 block mb-2">5. PERLENGKAPAN LAINNYA</label>
              <p className="text-xs text-slate-500 mb-2">Ketik perlengkapan lalu tekan <strong>Enter</strong>.</p>
              <div className="min-h-[52px] w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all flex flex-wrap gap-2 items-center">
                {perlengkapanLainnya.map(item => (
                  <span key={item} className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 font-bold text-xs rounded-lg border border-amber-200">
                    {item}
                    <button type="button" onClick={() => removeStringItem(item, perlengkapanLainnya, setPerlengkapanLainnya)} className="hover:bg-amber-200 p-0.5 rounded-full transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input 
                  type="text" 
                  value={perlengkapanInput}
                  onChange={(e) => setPerlengkapanInput(e.target.value)}
                  onKeyDown={(e) => handleAddStringItem(e, perlengkapanLainnya, setPerlengkapanLainnya, perlengkapanInput, setPerlengkapanInput)}
                  placeholder="Ketik perlengkapan lainnya..."
                  className="flex-1 min-w-[150px] bg-transparent border-none outline-none text-sm font-medium text-slate-700 py-1 px-1"
                />
              </div>
            </div>

            {/* 6. TAHAPAN PEKERJAAN */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-bold text-slate-800 block">6. TAHAPAN PEKERJAAN (Work Steps)</label>
                <button type="button" onClick={addTahapanSection} className="flex items-center gap-1 text-xs font-bold bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700">
                  <Plus className="w-3 h-3" /> Tambah Sub-Bagian
                </button>
              </div>
              
              <div className="space-y-4">
                {tahapanPekerjaan.map((section, sIdx) => (
                  <div key={sIdx} className="border border-slate-200 bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-slate-100 font-bold text-slate-700 px-3 py-1.5 rounded-lg text-sm border border-slate-200">
                        6.{sIdx + 1}
                      </div>
                      <input 
                        type="text" 
                        value={section.title}
                        onChange={(e) => updateTahapanTitle(sIdx, e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-sm font-bold"
                      />
                      <button type="button" onClick={() => removeTahapanSection(sIdx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 pl-4 border-l-2 border-slate-100 ml-4">
                      {section.points.map((point, pIdx) => (
                        <div key={pIdx} className="flex items-start gap-2">
                          <GripVertical className="w-4 h-4 text-slate-300 mt-2 cursor-grab" />
                          <textarea 
                            value={point}
                            onChange={(e) => updateTahapanPoint(sIdx, pIdx, e.target.value)}
                            rows={2}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-sm resize-y"
                          />
                          <button type="button" onClick={() => removeTahapanPoint(sIdx, pIdx)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg mt-1">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addTahapanPoint(sIdx)} className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 mt-2 ml-6">
                        <Plus className="w-3 h-3" /> Tambah Poin
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 7. PEKERJAAN PENYELESAIAN AKHIR */}
            <div>
              <label className="text-sm font-bold text-slate-800 block mb-2">7. PEKERJAAN PENYELESAIAN AKHIR</label>
              <p className="text-xs text-slate-500 mb-2">Ketik poin penyelesaian lalu tekan <strong>Enter</strong>.</p>
              <div className="min-h-[52px] w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all flex flex-col gap-2 justify-center">
                <div className="flex flex-wrap gap-2">
                  {penyelesaianAkhir.map((item, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-lg border border-emerald-200">
                      {item.length > 30 ? item.substring(0, 30) + '...' : item}
                      <button type="button" onClick={() => removeStringItem(item, penyelesaianAkhir, setPenyelesaianAkhir)} className="hover:bg-emerald-200 p-0.5 rounded-full transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input 
                  type="text" 
                  value={penyelesaianInput}
                  onChange={(e) => setPenyelesaianInput(e.target.value)}
                  onKeyDown={(e) => handleAddStringItem(e, penyelesaianAkhir, setPenyelesaianAkhir, penyelesaianInput, setPenyelesaianInput)}
                  placeholder="Ketik poin penyelesaian akhir..."
                  className="w-full bg-transparent border-none outline-none text-sm font-medium text-slate-700 py-1"
                />
              </div>
            </div>

          </div>
        </section>

        {/* Action Button & PDF Export */}
        <div className="pt-6 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          
          {mounted ? (
            <PDFDownloadLink
              document={<ProsedurPDF data={pdfData} />}
              fileName={`Prosedur_Kerja_${docNo || 'Draft'}.pdf`}
              className="flex w-full md:w-auto items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-4 rounded-2xl font-bold text-sm transition-all shadow-sm"
            >
              {/* Note: @ts-ignore */}
              {/* @ts-ignore */}
              {({ loading }) => (
                loading ? 'Mempersiapkan PDF...' : (
                  <>
                    <Download className="w-4 h-4" />
                    Download PDF Prosedur Kerja
                  </>
                )
              )}
            </PDFDownloadLink>
          ) : (
            <div className="flex w-full md:w-auto items-center justify-center gap-2 bg-slate-200 text-slate-400 px-6 py-4 rounded-2xl font-bold text-sm">
              Memuat Generator PDF...
            </div>
          )}

          <button 
            disabled={isSaving}
            type="submit"
            className="flex w-full md:w-auto items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:bg-primary/60 disabled:cursor-wait text-white px-8 py-4 rounded-2xl font-bold text-base transition-all shadow-lg shadow-primary/30 active:scale-[0.98]"
          >
            {isSaving ? (
              <span className="animate-pulse">Menyimpan...</span>
            ) : (
              <>
                Simpan & Lanjut ke Pengisian JSA
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
