'use client';

import React, { useState } from 'react';
import { Search, Plus, Camera, AlertTriangle, CheckCircle, Clock, MapPin, Building2, UploadCloud, X } from 'lucide-react';

const mockInspections = [
  {
    id: 'INSP-001',
    type: 'Unsafe Condition',
    description: 'Kabel las terkelupas dan berserakan di area genangan air.',
    location: 'Area Boiler 1',
    vendor: 'CV. Karya Abadi',
    date: '2026-06-25 10:30',
    status: 'Open',
    priority: 'High',
    image: 'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=500&q=80',
  },
  {
    id: 'INSP-002',
    type: 'Unsafe Act',
    description: 'Pekerja tidak menggunakan full body harness saat bekerja di ketinggian lebih dari 2 meter.',
    location: 'Tangki T-04',
    vendor: 'PT. Surveyor Indonesia',
    date: '2026-06-24 14:15',
    status: 'In Progress',
    priority: 'Critical',
    image: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=500&q=80',
  },
  {
    id: 'INSP-003',
    type: 'Unsafe Condition',
    description: 'Rambu peringatan galian tidak terlihat jelas di malam hari.',
    location: 'Plant A, Zona Merah',
    vendor: 'PT. Konstruksi Sejahtera',
    date: '2026-06-20 09:00',
    status: 'Closed',
    priority: 'Medium',
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=500&q=80',
  }
];

export default function InspectionPage() {
  const [filter, setFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredInspections = mockInspections.filter(item => filter === 'All' || item.status === filter);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Inspeksi & Temuan K3</h1>
          <p className="text-sm text-slate-500 mt-1">Catat dan pantau temuan kondisi tidak aman di lapangan (HSE Patrol).</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm shadow-primary/30"
        >
          <Plus className="w-5 h-5" />
          Lapor Temuan Baru
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/50 focus:border-primary sm:text-sm transition-all"
            placeholder="Cari deskripsi, lokasi, atau vendor..."
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto bg-slate-100 p-1 rounded-xl overflow-x-auto">
           <button onClick={() => setFilter('All')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${filter === 'All' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Semua</button>
           <button onClick={() => setFilter('Open')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${filter === 'Open' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Open</button>
           <button onClick={() => setFilter('In Progress')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${filter === 'In Progress' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>In Progress (Tunggu Validasi)</button>
           <button onClick={() => setFilter('Closed')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${filter === 'Closed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Closed</button>
        </div>
      </div>

      {/* Grid of Finding Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInspections.map((item) => (
          <div key={item.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group">
            
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
            <div className="p-5 flex-1 flex flex-col">
               <div className="flex items-center gap-2 mb-3">
                 <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{item.id}</span>
                 <span className="text-xs font-bold text-slate-500">{item.type}</span>
               </div>
               
               <p className="text-sm font-semibold text-slate-800 leading-relaxed mb-4 line-clamp-3">
                 "{item.description}"
               </p>

               <div className="mt-auto space-y-2 text-xs font-medium text-slate-600">
                 <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {item.location}</div>
                 <div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-slate-400" /> {item.vendor}</div>
                 <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-slate-400" /> {item.date}</div>
               </div>
            </div>
            
            <div className="border-t border-slate-100 p-4 bg-slate-50 flex gap-2">
               {item.status === 'Open' ? (
                  <button disabled className="w-full text-center py-2 text-xs font-bold text-slate-400 bg-white border border-slate-200 rounded-lg cursor-not-allowed">
                     Menunggu Respons Vendor
                  </button>
               ) : item.status === 'In Progress' ? (
                  <button className="w-full flex items-center justify-center gap-1.5 text-center py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors">
                     <CheckCircle className="w-4 h-4" /> Validasi Perbaikan
                  </button>
               ) : (
                  <button disabled className="w-full text-center py-2 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg cursor-not-allowed">
                     Temuan Selesai Ditutup
                  </button>
               )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Lapor Temuan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl h-[90vh] md:h-auto md:max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Camera className="w-5 h-5 text-primary" /> Lapor Temuan K3 Baru</h2>
                <p className="text-sm text-slate-500 mt-1">Formulir inspeksi HSE Patrol.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
               {/* Upload Foto */}
               <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Foto Temuan <span className="text-rose-500">*</span></label>
                  <div className="w-full h-32 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 hover:border-primary/50 transition-colors cursor-pointer">
                     <UploadCloud className="w-6 h-6 mb-2" />
                     <span className="text-sm font-medium">Klik untuk upload foto temuan</span>
                     <span className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB</span>
                  </div>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Jenis Temuan <span className="text-rose-500">*</span></label>
                    <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm">
                      <option value="Unsafe Condition">Unsafe Condition (Kondisi Tidak Aman)</option>
                      <option value="Unsafe Act">Unsafe Act (Tindakan Tidak Aman)</option>
                      <option value="Near Miss">Near Miss (Hampir Celaka)</option>
                    </select>
                 </div>
                 <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Priority (Keparahan) <span className="text-rose-500">*</span></label>
                    <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm">
                      <option value="Low">Low (Bisa ditoleransi sementara)</option>
                      <option value="Medium">Medium (Perlu segera diperbaiki)</option>
                      <option value="High">High (Berpotensi cedera)</option>
                      <option value="Critical">Critical (Stop Work Authority!)</option>
                    </select>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Lokasi Temuan <span className="text-rose-500">*</span></label>
                    <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm" placeholder="Contoh: Area Boiler 1" />
                 </div>
                 <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Vendor Terkait <span className="text-rose-500">*</span></label>
                    <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm">
                      <option value="">Pilih Vendor</option>
                      <option value="VND-001">PT. Konstruksi Sejahtera</option>
                      <option value="VND-002">CV. Karya Abadi</option>
                    </select>
                 </div>
               </div>

               <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Deskripsi Temuan <span className="text-rose-500">*</span></label>
                  <textarea 
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm resize-none" 
                     rows={4} 
                     placeholder="Deskripsikan dengan detail apa yang terjadi dan mengapa hal tersebut tidak aman..."
                  ></textarea>
               </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors">Batal</button>
              <button 
                onClick={() => {
                   alert("Temuan K3 berhasil dilaporkan! Notifikasi telah dikirim ke Vendor terkait.");
                   setIsModalOpen(false);
                }} 
                className="px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors shadow-sm shadow-primary/30 flex items-center gap-2"
              >
                 <Plus className="w-4 h-4" /> Create Report
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
