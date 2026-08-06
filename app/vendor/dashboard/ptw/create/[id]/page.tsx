'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Users, Truck, Stamp, ShieldAlert, FileText, HardHat } from 'lucide-react';
import { PDFViewer } from '@react-pdf/renderer';
import PtwPDF from '@/components/ptw/PtwPDF';
import { savePtw, getPtw } from './actions';
import { PTW_TYPES, HAZARD_SOURCES, APD_ITEMS, PtwType } from '@/lib/ptw-types';
import { getWorkers, WorkerItem } from '@/app/vendor/dashboard/pekerja/actions';
import { getEquipment, EquipmentItem } from '@/app/vendor/dashboard/peralatan/actions';

export default function PTWCreatePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.id === 'string' ? decodeURIComponent(params.id) : 'PRJ-000';

  const [ptwType, setPtwType] = useState<PtwType>('dingin');
  const [selectedHazards, setSelectedHazards] = useState<string[]>([]);
  
  // APD state (Grouped by part)
  const [selectedApd, setSelectedApd] = useState<{ [key: string]: string[] }>({
    kepala: [], telinga: [], kaki: [], ketinggian: [], pernapasan: [], tangan: [], badan: []
  });

  const [selectedPekerja, setSelectedPekerja] = useState<string[]>([]);
  const [selectedPeralatan, setSelectedPeralatan] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [rosterPekerja, setRosterPekerja] = useState<WorkerItem[]>([]);
  const [rosterPeralatan, setRosterPeralatan] = useState<EquipmentItem[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(true);

  React.useEffect(() => {
    async function loadData() {
      const [workers, equipment, data] = await Promise.all([
        getWorkers(),
        getEquipment(),
        projectId ? getPtw(projectId) : Promise.resolve(null),
      ]);
      setRosterPekerja(workers);
      setRosterPeralatan(equipment);
      setIsLoadingRoster(false);

      if (data) {
        if (data.workers) setSelectedPekerja(data.workers.map((w: any) => w.id).filter(Boolean));
        if (data.equipment) setSelectedPeralatan(data.equipment.map((e: any) => e.id).filter(Boolean));
        if (data.ptw_type) setPtwType(data.ptw_type as PtwType);
        if (data.hazards) setSelectedHazards(data.hazards);
        if (data.apd) setSelectedApd(data.apd);
      }
    }
    loadData();
  }, [projectId]);

  const toggleHazard = (hz: string) => {
    setSelectedHazards(prev => 
      prev.includes(hz) ? prev.filter(x => x !== hz) : [...prev, hz]
    );
  };

  const toggleApd = (category: string, item: string) => {
    setSelectedApd(prev => {
      const catList = prev[category] || [];
      const updated = catList.includes(item) ? catList.filter(x => x !== item) : [...catList, item];
      return { ...prev, [category]: updated };
    });
  };

  const togglePekerja = (id: string) => {
    setSelectedPekerja(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const togglePeralatan = (id: string) => {
    setSelectedPeralatan(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectedPekerjaData = rosterPekerja
    .filter(p => selectedPekerja.includes(p.id))
    .map(p => ({ id: p.id, worker_name: p.full_name, worker_role: p.position, certification: p.certification }));
  const selectedPeralatanData = rosterPeralatan
    .filter(p => selectedPeralatan.includes(p.id))
    .map(p => ({ id: p.id, name: p.name, type: p.category, certificate_number: p.certificate_number }));

  const handleAjukan = async () => {
    setIsSubmitting(true);
    try {
      await savePtw(projectId, selectedPekerjaData, selectedPeralatanData, ptwType, selectedHazards, selectedApd);
      alert("PTW berhasil diajukan dan sedang menunggu validasi Project Manager!");
      router.push(`/vendor/dashboard/projects/${encodeURIComponent(projectId)}`);
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat mengajukan PTW.");
    } finally {
      setIsSubmitting(false);
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
            <div className="w-14 h-14 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Stamp className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Permohonan Izin Kerja (PTW)</h1>
              <div className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wider">Project ID: {projectId}</div>
            </div>
          </div>
          <button onClick={handleAjukan} disabled={isSubmitting || (selectedPekerja.length === 0 && selectedPeralatan.length === 0)} className="px-6 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm shadow-emerald-600/30 flex items-center gap-2">
            {isSubmitting ? (
              <span className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Mengajukan...</span>
            ) : (
              <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Ajukan PTW</span>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Form Settings */}
        <div className="space-y-6">
          
          {/* PTW Type Selection */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><FileText className="w-5 h-5" /></div>
              <h2 className="text-lg font-bold text-slate-800">Tipe PTW & Safety Checklist</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">Pilih tipe Permit to Work. Safety Checklist pada PDF akan otomatis menyesuaikan.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {PTW_TYPES.map(type => (
                <label key={type.id} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${ptwType === type.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'hover:bg-slate-50'}`}>
                  <input type="radio" name="ptwType" value={type.id} checked={ptwType === type.id} onChange={(e) => setPtwType(e.target.value as PtwType)} className="text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm font-bold">{type.title.split('(')[0]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Hazard & APD */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><ShieldAlert className="w-5 h-5" /></div>
              <h2 className="text-lg font-bold text-slate-800">Identifikasi Bahaya & APD</h2>
            </div>
            
            <div className="mb-2">
              <span className="text-sm font-bold text-slate-700">Sumber Bahaya (Pilih yang relevan)</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-6 max-h-40 overflow-y-auto p-2 border border-slate-100 rounded-xl bg-slate-50">
              {HAZARD_SOURCES.map((hz, i) => (
                <label key={i} className="flex items-center gap-2 text-xs bg-white border border-slate-200 px-2 py-1 rounded shadow-sm cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={selectedHazards.includes(hz)} onChange={() => toggleHazard(hz)} className="rounded-sm" />
                  <span>{hz}</span>
                </label>
              ))}
            </div>

            <div className="mb-2 flex items-center gap-2 mt-6">
              <HardHat className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-700">Alat Pelindung Diri (APD)</span>
            </div>
            <div className="grid grid-cols-2 gap-4 border border-slate-100 rounded-xl bg-slate-50 p-4 max-h-60 overflow-y-auto">
              {Object.entries(APD_ITEMS).map(([cat, items]) => (
                <div key={cat} className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{cat}</div>
                  {items.map(item => (
                    <label key={item} className="flex items-center gap-2 text-xs">
                       <input type="checkbox" checked={selectedApd[cat]?.includes(item)} onChange={() => toggleApd(cat, item)} className="rounded-sm" />
                       <span>{item}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Pekerja Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users className="w-5 h-5" /></div>
              <h2 className="text-lg font-bold text-slate-800">Pilih Pekerja Bertugas</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">Pilih pekerja dari Data Master Pekerja yang akan ditugaskan di proyek ini.</p>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {isLoadingRoster ? (
                <p className="text-sm text-slate-400 text-center py-4">Memuat data pekerja...</p>
              ) : rosterPekerja.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-500 mb-2">Belum ada data pekerja tersimpan.</p>
                  <Link href="/vendor/dashboard/pekerja" className="text-sm font-bold text-primary hover:underline">Tambah Data Pekerja &rarr;</Link>
                </div>
              ) : (
                rosterPekerja.map((p) => (
                  <label key={p.id} className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-colors ${selectedPekerja.includes(p.id) ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                      checked={selectedPekerja.includes(p.id)}
                      onChange={() => togglePekerja(p.id)}
                    />
                    <div>
                      <div className="font-bold text-sm text-slate-800">{p.full_name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{p.position} • Sertifikat: {p.certification || 'Tidak Ada'}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Peralatan Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Truck className="w-5 h-5" /></div>
              <h2 className="text-lg font-bold text-slate-800">Pilih Peralatan / Mesin</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">Pilih alat dari Data Master Peralatan yang akan dibawa ke lapangan.</p>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {isLoadingRoster ? (
                <p className="text-sm text-slate-400 text-center py-4">Memuat data peralatan...</p>
              ) : rosterPeralatan.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-500 mb-2">Belum ada data peralatan tersimpan.</p>
                  <Link href="/vendor/dashboard/peralatan" className="text-sm font-bold text-primary hover:underline">Tambah Data Peralatan &rarr;</Link>
                </div>
              ) : (
                rosterPeralatan.map((p) => (
                  <label key={p.id} className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-colors ${selectedPeralatan.includes(p.id) ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      checked={selectedPeralatan.includes(p.id)}
                      onChange={() => togglePeralatan(p.id)}
                    />
                    <div>
                      <div className="font-bold text-sm text-slate-800">{p.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{p.category} • SILO: {p.certificate_number || '—'}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Column: PDF Preview */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[800px] sticky top-24">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-2 font-bold text-sm text-slate-700">
               <Stamp className="w-4 h-4 text-slate-400" /> Preview Draft PTW (Otomatis)
             </div>
          </div>
          <div className="flex-1 w-full bg-slate-500">
             <PDFViewer width="100%" height="100%" className="border-none">
               <PtwPDF 
                 projectId={projectId} 
                 ptwType={ptwType}
                 hazards={selectedHazards}
                 apd={selectedApd}
                 pekerja={selectedPekerjaData} 
                 peralatan={selectedPeralatanData} 
               />
             </PDFViewer>
          </div>
        </div>

      </div>
    </div>
  );
}
