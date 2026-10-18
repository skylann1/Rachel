"use client";

import { useCallback, useEffect, useState } from "react";
import { BellOff, BellRing, Loader2 } from "lucide-react";
import {
  isMyPushSubscription,
  removePushSubscription,
  savePushSubscription,
} from "@/app/dashboard/inbox/push-actions";

// Baris pengaktifan notifikasi perangkat (Web Push) untuk dropdown lonceng.
//
// Kenapa begini:
//   - Izin notifikasi hanya boleh diminta dari gesture pengguna, jadi tombol
//     ini eksplisit — bukan otomatis saat halaman dibuka.
//   - Service worker didaftarkan hanya di produksi (lihat
//     components/pwa/service-worker-register.tsx), jadi di dev baris ini
//     disembunyikan dan aktivasi dilakukan saat "register" on-demand.
//   - iPhone: iOS hanya mendukung Web Push untuk PWA yang sudah dipasang ke
//     Layar Utama, jadi di Safari biasa kami tampilkan petunjuk pasang dulu.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type PushState =
  | "loading"
  | "hidden"
  | "needs-install"
  | "blocked"
  | "off"
  | "on"
  | "busy";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

function isIosNonStandalone(): boolean {
  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isIos && !standalone;
}

export function PushNotificationToggle() {
  const [state, setState] = useState<PushState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const readState = async (): Promise<PushState> => {
      if (process.env.NODE_ENV !== "production") return "hidden";
      if (!VAPID_PUBLIC_KEY) return "hidden";
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        return "hidden";
      }
      if (isIosNonStandalone()) return "needs-install";
      if (Notification.permission === "denied") return "blocked";

      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) return "off";
        // Subscription browser ini bisa saja peninggalan akun lain yang
        // login di perangkat yang sama — "Aktif" hanya kalau tercatat milik
        // akun yang sedang login sekarang.
        const mine = await isMyPushSubscription(subscription.endpoint);
        return mine ? "on" : "off";
      } catch {
        return "off";
      }
    };

    // Dilewatkan lewat .then() supaya tidak ada setState sinkron di dalam
    // effect (react-hooks/set-state-in-effect), sambil tetap dijaga flag active.
    void readState().then((next) => {
      if (active) setState(next);
    });

    return () => {
      active = false;
    };
  }, []);

  const enable = useCallback(async () => {
    setError(null);
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }

      // register() aman dipanggil ulang (idempoten). Ini juga menutupi kasus
      // auto-register di layout belum sempat jalan.
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string),
      });

      const json = subscription.toJSON();
      const result = await savePushSubscription(
        {
          endpoint: json.endpoint as string,
          keys: json.keys as { p256dh: string; auth: string },
        },
        navigator.userAgent,
      );

      if (result?.error) {
        await subscription.unsubscribe().catch(() => undefined);
        setError("Gagal menyimpan langganan. Coba lagi.");
        setState("off");
        return;
      }
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengaktifkan notifikasi.");
      setState("off");
    }
  }, []);

  const disable = useCallback(async () => {
    setError(null);
    setState("busy");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      const endpoint = subscription?.endpoint;
      await subscription?.unsubscribe();
      if (endpoint) await removePushSubscription(endpoint);
      setState("off");
    } catch {
      setState("on");
    }
  }, []);

  if (state === "loading" || state === "hidden") return null;

  const active = state === "on";
  const message =
    state === "needs-install"
      ? "Buka menu Bagikan lalu \"Tambahkan ke Layar Utama\" dulu untuk mengaktifkan notifikasi di iPhone."
      : state === "blocked"
        ? "Izin notifikasi diblokir di browser ini. Buka setelan situs untuk mengizinkan."
        : active
          ? "Aktif — Anda akan menerima notifikasi di perangkat ini."
          : "Terima notifikasi seperti WhatsApp, bahkan saat aplikasi ditutup.";

  return (
    <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            active ? "bg-emerald-50 text-emerald-600" : "bg-primary/10 text-primary"
          }`}
        >
          {active ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-700">Notifikasi perangkat</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{message}</p>
          {error && <p className="mt-1 text-[11px] text-rose-500">{error}</p>}
        </div>
        {state !== "needs-install" && state !== "blocked" && (
          <button
            type="button"
            onClick={active ? disable : enable}
            disabled={state === "busy"}
            className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-60 ${
              active
                ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                : "bg-primary text-white hover:opacity-90"
            }`}
          >
            {state === "busy" && <Loader2 className="h-3 w-3 animate-spin" />}
            {active ? "Nonaktifkan" : "Aktifkan"}
          </button>
        )}
      </div>
    </div>
  );
}
