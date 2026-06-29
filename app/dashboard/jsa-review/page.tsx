"use client";

import React, { useState, useEffect } from 'react';
import { Search, ClipboardList, CheckCircle, AlertTriangle, Eye, Check, X, ShieldAlert, Sparkles, Loader2, MessageSquareWarning } from 'lucide-react';

const mockReviews = [
  { id: 'JSA-2026-004', vendor: 'PT. Bangun Graha', project: 'Pengecatan Fasilitas Pipa', submittedAt: '2026-06-26 09:30', riskLevel: 'High', status: 'Pending Review' },
  { id: 'JSA-2026-005', vendor: 'CV. Karya Abadi', project: 'Perbaikan Pagar Pembatas', submittedAt: '2026-06-25 14:15', riskLevel: 'Low', status: 'Pending Review' },
  { id: 'JSA-2026-001', vendor: 'PT. Konstruksi Sejahtera', project: 'Penggalian Pipa Gas Area A', submittedAt: '2026-06-24 10:00', riskLevel: 'High', status: 'Approved' },
  { id: 'JSA-2026-003', vendor: 'PT. Solusi Elektrik', project: 'Instalasi Panel Listrik', submittedAt: '2026-06-22 16:45', riskLevel: 'Medium', status: 'Rejected' },
];

const mockJsaRows = [
  { id: 1, step: 'Menyiapkan area kerja dan peralatan las', hazard: 'Area berantakan, tersandung', mitigation: 'Membersihkan area kerja' },
  { id: 2, step: 'Melakukan pengelasan pipa gas', hazard: 'Percikan api, ledakan gas', mitigation: 'Berhati-hati dan waspada saat mengelas' }, // Intentional anomaly for AI to catch
  { id: 3, step: 'Pembersihan sisa material', hazard: 'Tergores material tajam', mitigation: 'Menggunakan sarung tangan kulit standar' }
];

export default function JSAReviewPage() {
  const [filter, setFilter] = useState('Pending Review');
  const [selectedJsa, setSelectedJsa] = useState<any>(null);
  
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [activeCommentRow, setActiveCommentRow] = useState<number | null>(null);

  const filteredReviews = mockReviews.filter(review => filter === 'All' || review.status === filter);

  const [showSuccess, setShowSuccess] = useState(false);

  const handleOpenDetail = (review: any) => {
    setSelectedJsa(review);
    setAnomalies([]);
    setActiveCommentRow(null);
    setShowSuccess(false);
    scanAnomalies(mockJsaRows);
  };

  const handleApprove = () => {
    setShowSuccess(true);
    setTimeout(() => {
      setSelectedJsa(null);
      setShowSuccess(false);
    }, 3000);
  };

  const scanAnomalies = async (rows: any[]) => {
    setIsAiScanning(true);
    try {
      const response = await fetch('/api/ai/hse-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsaData: rows })
      });

      if (response.ok) {
        const data = await response.json();
        setAnomalies(data.anomalies || []);
      }
    } catch (error) {
      console.error("HSE Assistant failed", error);
    } finally {
      setIsAiScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
             Review JSA (HSE)
             <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI ASSISTANT
             </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Evaluasi dan berikan persetujuan untuk Job Safety Analysis yang diajukan oleh Vendor.</p>
        </div>
      </div>

      {/* Metrics / Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
           <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><AlertTriangle className="w-6 h-6" /></div>
           <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Menunggu Review</p>
              <p className="text-2xl font-black text-slate-800">2</p>
           </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
           <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle className="w-6 h-6" /></div>
           <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Disetujui Minggu Ini</p>
              <p className="text-2xl font-black text-slate-800">14</p>
           </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
           <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center"><ShieldAlert className="w-6 h-6" /></div>
           <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">High Risk JSA</p>
              <p className="text-2xl font-black text-slate-800">5</p>
           </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm transition-all"
              placeholder="Cari JSA, Vendor, atau Proyek..."
            />
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto bg-slate-100 p-1 rounded-xl">
             <button onClick={() => setFilter('Pending Review')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${filter === 'Pending Review' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Pending</button>
             <button onClick={() => setFilter('Approved')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${filter === 'Approved' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Riwayat</button>
             <button onClick={() => setFilter('All')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${filter === 'All' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Semua</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ID & Waktu Submit</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Informasi Proyek</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Risiko</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {filteredReviews.length === 0 ? (
                 <tr>
                   <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-sm">Tidak ada data JSA yang ditemukan.</td>
                 </tr>
               ) : (
                 filteredReviews.map((review) => (
                   <tr key={review.id} className="hover:bg-slate-50 transition-colors group">
                     <td className="px-6 py-4 align-top">
                        <div className="font-bold text-primary mb-1">{review.id}</div>
                        <div className="text-xs text-slate-500 font-medium">{review.submittedAt}</div>
                     </td>
                     <td className="px-6 py-4 align-top">
                        <div className="font-bold text-slate-800 mb-1 leading-tight">{review.project}</div>
                        <div className="text-xs text-slate-500 font-semibold">{review.vendor}</div>
                     </td>
                     <td className="px-6 py-4 align-top">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${review.riskLevel === 'High' ? 'bg-rose-100 text-rose-700' : review.riskLevel === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                           {review.riskLevel}
                        </span>
                     </td>
                     <td className="px-6 py-4 align-top">
                        {review.status === 'Pending Review' && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full"><AlertTriangle className="w-3.5 h-3.5" /> Pending</span>}
                        {review.status === 'Approved' && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full"><CheckCircle className="w-3.5 h-3.5" /> Approved</span>}
                        {review.status === 'Rejected' && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full"><AlertTriangle className="w-3.5 h-3.5" /> Rejected</span>}
                     </td>
                     <td className="px-6 py-4 align-top text-right">
                        <div className="flex justify-end gap-2">
                           <button onClick={() => handleOpenDetail(review)} className="p-2 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors border border-transparent hover:border-primary/20" title="Lihat Detail JSA">
                              <Eye className="w-4 h-4" />
                           </button>
                           {review.status === 'Pending Review' && (
                              <>
                                 <button className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200" title="Approve JSA">
                                    <Check className="w-4 h-4" />
                                 </button>
                                 <button className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200" title="Reject JSA">
                                    <X className="w-4 h-4" />
                                 </button>
                              </>
                           )}
                        </div>
                     </td>
                   </tr>
                 ))
               )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {selectedJsa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
           <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative">
              
              {showSuccess && (
                <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600 shadow-inner">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800">JSA Disetujui!</h2>
                  <p className="text-slate-600 mt-2 font-medium max-w-md text-center">Sistem telah men-generate Dokumen PTW/PTW secara otomatis dan meneruskannya ke Project Manager untuk validasi.</p>
                </div>
              )}

              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <div>
                   <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                     Review Detail JSA: {selectedJsa.id}
                     {isAiScanning && <span className="ml-2 flex items-center gap-1 text-[10px] bg-teal-50 text-teal-600 px-2 py-1 rounded-full border border-teal-200 font-bold"><Loader2 className="w-3 h-3 animate-spin" /> AI SCANNING...</span>}
                     {!isAiScanning && anomalies.length > 0 && <span className="ml-2 flex items-center gap-1 text-[10px] bg-rose-50 text-rose-600 px-2 py-1 rounded-full border border-rose-200 font-bold"><AlertTriangle className="w-3 h-3" /> {anomalies.length} AI ANOMALY DETECTED</span>}
                   </h2>
                   <p className="text-sm text-slate-500 mt-1">{selectedJsa.project} - {selectedJsa.vendor}</p>
                 </div>
                 <button onClick={() => setSelectedJsa(null)} className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded-full hover:bg-slate-100 transition-colors">
                   <X className="w-5 h-5" />
                 </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
                 <table className="w-full text-left border-collapse bg-white rounded-2xl shadow-sm border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-12">No</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-1/3">Langkah Kerja</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-1/3">Potensi Bahaya</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-1/3">Mitigasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {mockJsaRows.map((row, index) => {
                         const anomaly = anomalies.find(a => a.id === row.id);
                         const isAnomaly = !!anomaly;
                         
                         return (
                           <tr key={row.id} className={isAnomaly ? 'bg-rose-50/50' : ''}>
                             <td className="px-4 py-4 align-top text-sm font-bold text-slate-400">
                               {index + 1}
                               {isAnomaly && (
                                 <div className="mt-2 text-rose-500" title="AI Anomaly Flag">
                                   <MessageSquareWarning className="w-5 h-5" />
                                 </div>
                               )}
                             </td>
                             <td className="px-4 py-4 align-top text-sm text-slate-700">{row.step}</td>
                             <td className="px-4 py-4 align-top text-sm text-slate-700">{row.hazard}</td>
                             <td className="px-4 py-4 align-top text-sm relative">
                               <div className={`${isAnomaly ? 'text-rose-700 font-medium' : 'text-slate-700'}`}>
                                  {row.mitigation}
                               </div>
                               
                               {isAnomaly && (
                                 <div className="mt-3 relative">
                                    <button 
                                      onClick={() => setActiveCommentRow(activeCommentRow === row.id ? null : row.id)}
                                      className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-100 hover:bg-rose-200 px-3 py-1.5 rounded-lg transition-colors border border-rose-200 shadow-sm"
                                    >
                                      <Sparkles className="w-3.5 h-3.5" /> Lihat Saran AI
                                    </button>

                                    {activeCommentRow === row.id && (
                                      <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-rose-200 p-4 z-10 animate-in fade-in slide-in-from-top-2">
                                         <div className="flex justify-between items-start mb-2">
                                           <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1"><Sparkles className="w-3 h-3 text-teal-500" /> Draf Komentar AI</h4>
                                           <button onClick={() => setActiveCommentRow(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
                                         </div>
                                         <p className="text-sm text-slate-600 mb-4 bg-slate-50 p-2 rounded-lg border border-slate-100">{anomaly.auto_comment}</p>
                                         <button className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors">
                                            Gunakan Komentar Ini
                                         </button>
                                      </div>
                                    )}
                                 </div>
                               )}
                             </td>
                           </tr>
                         );
                       })}
                    </tbody>
                 </table>
              </div>

              <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center">
                 <button onClick={() => setSelectedJsa(null)} className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors">
                   Tutup
                 </button>
                 <div className="flex gap-2">
                   <button className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl transition-colors">
                     <X className="w-4 h-4" /> Tolak & Kembalikan
                   </button>
                   <button onClick={handleApprove} className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm shadow-emerald-600/30">
                     <Check className="w-4 h-4" /> Setujui Dokumen
                   </button>
                 </div>
              </div>

           </div>
        </div>
      )}
    </div>
  );
}
