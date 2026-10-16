"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
}

const DISMISS_KEY = "rachel-k3:install-dismissed";

function isStandalone() {
  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function isIosSafari() {
  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  return isIos && isSafari;
}

// Floating "install app" affordance. Only appears when the browser says the app
// is installable (Chromium) or when the user is on iOS Safari, which never fires
// beforeinstallprompt and needs manual "Add to Home Screen" instructions.
export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (isStandalone()) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      setShowIosHint(false);
      localStorage.setItem(DISMISS_KEY, "1");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari never fires beforeinstallprompt. Detected after hydration (the
    // browser APIs are unavailable during SSR), hence the deferred callback.
    const raf = window.requestAnimationFrame(() => {
      if (isIosSafari()) setShowIosHint(true);
    });

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDeferredPrompt(null);
    setShowIosHint(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const visible = Boolean(deferredPrompt) || showIosHint;
  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-xs">
      <div className="relative rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Tutup"
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {showIosHint ? <Share className="h-5 w-5" /> : <Download className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Pasang RACHEL K3</p>
            {showIosHint ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Buka menu <Share className="inline h-3 w-3" /> <b>Bagikan</b> lalu pilih{" "}
                <b>Tambahkan ke Layar Utama</b> untuk memakai aplikasi ini seperti app
                mobile.
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pasang aplikasi ini di perangkat Anda untuk akses lebih cepat.
                </p>
                <button
                  type="button"
                  onClick={install}
                  className="mt-2 inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Pasang sekarang
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
