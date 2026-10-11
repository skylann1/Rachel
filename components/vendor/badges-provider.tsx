"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getVendorSidebarBadges, type VendorSidebarBadges } from "@/app/vendor/dashboard/sidebar-badges";
import { useNotificationsRealtime } from "@/hooks/useNotificationsRealtime";

// Realtime (notifikasi masuk) jadi pemicu utama; polling hanya cadangan kalau socket putus.
const POLL_MS = 60_000;
const EMPTY: VendorSidebarBadges = { myTask: 0, projects: 0 };

const BadgesContext = createContext<VendorSidebarBadges>(EMPTY);

export function useVendorBadges() {
  return useContext(BadgesContext);
}

/**
 * Satu sumber angka badge untuk sidebar desktop & mobile. Nilai awal dari
 * server (layout), lalu dihitung ulang: seketika saat notifikasi baru masuk
 * (Supabase Realtime), saat pindah halaman, saat tab kembali fokus, dan tiap
 * 60 detik sebagai cadangan.
 */
export function VendorBadgesProvider({
  initial,
  userId,
  children,
}: {
  initial: VendorSidebarBadges;
  userId?: string;
  children: React.ReactNode;
}) {
  const [badges, setBadges] = useState(initial);
  const pathname = usePathname();
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const next = await getVendorSidebarBadges();
      setBadges(prev =>
        prev.myTask === next.myTask && prev.projects === next.projects ? prev : next,
      );
    } catch {
      // jaringan putus / sesi habis — pertahankan angka terakhir
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Tugas/penugasan baru selalu disertai notifikasi -> hitung ulang segera.
  // Digabung 400ms supaya beberapa notifikasi beruntun jadi satu query.
  const debounce = useRef<number | undefined>(undefined);
  useNotificationsRealtime(userId, () => {
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => void refresh(), 400);
  });
  useEffect(() => () => window.clearTimeout(debounce.current), []);

  // Pindah halaman: aksi seperti submit/approve biasanya mengubah angka.
  useEffect(() => {
    const t = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(t);
  }, [pathname, refresh]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [refresh]);

  return <BadgesContext.Provider value={badges}>{children}</BadgesContext.Provider>;
}
