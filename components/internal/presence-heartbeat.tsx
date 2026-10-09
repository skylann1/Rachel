'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { touchPresenceAction } from '@/app/actions/presence';

const HEARTBEAT_MS = 60_000;
// Tab dianggap masih hidup kalau heartbeat-nya tercatat dalam jendela ini
// (sedikit di atas HEARTBEAT_MS supaya tab yang sedang dithrottle browser
// tidak langsung dianggap mati).
const TAB_ALIVE_MS = 90_000;
const TABS_KEY = 'rachel-presence-tabs';

function readTabs(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(TABS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeTabs(tabs: Record<string, number>) {
  try {
    localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  } catch {
    // localStorage bisa tidak tersedia (mode privat); presence tetap jalan tanpa deteksi multi-tab.
  }
}

/**
 * Tanpa UI. Ping sekali tiap pindah halaman (supaya "sedang di" akurat) dan
 * lanjut tiap 60 detik selama tab terbuka. Dipasang di layout kedua realm
 * (/dashboard dan /vendor/dashboard) — tidak di halaman login/publik.
 *
 * Saat tab ditutup, kalau tidak ada tab lain milik user yang sama yang masih
 * hidup (dilacak lewat localStorage, dibagi antar tab satu browser), kirim
 * sinyal "keluar" supaya admin melihat user offline seketika, bukan 2 menit
 * kemudian. Kalau ada tab lain, tidak dikirim — kalau tidak, user yang masih
 * online di tab kedua tampil offline sampai heartbeat berikutnya.
 */
export function PresenceHeartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    const ping = () => {
      touchPresenceAction(pathname).catch(() => {});
    };
    ping();
    const id = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [pathname]);

  // Satu kali per tab: daftarkan diri, kembali aktif saat tab dibuka lagi, dan kirim "keluar".
  useEffect(() => {
    const tabId = Math.random().toString(36).slice(2);

    const beat = () => {
      const tabs = readTabs();
      tabs[tabId] = Date.now();
      writeTabs(tabs);
    };
    beat();
    const beatId = setInterval(beat, HEARTBEAT_MS / 2);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        beat();
        touchPresenceAction(window.location.pathname).catch(() => {});
      }
    };

    const onPageHide = () => {
      const tabs = readTabs();
      delete tabs[tabId];
      const now = Date.now();
      const othersAlive = Object.values(tabs).some(ts => now - ts < TAB_ALIVE_MS);
      writeTabs(tabs);
      if (!othersAlive) navigator.sendBeacon('/api/presence/leave');
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearInterval(beatId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  return null;
}
