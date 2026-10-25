'use client';

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { Camera, AlertTriangle, CheckCircle, Clock, MapPin, UploadCloud, X, ArrowRight, Loader2, Inbox } from 'lucide-react';
import { getVendorInspections } from './actions';
import { dueState } from '@/lib/inspection-fields';
import { PhotoGalleryLightbox } from '@/components/photo-gallery-lightbox';
import { resolveInspectionGallery } from '@/lib/inspection-photos';
import { ACTIVITY_TYPE_META, normalizeActivityType } from '@/lib/inspection-activity';
import { DataTable, DataHead, EmptyRow, ROW_CLS, CELL_CLS, ACTION_LINK_CLS } from '@/components/ui/data-table';

const SLA_TONE = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  late: 'bg-rose-50 text-rose-700 border-rose-200',
  none: 'hidden',
};

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
        due_date: d.due_date,
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

      {/* Daftar temuan */}
      {filteredInspections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border-2 border-dashed border-slate-200 rounded-2xl">
          <Inbox className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">
            {inspections.length === 0 ? 'Belum ada temuan K3 yang dilaporkan untuk proyek Anda.' : 'Tidak ada temuan pada kategori ini.'}
          </p>
        </div>
      ) : (
      <DataTable minWidth={960}>
        <DataHead columns={[
          { label: 'Foto', className: 'w-16' }, { label: 'Temuan' }, { label: 'Lokasi / Tanggal' }, { label: 'Prioritas' }, { label: 'Status / SLA' }, { label: 'Aksi', className: 'text-right' },
        ]} />
        <tbody className="divide-y divide-slate-100">
          {filteredInspections.map((item) => {
            const sla = dueState(item.due_date, item.status);
            return (
              <tr key={item.id} className={`${ROW_CLS} ${item.status === 'Open' ? 'bg-rose-50/30' : ''}`}>
                <td className={CELL_CLS}>
                  <button
                    type="button"
                    disabled={item.photos.length === 0}
                    onClick={() => { setGalleryPhotos(item.photos); setGalleryIndex(0); }}
                    className="relative block w-12 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 disabled:cursor-default"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image} alt={item.type} className="w-full h-full object-cover" />
                    {item.photos.length > 1 && (
                      <span className="absolute bottom-0 right-0 px-1 text-[9px] font-bold bg-slate-900/70 text-white rounded-tl">+{item.photos.length - 1}</span>
                    )}
                  </button>
                </td>
                <td className={`${CELL_CLS} max-w-sm`}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{item.id}</span>
                    <span className="text-xs font-bold text-slate-500">{item.type}</span>
                    {item.activityType === 'Audit / Kunjungan' && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${ACTIVITY_TYPE_META[item.activityType as 'Audit / Kunjungan'].badge}`}>Audit / Kunjungan</span>
                    )}
                  </div>
                  <p className="font-semibold text-slate-800 line-clamp-2">{item.description}</p>
                </td>
                <td className={`${CELL_CLS} text-xs text-slate-600 space-y-1`}>
                  <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />{item.location}</div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap"><Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />{item.date}</div>
                </td>
                <td className={CELL_CLS}>
                  <span className={`inline-block px-2 py-0.5 text-[11px] font-black uppercase tracking-wider rounded-md ${
                    item.priority === 'Critical' ? 'bg-rose-600 text-white' :
                    item.priority === 'High' ? 'bg-amber-500 text-white' :
                    item.priority === 'Medium' ? 'bg-sky-100 text-sky-700' : 'bg-blue-500 text-white'
                  }`}>{item.priority}</span>
                </td>
                <td className={`${CELL_CLS} space-y-1.5`}>
                  <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-md border ${
                    item.status === 'Open' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                    item.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>{item.status}</span>
                  {sla.tone !== 'none' && (
                    <div><span className={`inline-flex px-2 py-0.5 rounded-md border text-[11px] font-bold ${SLA_TONE[sla.tone]}`}>SLA: {sla.label}</span></div>
                  )}
                </td>
                <td className={`${CELL_CLS} text-right`}>
                  {item.status === 'Open' ? (
                    <Link href={`/vendor/dashboard/inspection/${item.id}`} className={`${ACTION_LINK_CLS} text-white bg-rose-600 border-rose-600 hover:bg-rose-700`}>
                      Tindak Lanjuti <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : item.status === 'In Progress' ? (
                    <Link href={`/vendor/dashboard/inspection/${item.id}`} className={`${ACTION_LINK_CLS} text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100`}>
                      <Clock className="w-3.5 h-3.5" /> Menunggu Validasi
                    </Link>
                  ) : (
                    <Link href={`/vendor/dashboard/inspection/${item.id}`} className={`${ACTION_LINK_CLS} text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100`}>
                      <CheckCircle className="w-3.5 h-3.5" /> Lihat Detail
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
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
