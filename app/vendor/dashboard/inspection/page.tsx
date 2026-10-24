'use client';

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { Camera, AlertTriangle, CheckCircle, Clock, MapPin, UploadCloud, X, ArrowRight, Loader2, Inbox } from 'lucide-react';
import { getVendorInspections } from './actions';
import { PhotoGalleryLightbox } from '@/components/photo-gallery-lightbox';
import { resolveInspectionGallery } from '@/lib/inspection-photos';
import { ACTIVITY_TYPE_META, normalizeActivityType } from '@/lib/inspection-activity';

export default function VendorInspectionPage() {
  const [filter, setFilter] = useState('All');
  const [inspections, setInspections] = useState<any[]>([]);
  const [galleryPhotos, setGalleryPhotos] = useState<string[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const data = await getVendorInspections();
    const formatted = data.map((d: any) => {
      const { image, photos } = resolveInspectionGallery(d);
      return {
        id: d.id,
        type: d.finding_type,
        activityType: normalizeActivityType(d.activity_type),
        description: d.title,
        location: d.location,
        date: new Date(d.created_at).toLocaleString('id-ID'),
        status: d.status,
        priority: d.priority,
        image,
        photos,
        feedbackHSE: d.title,
      };
    });
    setInspections(formatted);
  }

  const filteredInspections = inspections.filter(item => filter === 'All' || item.status === filter);
  const openCount = inspections.filter(item => item.status === 'Open').length;

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
              Perlu Tindakan <span className="bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded text-[10px]">{openCount}</span>
           </button>
           <button onClick={() => setFilter('Closed')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${filter === 'Closed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Selesai</button>
        </div>
      </div>

      {/* Grid of Finding Cards */}
      {filteredInspections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border-2 border-dashed border-slate-200 rounded-2xl">
          <Inbox className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">
            {inspections.length === 0 ? 'Belum ada temuan K3 yang dilaporkan untuk proyek Anda.' : 'Tidak ada temuan pada kategori ini.'}
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInspections.map((item) => (
          <div key={item.id} className={`bg-white border-2 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group ${item.status === 'Open' ? 'border-rose-200' : 'border-slate-200'}`}>
            
            {/* Image Placeholder */}
            <div
              className={`h-48 bg-slate-100 relative overflow-hidden ${item.photos.length > 0 ? 'cursor-pointer' : ''}`}
              onClick={() => { if (item.photos.length > 0) { setGalleryPhotos(item.photos); setGalleryIndex(0); } }}
            >
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={item.image} alt={item.type} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
               {item.photos.length > 1 && (
                 <span className="absolute bottom-3 right-3 px-2 py-1 text-xs font-bold rounded-lg bg-slate-900/70 text-white backdrop-blur-sm">
                   +{item.photos.length - 1}
                 </span>
               )}
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
                 {item.activityType === 'Audit / Kunjungan' && (
                   <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${ACTIVITY_TYPE_META[item.activityType as 'Audit / Kunjungan'].badge}`}>Audit / Kunjungan</span>
                 )}
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
                  <Link
                    href={`/vendor/dashboard/inspection/${item.id}`}
                    className="w-full flex items-center justify-center gap-1.5 text-center py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm shadow-rose-600/30 transition-colors"
                  >
                     Tindak Lanjuti <ArrowRight className="w-4 h-4" />
                  </Link>
               ) : item.status === 'In Progress' ? (
                  <Link href={`/vendor/dashboard/inspection/${item.id}`} className="w-full flex items-center justify-center gap-1.5 text-center py-2 text-sm font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-xl">
                     <Clock className="w-4 h-4" /> Menunggu Validasi HSE
                  </Link>
               ) : (
                  <Link href={`/vendor/dashboard/inspection/${item.id}`} className="w-full flex items-center justify-center gap-1.5 text-center py-2 text-sm font-bold text-emerald-600 bg-emerald-100 border border-emerald-200 rounded-xl">
                     <CheckCircle className="w-4 h-4" /> Telah Ditutup · Lihat Detail
                  </Link>
               )}
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Lightbox Galeri Foto */}
      {galleryPhotos && (
        <PhotoGalleryLightbox
          photos={galleryPhotos}
          initialIndex={galleryIndex}
          onClose={() => setGalleryPhotos(null)}
        />
      )}

    </div>
  );
}
