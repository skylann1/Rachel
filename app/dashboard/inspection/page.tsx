"use client";

import React, { useState } from 'react';
import { Search, Plus, Camera, AlertTriangle, CheckCircle, Clock, MapPin, Building2 } from 'lucide-react';

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

  const filteredInspections = mockInspections.filter(item => filter === 'All' || item.status === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Inspeksi & Temuan K3</h1>
          <p className="text-sm text-slate-500 mt-1">Catat dan pantau perbaikan dari kondisi tidak aman di lapangan (Safety Patrol).</p>
        </div>
        <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30">
          <Plus className="w-4 h-4" />
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
           <button onClick={() => setFilter('In Progress')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${filter === 'In Progress' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>In Progress</button>
           <button onClick={() => setFilter('Closed')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${filter === 'Closed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Closed</button>
        </div>
      </div>

      {/* Grid of Finding Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInspections.map((item) => (
          <div key={item.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group">
            
            {/* Image Placeholder */}
            <div className="h-48 bg-slate-100 relative overflow-hidden">
               {/* Gunakan tag img standar sebagai mockup, pada prod gunakan next/image */}
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
            </div>

            <div className="p-5 flex flex-col flex-1">
               <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-bold text-slate-400">{item.id} • {item.type}</span>
                  {item.status === 'Open' && <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" /> Open</span>}
                  {item.status === 'In Progress' && <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> Progress</span>}
                  {item.status === 'Closed' && <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" /> Closed</span>}
               </div>
               
               <p className="text-sm font-semibold text-slate-800 leading-snug mb-4 line-clamp-3">
                  {item.description}
               </p>
               
               <div className="mt-auto space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                     <MapPin className="w-3.5 h-3.5" />
                     <span className="truncate">{item.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                     <Building2 className="w-3.5 h-3.5" />
                     <span className="truncate">{item.vendor}</span>
                  </div>
               </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
               <span className="text-xs font-medium text-slate-400">{item.date}</span>
               <button className="text-xs font-bold text-primary hover:text-primary/80 transition-colors">
                  Update Status
               </button>
            </div>

          </div>
        ))}
      </div>
      
    </div>
  );
}
