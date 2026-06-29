"use client";

import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertTriangle, ShieldCheck, Clock, FileSignature, Trash2 } from 'lucide-react';

const mockInbox = [
  {
    id: 1,
    type: 'approval',
    title: 'JSA Disetujui: PRJ-001 Penggalian Pipa',
    message: 'JSA untuk proyek Penggalian Pipa Gas Area A telah disetujui oleh tim HSE. PTW otomatis telah diterbitkan dan menunggu validasi PM.',
    time: '10 Menit yang lalu',
    read: false,
    icon: CheckCircle2,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  },
  {
    id: 2,
    type: 'action_required',
    title: 'Perlu Validasi: PTW-2026-001',
    message: 'PTW baru menunggu validasi Anda untuk vendor PT. Konstruksi Sejahtera di Area Zona Merah.',
    time: '1 Jam yang lalu',
    read: false,
    icon: FileSignature,
    color: 'text-amber-600 bg-amber-50 border-amber-100',
  },
  {
    id: 3,
    type: 'warning',
    title: 'Peringatan: Temuan K3 Belum Ditutup',
    message: 'Ada 2 temuan Inspeksi K3 (Safety Patrol) yang melewati batas waktu perbaikan untuk CV. Karya Abadi.',
    time: 'Kemarin',
    read: true,
    icon: AlertTriangle,
    color: 'text-rose-600 bg-rose-50 border-rose-100',
  },
  {
    id: 4,
    type: 'system',
    title: 'Pembaruan Sistem SIPERMIT',
    message: 'Modul pelaporan insiden kini tersedia. Vendor dapat langsung melapor jika terjadi kondisi darurat.',
    time: '2 Hari yang lalu',
    read: true,
    icon: ShieldCheck,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
  }
];

export default function InboxPage() {
  const [filter, setFilter] = useState('All');
  const [messages, setMessages] = useState(mockInbox);
  const [selectedMsg, setSelectedMsg] = useState<typeof mockInbox[0] | null>(null);

  const filteredMessages = messages.filter(msg => {
    if (filter === 'Unread') return !msg.read;
    return true;
  });

  const handleMessageClick = (msg: typeof mockInbox[0]) => {
    // Mark as read if unread
    if (!msg.read) {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
    }
    setSelectedMsg(msg);
  };

  const markAllAsRead = () => {
    setMessages(prev => prev.map(m => ({ ...m, read: true })));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Mail className="w-6 h-6 text-primary" />
            Kotak Masuk
          </h1>
          <p className="text-sm text-slate-500 mt-1">Pantau seluruh pemberitahuan sistem, persetujuan dokumen, dan peringatan K3.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col md:flex-row overflow-hidden min-h-[600px] relative">
        
        {/* Sidebar Filter */}
        <div className="w-full md:w-64 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-100 p-6 flex flex-col gap-2">
           <button 
             onClick={() => setFilter('All')}
             className={`flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${filter === 'All' ? 'bg-white shadow-sm text-primary border border-slate-200' : 'text-slate-600 hover:bg-slate-100 border border-transparent'}`}
           >
             Semua Pesan
             <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md text-xs">{messages.length}</span>
           </button>
           <button 
             onClick={() => setFilter('Unread')}
             className={`flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${filter === 'Unread' ? 'bg-white shadow-sm text-primary border border-slate-200' : 'text-slate-600 hover:bg-slate-100 border border-transparent'}`}
           >
             Belum Dibaca
             <span className="bg-rose-500 text-white px-2 py-0.5 rounded-md text-xs">{messages.filter(m => !m.read).length}</span>
           </button>
        </div>

        {/* Message List */}
        <div className="flex-1 flex flex-col">
           <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <span className="text-sm font-bold text-slate-500">
                 Menampilkan {filteredMessages.length} pesan
              </span>
              <button onClick={markAllAsRead} className="text-xs font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-1.5">
                 <CheckCircle2 className="w-4 h-4" /> Tandai semua dibaca
              </button>
           </div>
           
           <div className="divide-y divide-slate-100 overflow-y-auto">
              {filteredMessages.map((msg) => (
                 <div 
                    key={msg.id} 
                    onClick={() => handleMessageClick(msg)}
                    className={`p-6 hover:bg-slate-50 transition-colors cursor-pointer group relative ${!msg.read ? 'bg-blue-50/30' : ''}`}
                 >
                    {!msg.read && (
                       <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                    )}
                    
                    <div className="flex gap-4">
                       <div className={`w-12 h-12 rounded-xl flex items-center justify-center border flex-shrink-0 ${msg.color}`}>
                          <msg.icon className="w-6 h-6" />
                       </div>
                       
                       <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1 gap-2">
                             <h3 className={`text-base truncate ${!msg.read ? 'font-black text-slate-800' : 'font-bold text-slate-700'}`}>
                                {msg.title}
                             </h3>
                             <span className="text-xs font-medium text-slate-400 whitespace-nowrap flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {msg.time}
                             </span>
                          </div>
                          <p className={`text-sm leading-relaxed line-clamp-1 ${!msg.read ? 'text-slate-600 font-medium' : 'text-slate-500'}`}>
                             {msg.message}
                          </p>
                       </div>
                    </div>

                    <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           setMessages(prev => prev.filter(m => m.id !== msg.id));
                         }}
                         className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 shadow-sm transition-all"
                       >
                          <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                 </div>
              ))}
              
              {filteredMessages.length === 0 && (
                 <div className="p-12 text-center text-slate-400">
                    Tidak ada pesan baru.
                 </div>
              )}
           </div>
        </div>

        {/* Detail Modal Overlay */}
        {selectedMsg && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex justify-end">
            <div className="w-full md:w-[400px] h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800">Detail Pesan</h3>
                <button 
                  onClick={() => setSelectedMsg(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border mb-6 ${selectedMsg.color}`}>
                  <selectedMsg.icon className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-slate-800 leading-tight mb-2">
                  {selectedMsg.title}
                </h2>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-6 pb-6 border-b border-slate-100">
                  <Clock className="w-4 h-4" />
                  {selectedMsg.time}
                </div>
                <div className="prose prose-sm text-slate-600 leading-relaxed">
                  <p>{selectedMsg.message}</p>
                </div>
                
                <div className="mt-8">
                  <button 
                    onClick={() => setSelectedMsg(null)}
                    className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all"
                  >
                    Tutup Pesan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
