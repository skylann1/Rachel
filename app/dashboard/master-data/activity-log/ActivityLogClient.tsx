'use client';

import React, { useCallback, useState } from 'react';
import { Activity, Users } from 'lucide-react';
import type { OnlineUser, FeedPage, SecurityAlert } from './types';
import OnlineUsersTab from './OnlineUsersTab';
import ActivityFeedTab from './ActivityFeedTab';
import SecurityAlerts from './SecurityAlerts';
import UserDetailDrawer from './UserDetailDrawer';

/**
 * Kerangka halaman: peringatan keamanan di atas, dua tab di bawahnya, dan
 * drawer detail user yang bisa dibuka dari keduanya. Kedua tab tetap ter-mount
 * (disembunyikan dengan CSS saat tidak aktif) supaya langganan Realtime tab
 * Online terus berjalan — badge jumlah online tetap hidup — dan filter di tab
 * Riwayat tidak hilang tiap pindah tab.
 */
export default function ActivityLogClient({
  initialOnlineUsers, initialFeed, initialAlerts,
}: {
  initialOnlineUsers: OnlineUser[];
  initialFeed: FeedPage;
  initialAlerts: SecurityAlert[];
}) {
  const [tab, setTab] = useState<'online' | 'riwayat'>('online');
  const [onlineCount, setOnlineCount] = useState(initialOnlineUsers.length);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const closeDrawer = useCallback(() => setSelectedUser(null), []);

  const tabs = [
    { id: 'online' as const, label: 'Pengguna Online', icon: Users, count: onlineCount },
    { id: 'riwayat' as const, label: 'Riwayat Aktivitas', icon: Activity, count: null },
  ];

  return (
    <div className="space-y-6">
      <SecurityAlerts initialAlerts={initialAlerts} />

      <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm w-full sm:w-fit">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-3 sm:px-4 text-sm font-bold rounded-lg transition-all ${
                tab === t.id ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
              {t.count !== null && (
                <span className={`text-[10px] font-black rounded-full min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center ${
                  tab === t.id ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'
                }`}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className={tab === 'online' ? '' : 'hidden'}>
        <OnlineUsersTab initialUsers={initialOnlineUsers} onSelectUser={setSelectedUser} onCountChange={setOnlineCount} />
      </div>
      <div className={tab === 'riwayat' ? '' : 'hidden'}>
        <ActivityFeedTab initialPage={initialFeed} onSelectUser={setSelectedUser} />
      </div>

      <UserDetailDrawer userId={selectedUser} onClose={closeDrawer} />
    </div>
  );
}
