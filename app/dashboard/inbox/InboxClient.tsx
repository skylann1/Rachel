'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Mail, CheckCircle2, AlertTriangle, ShieldCheck, Clock,
  FileSignature, Trash2, Bell, ArrowRight, Inbox,
  X, Search, Settings2, CheckSquare, Square
} from 'lucide-react';
import {
  NotificationItem,
  NotificationType,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  markManyAsRead,
  deleteMany,
  getNotifications,
  updateNotificationPreferences,
} from './actions';
import { useNotificationsRealtime } from '@/hooks/useNotificationsRealtime';

interface InboxClientProps {
  notifications: NotificationItem[];
  userId?: string;
  initialMutedTypes?: NotificationType[];
}

type DateRange = 'all' | 'today' | '7d' | '30d';

const TYPE_META: Record<NotificationType, { label: string; desc: string; Icon: React.ElementType; color: string }> = {
  approval: { label: 'Persetujuan', desc: 'Prosedur, JSA, atau PTW disetujui', Icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  action_required: { label: 'Butuh Tindakan', desc: 'Perlu respons atau pengajuan lanjutan', Icon: FileSignature, color: 'text-amber-600 bg-amber-50 border-amber-100' },
  warning: { label: 'Peringatan', desc: 'Penolakan atau isu yang perlu diperbaiki', Icon: AlertTriangle, color: 'text-rose-600 bg-rose-50 border-rose-100' },
  info: { label: 'Info', desc: 'Pembaruan status umum', Icon: Bell, color: 'text-sky-600 bg-sky-50 border-sky-100' },
  system: { label: 'Sistem', desc: 'Pemberitahuan sistem', Icon: ShieldCheck, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
};

const getIconAndColor = (type: string) => {
  const meta = TYPE_META[type as NotificationType];
  return meta ? { Icon: meta.Icon, color: meta.color } : { Icon: Bell, color: TYPE_META.info.color };
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

function withinRange(item: NotificationItem, range: DateRange): boolean {
  if (range === 'all') return true;
  const t = new Date(item.created_at).getTime();
  if (range === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return t >= start.getTime();
  }
  if (range === '7d') return t >= Date.now() - 7 * 86400000;
  if (range === '30d') return t >= Date.now() - 30 * 86400000;
  return true;
}

function groupByDate(items: NotificationItem[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const groups: { label: string; items: NotificationItem[] }[] = [
    { label: 'Hari Ini', items: [] },
    { label: 'Kemarin', items: [] },
    { label: 'Minggu Ini', items: [] },
    { label: 'Lebih Lama', items: [] },
  ];

  for (const item of items) {
    const d = new Date(item.created_at);
    if (d >= startOfToday) groups[0].items.push(item);
    else if (d >= startOfYesterday) groups[1].items.push(item);
    else if (d >= startOfWeek) groups[2].items.push(item);
    else groups[3].items.push(item);
  }

  return groups.filter(g => g.items.length > 0);
}

export default function InboxClient({ notifications: initialNotifications, userId, initialMutedTypes = [] }: InboxClientProps) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [messages, setMessages] = useState(initialNotifications);
  const [selectedMsg, setSelectedMsg] = useState<NotificationItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mutedTypes, setMutedTypes] = useState<NotificationType[]>(initialMutedTypes);
  const [draftMuted, setDraftMuted] = useState<NotificationType[]>(initialMutedTypes);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const handleInsert = useCallback((item: NotificationItem) => {
    if (mutedTypes.includes(item.type)) return;
    setMessages(prev => (prev.some(m => m.id === item.id) ? prev : [item, ...prev]));
  }, [mutedTypes]);

  useNotificationsRealtime(userId, handleInsert);

  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      if (filter === 'Unread' && msg.is_read) return false;
      if (filter === 'approval' && msg.type !== 'approval') return false;
      if (filter === 'action_required' && msg.type !== 'action_required') return false;
      if (filter === 'warning' && msg.type !== 'warning') return false;
      if (!withinRange(msg, dateRange)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!msg.title.toLowerCase().includes(q) && !msg.message.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [messages, filter, dateRange, search]);

  const groupedMessages = useMemo(() => groupByDate(filteredMessages), [filteredMessages]);

  const unreadCount = messages.filter(m => !m.is_read).length;
  const visibleIds = filteredMessages.map(m => m.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));

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
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (selectedMsg?.id === id) setSelectedMsg(null);
    await deleteNotification(id);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds(prev => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      }
      return new Set([...prev, ...visibleIds]);
    });
  };

  const handleBulkMarkRead = async () => {
    const ids = Array.from(selectedIds);
    setMessages(prev => prev.map(m => ids.includes(m.id) ? { ...m, is_read: true } : m));
    setSelectedIds(new Set());
    await markManyAsRead(ids);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    setMessages(prev => prev.filter(m => !ids.includes(m.id)));
    setSelectedIds(new Set());
    if (selectedMsg && ids.includes(selectedMsg.id)) setSelectedMsg(null);
    await deleteMany(ids);
  };

  const openPrefs = () => {
    setDraftMuted(mutedTypes);
    setPrefsOpen(true);
  };

  const toggleDraftType = (type: NotificationType) => {
    setDraftMuted(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    await updateNotificationPreferences(draftMuted);
    setMutedTypes(draftMuted);
    const fresh = await getNotifications();
    setMessages(fresh);
    setSelectedIds(new Set());
    setSavingPrefs(false);
    setPrefsOpen(false);
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

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden min-h-[600px] relative">

        {/* Search + Filter Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between bg-white">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul atau isi pesan..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">Semua Waktu</option>
              <option value="today">Hari Ini</option>
              <option value="7d">7 Hari Terakhir</option>
              <option value="30d">30 Hari Terakhir</option>
            </select>
            <button
              onClick={openPrefs}
              className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors"
              title="Pengaturan Notifikasi"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

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
          <div className="flex-1 flex flex-col overflow-hidden">
             {selectedIds.size > 0 ? (
               <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-primary/5">
                  <span className="text-sm font-bold text-primary">{selectedIds.size} pesan dipilih</span>
                  <div className="flex items-center gap-2">
                    <button onClick={handleBulkMarkRead} className="text-xs font-bold text-slate-600 hover:text-primary transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white">
                       <CheckCircle2 className="w-3.5 h-3.5" /> Tandai Dibaca
                    </button>
                    <button onClick={handleBulkDelete} className="text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white">
                       <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                    <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors px-3 py-1.5">
                       Batal
                    </button>
                  </div>
               </div>
             ) : (
               <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                  <button onClick={toggleSelectAllVisible} className="text-xs font-bold text-slate-500 hover:text-primary transition-colors flex items-center gap-1.5" disabled={visibleIds.length === 0}>
                    {allVisibleSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                    Menampilkan {filteredMessages.length} pesan
                  </button>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-1.5">
                       <CheckCircle2 className="w-4 h-4" /> Tandai semua dibaca
                    </button>
                  )}
               </div>
             )}

             <div className="overflow-y-auto flex-1">
                {groupedMessages.map((group) => (
                  <div key={group.label}>
                    <div className="sticky top-0 z-10 px-6 py-2 bg-slate-50/95 backdrop-blur-sm border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {group.label}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {group.items.map((msg) => {
                        const { Icon, color } = getIconAndColor(msg.type);
                        const checked = selectedIds.has(msg.id);
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
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleSelect(msg.id); }}
                                  className="shrink-0 mt-2 text-slate-300 hover:text-primary transition-colors"
                                >
                                  {checked ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                                </button>

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
                    </div>
                  </div>
                ))}

                {filteredMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-16 text-center">
                     <Inbox className="w-16 h-16 text-slate-200 mb-4" />
                     <h3 className="text-lg font-bold text-slate-600">Kotak Masuk Bersih</h3>
                     <p className="text-sm text-slate-400 mt-1 max-w-xs">
                       {search.trim() ? 'Tidak ada pesan yang cocok dengan pencarian.' : filter === 'Unread' ? 'Semua pesan sudah dibaca!' : 'Belum ada pemberitahuan untuk ditampilkan.'}
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

      {/* Notification Preferences Modal */}
      {prefsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-primary" /> Pengaturan Notifikasi
                </h3>
                <p className="text-xs text-slate-400 mt-1">Pilih jenis notifikasi yang ingin Anda tampilkan.</p>
              </div>
              <button onClick={() => setPrefsOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
              {(Object.keys(TYPE_META) as NotificationType[]).map(type => {
                const meta = TYPE_META[type];
                const Icon = meta.Icon;
                const muted = draftMuted.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleDraftType(type)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${muted ? 'border-slate-200 bg-slate-50' : 'border-primary/20 bg-primary/5'}`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 ${muted ? 'text-slate-400 bg-white border-slate-200' : meta.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${muted ? 'text-slate-500' : 'text-slate-800'}`}>{meta.label}</p>
                      <p className="text-xs text-slate-400 truncate">{meta.desc}</p>
                    </div>
                    <div className={`w-10 h-6 rounded-full shrink-0 relative transition-colors ${muted ? 'bg-slate-200' : 'bg-primary'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${muted ? 'translate-x-0.5' : 'translate-x-4'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setPrefsOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleSavePrefs}
                disabled={savingPrefs}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all text-sm disabled:opacity-60"
              >
                {savingPrefs ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
