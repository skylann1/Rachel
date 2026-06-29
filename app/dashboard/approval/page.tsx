"use client";

import React, { useState } from 'react';
import { Search, FileSignature, CheckCircle2, ShieldCheck, MapPin, Clock, ArrowRight, Activity } from 'lucide-react';

const mockPTWs = [
  { id: 'PTW-2026-001', jsaId: 'JSA-2026-001', project: 'Penggalian Pipa Gas Area A - Tahap 2', vendor: 'PT. Konstruksi Sejahtera', location: 'Plant A, Zona Merah', date: '2026-06-25', status: 'Menunggu Validasi PM' },
  { id: 'PTW-2026-002', jsaId: 'JSA-2026-010', project: 'Pemasangan Scaffolding Boiler', vendor: 'CV. Karya Abadi', location: 'Area Boiler 1', date: '2026-06-23', status: 'Aktif (Divalidasi)' },
  { id: 'PTW-2026-003', jsaId: 'JSA-2026-015', project: 'Inspeksi Tangki Timbun', vendor: 'PT. Surveyor Indonesia', location: 'Tangki T-04', date: '2026-06-20', status: 'Selesai (Ditutup)' },
];

export default function PTWApprovalPage() {
  const [filter, setFilter] = useState('Menunggu Validasi PM');

  const filteredPTWs = mockPTWs.filter(ptw => filter === 'All' || ptw.status === filter);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Validasi PTW (Project Manager)</h1>
          <p className="text-sm text-slate-500 mt-1">Review Surat Izin Kerja Aman (PTW) yang telah disetujui HSE dan berikan otorisasi mulai kerja.</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex items-start gap-4">
         <div className="p-3 bg-white rounded-xl shadow-sm mt-1">
            <ShieldCheck className="w-6 h-6 text-primary" />
         </div>
         <div>
            <h3 className="text-sm font-bold text-slate-800">Alur Penerbitan PTW</h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
               PTW ini dibuat <b>otomatis</b> setelah tim HSE menyetujui JSA dari vendor. Sebagai Project Manager (PM), Anda adalah otoritas terakhir yang memvalidasi PTW ini sebelum vendor diizinkan memulai pekerjaannya secara fisik di lapangan. Pastikan area kerja telah siap.
            </p>
         </div>
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
            placeholder="Cari ID PTW, JSA, atau nama proyek..."
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto bg-slate-100 p-1 rounded-xl">
           <button onClick={() => setFilter('Menunggu Validasi PM')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${filter === 'Menunggu Validasi PM' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Perlu Validasi</button>
           <button onClick={() => setFilter('Aktif (Divalidasi)')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${filter === 'Aktif (Divalidasi)' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>PTW Aktif</button>
           <button onClick={() => setFilter('All')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${filter === 'All' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Semua Riwayat</button>
        </div>
      </div>

      {/* PTW List */}
      <div className="space-y-4">
        {filteredPTWs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-sm">
            Tidak ada dokumen PTW yang sesuai dengan filter.
          </div>
        ) : (
          filteredPTWs.map((ptw) => (
            <div key={ptw.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group flex flex-col lg:flex-row gap-6">
              
              {/* Left Col: Main Info */}
              <div className="flex-1 flex gap-5">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                  <FileSignature className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg">ID: {ptw.id}</span>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg flex items-center gap-1">Referensi: <span className="text-primary">{ptw.jsaId}</span></span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 leading-tight">
                    {ptw.project}
                  </h3>
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 font-semibold">
                    Vendor Pelaksana: <span className="text-slate-700">{ptw.vendor}</span>
                  </div>
                </div>
              </div>

              {/* Middle Col: Details */}
              <div className="flex-1 grid grid-cols-2 gap-4 lg:border-l lg:border-slate-100 lg:pl-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Lokasi Kerja</p>
                    <p className="text-sm font-semibold text-slate-700">{ptw.location}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Tanggal Pengajuan</p>
                    <p className="text-sm font-semibold text-slate-700">{ptw.date}</p>
                  </div>
                </div>
              </div>

              {/* Right Col: Actions */}
              <div className="flex flex-col items-end justify-center lg:border-l lg:border-slate-100 lg:pl-6 gap-3 min-w-[180px]">
                {ptw.status === 'Menunggu Validasi PM' && (
                  <>
                     <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 w-full text-center">Menunggu Validasi</span>
                     <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-sm shadow-primary/30">
                        <CheckCircle2 className="w-4 h-4" />
                        Validasi PTW
                     </button>
                  </>
                )}
                {ptw.status === 'Aktif (Divalidasi)' && (
                  <>
                     <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 w-full text-center flex items-center justify-center gap-1"><Activity className="w-3.5 h-3.5" /> PTW Aktif</span>
                     <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all border border-slate-200">
                        Tutup PTW (Selesai)
                     </button>
                  </>
                )}
                {ptw.status === 'Selesai (Ditutup)' && (
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 w-full text-center">Pekerjaan Selesai</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
