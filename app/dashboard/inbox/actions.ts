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

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

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

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) return 0;
  return count || 0;
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

  // Get all users with this role
  const { data: users } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', role);

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
