'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Users, Truck, ShieldAlert, Stamp } from 'lucide-react';
import { PDFViewer } from '@react-pdf/renderer';
import PtwPDF from './PtwPDF';

// Mock Master Data
const mockPekerja = [
  { id: 'WRK-001', nama: 'Budi Santoso', jabatan: 'Supervisor Lapangan', sertifikat: 'Ahli K3 Umum' },
  { id: 'WRK-002', nama: 'Agus Pratama', jabatan: 'Welder', sertifikat: 'Welder 6G' },
  { id: 'WRK-004', nama: 'Hendra Wijaya', jabatan: 'Helper', sertifikat: 'Tidak Ada' },
];

const mockPeralatan = [
  { id: 'EQP-001', nama: 'Excavator PC200', jenis: 'Alat Berat', silo: 'SILO-2026-001' },
  { id: 'EQP-002', nama: 'Welding Machine 400A', jenis: 'Mesin Las', silo: 'SILO-2026-002' },
];

export default function PTWCreatePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.id === 'string' ? decodeURIComponent(params.id) : 'PRJ-000';

  const [selectedPekerja, setSelectedPekerja] = useState<string[]>([]);
  const [selectedPeralatan, setSelectedPeralatan] = useState<string[]>([]);

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

  const handleAjukan = () => {
    alert("PTW berhasil diajukan dan sedang menunggu validasi Project Manager!");
    router.push(`/vendor/dashboard/projects/${encodeURIComponent(projectId)}`);
  };

  const selectedPekerjaData = mockPekerja.filter(p => selectedPekerja.includes(p.id));
  const selectedPeralatanData = mockPeralatan.filter(p => selectedPeralatan.includes(p.id));

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
          <button onClick={handleAjukan} className="px-6 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/30 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> Ajukan PTW
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Form Checkbox Selector */}
        <div className="space-y-6">
          
          {/* Pekerja Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users className="w-5 h-5" /></div>
              <h2 className="text-lg font-bold text-slate-800">Pilih Pekerja Bertugas</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">Pilih pekerja dari Data Master Pekerja yang akan ditugaskan di proyek ini.</p>
            
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {mockPekerja.map((p) => (
                <label key={p.id} className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-colors ${selectedPekerja.includes(p.id) ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                    checked={selectedPekerja.includes(p.id)}
                    onChange={() => togglePekerja(p.id)}
                  />
                  <div>
                    <div className="font-bold text-sm text-slate-800">{p.nama} <span className="text-slate-400 font-normal">({p.id})</span></div>
                    <div className="text-xs text-slate-500 mt-0.5">{p.jabatan} • Sertifikat: {p.sertifikat}</div>
                  </div>
                </label>
              ))}
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
              {mockPeralatan.map((p) => (
                <label key={p.id} className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-colors ${selectedPeralatan.includes(p.id) ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    checked={selectedPeralatan.includes(p.id)}
                    onChange={() => togglePeralatan(p.id)}
                  />
                  <div>
                    <div className="font-bold text-sm text-slate-800">{p.nama} <span className="text-slate-400 font-normal">({p.id})</span></div>
                    <div className="text-xs text-slate-500 mt-0.5">{p.jenis} • SILO: {p.silo}</div>
                  </div>
                </label>
              ))}
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
               <PtwPDF projectId={projectId} pekerja={selectedPekerjaData} peralatan={selectedPeralatanData} />
             </PDFViewer>
          </div>
        </div>

      </div>
    </div>
  );
}
