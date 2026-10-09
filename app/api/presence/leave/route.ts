import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { markOffline } from '@/lib/presence';

/**
 * Dipanggil navigator.sendBeacon dari PresenceHeartbeat saat tab TERAKHIR
 * pengguna ditutup. Sesi diambil dari cookie (same-origin), bukan dari body.
 * Selalu 204 — beacon tidak membaca respons, dan tidak ada gunanya membocorkan
 * apakah sesi valid.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await markOffline(supabase, user.id);
  return new NextResponse(null, { status: 204 });
}
