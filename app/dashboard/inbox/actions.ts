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
// Kepemilikan disaring eksplisit di setiap mutasi berikut, tidak hanya
// mengandalkan RLS notifications: satu policy yang salah konfigurasi
// (atau penggantian ke admin client di kemudian hari) akan langsung
// membuat id notifikasi milik orang lain bisa dibaca/dihapus.
export async function markNotificationAsRead(notificationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id);
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', user.id);
}

export async function markManyAsRead(notificationIds: string[]) {
  if (notificationIds.length === 0) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .in('id', notificationIds)
    .eq('user_id', user.id);
}

export async function deleteMany(notificationIds: string[]) {
  if (notificationIds.length === 0) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('notifications')
    .delete()
    .in('id', notificationIds)
    .eq('user_id', user.id);
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
 * Kirim notifikasi ke SELURUH anggota satu organisasi.
 *
 * Dipakai untuk kolom yang menyimpan id ORGANISASI vendor, bukan id user —
 * mis. `inspections.target_vendor`, yang menunjuk `vendor_profiles(id)` =
 * `organizations(id)` sejak schema_org_backfill_vendor.sql. Memasukkan id
 * organisasi ke `notifications.user_id` (FK ke `profiles(id)`) akan gagal
 * atau menghasilkan notifikasi yang tidak pernah dibaca siapa pun, karena
 * satu company vendor sekarang bisa punya banyak staff.
 */
export async function notifyOrgMembers({
  orgId,
  type,
  title,
  message,
  link,
}: {
  orgId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  const supabase = await createClient();

  const { data: members } = await supabase
    .from('profiles')
    .select('id')
    .eq('org_id', orgId);

  if (!members || members.length === 0) return;

  await supabase.from('notifications').insert(
    members.map(m => ({
      user_id: m.id,
      type,
      title,
      message,
      link: link || null,
    }))
  );
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

/**
 * Send notification to ALL users whose role carries a specific permission
 * (module + action pada roles.permissions), bukan nama role yang di-hardcode.
 * Dipakai untuk tahap approval Prosedur/JSA/PTW: siapa pun yang admin kasih
 * permission itu lewat halaman Role & Permission otomatis kebagian notifikasi,
 * tanpa perlu ubah kode.
 */
export async function notifyUsersByPermission({
  module,
  action,
  type,
  title,
  message,
  link,
}: {
  module: string;
  action: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  const supabase = await createClient();

  const { data: roles } = await supabase.from('roles').select('name, permissions');
  const targetRoleNames = (roles || [])
    .filter((r: any) => Array.isArray(r.permissions?.[module]) && r.permissions[module].includes(action))
    .map((r: any) => r.name as string);

  // Admin selalu ikut disertakan, sama seperti notifyUsersByRole.
  const targetRoles = targetRoleNames.includes('admin') ? targetRoleNames : [...targetRoleNames, 'admin'];

  const { data: users } = await supabase
    .from('profiles')
    .select('id')
    .in('role', targetRoles);

  if (!users || users.length === 0) return;

  const notifications = users.map(u => ({
    user_id: u.id,
    type,
    title,
    message,
    link: link || null,
  }));

  await supabase.from('notifications').insert(notifications);
}

/**
 * Send notification to all users assigned to a specific stage of a document in a project.
 * Only notifies assignees with status 'pending' (not yet decided).
 */
export async function notifyAssignees({
  projectId,
  docType,
  stageKey,
  type,
  title,
  message,
  link,
}: {
  projectId: string;
  docType: string;
  stageKey: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  const supabase = await createClient();

  const { data: assignees } = await supabase
    .from('stage_assignments')
    .select('assignee_id')
    .eq('project_id', projectId)
    .eq('doc_type', docType)
    .eq('stage_key', stageKey)
    .eq('status', 'pending');

  if (!assignees || assignees.length === 0) return;

  await supabase.from('notifications').insert(
    assignees.map(a => ({
      user_id: a.assignee_id,
      type,
      title,
      message,
      link: link || null,
    }))
  );
}
