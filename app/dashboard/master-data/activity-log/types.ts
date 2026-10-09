import type { ActivityMetadata } from '@/lib/activity-diff';

/**
 * Tipe bersama server action dan komponen client halaman Log Aktivitas.
 * Dipisah dari actions.ts karena file "use server" hanya boleh mengekspor
 * fungsi async.
 */

export interface OnlineUser {
  userId: string;
  fullName: string | null;
  type: string | null;
  role: string | null;
  jabatan: string | null;
  currentPath: string | null;
  lastSeenAt: string;
}

export interface ActivityFeedRow {
  id: string;
  createdAt: string;
  action: string;
  notes: string | null;
  kind: 'activity' | 'document';
  /** entity_type (activity_logs) atau doc_type (document_logs). */
  category: string;
  actorId: string | null;
  actorName: string | null;
  actorJabatan: string | null;
  actorType: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: ActivityMetadata | null;
}

export interface FeedFilters {
  search?: string;
  category?: string;
  kind?: 'all' | 'activity' | 'document';
  /** YYYY-MM-DD, zona waktu Asia/Jakarta. */
  from?: string;
  to?: string;
  actorId?: string;
}

export interface FeedPage {
  rows: ActivityFeedRow[];
  hasMore: boolean;
}

export type AlertSeverity = 'high' | 'medium' | 'info';

export interface SecurityAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  /** Waktu kejadian terbaru yang membentuk peringatan ini. */
  at: string;
}

export interface UserSession {
  start: string;
  end: string;
  minutes: number;
  pages: number;
}

export interface UserDetail {
  userId: string;
  fullName: string | null;
  type: string | null;
  role: string | null;
  jabatan: string | null;
  online: boolean;
  lastSeenAt: string | null;
  currentPath: string | null;
  loginCount30d: number;
  logins: Array<{ at: string; ip: string | null; userAgent: string | null; newDevice: boolean }>;
  sessions: UserSession[];
  /** Waktu di tiap modul, 7 hari terakhir, terbesar dulu. */
  moduleTime: Array<{ label: string; minutes: number }>;
  recentVisits: Array<{ label: string; at: string; seconds: number }>;
  activity: ActivityFeedRow[];
}
