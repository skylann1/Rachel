'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, FileText, CheckCircle2, ShieldCheck, FileSignature } from 'lucide-react';
import { PDFViewer } from '@react-pdf/renderer';
import IncidentPDF from './IncidentPDF';

export default function IncidentInvestigationPage() {
  const params = useParams();
  const router = useRouter();
  const incidentId = typeof params.id === 'string' ? decodeURIComponent(params.id) : 'INC-2026-000';

  // State investigasi
  const [investigation, setInvestigation] = useState({
    akarMasalah: '',
    tindakanPerbaikan: '',
    tindakanPencegahan: '',
    status: 'Menunggu Investigasi'
  });

  const handleSimpan = () => {
    setInvestigation(prev => ({ ...prev, status: 'Investigasi Selesai' }));
    alert('Hasil investigasi berhasil disimpan dan Laporan Resmi K3 diterbitkan!');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Nav */}
      <div>
        <Link href="/dashboard/incident" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Insiden
        </Link>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex gap-4 items-center">
            <div className="w-14 h-14 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Investigasi Insiden</h1>
              <div className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wider">ID: {incidentId}</div>
            </div>
          </div>
          {investigation.status !== 'Investigasi Selesai' && (
            <button onClick={handleSimpan} className="px-6 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Terbitkan Laporan Akhir
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Form Investigasi */}
        <div className="space-y-6">
          
          {/* Rangkuman Laporan Awal (Read Only) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" /> Rangkuman Laporan Awal
            </h2>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-slate-500 font-medium">Vendor Pelapor</div>
                <div className="col-span-2 font-bold text-slate-800">: PT. Vendor Konstruksi</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-slate-500 font-medium">Jenis Kejadian</div>
                <div className="col-span-2 font-bold text-rose-600">: Near Miss</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-slate-500 font-medium">Waktu & Lokasi</div>
                <div className="col-span-2 font-bold text-slate-800">: 28 Juni 2026 10:15 WIB | Area Boiler 1</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
                <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Kronologi Awal</span>
                <p className="text-slate-700 leading-relaxed">
                  "Pekerja sedang berjalan di area Boiler 1 dan nyaris tertimpa pipa scaffolding yang tergelincir dari lantai 2. Tidak ada korban jiwa maupun luka, namun pekerja kaget dan pekerjaan langsung dihentikan."
                </p>
              </div>
            </div>
          </div>

          {/* Form Hasil Investigasi HSE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
             {investigation.status === 'Investigasi Selesai' && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
                   <div className="bg-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-200">
                     <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                     <div>
                       <div className="font-bold text-slate-800 text-lg">Investigasi Ditutup</div>
                       <div className="text-sm text-slate-500">Laporan akhir K3 telah diterbitkan.</div>
                     </div>
                   </div>
                </div>
             )}
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" /> Hasil Investigasi & RCA
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">Akar Masalah (Root Cause)</label>
                <textarea 
                  value={investigation.akarMasalah}
                  onChange={(e) => setInvestigation({...investigation, akarMasalah: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm resize-none"
                  rows={3}
                  placeholder="Gunakan metode 5 Why atau Fishbone untuk menentukan akar masalah..."
                ></textarea>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">Tindakan Perbaikan (Korektif)</label>
                <textarea 
                  value={investigation.tindakanPerbaikan}
                  onChange={(e) => setInvestigation({...investigation, tindakanPerbaikan: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm resize-none"
                  rows={3}
                  placeholder="Tindakan yang harus langsung dilakukan untuk mengatasi sumber masalah..."
                ></textarea>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">Tindakan Pencegahan (Preventif)</label>
                <textarea 
                  value={investigation.tindakanPencegahan}
                  onChange={(e) => setInvestigation({...investigation, tindakanPencegahan: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm resize-none"
                  rows={3}
                  placeholder="Rekomendasi agar kejadian serupa tidak terulang di masa depan..."
                ></textarea>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: PDF Preview */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[800px] sticky top-24">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-2 font-bold text-sm text-slate-700">
               <FileSignature className="w-4 h-4 text-slate-400" /> Laporan Investigasi PDF
             </div>
             <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                investigation.status === 'Investigasi Selesai' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
             }`}>
                {investigation.status === 'Investigasi Selesai' ? 'FINAL' : 'DRAFT'}
             </span>
          </div>
          <div className="flex-1 w-full bg-slate-500">
             <PDFViewer width="100%" height="100%" className="border-none">
               <IncidentPDF 
                  incidentId={incidentId} 
                  investigation={investigation} 
               />
             </PDFViewer>
          </div>
        </div>

      </div>
    </div>
  );
}
