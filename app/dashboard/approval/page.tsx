'use client';

import React, { useState } from 'react';
import { Search, FileSignature, CheckCircle2, ShieldCheck, MapPin, Clock, ShieldAlert, Stamp, AlertTriangle, X } from 'lucide-react';

const mockProsedur = [
  { id: 'SOP-2026-001', project: 'Pekerjaan Perbaikan Pos Security', vendor: 'PT. Bangun Graha', date: '2026-06-30', status: 'Pending Review' },
];

const mockJSA = [
  { id: 'JSA-2026-042', project: 'Maintenance Kompresor B', vendor: 'CV. Teknik Mesin Nusantara', date: '2026-06-28', status: 'Pending Review' },
];

const mockPTW = [
  { id: 'PTW-2026-001', jsaId: 'JSA-2026-001', project: 'Penggalian Pipa Gas Area A - Tahap 2', vendor: 'PT. Konstruksi Sejahtera', location: 'Plant A, Zona Merah', date: '2026-06-25', status: 'Menunggu Validasi PM' },
];

export default function UnifiedApprovalPage() {
  const [activeTab, setActiveTab] = useState('Prosedur'); // 'Prosedur', 'JSA', 'PTW'
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState('');

  const openReview = (doc: any, type: string) => {
    setSelectedDoc({ ...doc, type });
    setReviewNote('');
    setIsReviewModalOpen(true);
  };

  const handleApprove = () => {
    alert(`Dokumen ${selectedDoc?.id} berhasil di-Approve!`);
    setIsReviewModalOpen(false);
  };

  const handleReject = () => {
    if (!reviewNote.trim()) {
      alert("Harap isi catatan revisi sebelum menolak dokumen.");
      return;
    }
    alert(`Dokumen ${selectedDoc?.id} di-Reject dengan catatan: ${reviewNote}`);
    setIsReviewModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Verifikasi & Approval</h1>
          <p className="text-sm text-slate-500 mt-1">Review dan validasi dokumen Prosedur Kerja, JSA, dan Surat Izin Kerja (PTW) dari Vendor.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('Prosedur')}
          className={`px-6 py-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'Prosedur' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <FileSignature className="w-4 h-4" /> Prosedur Kerja
          <span className="ml-1 bg-amber-100 text-amber-700 py-0.5 px-2 rounded-full text-[10px]">{mockProsedur.length}</span>
        </button>
        <button 
          onClick={() => setActiveTab('JSA')}
          className={`px-6 py-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'JSA' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <ShieldAlert className="w-4 h-4" /> JSA & HIRADC
          <span className="ml-1 bg-amber-100 text-amber-700 py-0.5 px-2 rounded-full text-[10px]">{mockJSA.length}</span>
        </button>
        <button 
          onClick={() => setActiveTab('PTW')}
          className={`px-6 py-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'PTW' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Stamp className="w-4 h-4" /> Permit to Work (PM)
          <span className="ml-1 bg-amber-100 text-amber-700 py-0.5 px-2 rounded-full text-[10px]">{mockPTW.length}</span>
        </button>
      </div>

      {/* List Container */}
      <div className="space-y-4">
        
        {/* Render Prosedur */}
        {activeTab === 'Prosedur' && mockProsedur.map((doc) => (
          <div key={doc.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-center">
            <div className="flex gap-5 w-full md:w-auto">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileSignature className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">ID: {doc.id}</span>
                <h3 className="text-lg font-bold text-slate-800 mt-1">{doc.project}</h3>
                <div className="text-sm text-slate-500 font-medium">Vendor: <span className="text-slate-700">{doc.vendor}</span> • Tgl Submit: {doc.date}</div>
              </div>
            </div>
            <button 
              onClick={() => openReview(doc, 'Prosedur Kerja')}
              className="w-full md:w-auto px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30"
            >
              Review Dokumen
            </button>
          </div>
        ))}

        {/* Render JSA */}
        {activeTab === 'JSA' && mockJSA.map((doc) => (
          <div key={doc.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-center">
            <div className="flex gap-5 w-full md:w-auto">
              <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">ID: {doc.id}</span>
                <h3 className="text-lg font-bold text-slate-800 mt-1">{doc.project}</h3>
                <div className="text-sm text-slate-500 font-medium">Vendor: <span className="text-slate-700">{doc.vendor}</span> • Tgl Submit: {doc.date}</div>
              </div>
            </div>
            <button 
              onClick={() => openReview(doc, 'JSA & HIRADC')}
              className="w-full md:w-auto px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30"
            >
              Review Dokumen
            </button>
          </div>
        ))}

        {/* Render PTW */}
        {activeTab === 'PTW' && mockPTW.map((doc) => (
          <div key={doc.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-center">
            <div className="flex gap-5 w-full md:w-auto">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Stamp className="w-6 h-6" />
              </div>
              <div>
                <div className="flex gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">ID: {doc.id}</span>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">Ref JSA: {doc.jsaId}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800">{doc.project}</h3>
                <div className="text-sm text-slate-500 font-medium">
                  Lokasi: {doc.location} • Vendor: {doc.vendor}
                </div>
              </div>
            </div>
            <button 
              onClick={() => openReview(doc, 'Permit to Work')}
              className="w-full md:w-auto px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-600/30 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Validasi PM
            </button>
          </div>
        ))}

      </div>

      {/* Modal Review */}
      {isReviewModalOpen && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-4xl flex flex-col shadow-2xl h-[90vh] animate-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Review: {selectedDoc.type}</h2>
                <p className="text-sm text-slate-500">{selectedDoc.project} ({selectedDoc.vendor})</p>
              </div>
              <button onClick={() => setIsReviewModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* The PDF / Content Viewer Area */}
            <div className="flex-1 bg-slate-200 p-4 overflow-y-auto">
               <div className="bg-white w-full h-full min-h-[500px] shadow-sm flex items-center justify-center text-slate-400 border border-slate-300">
                 [ Tampilan PDF {selectedDoc.type} akan di-render di sini ]
               </div>
            </div>

            {/* Actions & Feedback */}
            <div className="p-6 border-t border-slate-100 bg-white rounded-b-2xl shrink-0">
               <div className="mb-4">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Catatan Revisi (Hanya diisi jika dokumen di-Reject)</label>
                  <textarea 
                     value={reviewNote}
                     onChange={(e) => setReviewNote(e.target.value)}
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm resize-none" 
                     rows={3} 
                     placeholder="Tuliskan bagian mana yang perlu diperbaiki oleh vendor..."
                  ></textarea>
               </div>
               <div className="flex justify-end gap-3">
                 <button onClick={handleReject} className="px-6 py-2.5 text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors">
                   Reject & Kembalikan
                 </button>
                 <button onClick={handleApprove} className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors shadow-sm shadow-emerald-500/30 flex items-center gap-2">
                   <CheckCircle2 className="w-4 h-4" /> Approve Dokumen
                 </button>
               </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
