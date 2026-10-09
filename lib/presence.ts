/**
 * Presence pengguna: heartbeat client menulis current_path + last_seen_at ke
 * user_presence tiap 60 detik (lihat components/internal/presence-heartbeat.tsx).
 * "Online" = terlihat dalam 2 menit terakhir.
 */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

/** Best-effort — gagal tulis presence tidak boleh mengganggu apa pun. */
export async function touchPresence(supabase: any, userId: string, path: string): Promise<void> {
  try {
    const { error } = await supabase.from('user_presence').upsert({
      user_id: userId,
      current_path: path,
      last_seen_at: new Date().toISOString(),
    });
    if (error) console.error('touchPresence gagal:', error.message);
  } catch (e) {
    console.error('touchPresence gagal:', e);
  }
}
