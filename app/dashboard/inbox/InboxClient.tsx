'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Mail, CheckCircle2, AlertTriangle, ShieldCheck, Clock, 
  FileSignature, Trash2, Bell, Eye, ArrowRight, Inbox,
  X
} from 'lucide-react';
import { 
  NotificationItem, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification 
} from './actions';

interface InboxClientProps {
  notifications: NotificationItem[];
}

const getIconAndColor = (type: string) => {
  switch (type) {
    case 'approval':
      return { Icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
    case 'action_required':
      return { Icon: FileSignature, color: 'text-amber-600 bg-amber-50 border-amber-100' };
    case 'warning':
      return { Icon: AlertTriangle, color: 'text-rose-600 bg-rose-50 border-rose-100' };
    case 'info':
      return { Icon: Bell, color: 'text-sky-600 bg-sky-50 border-sky-100' };
    case 'system':
    default:
      return { Icon: ShieldCheck, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' };
  }
};

const formatTime = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} Menit yang lalu`;
  if (diffHr < 24) return `${diffHr} Jam yang lalu`;
  if (diffDay === 1) return 'Kemarin';
  if (diffDay < 7) return `${diffDay} Hari yang lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function InboxClient({ notifications: initialNotifications }: InboxClientProps) {
  const [filter, setFilter] = useState('All');
  const [messages, setMessages] = useState(initialNotifications);
  const [selectedMsg, setSelectedMsg] = useState<NotificationItem | null>(null);

  const filteredMessages = messages.filter(msg => {
    if (filter === 'Unread') return !msg.is_read;
    if (filter === 'approval') return msg.type === 'approval';
    if (filter === 'action_required') return msg.type === 'action_required';
    if (filter === 'warning') return msg.type === 'warning';
    return true;
  });

  const unreadCount = messages.filter(m => !m.is_read).length;

  const handleMessageClick = async (msg: NotificationItem) => {
    if (!msg.is_read) {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
      await markNotificationAsRead(msg.id);
    }
    setSelectedMsg(msg);
  };

  const handleMarkAllRead = async () => {
    setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
    await markAllNotificationsAsRead();
  };

  const handleDelete = async (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
    if (selectedMsg?.id === id) setSelectedMsg(null);
    await deleteNotification(id);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Mail className="w-6 h-6 text-primary" />
            Kotak Masuk
            {unreadCount > 0 && (
              <span className="bg-rose-500 text-white text-xs font-black px-2.5 py-1 rounded-full animate-pulse">
                {unreadCount}
              </span>
            )}
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
             <span className={`px-2 py-0.5 rounded-md text-xs ${unreadCount > 0 ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{unreadCount}</span>
           </button>
           
           <div className="h-px bg-slate-200 my-2"></div>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Kategori</p>
           
           {[
             { key: 'approval', label: 'Persetujuan', Icon: CheckCircle2, clr: 'text-emerald-600' },
             { key: 'action_required', label: 'Butuh Tindakan', Icon: FileSignature, clr: 'text-amber-600' },
             { key: 'warning', label: 'Peringatan', Icon: AlertTriangle, clr: 'text-rose-600' },
           ].map(cat => (
             <button
               key={cat.key}
               onClick={() => setFilter(cat.key)}
               className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${filter === cat.key ? 'bg-white shadow-sm font-bold text-slate-800 border border-slate-200' : 'font-semibold text-slate-500 hover:bg-slate-100 border border-transparent'}`}
             >
               <cat.Icon className={`w-4 h-4 ${cat.clr}`} />
               {cat.label}
             </button>
           ))}
        </div>

        {/* Message List */}
        <div className="flex-1 flex flex-col">
           <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
              <span className="text-sm font-bold text-slate-500">
                 Menampilkan {filteredMessages.length} pesan
              </span>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-1.5">
                   <CheckCircle2 className="w-4 h-4" /> Tandai semua dibaca
                </button>
              )}
           </div>
           
           <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {filteredMessages.map((msg) => {
                const { Icon, color } = getIconAndColor(msg.type);
                return (
                  <div 
                     key={msg.id} 
                     onClick={() => handleMessageClick(msg)}
                     className={`p-6 hover:bg-slate-50 transition-colors cursor-pointer group relative ${!msg.is_read ? 'bg-blue-50/30' : ''}`}
                  >
                     {!msg.is_read && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                     )}
                     
                     <div className="flex gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border flex-shrink-0 ${color}`}>
                           <Icon className="w-6 h-6" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                           <div className="flex justify-between items-start mb-1 gap-2">
                              <h3 className={`text-base truncate ${!msg.is_read ? 'font-black text-slate-800' : 'font-bold text-slate-700'}`}>
                                 {msg.title}
                              </h3>
                              <span className="text-xs font-medium text-slate-400 whitespace-nowrap flex items-center gap-1">
                                 <Clock className="w-3 h-3" /> {formatTime(msg.created_at)}
                              </span>
                           </div>
                           <p className={`text-sm leading-relaxed line-clamp-1 ${!msg.is_read ? 'text-slate-600 font-medium' : 'text-slate-500'}`}>
                              {msg.message}
                           </p>
                        </div>
                     </div>

                     <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(msg.id);
                          }}
                          className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 shadow-sm transition-all"
                        >
                           <Trash2 className="w-4 h-4" />
                        </button>
                     </div>
                  </div>
                );
              })}
              
              {filteredMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center p-16 text-center">
                   <Inbox className="w-16 h-16 text-slate-200 mb-4" />
                   <h3 className="text-lg font-bold text-slate-600">Kotak Masuk Bersih</h3>
                   <p className="text-sm text-slate-400 mt-1 max-w-xs">
                     {filter === 'Unread' ? 'Semua pesan sudah dibaca!' : 'Belum ada pemberitahuan untuk ditampilkan.'}
                   </p>
                </div>
              )}
           </div>
        </div>

        {/* Detail Slide-Over Panel */}
        {selectedMsg && (() => {
          const { Icon, color } = getIconAndColor(selectedMsg.type);
          return (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex justify-end animate-in fade-in duration-150">
              <div className="w-full md:w-[420px] h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-800">Detail Pesan</h3>
                  <button 
                    onClick={() => setSelectedMsg(null)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border mb-6 ${color}`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-black text-slate-800 leading-tight mb-2">
                    {selectedMsg.title}
                  </h2>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-6 pb-6 border-b border-slate-100">
                    <Clock className="w-4 h-4" />
                    {formatTime(selectedMsg.created_at)}
                  </div>
                  <div className="prose prose-sm text-slate-600 leading-relaxed">
                    <p>{selectedMsg.message}</p>
                  </div>
                  
                  <div className="mt-8 flex flex-col gap-3">
                    {selectedMsg.link && (
                      <Link
                        href={selectedMsg.link}
                        className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                      >
                        Buka Halaman Terkait <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                    <button 
                      onClick={() => setSelectedMsg(null)}
                      className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
                    >
                      Tutup Pesan
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
