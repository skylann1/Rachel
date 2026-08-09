"use server";

import { createClient } from "@/utils/supabase/server";

// =====================================================================
// NOTIFICATION TYPES
// =====================================================================
export type NotificationType = 'approval' | 'action_required' | 'warning' | 'system' | 'info';

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// =====================================================================
// FETCH
// =====================================================================
export async function getNotifications(): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const mutedTypes = await getNotificationPreferences();

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(150);

  if (mutedTypes.length > 0) {
    query = query.not('type', 'in', `(${mutedTypes.join(',')})`);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("Notifications fetch error:", error.message);
    return [];
  }

  return (data || []) as NotificationItem[];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const mutedTypes = await getNotificationPreferences();

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (mutedTypes.length > 0) {
    query = query.not('type', 'in', `(${mutedTypes.join(',')})`);
  }

  const { count, error } = await query;

  if (error) return 0;
  return count || 0;
}

// =====================================================================
// PREFERENCES
// =====================================================================
export async function getNotificationPreferences(): Promise<NotificationType[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('muted_types')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return [];
  return (data.muted_types || []) as NotificationType[];
}

export async function updateNotificationPreferences(mutedTypes: NotificationType[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('notification_preferences')
    .upsert({ user_id: user.id, muted_types: mutedTypes, updated_at: new Date().toISOString() });
}

// =====================================================================
// MUTATIONS
// =====================================================================
export async function markNotificationAsRead(notificationId: string) {
  const supabase = await createClient();
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
}

export async function markAllNotificationsAsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);
}

export async function deleteNotification(notificationId: string) {
  const supabase = await createClient();
  await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);
}

export async function markManyAsRead(notificationIds: string[]) {
  if (notificationIds.length === 0) return;
  const supabase = await createClient();
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .in('id', notificationIds);
}

export async function deleteMany(notificationIds: string[]) {
  if (notificationIds.length === 0) return;
  const supabase = await createClient();
  await supabase
    .from('notifications')
    .delete()
    .in('id', notificationIds);
}

// =====================================================================
// CREATE NOTIFICATION (called from other server actions)
// =====================================================================
export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  const supabase = await createClient();
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    link: link || null,
  });
}

/**
 * Send notification to ALL users with a specific role.
 * Used for broadcast notifications (e.g., "New PTW needs approval" → all PM users).
 *
 * Admin selalu ikut disertakan — admin bisa approve/lihat semua tahap
 * (lihat requireRole di app/dashboard/approval/actions.ts dan bypass 'admin'
 * di getMyTasks), jadi admin juga harus tahu setiap tugas yang di-broadcast
 * ke role lain, bukan cuma role target-nya.
 */
export async function notifyUsersByRole({
  role,
  type,
  title,
  message,
  link,
}: {
  role: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  const supabase = await createClient();

  // Get all users with this role, plus all admins
  const targetRoles = role === 'admin' ? [role] : [role, 'admin'];
  const { data: users } = await supabase
    .from('profiles')
    .select('id')
    .in('role', targetRoles);

  if (!users || users.length === 0) return;

  // Batch insert notifications
  const notifications = users.map(u => ({
    user_id: u.id,
    type,
    title,
    message,
    link: link || null,
  }));

  await supabase.from('notifications').insert(notifications);
}
