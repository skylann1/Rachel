"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getVendorSidebarBadges, type VendorSidebarBadges } from "@/app/vendor/dashboard/sidebar-badges";

const POLL_MS = 30_000;
const EMPTY: VendorSidebarBadges = { myTask: 0, projects: 0 };

const BadgesContext = createContext<VendorSidebarBadges>(EMPTY);

export function useVendorBadges() {
  return useContext(BadgesContext);
}

/**
 * Satu sumber angka badge untuk sidebar desktop & mobile. Nilai awal dari
 * server (layout), lalu dihitung ulang: tiap 30 detik, saat pindah halaman,
 * dan saat tab kembali fokus — jadi tidak perlu refresh manual.
 */
export function VendorBadgesProvider({
  initial,
  children,
}: {
  initial: VendorSidebarBadges;
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
