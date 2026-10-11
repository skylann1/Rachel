// lib/session-kick.ts
//
// Aturan "satu akun, satu sesi": setelah login baru mencabut sesi lain, kabari
// device lama LEWAT Realtime broadcast supaya dia langsung keluar tanpa perlu
// aksi apa pun (lihat components/session-guard.tsx). Pengirim memakai REST
// (httpSend) — server tidak perlu menyimpan koneksi WebSocket.
//
// Bukan Server Action — dipanggil dari dalam file yang sudah "use server".

import { createAdminClient } from '@/utils/supabase/admin';

export async function broadcastSessionKick(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.channel(`session-guard:${userId}`).httpSend('kicked', { at: Date.now() });
  } catch (err) {
    // Gagal broadcast tidak boleh menggagalkan login; polling di SessionGuard jadi cadangan.
    console.error('broadcastSessionKick error:', err);
  }
}
