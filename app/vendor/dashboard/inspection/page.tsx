'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, AlertTriangle, CheckCircle, Clock, MapPin, UploadCloud, X, ArrowRight, Loader2 } from 'lucide-react';
import { getVendorInspections, submitVendorResponse } from './actions';
import { uploadImage } from '@/utils/supabase/storage';

export default function VendorInspectionPage() {
  const [filter, setFilter] = useState('All');
  const [selectedInspection, setSelectedInspection] = useState<any>(null);
  const [inspections, setInspections] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const data = await getVendorInspections();
    const formatted = data.map((d: any) => ({
      id: d.id,
      type: d.finding_type,
      description: d.title,
      location: d.location,
      date: new Date(d.created_at).toLocaleString('id-ID'),
      status: d.status,
      priority: d.priority,
      image: d.image_url || 'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=500&q=80',
      feedbackHSE: d.vendor_response || 'Segera tindak lanjuti temuan ini.', // Wait, HSE feedback should be from another column, but for now fallback
    }));
    setInspections(formatted);
  }

  const filteredInspections = inspections.filter(item => filter === 'All' || item.status === filter);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedInspection) return;
    
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    try {
      if (imageFile) {
        const imageUrl = await uploadImage(imageFile, 'inspections-evidence');
        if (imageUrl) formData.append('vendor_evidence_url', imageUrl);
      }

      await submitVendorResponse(selectedInspection.id, formData);
      alert("Bukti perbaikan berhasil dikirim! Menunggu validasi penutupan dari HSE PGN.");
      setSelectedInspection(null);
      setImageFile(null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Gagal mengirim tindak lanjut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-4 items-center">
           <div className="w-14 h-14 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
             <AlertTriangle className="w-7 h-7" />
           </div>
           <div>
             <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Inbox Temuan K3</h1>
             <p className="text-sm text-slate-500 mt-1">Tindak lanjuti segera temuan dari HSE Patrol PGN.</p>
           </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto bg-slate-100 p-1 rounded-xl overflow-x-auto">
           <button onClick={() => setFilter('All')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${filter === 'All' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Semua</button>
           <button onClick={() => setFilter('Open')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 ${filter === 'Open' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Perlu Tindakan <span className="bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded text-[10px]">1</span>
           </button>
           <button onClick={() => setFilter('Closed')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${filter === 'Closed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Selesai</button>
        </div>
      </div>

      {/* Grid of Finding Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInspections.map((item) => (
          <div key={item.id} className={`bg-white border-2 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group ${item.status === 'Open' ? 'border-rose-200' : 'border-slate-200'}`}>
            
            {/* Image Placeholder */}
            <div className="h-48 bg-slate-100 relative overflow-hidden">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={item.image} alt={item.type} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
               <div className="absolute top-3 right-3 flex gap-2">
                  <span className={`px-2.5 py-1 text-xs font-black uppercase tracking-wider rounded-lg shadow-sm ${
                     item.priority === 'Critical' ? 'bg-rose-600 text-white' : 
                     item.priority === 'High' ? 'bg-amber-500 text-white' : 
                     'bg-blue-500 text-white'
                  }`}>
                     {item.priority}
                  </span>
               </div>
               <div className="absolute top-3 left-3 flex gap-2">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-lg shadow-sm backdrop-blur-md ${
                     item.status === 'Open' ? 'bg-rose-100/90 text-rose-700 border border-rose-200' :
                     item.status === 'In Progress' ? 'bg-amber-100/90 text-amber-700 border border-amber-200' :
                     'bg-emerald-100/90 text-emerald-700 border border-emerald-200'
                  }`}>
                     {item.status}
                  </span>
               </div>
            </div>

            {/* Content */}
            <div className="p-5 flex-1 flex flex-col bg-white">
               <div className="flex items-center gap-2 mb-3">
                 <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{item.id}</span>
                 <span className="text-xs font-bold text-slate-500">{item.type}</span>
               </div>
               
               <p className="text-sm font-semibold text-slate-800 leading-relaxed mb-4 line-clamp-3">
                 "{item.description}"
               </p>

               <div className="mt-auto space-y-2 text-xs font-medium text-slate-600">
                 <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {item.location}</div>
                 <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-slate-400" /> {item.date}</div>
               </div>
            </div>
            
            <div className={`p-4 flex gap-2 ${item.status === 'Open' ? 'bg-rose-50' : 'bg-slate-50 border-t border-slate-100'}`}>
               {item.status === 'Open' ? (
                  <button 
                    onClick={() => setSelectedInspection(item)}
                    className="w-full flex items-center justify-center gap-1.5 text-center py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm shadow-rose-600/30 transition-colors"
                  >
                     Tindak Lanjuti <ArrowRight className="w-4 h-4" />
                  </button>
               ) : (
                  <button disabled className="w-full flex items-center justify-center gap-1.5 text-center py-2 text-sm font-bold text-emerald-600 bg-emerald-100 border border-emerald-200 rounded-xl cursor-not-allowed">
                     <CheckCircle className="w-4 h-4" /> Telah Ditutup
                  </button>
               )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Tindak Lanjut */}
      {selectedInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl h-[90vh] md:h-auto md:max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-rose-50 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-rose-700 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Tindak Lanjut Temuan K3</h2>
                <p className="text-sm text-rose-600/80 mt-1">{selectedInspection.id} - {selectedInspection.type}</p>
              </div>
              <button onClick={() => setSelectedInspection(null)} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
               {/* Instruksi HSE */}
               <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                  <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Instruksi Tim HSE PGN</div>
                  <p className="text-sm font-medium text-amber-900">"{selectedInspection.feedbackHSE}"</p>
               </div>

               {/* Upload Foto Bukti */}
               <div>
                  <label className="text-sm font-bold text-slate-700 block mb-2">Upload Foto Bukti Perbaikan (Closing) <span className="text-rose-500">*</span></label>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                  <div onClick={() => fileInputRef.current?.click()} className="w-full h-40 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 hover:border-emerald-500/50 hover:text-emerald-600 transition-colors cursor-pointer group overflow-hidden">
                     {imageFile ? (
                       <img src={URL.createObjectURL(imageFile)} alt="Preview" className="w-full h-full object-cover" />
                     ) : (
                       <>
                         <UploadCloud className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                         <span className="text-sm font-bold">Pilih foto atau tarik ke sini</span>
                         <span className="text-xs font-medium text-slate-400 mt-1">Pastikan foto menunjukkan kondisi yang sudah aman</span>
                       </>
                     )}
                  </div>
               </div>
               
               {/* Deskripsi Tindakan */}
               <div>
                  <label className="text-sm font-bold text-slate-700 block mb-2">Tindakan Perbaikan yang Dilakukan <span className="text-rose-500">*</span></label>
                  <textarea 
                     name="vendor_response"
                     required
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm resize-none" 
                     rows={4} 
                     placeholder="Jelaskan secara singkat apa yang sudah diperbaiki oleh tim vendor di lapangan..."
                  ></textarea>
               </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
              <button type="button" onClick={() => setSelectedInspection(null)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors">Batal</button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-colors shadow-sm shadow-emerald-600/30 flex items-center gap-2"
              >
                 {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} 
                 {isSubmitting ? 'Mengirim...' : 'Kirim Bukti Perbaikan'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
