/**
 * Presence pengguna: heartbeat client menulis current_path + last_seen_at ke
 * user_presence tiap 60 detik (lihat components/internal/presence-heartbeat.tsx).
 * "Online" = terlihat dalam 2 menit terakhir.
 *
 * Selain status terkini, tiap kunjungan halaman dicatat di presence_history
 * (sumber timeline di drawer detail user): heartbeat berikutnya di halaman
 * yang sama memperpanjang baris yang ada; pindah halaman, atau jeda lebih dari
 * 3 menit, membuka baris baru.
 */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const SAME_VISIT_WINDOW_MS = 3 * 60 * 1000;
const HISTORY_RETENTION_DAYS = 30;

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

async function recordPresenceVisit(supabase: any, userId: string, path: string, nowIso: string): Promise<void> {
  const { data: last } = await supabase
    .from('presence_history')
    .select('id, path, last_seen_at')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const continuing =
    last &&
    last.path === path &&
    Date.now() - new Date(last.last_seen_at).getTime() < SAME_VISIT_WINDOW_MS;

  if (continuing) {
    await supabase.from('presence_history').update({ last_seen_at: nowIso }).eq('id', last.id);
    return;
  }

  await supabase.from('presence_history').insert({
    user_id: userId, path, entered_at: nowIso, last_seen_at: nowIso,
  });
  // Pangkas riwayat lama hanya saat membuka baris baru — cukup jarang, murah
  // (indeks user_id + entered_at), dan tidak butuh cron.
  const cutoff = new Date(Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('presence_history').delete().eq('user_id', userId).lt('entered_at', cutoff);
}

/** Best-effort — gagal tulis presence tidak boleh mengganggu apa pun. */
export async function touchPresence(supabase: any, userId: string, path: string): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from('user_presence').upsert({
      user_id: userId,
      current_path: path,
      last_seen_at: nowIso,
    });
    if (error) console.error('touchPresence gagal:', error.message);
    await recordPresenceVisit(supabase, userId, path, nowIso);
  } catch (e) {
    console.error('touchPresence gagal:', e);
  }
}

/**
 * Tandai user offline seketika (tab terakhir ditutup). last_seen_at digeser ke
 * belakang melewati jendela online, jadi isOnline() langsung false dan event
 * UPDATE-nya sampai ke tab Pengguna Online lewat Realtime.
 */
export async function markOffline(supabase: any, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_presence')
      .update({ last_seen_at: new Date(Date.now() - ONLINE_WINDOW_MS * 2).toISOString() })
      .eq('user_id', userId);
    if (error) console.error('markOffline gagal:', error.message);
  } catch (e) {
    console.error('markOffline gagal:', e);
  }
}
