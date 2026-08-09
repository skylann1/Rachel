"use server";

import { createClient } from "@/utils/supabase/server";
import { getNotifications } from "@/app/dashboard/inbox/actions";
import { getEffectivePtwStatus, PTW_STATUS, PTW_PENDING_STATUSES } from "@/lib/ptw-status";
import { JSA_STATUS, isJsaPending } from "@/lib/jsa-status";
import { PROCEDURE_STATUS } from "@/lib/procedure-status";
import { getVendorIncidents } from "@/app/vendor/dashboard/incident/actions";

// Mirrors the real status strings written by the approval workflow
// (see app/dashboard/approval/actions.ts and app/vendor/dashboard/projects/[id]/VendorProjectClient.tsx)
function mapJsaStatus(jsa?: { status: string; rejection_note?: string | null }): 'Approved' | 'Pending' | 'Rejected' | 'Belum Ada' {
  if (!jsa) return 'Belum Ada';
  if (jsa.status === JSA_STATUS.approved) return 'Approved';
  if (isJsaPending(jsa.status)) {
    return jsa.rejection_note ? 'Rejected' : 'Pending';
  }
  return 'Belum Ada'; // Draft: created but not yet submitted
}

// Satu proyek bisa punya beberapa PTW sekaligus (tipe berbeda) — "Aktif"
// hanya kalau SEMUA sudah aktif, "Expired" kalau ADA yang kedaluwarsa.
function mapPtwStatus(ptws: { status: string; rejection_note?: string | null; valid_to?: string | null }[] = [], endDate?: string | null): 'Aktif' | 'Menunggu Persetujuan' | 'Ditolak' | 'Expired' | 'Belum Terbit' {
  if (ptws.length === 0) return 'Belum Terbit';
  const effective = ptws.map(p => getEffectivePtwStatus(p.status, p.valid_to ?? endDate));
  if (effective.some(s => s === PTW_STATUS.expired)) return 'Expired';
  if (effective.every(s => s === PTW_STATUS.aktif)) return 'Aktif';
  if (ptws.some(p => p.status === PTW_STATUS.draft && p.rejection_note)) return 'Ditolak';
  if (effective.every(s => s === PTW_STATUS.draft)) return 'Belum Terbit';
  return 'Menunggu Persetujuan'; // Menunggu Approval PM / Review PTW Issuer / Menunggu Penomoran HSSE
}

export async function getVendorDashboardData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { projects: [], stats: { total: 0, pendingJsa: 0, activePtw: 0, needsAction: 0 } };

  // Fetch projects
  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      start_date,
      end_date,
      jsa ( status, rejection_note ),
      ptw ( status, rejection_note, valid_to )
    `)
    .eq('vendor_id', user.id)
    .order('created_at', { ascending: false });

  if (projectsError) {
    console.error(projectsError);
    return { projects: [], stats: { total: 0, pendingJsa: 0, activePtw: 0, needsAction: 0 } };
  }

  let totalProjects = projectsData.length;
  let pendingJsa = 0;
  let activePtw = 0;
  let needsAction = 0;

  const formattedProjects = projectsData.map(p => {
    const jsaStatus = mapJsaStatus(p.jsa?.[0]);
    const ptwStatus = mapPtwStatus(p.ptw ?? [], p.end_date);

    if (jsaStatus === 'Pending') pendingJsa++;
    if (ptwStatus === 'Aktif') activePtw++;
    if (jsaStatus === 'Rejected' || ptwStatus === 'Ditolak') needsAction++;

    return {
      id: p.id,
      name: p.name,
      jsaStatus,
      ptwStatus,
      date: p.start_date || 'N/A'
    };
  });

  return {
    projects: formattedProjects,
    stats: {
      total: totalProjects,
      pendingJsa,
      activePtw,
      needsAction
    }
  };
}

export interface VendorActivityItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: 'success' | 'danger' | 'info';
  link: string | null;
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'Baru saja';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit yang lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam yang lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari yang lalu`;
  return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function getVendorRecentActivity(): Promise<VendorActivityItem[]> {
  const notifications = await getNotifications();

  return notifications.slice(0, 6).map(n => ({
    id: n.id,
    title: n.title,
    desc: n.message,
    time: timeAgo(n.created_at),
    type: n.type === 'approval' ? 'success' : n.type === 'warning' ? 'danger' : 'info',
    link: n.link,
  }));
}

// ============================================================================
// DASHBOARD CHARTS — vendor-scoped mirror of app/dashboard/page.tsx's
// InteractiveDashboard data, minus the cross-vendor scorecard/priority/
// schedule widgets that don't apply to a single vendor's own view.
// ============================================================================

const ANOMALI_TYPES = ['Unsafe Act', 'Unsafe Condition'];
const POSITIF_TYPES = ['Safe Act', 'Safe Condition'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const SEVERITY_ORDER = ['Near Miss', 'First Aid', 'Medical Treatment', 'LTI', 'Fatality'];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export interface VendorDashboardData {
  trend: { month: string; positif: number; anomali: number }[];
  pipeline: { stage: string; disetujui: number; menunggu: number }[];
  anomali: { open: number; progres: number; closed: number };
  insidenTipe: { tipe: string; value: number }[];
  daysWithoutIncident: number | null;
  streakLabel: string;
  totalIncidents: number;
}

const EMPTY_CHARTS_DATA: VendorDashboardData = {
  trend: [],
  pipeline: [
    { stage: 'Prosedur', disetujui: 0, menunggu: 0 },
    { stage: 'JSA', disetujui: 0, menunggu: 0 },
    { stage: 'PTW', disetujui: 0, menunggu: 0 },
  ],
  anomali: { open: 0, progres: 0, closed: 0 },
  insidenTipe: [],
  daysWithoutIncident: null,
  streakLabel: 'Belum ada proyek berjalan',
  totalIncidents: 0,
};

export async function getVendorChartsData(): Promise<VendorDashboardData> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY_CHARTS_DATA;

  const now = new Date();

  const [{ data: projects }, { data: inspections }, incidents] = await Promise.all([
    supabase.from('projects')
      .select('start_date, procedures ( status ), jsa ( status ), ptw ( status )')
      .eq('vendor_id', user.id),
    supabase.from('inspections')
      .select('status, finding_type, created_at')
      .eq('target_vendor', user.id),
    getVendorIncidents(),
  ]);

  // ------------------------------------------------------------- pipeline
  const procedures = (projects || [])
    .map(p => Array.isArray(p.procedures) ? p.procedures[0] : p.procedures)
    .filter(Boolean) as { status: string }[];
  const jsas = (projects || [])
    .map(p => Array.isArray(p.jsa) ? p.jsa[0] : p.jsa)
    .filter(Boolean) as { status: string }[];
  const ptws = (projects || [])
    .flatMap(p => Array.isArray(p.ptw) ? p.ptw : (p.ptw ? [p.ptw] : [])) as { status: string }[];

  const ptwPendingStatuses = [PTW_STATUS.draft, ...PTW_PENDING_STATUSES];
  const pipeline = [
    {
      stage: 'Prosedur',
      disetujui: procedures.filter(p => p.status === PROCEDURE_STATUS.approved).length,
      menunggu: procedures.filter(p => p.status === PROCEDURE_STATUS.draft || p.status === PROCEDURE_STATUS.menungguReviewPM).length,
    },
    {
      stage: 'JSA',
      disetujui: jsas.filter(j => j.status === JSA_STATUS.approved).length,
      menunggu: jsas.filter(j => isJsaPending(j.status)).length,
    },
    {
      stage: 'PTW',
      disetujui: ptws.filter(p => p.status === PTW_STATUS.aktif).length,
      menunggu: ptws.filter(p => ptwPendingStatuses.includes(p.status)).length,
    },
  ];

  // ---------------------------------------------------------- inspections
  const anomalies = (inspections || []).filter(i => ANOMALI_TYPES.includes(i.finding_type));
  const positives = (inspections || []).filter(i => POSITIF_TYPES.includes(i.finding_type));

  const anomali = {
    open: anomalies.filter(i => i.status === 'Open').length,
    progres: anomalies.filter(i => i.status === 'In Progress').length,
    closed: anomalies.filter(i => i.status === 'Closed').length,
  };

  // ------------------------------------------------------- 6-month trend
  const trendWindow: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    trendWindow.push({ key: monthKey(d), label: MONTH_SHORT[d.getMonth()] });
  }
  const trend = trendWindow.map(({ key, label }) => ({
    month: label,
    positif: positives.filter(i => monthKey(new Date(i.created_at)) === key).length,
    anomali: anomalies.filter(i => monthKey(new Date(i.created_at)) === key).length,
  }));

  // ------------------------------------------------------------ incidents
  const incidentDates = incidents
    .map(i => new Date(i.incident_date))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  // Days without incident. With no incident on record the honest baseline is
  // "since operations began" — this vendor's earliest project start.
  const operationsStart = (projects || [])
    .map(p => new Date(p.start_date))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0] || null;

  const lastIncident = incidentDates[0] || null;
  const streakFrom = lastIncident || operationsStart;
  const daysWithoutIncident = streakFrom
    ? Math.max(0, Math.floor((now.getTime() - streakFrom.getTime()) / 86_400_000))
    : null;
  const streakLabel = lastIncident
    ? 'Sejak insiden terakhir dilaporkan'
    : operationsStart
      ? 'Sejak proyek pertama dimulai'
      : 'Belum ada proyek berjalan';

  const insidenTipe = SEVERITY_ORDER
    .map(tipe => ({ tipe, value: incidents.filter(i => i.type === tipe).length }))
    .filter(t => t.value > 0);

  return {
    trend,
    pipeline,
    anomali,
    insidenTipe,
    daysWithoutIncident,
    streakLabel,
    totalIncidents: incidents.length,
  };
}
