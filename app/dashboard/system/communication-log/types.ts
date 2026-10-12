export type EmailStatus = 'sent' | 'failed' | 'skipped';

export interface EmailLogRow {
  id: string;
  createdAt: string;
  to: string;
  subject: string;
  status: EmailStatus;
  error: string | null;
}

export interface NotificationLogRow {
  id: string;
  createdAt: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientType: string | null;
}

export interface CommunicationLogData {
  /** true kalau RESEND_API_KEY terpasang di server — tanpa ini semua email dilewati. */
  emailConfigured: boolean;
  /** false kalau tabel email_logs belum dimigrasikan. */
  emailTableReady: boolean;
  emails: EmailLogRow[];
  emailCounts: { sent: number; failed: number; skipped: number };
  notifications: NotificationLogRow[];
  notificationCounts: { total: number; unread: number };
}
