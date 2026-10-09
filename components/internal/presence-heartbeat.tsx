'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { touchPresenceAction } from '@/app/actions/presence';

const HEARTBEAT_MS = 60_000;

/**
 * Tanpa UI. Ping sekali tiap pindah halaman (supaya "sedang di" akurat) dan
 * lanjut tiap 60 detik selama tab terbuka. Dipasang di layout kedua realm
 * (/dashboard dan /vendor/dashboard) — tidak di halaman login/publik.
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

  return null;
}
