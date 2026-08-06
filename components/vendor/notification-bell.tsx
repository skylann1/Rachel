"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bell, CheckCircle2, AlertTriangle, ShieldCheck, FileSignature, Clock } from "lucide-react";
import { getNotifications, markNotificationAsRead, NotificationItem, NotificationType } from "@/app/dashboard/inbox/actions";
import { useNotificationsRealtime } from "@/hooks/useNotificationsRealtime";

const ICONS: Record<string, { Icon: React.ElementType; cls: string }> = {
  approval: { Icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50' },
  action_required: { Icon: FileSignature, cls: 'text-amber-600 bg-amber-50' },
  warning: { Icon: AlertTriangle, cls: 'text-rose-600 bg-rose-50' },
  info: { Icon: Bell, cls: 'text-sky-600 bg-sky-50' },
  system: { Icon: ShieldCheck, cls: 'text-indigo-600 bg-indigo-50' },
};

function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Baru saja';
  if (min < 60) return `${min}m lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}j lalu`;
  const day = Math.floor(hr / 24);
  return `${day}h lalu`;
}

interface VendorNotificationBellProps {
  initialUnread: number;
  userId?: string;
  mutedTypes?: NotificationType[];
}

export function VendorNotificationBell({ initialUnread, userId, mutedTypes = [] }: VendorNotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const [pulse, setPulse] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleInsert = useCallback((item: NotificationItem) => {
    if (mutedTypes.includes(item.type)) return;
    setItems(prev => prev ? [item, ...prev] : [item]);
    setUnread(u => u + 1);
    setPulse(true);
    setTimeout(() => setPulse(false), 2000);
  }, [mutedTypes]);

  useNotificationsRealtime(userId, handleInsert);

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && items === null) {
      const data = await getNotifications();
      setItems(data);
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      setItems(prev => prev ? prev.map(i => i.id === item.id ? { ...i, is_read: true } : i) : prev);
      setUnread(u => Math.max(0, u - 1));
      await markNotificationAsRead(item.id);
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className={`relative p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors ${pulse ? 'animate-pulse' : ''}`}
        aria-label="Notifikasi"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 rounded-full border-2 border-white text-[9px] font-black text-white px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-800">Notifikasi</span>
            <Link href="/vendor/dashboard/inbox" onClick={() => setOpen(false)} className="text-xs font-bold text-primary hover:text-primary/80">
              Lihat Semua
            </Link>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {items === null ? (
              <div className="p-6 text-center text-sm text-slate-400">Memuat...</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Belum ada notifikasi.</p>
              </div>
            ) : (
              items.slice(0, 8).map(item => {
                const meta = ICONS[item.type] ?? ICONS.info;
                const Icon = meta.Icon;
                const body = (
                  <div className={`flex gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${!item.is_read ? 'bg-blue-50/40' : ''}`}>
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${meta.cls}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs truncate ${!item.is_read ? 'font-bold text-slate-800' : 'font-semibold text-slate-600'}`}>{item.title}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{item.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />{timeAgo(item.created_at)}
                      </p>
                    </div>
                    {!item.is_read && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
                  </div>
                );
                return item.link ? (
                  <Link key={item.id} href={item.link} onClick={() => handleItemClick(item)}>{body}</Link>
                ) : (
                  <div key={item.id} onClick={() => handleItemClick(item)}>{body}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
