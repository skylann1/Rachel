import React from 'react';
import {
  Activity, Users, LogIn, Building2, Shield, Briefcase, Megaphone, UserCog,
  FileText, ShieldAlert, Stamp,
} from 'lucide-react';

/** Potongan UI yang dipakai bersama tab Online, tab Riwayat, drawer detail user, dan panel peringatan. */

export function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Baru saja';
  if (min < 60) return `${min}m lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}j lalu`;
  const day = Math.floor(hr / 24);
  return `${day}h lalu`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) return '<1 mnt';
  if (minutes < 60) return `${minutes} mnt`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} jam` : `${h} jam ${m} mnt`;
}

const TYPE_BADGE: Record<string, string> = {
  pgn: 'bg-blue-100 text-blue-700',
  pgsol: 'bg-violet-100 text-violet-700',
  vendor: 'bg-amber-100 text-amber-700',
};
const TYPE_LABEL: Record<string, string> = { pgn: 'PGN', pgsol: 'PGSOL', vendor: 'Vendor' };

export function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  return (
    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${TYPE_BADGE[type] ?? 'bg-slate-100 text-slate-600'}`}>
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}

export const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  auth: LogIn,
  vendor: Building2,
  account: Users,
  role: Shield,
  project: Briefcase,
  announcement: Megaphone,
  pgsol_assignment: UserCog,
  procedure: FileText,
  jsa: ShieldAlert,
  ptw: Stamp,
};

export const CATEGORY_LABEL: Record<string, string> = {
  auth: 'Autentikasi',
  vendor: 'Vendor',
  account: 'Akun',
  role: 'Role',
  project: 'Proyek',
  announcement: 'Pengumuman',
  pgsol_assignment: 'Reviewer PGSOL',
  procedure: 'Prosedur Kerja',
  jsa: 'JSA',
  ptw: 'PTW',
};

export function categoryIcon(category: string) {
  return CATEGORY_ICON[category] ?? Activity;
}

export function initials(name: string | null): string {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
}
