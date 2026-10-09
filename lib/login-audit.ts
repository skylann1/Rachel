/**
 * Audit login untuk activity_logs. Dipakai kedua login action (/auth/login dan
 * /vendor/login). Modul biasa, bukan "use server".
 *
 * Login gagal dan login ditolak ditulis dengan client service role: pada
 * kegagalan kredensial belum ada sesi, jadi INSERT lewat RLS
 * (actor_id = auth.uid()) mustahil — dan tabel ini sengaja tidak menerima
 * INSERT anonim supaya log tidak bisa dibanjiri/dipalsukan dari luar.
 */
import { createAdminClient } from '@/utils/supabase/admin';
import { logActivity } from '@/lib/activity-log';
import { getRequestMeta } from '@/lib/request-meta';

/** Kredensial salah — tidak ada sesi, pelaku diidentifikasi lewat email yang dicoba. */
export async function logFailedLogin(email: string, reason: string): Promise<void> {
  try {
    await logActivity(createAdminClient(), {
      actorId: null,
      action: 'Login gagal',
      entityType: 'auth',
      notes: email || '(email kosong)',
      metadata: { reason },
    });
  } catch (e) {
    console.error('logFailedLogin gagal:', e);
  }
}

/** Kredensial benar tapi akun bukan milik portal ini (mis. vendor mencoba /auth/login). */
export async function logRejectedLogin(actorId: string, email: string, reason: string): Promise<void> {
  try {
    await logActivity(createAdminClient(), {
      actorId,
      action: 'Login ditolak (portal salah)',
      entityType: 'auth',
      notes: email,
      metadata: { reason },
    });
  } catch (e) {
    console.error('logRejectedLogin gagal:', e);
  }
}

/**
 * Login berhasil. Ditandai `newDevice` kalau akun ini sudah pernah login
 * sebelumnya tapi belum pernah dari user agent yang sama — login pertama
 * sepanjang masa tidak ditandai (itu bukan anomali). IP sengaja tidak ikut
 * dibandingkan karena berubah-ubah di jaringan seluler.
 */
export async function logSuccessfulLogin(sessionClient: any, userId: string): Promise<void> {
  let newDevice = false;
  try {
    const { userAgent } = await getRequestMeta();
    const admin = createAdminClient();
    const { count: totalPrior } = await admin
      .from('activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq('actor_id', userId)
      .eq('action', 'Login');
    if ((totalPrior ?? 0) > 0 && userAgent) {
      const { count: samePrior } = await admin
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('actor_id', userId)
        .eq('action', 'Login')
        .eq('user_agent', userAgent);
      newDevice = (samePrior ?? 0) === 0;
    }
  } catch (e) {
    console.error('deteksi perangkat baru gagal:', e);
  }

  await logActivity(sessionClient, {
    actorId: userId,
    action: 'Login',
    entityType: 'auth',
    metadata: newDevice ? { newDevice: true } : null,
  });
}
