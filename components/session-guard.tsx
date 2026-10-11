// components/session-guard.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LogOut, MonitorSmartphone } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { ModalPortal } from '@/components/ui/modal-portal';

/** Cadangan kalau sinyal realtime terlewat (tab tertidur, koneksi putus sebentar). */
const POLL_MS = 20_000;

type Reason = 'other-device' | 'ended';

/** Channel yang di-broadcast server saat akun ini login di tempat lain (lihat lib/session-kick.ts). */
export const sessionGuardChannel = (userId: string) => `session-guard:${userId}`;

/**
 * Menjaga aturan "satu akun, satu sesi". Server mengirim broadcast 'kicked'
 * begitu akun login di device lain; di sini sinyal itu memicu validasi sesi ke
 * server — broadcast SENDIRI tidak dipercaya, jadi sinyal palsu tidak bisa
 * mengeluarkan siapa pun. Polling berkala + saat tab kembali aktif menjadi
 * jaring pengaman. Begitu sesi terbukti sudah dicabut, halaman diblokir dengan
 * pesan dan user diarahkan ke login — tanpa perlu klik apa pun lebih dulu.
 */
export function SessionGuard({ userId, loginUrl }: { userId: string; loginUrl: string }) {
  const [reason, setReason] = useState<Reason | null>(null);
  const done = useRef(false);

  const validate = useCallback(async (hint: Reason) => {
    if (done.current) return;
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    // Hanya penolakan eksplisit dari server yang dianggap sesi berakhir.
    // Error jaringan (offline, 5xx) diabaikan supaya tidak salah menendang.
    const rejected = !!error && (
      error.name === 'AuthSessionMissingError' || error.status === 401 || error.status === 403
    );
    if (rejected || (!error && !data.user)) {
      done.current = true;
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      setReason(hint);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(sessionGuardChannel(userId))
      .on('broadcast', { event: 'kicked' }, () => { validate('other-device'); })
      .subscribe();

    const poll = setInterval(() => { validate('ended'); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') validate('ended'); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      supabase.removeChannel(channel);
    };
  }, [userId, validate]);

  if (!reason) return null;

  const otherDevice = reason === 'other-device';
  return (
    <ModalPortal zIndex={500} blocking>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="h-1.5 bg-gradient-to-r from-amber-500 to-orange-400" />
        <div className="p-7 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-8 ring-amber-50/70">
            {otherDevice ? <MonitorSmartphone className="h-7 w-7" /> : <LogOut className="h-7 w-7" />}
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">
            {otherDevice ? 'Akun Anda Login di Perangkat Lain' : 'Sesi Anda Telah Berakhir'}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {otherDevice
              ? 'Satu akun hanya bisa aktif di satu perangkat. Sesi di perangkat ini diakhiri karena akun yang sama baru saja masuk di perangkat atau browser lain.'
              : 'Sesi login Anda sudah tidak berlaku — mungkin Anda sudah keluar atau masuk dari perangkat lain. Silakan login kembali.'}
          </p>
          <button
            onClick={() => window.location.assign(loginUrl)}
            className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary"
          >
            Login Kembali
          </button>
          {otherDevice && (
            <p className="mt-3 text-xs text-slate-400">
              Bukan Anda yang masuk? Segera ganti password akun ini.
            </p>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
