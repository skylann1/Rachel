/**
 * Helper tulis untuk activity_logs (lihat supabase/schema_activity_log.sql dan
 * schema_activity_log_advanced.sql) — jejak aksi di luar approval dokumen K3:
 * login/logout dan CRUD Master Data. Approval Prosedur/JSA/PTW tetap ditulis
 * lewat lib/document-logs.ts.
 *
 * Disimpan di modul biasa, bukan di dalam file "use server": export tipe di
 * file "use server" ikut jadi re-export runtime di Turbopack dan bikin crash
 * (lihat catatan yang sama di lib/document-logs.ts).
 *
 * Gagal menulis log TIDAK boleh menggagalkan aksi yang sedang dicatat, jadi
 * semua error ditelan di sini — pemanggil tidak perlu try/catch sendiri.
 *
 * IP dan user agent diambil otomatis dari request yang sedang berjalan.
 * RLS mensyaratkan actor_id = auth.uid(), jadi `supabase` harus client sesi
 * pelaku. Satu-satunya pengecualian adalah event tanpa sesi (login gagal):
 * pemanggil meneruskan client service role (createAdminClient), yang
 * melewati RLS.
 */
import { getRequestMeta } from '@/lib/request-meta';
import { compactMetadata, type ActivityMetadata } from '@/lib/activity-diff';

export type ActivityEntityType =
  | 'auth'
  | 'vendor'
  | 'account'
  | 'role'
  | 'project'
  | 'announcement'
  | 'pgsol_assignment';

export async function logActivity(supabase: any, params: {
  actorId?: string | null;
  action: string;
  entityType: ActivityEntityType;
  entityId?: string | null;
  notes?: string | null;
  metadata?: ActivityMetadata | null;
}): Promise<void> {
  try {
    const { ip, userAgent } = await getRequestMeta();
    const { error } = await supabase.from('activity_logs').insert({
      actor_id: params.actorId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      notes: params.notes ?? null,
      ip_address: ip,
      user_agent: userAgent,
      metadata: compactMetadata(params.metadata),
    });
    if (error) console.error('logActivity gagal:', error.message);
  } catch (e) {
    console.error('logActivity gagal:', e);
  }
}
