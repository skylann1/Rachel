'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { hasPermissionForUser } from '@/utils/permissions';
import type { CommunicationLogData, EmailLogRow, NotificationLogRow } from './types';

const LIMIT = 200;

/**
 * Log email (email_logs) dan notifikasi in-app (notifications) terbaru.
 * Lintas pengguna, jadi dibaca lewat service role SETELAH gerbang izin
 * activityLog.view (server action bisa dipanggil langsung).
 */
export async function getCommunicationLog(): Promise<CommunicationLogData> {
  const empty: CommunicationLogData = {
    emailConfigured: !!process.env.RESEND_API_KEY,
    emailTableReady: true,
    emails: [],
    emailCounts: { sent: 0, failed: 0, skipped: 0 },
    notifications: [],
    notificationCounts: { total: 0, unread: 0 },
  };

  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return empty;
  if (!(await hasPermissionForUser(userClient, user.id, 'activityLog', 'view'))) return empty;

  const admin = createAdminClient();

  const [emailRes, notifRes, notifTotal, notifUnread] = await Promise.all([
    admin.from('email_logs').select('id, created_at, to_email, subject, status, error')
      .order('created_at', { ascending: false }).limit(LIMIT),
    admin.from('notifications')
      .select('id, created_at, type, title, message, link, is_read, profiles:user_id ( full_name, email, type )')
      .order('created_at', { ascending: false }).limit(LIMIT),
    admin.from('notifications').select('id', { count: 'exact', head: true }),
    admin.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
  ]);

  // Tabel belum dimigrasikan → kode Postgres 42P01 / pesan "does not exist".
  const emailTableReady = !emailRes.error;

  const emails: EmailLogRow[] = ((emailRes.data || []) as any[]).map(r => ({
    id: r.id, createdAt: r.created_at, to: r.to_email, subject: r.subject, status: r.status, error: r.error ?? null,
  }));

  const emailCounts = { sent: 0, failed: 0, skipped: 0 };
  if (emailTableReady) {
    const counts = await Promise.all((['sent', 'failed', 'skipped'] as const).map(async s => {
      const { count } = await admin.from('email_logs').select('id', { count: 'exact', head: true }).eq('status', s);
      return [s, count ?? 0] as const;
    }));
    counts.forEach(([s, n]) => { emailCounts[s] = n; });
  }

  const notifications: NotificationLogRow[] = ((notifRes.data || []) as any[]).map(r => {
    const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id, createdAt: r.created_at, type: r.type, title: r.title, message: r.message,
      link: r.link ?? null, isRead: !!r.is_read,
      recipientName: prof?.full_name ?? null, recipientEmail: prof?.email ?? null, recipientType: prof?.type ?? null,
    };
  });

  return {
    emailConfigured: !!process.env.RESEND_API_KEY,
    emailTableReady,
    emails,
    emailCounts,
    notifications,
    notificationCounts: { total: notifTotal.count ?? 0, unread: notifUnread.count ?? 0 },
  };
}
