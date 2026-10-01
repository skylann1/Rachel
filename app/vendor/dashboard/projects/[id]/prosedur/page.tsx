"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  FileText, ArrowRight, Hammer,
  UploadCloud, CheckCircle2, X, Info, Download, Plus, Trash2, GripVertical, Boxes, History
} from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ProsedurPDF } from './ProsedurPDF';
import { saveProsedur, getProsedur } from './actions';
import { VendorInternalReviewActions } from '@/components/vendor/VendorInternalReviewActions';
import { getWorkers, WorkerItem } from '@/app/vendor/dashboard/pekerja/actions';
import { getEquipment, EquipmentItem } from '@/app/vendor/dashboard/peralatan/actions';
import { getMaterials, MaterialItem } from '@/app/vendor/dashboard/material/actions';
import { APD_ITEMS, APD_CATEGORY_LABELS, HAZARD_COLUMNS, PTW_TYPES, PtwType } from '@/lib/ptw-types';
import {
  normalizeTahapanPekerjaan, emptyKebutuhan, deriveDocumentSections,
  TahapanSection, StepKebutuhan,
} from '@/lib/procedure-kebutuhan';

export default function ProsedurKerjaForm() {
  const router = useRouter();
  const params = useParams();
  
  // Hydration fix for PDFDownloadLink
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [isSaving, setIsSaving] = useState(false);

  // --- Form State ---
  const [docNo, setDocNo] = useState('SOP-K3-001/2026');
  const [contractNo, setContractNo] = useState('006600.PMB-BP/LG.01/OP-CKR/PGAS/V/2026'); 
  const [submissionDate, setSubmissionDate] = useState('2026-06-29');
  const [projectName, setProjectName] = useState('Perbaikan Pos Security Stasiun Muara Bekasi');
  const [vendorSignature, setVendorSignature] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setVendorSignature(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Section 1
  const [umum, setUmum] = useState('Pekerjaan Perbaikan Pos Security dilaksanakan untuk memperbaiki kondisi bangunan pos security agar berfungsi dengan baik, aman, dan sesuai standar operasional perusahaan. Seluruh pekerjaan harus dilaksanakan sesuai prosedur kerja, spesifikasi teknis, standar K3, dan peraturan yang berlaku di lokasi kerja.');

  // Section 2
  const [scopeOfWork, setScopeOfWork] = useState('- Mobilisasi dan demobilisasi peralatan serta material.\n- Pembongkaran keramik lantai existing.\n- Pembongkaran dinding existing.\n- Pengikisan lapisan cat existing.\n- Pekerjaan pasangan dinding bata.\n- Pekerjaan plesteran dan acian dinding.\n- Pemasangan keramik lantai.\n- Pengecatan dinding.\n- Pengecatan lisplang.\n- Pengecatan plafon.\n- Pemasangan built in railing tangga.\n- Pembersihan area kerja (housekeeping).\n- Demobilisasi peralatan dan penyelesaian pekerjaan.');
  
  const [docId, setDocId] = useState<string | null>(null);

  // Jenis PTW yang Dibutuhkan — checklist level DOKUMEN (bukan per
  // sub-langkah seperti panel "Kebutuhan"), dikonsumsi halaman PTW list
  // untuk menyorot jenis yang wajib diajukan.
  const [requiredPtwTypes, setRequiredPtwTypes] = useState<PtwType[]>([]);

  const togglePtwType = (type: PtwType) => {
    setRequiredPtwTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Fetch initial data
  useEffect(() => {
    async function loadData() {
      if (params.id) {
        const data = await getProsedur(params.id as string);
        if (data && data.content) {
          setDocId(data.id);
          const content = data.content;
          setDocNo(content.docNo || '');
          setContractNo(content.contractNo || '');
          if (content.submissionDate) setSubmissionDate(content.submissionDate);
          setUmum(content.umum || '');
          setScopeOfWork(content.scopeOfWork || '');
          setVendorSignature(content.vendorSignature || null);
          setRevisions(content.revisions || []);
          if (content.tahapanPekerjaan) setTahapanPekerjaan(normalizeTahapanPekerjaan(content.tahapanPekerjaan));
          if (content.penyelesaianAkhir) setPenyelesaianAkhir(content.penyelesaianAkhir);
          if (content.requiredPtwTypes) setRequiredPtwTypes(content.requiredPtwTypes);
        }
      }
    }
    loadData();
  }, [params.id]);

  // Section 6
  const [tahapanPekerjaan, setTahapanPekerjaan] = useState<TahapanSection[]>(normalizeTahapanPekerjaan([
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
  ]));

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

  // Master data untuk picker kebutuhan per sub-langkah (org-scoped via action).
  const [rosterPekerja, setRosterPekerja] = useState<WorkerItem[]>([]);
  const [rosterPeralatan, setRosterPeralatan] = useState<EquipmentItem[]>([]);
  const [rosterMaterial, setRosterMaterial] = useState<MaterialItem[]>([]);
  // Kebutuhan panel yang sedang terbuka, kunci "{sectionIndex}-{pointIndex}".
  const [openKebutuhan, setOpenKebutuhan] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getWorkers(), getEquipment(), getMaterials()])
      .then(([workers, equipment, materials]) => {
        setRosterPekerja(workers);
        setRosterPeralatan(equipment);
        setRosterMaterial(materials);
      })
      .catch(() => {});
  }, []);


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
    newTahapan[sectionIndex].points.push({ text: 'Langkah baru...', kebutuhan: emptyKebutuhan() });
    setTahapanPekerjaan(newTahapan);
  };

  const updateTahapanPoint = (sectionIndex: number, pointIndex: number, newText: string) => {
    const newTahapan = [...tahapanPekerjaan];
    newTahapan[sectionIndex].points[pointIndex].text = newText;
    setTahapanPekerjaan(newTahapan);
  };

  const removeTahapanPoint = (sectionIndex: number, pointIndex: number) => {
    const newTahapan = [...tahapanPekerjaan];
    newTahapan[sectionIndex].points.splice(pointIndex, 1);
    setTahapanPekerjaan(newTahapan);
  };

  // Kebutuhan per sub-langkah — mutate satu point lalu set ulang seluruh state.
  const updatePointKebutuhan = (
    sectionIndex: number,
    pointIndex: number,
    updater: (k: StepKebutuhan) => StepKebutuhan
  ) => {
    setTahapanPekerjaan(prev =>
      prev.map((section, sIdx) =>
        sIdx !== sectionIndex
          ? section
          : {
              ...section,
              points: section.points.map((p, pIdx) =>
                pIdx !== pointIndex
                  ? p
                  : { ...p, kebutuhan: updater(p.kebutuhan || emptyKebutuhan()) }
              ),
            }
      )
    );
  };

  const toggleKebutuhanWorker = (sIdx: number, pIdx: number, worker: WorkerItem) =>
    updatePointKebutuhan(sIdx, pIdx, (k) => {
      const exists = k.workers.some(w => w.id === worker.id);
      return {
        ...k,
        workers: exists
          ? k.workers.filter(w => w.id !== worker.id)
          : [...k.workers, { id: worker.id, label: worker.full_name }],
      };
    });

  const toggleKebutuhanEquipment = (sIdx: number, pIdx: number, equipment: EquipmentItem) =>
    updatePointKebutuhan(sIdx, pIdx, (k) => {
      const exists = k.equipment.some(e => e.id === equipment.id);
      return {
        ...k,
        equipment: exists
          ? k.equipment.filter(e => e.id !== equipment.id)
          : [...k.equipment, { id: equipment.id, label: equipment.name }],
      };
    });

  const toggleKebutuhanMaterial = (sIdx: number, pIdx: number, material: MaterialItem) =>
    updatePointKebutuhan(sIdx, pIdx, (k) => {
      const exists = k.materials.some(m => m.id === material.id);
      return {
        ...k,
        materials: exists
          ? k.materials.filter(m => m.id !== material.id)
          : [...k.materials, { id: material.id, label: material.name }],
      };
    });

  const toggleKebutuhanApd = (sIdx: number, pIdx: number, category: string, item: string) =>
    updatePointKebutuhan(sIdx, pIdx, (k) => {
      const list = k.apd[category] || [];
      const next = list.includes(item) ? list.filter(x => x !== item) : [...list, item];
      return { ...k, apd: { ...k.apd, [category]: next } };
    });

  const toggleKebutuhanHazard = (sIdx: number, pIdx: number, hazard: string) =>
    updatePointKebutuhan(sIdx, pIdx, (k) => ({
      ...k,
      hazards: k.hazards.includes(hazard)
        ? k.hazards.filter((h) => h !== hazard)
        : [...k.hazards, hazard],
    }));

  // Section 3/4/5 dokumen tidak lagi diketik manual — diturunkan dari agregat
  // kebutuhan seluruh sub-langkah TAHAPAN PEKERJAAN. Satu sumber untuk kotak
  // ringkasan, payload simpan, dan preview PDF.
  const derivedSections = deriveDocumentSections(tahapanPekerjaan);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (requiredPtwTypes.length === 0) {
      alert('Pilih minimal satu jenis PTW yang dibutuhkan untuk pekerjaan ini.');
      return;
    }

    setIsSaving(true);

    const payload = {
      docNo,
      contractNo,
      submissionDate,
      umum,
      scopeOfWork,
      tools: derivedSections.tools,
      selectedApd: derivedSections.apd,
      perlengkapanLainnya: derivedSections.perlengkapanLainnya,
      tahapanPekerjaan,
      penyelesaianAkhir,
      vendorSignature,
      revisions,
      requiredPtwTypes
    };

    try {
      await saveProsedur(params.id as string, payload);
      // Simulate delay for UI
      setTimeout(() => {
        setIsSaving(false);
        // Go back to project detail — prosedur needs PM approval before JSA can start
        router.push(`/vendor/dashboard/projects/${params.id}`);
      }, 800);
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan prosedur kerja');
      setIsSaving(false);
    }
  };

  const pdfData = {
    projectName,
    docNo,
    contractNo,
    submissionDate,
    umum,
    scopeOfWork,
    tools: derivedSections.tools,
    apd: derivedSections.apd,
    perlengkapanLainnya: derivedSections.perlengkapanLainnya,
    tahapanPekerjaan,
    penyelesaianAkhir,
    vendorSignature,
    revisions
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
            <p className="text-sm font-medium text-slate-500">Proyek: {projectName}</p>
          </div>
        </div>
      </div>

      {/* Riwayat Revisi */}
      {revisions.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-amber-600" />
            <h2 className="font-bold text-slate-800 text-sm">Riwayat Revisi</h2>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{revisions.length}x</span>
          </div>
          <ol className="space-y-3">
            {[...revisions].sort((a, b) => (b.revNo ?? 0) - (a.revNo ?? 0)).map((rev, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 font-black text-amber-600 text-sm">Rev {rev.revNo}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-400">{rev.date}</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{rev.note || 'Tidak ada catatan.'}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-slate-400 mt-4 pt-3 border-t border-slate-100">
            Catatan revisi diberikan saat prosedur ditolak. Pastikan setiap perbaikan sesuai catatan sebelum mengajukan ulang.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        
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
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700 block mb-3">
                Jenis PTW yang Dibutuhkan <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {PTW_TYPES.map(type => {
                  const checked = requiredPtwTypes.includes(type.id);
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => togglePtwType(type.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                        checked ? 'border-transparent' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                      style={checked ? { backgroundColor: type.color, color: type.textColor } : undefined}
                    >
                      <CheckCircle2 className={`w-4 h-4 shrink-0 ${checked ? 'opacity-100' : 'opacity-30'}`} />
                      {type.title.split('(')[0].trim()}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-2">Pilih semua jenis izin kerja yang relevan dengan pekerjaan ini — menentukan jenis PTW mana yang ditandai wajib di halaman pengajuan PTW.</p>
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

            {/* 3. ALAT / TOOLS — turunan dari kebutuhan sub-langkah */}
            <div>
              <label className="text-sm font-bold text-slate-800 block mb-2">3. ALAT / TOOLS</label>
              <p className="text-xs text-slate-500 mb-2">Terisi otomatis dari peralatan yang dipilih pada tiap sub-langkah Tahapan Pekerjaan.</p>
              <div className="min-h-[52px] w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl flex flex-wrap gap-2 items-center">
                {derivedSections.tools.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Belum ada peralatan dipilih di Tahapan Pekerjaan.</span>
                ) : derivedSections.tools.map(item => (
                  <span key={item} className="inline-flex items-center px-3 py-1 bg-white text-slate-700 font-bold text-xs rounded-lg border border-slate-200">{item}</span>
                ))}
              </div>
            </div>

            {/* 4. APD — turunan dari kebutuhan sub-langkah */}
            <div>
              <label className="text-sm font-bold text-slate-800 block mb-2">4. ALAT PELINDUNG DIRI (APD)</label>
              <p className="text-xs text-slate-500 mb-2">Terisi otomatis dari APD yang dipilih pada tiap sub-langkah Tahapan Pekerjaan.</p>
              <div className="min-h-[52px] w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl flex flex-wrap gap-2 items-center">
                {derivedSections.apd.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Belum ada APD dipilih di Tahapan Pekerjaan.</span>
                ) : derivedSections.apd.map(item => (
                  <span key={item} className="inline-flex items-center px-3 py-1 bg-white text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200">{item}</span>
                ))}
              </div>
            </div>

            {/* 5. PERLENGKAPAN LAINNYA — turunan dari kebutuhan sub-langkah */}
            <div>
              <label className="text-sm font-bold text-slate-800 block mb-2">5. PERLENGKAPAN LAINNYA</label>
              <p className="text-xs text-slate-500 mb-2">Terisi otomatis dari material yang dipilih pada tiap sub-langkah Tahapan Pekerjaan.</p>
              <div className="min-h-[52px] w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl flex flex-wrap gap-2 items-center">
                {derivedSections.perlengkapanLainnya.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Belum ada material dipilih di Tahapan Pekerjaan.</span>
                ) : derivedSections.perlengkapanLainnya.map(item => (
                  <span key={item} className="inline-flex items-center px-3 py-1 bg-white text-amber-700 font-bold text-xs rounded-lg border border-amber-200">{item}</span>
                ))}
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
                      {section.points.map((point, pIdx) => {
                        const kebutuhanKey = `${sIdx}-${pIdx}`;
                        const kebutuhanOpen = openKebutuhan === kebutuhanKey;
                        const pointKebutuhan = point.kebutuhan;
                        const kebutuhanCount =
                          (pointKebutuhan?.workers.length || 0) +
                          (pointKebutuhan?.equipment.length || 0) +
                          (pointKebutuhan?.materials.length || 0) +
                          (pointKebutuhan?.hazards.length || 0) +
                          Object.values(pointKebutuhan?.apd || {}).reduce((n, list) => n + list.length, 0);
                        return (
                          <div key={pIdx}>
                            <div className="flex items-start gap-2">
                              <GripVertical className="w-4 h-4 text-slate-300 mt-2 cursor-grab shrink-0" />
                              <textarea
                                value={point.text}
                                onChange={(e) => updateTahapanPoint(sIdx, pIdx, e.target.value)}
                                rows={2}
                                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-sm resize-y"
                              />
                              <div className="flex flex-col gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setOpenKebutuhan(kebutuhanOpen ? null : kebutuhanKey)}
                                  title="Kebutuhan sumber daya sub-langkah ini"
                                  className={`relative p-2 rounded-lg border transition-colors ${kebutuhanOpen || kebutuhanCount > 0 ? 'bg-primary text-white border-primary' : 'text-slate-400 hover:text-primary border-slate-200 hover:border-primary bg-white'}`}
                                >
                                  <Boxes className="w-4 h-4" />
                                  {kebutuhanCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                                      {kebutuhanCount}
                                    </span>
                                  )}
                                </button>
                                <button type="button" onClick={() => removeTahapanPoint(sIdx, pIdx)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {kebutuhanOpen && (
                              <div className="ml-9 mt-2 w-[calc(100%-2rem)] border border-slate-200 rounded-lg bg-slate-50 p-3 space-y-3">
                                <p className="text-[11px] font-bold text-slate-700">
                                  Kebutuhan — pekerja, peralatan, material, APD & sumber bahaya (dibawa ke JSA &amp; prefill PTW)
                                </p>

                                <div>
                                  <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Pekerja</p>
                                  {rosterPekerja.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic">Belum ada data pekerja. Tambahkan di menu Pekerja.</p>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {rosterPekerja.map(w => {
                                        const on = pointKebutuhan?.workers.some(x => x.id === w.id);
                                        return (
                                          <button key={w.id} type="button" onClick={() => toggleKebutuhanWorker(sIdx, pIdx, w)}
                                            className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${on ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary'}`}>
                                            {w.full_name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Peralatan</p>
                                  {rosterPeralatan.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic">Belum ada data peralatan. Tambahkan di menu Peralatan.</p>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {rosterPeralatan.map(equipment => {
                                        const on = pointKebutuhan?.equipment.some(e => e.id === equipment.id);
                                        return (
                                          <button key={equipment.id} type="button" onClick={() => toggleKebutuhanEquipment(sIdx, pIdx, equipment)}
                                            className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${on ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary'}`}>
                                            {equipment.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Material</p>
                                  {rosterMaterial.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic">Belum ada data material. Tambahkan di menu Material.</p>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {rosterMaterial.map(material => {
                                        const on = pointKebutuhan?.materials.some(m => m.id === material.id);
                                        return (
                                          <button key={material.id} type="button" onClick={() => toggleKebutuhanMaterial(sIdx, pIdx, material)}
                                            className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${on ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary'}`}>
                                            {material.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <p className="text-[11px] font-semibold text-slate-500 mb-1.5">APD</p>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {Object.entries(APD_ITEMS).map(([cat, items]) => (
                                      <div key={cat}>
                                        <p className="text-[11px] text-slate-500 mb-1">{APD_CATEGORY_LABELS[cat]}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {items.map(item => {
                                            const on = pointKebutuhan?.apd[cat]?.includes(item);
                                            return (
                                              <button key={item} type="button" onClick={() => toggleKebutuhanApd(sIdx, pIdx, cat, item)}
                                                className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${on ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary'}`}>
                                                {item}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Sumber Bahaya</p>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {HAZARD_COLUMNS.map((column, cIdx) => (
                                      <div key={cIdx} className="flex flex-wrap gap-1.5 content-start">
                                        {column.map((hz) => {
                                          const on = pointKebutuhan?.hazards.includes(hz);
                                          return (
                                            <button key={hz} type="button" onClick={() => toggleKebutuhanHazard(sIdx, pIdx, hz)}
                                              className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${on ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-400'}`}>
                                              {hz}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
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

        {/* SECTION C: Tanda Tangan */}
        <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <UploadCloud className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-slate-800">Section C: Tanda Tangan Digital (Vendor)</h2>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">Upload Tanda Tangan Anda (Untuk kolom 'BY') <span className="text-rose-500">*</span></label>
            <p className="text-xs text-slate-500 mb-4">Pastikan gambar berlatar putih atau transparan (PNG/JPG).</p>
            <input 
              type="file" 
              accept="image/png, image/jpeg"
              onChange={handleSignatureUpload}
              className="w-full md:w-1/2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm font-medium"
            />
            {vendorSignature && (
              <div className="mt-4 p-4 bg-slate-100 rounded-xl inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={vendorSignature} alt="Signature Preview" className="h-16 object-contain mix-blend-multiply" />
              </div>
            )}
          </div>
        </section>

        <VendorInternalReviewActions projectId={params.id as string} docType="procedure" docId={docId} />

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
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Menyimpan...</span>
              </>
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
