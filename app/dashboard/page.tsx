import React from 'react';
import { Briefcase, Building2, ShieldCheck, ArrowUpRight, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { InteractiveDashboard, DashboardData } from '@/components/internal/interactive-dashboard';
import { getEffectivePtwStatus, PTW_STATUS, PTW_PENDING_STATUSES } from '@/lib/ptw-status';
import { isJsaPending, JSA_STATUS } from '@/lib/jsa-status';
import { PROCEDURE_STATUS } from '@/lib/procedure-status';
import { PTW_TYPES } from '@/lib/ptw-types';
import { PeriodSwitcher } from '@/components/internal/period-switcher';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const ANOMALI_TYPES = ['Unsafe Act', 'Unsafe Condition'];
const POSITIF_TYPES = ['Safe Act', 'Safe Condition'];

const DAY_MS = 86_400_000;

/**
 * OSHA-style classification of the incident_type enum.
 * "Recordable" deliberately excludes First Aid — first aid cases are, by
 * definition, below the recordability threshold, so folding them in would
 * inflate TRIR against every published benchmark.
 */
const RECORDABLE_TYPES = ['Medical Treatment', 'LTI', 'Fatality'];
const LOST_TIME_TYPES = ['LTI', 'Fatality'];

/** Bucket key for a date, matching the 6-month trend window. */
function monthKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/** Whole days elapsed between two instants, floored at 0. */
function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

/**
 * Mean turnaround in days over rows where both endpoints exist.
 * Rows still in flight (no end timestamp) are excluded rather than counted as
 * zero — an unfinished approval has no cycle time yet, and treating it as
 * instant would make a stalled queue look fast.
 */
function avgDays(rows: { start?: string | null; end?: string | null }[]) {
  const spans = rows
    .filter(r => r.start && r.end)
    .map(r => (new Date(r.end!).getTime() - new Date(r.start!).getTime()) / DAY_MS)
    .filter(d => Number.isFinite(d) && d >= 0);
  if (spans.length === 0) return { avgDays: null, count: 0 };
  return { avgDays: spans.reduce((s, d) => s + d, 0) / spans.length, count: spans.length };
}

/** Normalise free-text location so "Area A " and "area a" aggregate together. */
function normaliseLocation(raw: string | null | undefined) {
  const t = (raw || '').trim();
  if (!t) return null;
  return t.replace(/\s+/g, ' ');
}

/**
 * Resolve the `periode` query param into a half-open [start, end) window.
 * Anything unparseable falls back to "all time" rather than erroring — a bad
 * URL should degrade to the full picture, not a blank dashboard.
 */
function resolvePeriod(raw: string | undefined, now: Date) {
  const m = /^(\d{4})-(\d{1,2})$/.exec(raw || '');
  if (!m) return { value: 'all', label: 'Semua Periode', start: null as Date | null, end: null as Date | null };

  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11 || year < 2000 || year > now.getFullYear() + 1) {
    return { value: 'all', label: 'Semua Periode', start: null as Date | null, end: null as Date | null };
  }

  return {
    value: `${year}-${String(monthIdx + 1).padStart(2, '0')}`,
    label: `${MONTH_LONG[monthIdx]} ${year}`,
    start: new Date(year, monthIdx, 1),
    end: new Date(year, monthIdx + 1, 1),
  };
}

/** The last 12 months, newest first, plus an all-time escape hatch. */
function buildPeriodOptions(now: Date) {
  const opts = [{ value: 'all', label: 'Semua Periode' }];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return opts;
}

export default async function DashboardOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
   const supabase = await createClient();
   const now = new Date();

   const { periode: periodeParam } = await searchParams;
   const period = resolvePeriod(periodeParam, now);
   const periodOptions = buildPeriodOptions(now);
   const isFiltered = period.start !== null;

   /** True when a timestamp falls inside the selected window (always true for all-time). */
   const inPeriod = (raw: string | null | undefined) => {
     if (!period.start || !period.end) return true;
     if (!raw) return false;
     const t = new Date(raw).getTime();
     if (!Number.isFinite(t)) return false;
     return t >= period.start.getTime() && t < period.end.getTime();
   };

   // ---------------------------------------------------------------- fetches
   const [
     { data: vendors },
     { data: projects },
     { data: procedures },
     { data: jsas },
     { data: ptws },
     { data: inspections },
     { data: incidents },
   ] = await Promise.all([
     supabase.from('vendor_profiles').select('csms_status'),
     supabase.from('projects').select('status, start_date, end_date, progress'),
     supabase.from('procedures').select('status'),
     supabase.from('jsa').select('status, created_at, reviewed_at, approved_at'),
     supabase.from('ptw').select('status, workers, valid_from, valid_to, ptw_type, hazards, ptw_number, created_at, authority_approved_at, issuer_approved_at, projects ( name, end_date )'),
     supabase.from('inspections').select('status, finding_type, priority, created_at, location, target_vendor, vendor_profiles:target_vendor ( company_name )'),
     supabase.from('incidents').select('type, incident_date, incident_time, status, location, rca_root_cause'),
   ]);

   const vendorsCount = (vendors || []).length;

   // ------------------------------------------------------- period slicing
   // Only activity-shaped data is sliced. Live-state widgets further down
   // (project schedule, permit expiry, CSMS, the incident-free streak)
   // deliberately keep reading the full dataset — "PTW expiring this week"
   // means nothing when scoped to a month that already ended.
   const inspectionsInPeriod = (inspections || []).filter(i => inPeriod(i.created_at));
   const incidentsInPeriod = (incidents || []).filter(i => inPeriod(i.incident_date));
   const jsasInPeriod = (jsas || []).filter(j => inPeriod(j.created_at));
   const ptwsInPeriod = (ptws || []).filter(p => inPeriod(p.created_at));

   /**
    * PTWs whose validity overlaps the selected window — the basis for
    * period man-hours. Falls back to created_at for permits that never had
    * explicit validity dates recorded.
    */
   const ptwsActiveInPeriod = !isFiltered
     ? (ptws || [])
     : (ptws || []).filter(p => {
         const proj: any = Array.isArray(p.projects) ? p.projects[0] : p.projects;
         const from = p.valid_from ? new Date(p.valid_from) : p.created_at ? new Date(p.created_at) : null;
         const to = p.valid_to ? new Date(p.valid_to) : proj?.end_date ? new Date(proj.end_date) : null;
         if (!from || !to || isNaN(from.getTime()) || isNaN(to.getTime())) return false;
         // Overlap test against the half-open period window.
         return from.getTime() < period.end!.getTime() && to.getTime() >= period.start!.getTime();
       });

   // ------------------------------------------------------------- projects
   // 'Ditolak' is neither active nor late — it is out of the pipeline entirely.
   const activeProjects = (projects || []).filter(p => p.status !== 'Selesai' && p.status !== 'Ditolak');
   const onSchedule = activeProjects.filter(p => new Date(p.end_date) >= now).length;
   const terlambat = activeProjects.filter(p => new Date(p.end_date) < now).length;

   // ------------------------------------------------------------- pipeline
   const procMenunggu = (procedures || []).filter(p => p.status === PROCEDURE_STATUS.draft || p.status === PROCEDURE_STATUS.menungguReviewPM).length;
   const procDisetujui = (procedures || []).filter(p => p.status === PROCEDURE_STATUS.approved).length;

   const jsaMenunggu = (jsas || []).filter(j => isJsaPending(j.status)).length;
   const jsaDisetujui = (jsas || []).filter(j => j.status === JSA_STATUS.approved).length;

   const ptwPendingStatuses = [PTW_STATUS.draft, ...PTW_PENDING_STATUSES];
   const ptwMenunggu = (ptws || []).filter(p => ptwPendingStatuses.includes(p.status)).length;
   const ptwDisetujui = (ptws || []).filter(p => {
     const proj: any = Array.isArray(p.projects) ? p.projects[0] : p.projects;
     return getEffectivePtwStatus(p.status, p.valid_to ?? proj?.end_date) === PTW_STATUS.aktif;
   }).length;

   // Safe Man-Hours: 8 hours * 30 days * workers on permits live in the window
   const totalWorkers = ptwsActiveInPeriod.reduce(
     (sum, p) => sum + (Array.isArray(p.workers) ? p.workers.length : 0), 0
   );
   const safeManHours = totalWorkers * 8 * 30;

   // ---------------------------------------------------------- inspections
   const anomalies = inspectionsInPeriod.filter(i => ANOMALI_TYPES.includes(i.finding_type));
   const positives = inspectionsInPeriod.filter(i => POSITIF_TYPES.includes(i.finding_type));

   const anomaliOpen = anomalies.filter(i => i.status === 'Open').length;
   const anomaliProgres = anomalies.filter(i => i.status === 'In Progress').length;
   const anomaliClosed = anomalies.filter(i => i.status === 'Closed').length;

   // Priority profile of anomalies still needing action — data the old dashboard never surfaced.
   const openAnomalies = anomalies.filter(i => i.status !== 'Closed');
   const prioritas = (['Low', 'Medium', 'High', 'Critical'] as const).map(level => ({
     level,
     value: openAnomalies.filter(i => i.priority === level).length,
   }));

   // ------------------------------------------------ vendor safety scorecard
   // Anomalies attributed to each vendor via inspections.target_vendor.
   // Vendors with no findings at all are omitted rather than shown as a
   // perfect score — absence of a record is not evidence of safe work.
   const vendorAgg = new Map<string, { nama: string; anomali: number; terbuka: number; positif: number }>();
   for (const i of inspectionsInPeriod) {
     const vid = (i as any).target_vendor as string | null;
     if (!vid) continue;
     const vp: any = Array.isArray((i as any).vendor_profiles) ? (i as any).vendor_profiles[0] : (i as any).vendor_profiles;
     const entry = vendorAgg.get(vid) ?? { nama: vp?.company_name || 'Vendor tidak diketahui', anomali: 0, terbuka: 0, positif: 0 };
     if (ANOMALI_TYPES.includes(i.finding_type)) {
       entry.anomali++;
       if (i.status !== 'Closed') entry.terbuka++;
     } else if (POSITIF_TYPES.includes(i.finding_type)) {
       entry.positif++;
     }
     vendorAgg.set(vid, entry);
   }

   const vendorScorecard = [...vendorAgg.values()]
     .map(v => {
       const total = v.anomali + v.positif;
       return {
         ...v,
         total,
         // Share of findings that were anomalies — lower is better.
         rasio: total > 0 ? Math.round((v.anomali / total) * 100) : 0,
       };
     })
     // Worst first: most unresolved, then most anomalies overall.
     .sort((a, b) => b.terbuka - a.terbuka || b.anomali - a.anomali)
     .slice(0, 5);

   // ------------------------------------------------------- 6-month trend
   // The trend is a window in its own right: six months ending at the selected
   // period (or at today for all-time). It therefore reads the unsliced
   // inspection set — scoping it to one month would flatten it to a single point.
   const allAnomalies = (inspections || []).filter(i => ANOMALI_TYPES.includes(i.finding_type));
   const allPositives = (inspections || []).filter(i => POSITIF_TYPES.includes(i.finding_type));

   const trendAnchor = period.start ?? new Date(now.getFullYear(), now.getMonth(), 1);
   const trendWindow: { key: string; label: string }[] = [];
   for (let i = 5; i >= 0; i--) {
     const d = new Date(trendAnchor.getFullYear(), trendAnchor.getMonth() - i, 1);
     trendWindow.push({ key: monthKey(d), label: MONTH_SHORT[d.getMonth()] });
   }
   const trend = trendWindow.map(({ key, label }) => ({
     month: label,
     positif: allPositives.filter(i => monthKey(new Date(i.created_at)) === key).length,
     anomali: allAnomalies.filter(i => monthKey(new Date(i.created_at)) === key).length,
   }));

   // ------------------------------------------------------------ incidents
   const incidentList = incidents || [];
   const incidentDates = incidentList
     .map(i => new Date(i.incident_date))
     .filter(d => !isNaN(d.getTime()))
     .sort((a, b) => b.getTime() - a.getTime());

   // Days without incident. With no incident on record the honest baseline is
   // "since operations began" — the earliest project start — not a blank.
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

   // Severity mix, ordered least → most severe (the classic HSE pyramid order).
   const SEVERITY_ORDER = ['Near Miss', 'First Aid', 'Medical Treatment', 'LTI', 'Fatality'];
   const insidenTipe = SEVERITY_ORDER
     .map(tipe => ({ tipe, value: incidentList.filter(i => i.type === tipe).length }))
     .filter(t => t.value > 0);

   // ------------------------------------------------- incident time pattern
   // When during the week/day incidents actually happen — read against the
   // full history (not the period filter) since a single month rarely has
   // enough incidents for the pattern to mean anything.
   const incidentMoments = incidentList
     .map(i => {
       const d = new Date(i.incident_date);
       const hour = i.incident_time ? parseInt(String(i.incident_time).slice(0, 2), 10) : NaN;
       if (isNaN(d.getTime()) || isNaN(hour)) return null;
       return { weekday: d.getDay(), hour };
     })
     .filter((m): m is { weekday: number; hour: number } => m !== null);

   const WEEKDAY_LABEL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
   const incidentByWeekday = WEEKDAY_LABEL.map((hari, idx) => ({
     hari,
     value: incidentMoments.filter(m => m.weekday === idx).length,
   }));

   const HOUR_SEGMENTS = [
     { segmen: '00–06 (Dini Hari)', from: 0, to: 6 },
     { segmen: '06–12 (Pagi)', from: 6, to: 12 },
     { segmen: '12–18 (Siang/Sore)', from: 12, to: 18 },
     { segmen: '18–24 (Malam)', from: 18, to: 24 },
   ];
   const incidentByHour = HOUR_SEGMENTS.map(({ segmen, from, to }) => ({
     segmen,
     value: incidentMoments.filter(m => m.hour >= from && m.hour < to).length,
   }));

   const incidentPattern = {
     weekday: incidentByWeekday,
     hour: incidentByHour,
     sampleSize: incidentMoments.length,
   };

   // ------------------------------------------------- lagging safety rates
   // TRIR and LTIFR use the standard OSHA/ILO constants. Man-hours here are an
   // estimate (see safeManHours above), so the UI labels these as such rather
   // than presenting them as audited figures.
   const recordableCount = incidentsInPeriod.filter(i => RECORDABLE_TYPES.includes(i.type)).length;
   const lostTimeCount = incidentsInPeriod.filter(i => LOST_TIME_TYPES.includes(i.type)).length;
   const nearMissCount = incidentsInPeriod.filter(i => i.type === 'Near Miss').length;

   const safetyRates = {
     trir: safeManHours > 0 ? (recordableCount * 200_000) / safeManHours : null,
     ltifr: safeManHours > 0 ? (lostTimeCount * 1_000_000) / safeManHours : null,
     recordable: recordableCount,
     lostTime: lostTimeCount,
     // Share of reports that are near misses. A healthy reporting culture
     // surfaces many near misses relative to actual harm.
     nearMissRatio: incidentsInPeriod.length > 0
       ? Math.round((nearMissCount / incidentsInPeriod.length) * 100)
       : null,
     manHours: safeManHours,
   };

   // ------------------------------------------------------- safety pyramid
   // Heinrich-style triangle: the anomaly base comes from inspections, the
   // upper tiers from reported incidents.
   const pyramid = [
     { tipe: 'Fatality', value: incidentsInPeriod.filter(i => i.type === 'Fatality').length, tone: 'crit' as const },
     { tipe: 'LTI', value: incidentsInPeriod.filter(i => i.type === 'LTI').length, tone: 'crit' as const },
     { tipe: 'Medical Treatment', value: incidentsInPeriod.filter(i => i.type === 'Medical Treatment').length, tone: 'warn' as const },
     { tipe: 'First Aid', value: incidentsInPeriod.filter(i => i.type === 'First Aid').length, tone: 'warn' as const },
     { tipe: 'Near Miss', value: nearMissCount, tone: 'info' as const },
     { tipe: 'Unsafe Act / Condition', value: anomalies.length, tone: 'base' as const },
   ];

   // ------------------------------------------------------ investigasi RCA
   const investigasi = {
     selesai: incidentsInPeriod.filter(i => i.status === 'Investigasi Selesai').length,
     menunggu: incidentsInPeriod.filter(i => i.status !== 'Investigasi Selesai').length,
     rcaLengkap: incidentsInPeriod.filter(i => (i.rca_root_cause || '').trim().length > 0).length,
   };

   // ------------------------------------------------------ PTW by permit type
   const ptwByType = PTW_TYPES.map(t => {
     const rows = ptwsInPeriod.filter(p => p.ptw_type === t.id);
     const aktif = rows.filter(p => {
       const proj: any = Array.isArray(p.projects) ? p.projects[0] : p.projects;
       return getEffectivePtwStatus(p.status, p.valid_to ?? proj?.end_date) === PTW_STATUS.aktif;
     }).length;
     return { id: t.id, label: t.title, color: t.color, total: rows.length, aktif };
   })
     .filter(t => t.total > 0)
     .sort((a, b) => b.total - a.total);

   // -------------------------------------------------- PTW expiry watchlist
   // Permits already issued whose validity lapses within a week (or has
   // already lapsed) — the list a permit issuer needs to act on today.
   const today = new Date();
   today.setHours(0, 0, 0, 0);

   const ptwExpiring = (ptws || [])
     .map(p => {
       const proj: any = Array.isArray(p.projects) ? p.projects[0] : p.projects;
       const validTo = p.valid_to ?? proj?.end_date ?? null;
       if (!validTo) return null;
       const effective = getEffectivePtwStatus(p.status, validTo);
       // Only permits that were actually issued can expire.
       if (effective !== PTW_STATUS.aktif && effective !== 'Expired') return null;
       const end = new Date(validTo);
       if (isNaN(end.getTime())) return null;
       end.setHours(0, 0, 0, 0);
       const sisaHari = Math.round((end.getTime() - today.getTime()) / DAY_MS);
       if (sisaHari > 7) return null;
       return {
         nomor: p.ptw_number || '—',
         proyek: proj?.name || 'Proyek tidak diketahui',
         tipe: PTW_TYPES.find(t => t.id === p.ptw_type)?.title || p.ptw_type || '—',
         validTo,
         sisaHari,
       };
     })
     .filter((x): x is NonNullable<typeof x> => x !== null)
     .sort((a, b) => a.sisaHari - b.sisaHari)
     .slice(0, 6);

   // ------------------------------------------------ approval cycle times
   const jsaReview = avgDays(jsasInPeriod.map(j => ({ start: j.created_at, end: j.reviewed_at })));
   const jsaApproval = avgDays(jsasInPeriod.map(j => ({ start: j.created_at, end: j.approved_at })));
   const ptwAuthority = avgDays(ptwsInPeriod.map(p => ({ start: p.created_at, end: p.authority_approved_at })));
   const ptwIssuer = avgDays(ptwsInPeriod.map(p => ({ start: p.created_at, end: p.issuer_approved_at })));

   const cycleTime = [
     { stage: 'JSA — Direview', ...jsaReview },
     { stage: 'JSA — Disetujui', ...jsaApproval },
     { stage: 'PTW — Approval PM', ...ptwAuthority },
     { stage: 'PTW — Review Issuer', ...ptwIssuer },
   ];

   // ------------------------------------------------- aging of open anomalies
   const AGING_BUCKETS = [
     { bucket: '≤ 7 hari', min: 0, max: 7, tone: 'ok' as const },
     { bucket: '8–14 hari', min: 8, max: 14, tone: 'ok' as const },
     { bucket: '15–30 hari', min: 15, max: 30, tone: 'warn' as const },
     { bucket: '> 30 hari', min: 31, max: Infinity, tone: 'crit' as const },
   ];
   const openAges = openAnomalies
     .map(i => daysBetween(new Date(i.created_at), now))
     .filter(d => Number.isFinite(d));

   const aging = AGING_BUCKETS.map(b => ({
     bucket: b.bucket,
     tone: b.tone,
     value: openAges.filter(d => d >= b.min && d <= b.max).length,
   }));
   const oldestOpenDays = openAges.length > 0 ? Math.max(...openAges) : null;

   // ------------------------------------------------------------ top hazards
   const hazardCount = new Map<string, number>();
   for (const p of ptwsInPeriod) {
     for (const h of (p.hazards as string[] | null) || []) {
       const key = (h || '').trim();
       if (!key) continue;
       hazardCount.set(key, (hazardCount.get(key) || 0) + 1);
     }
   }
   const topHazards = [...hazardCount.entries()]
     .map(([nama, value]) => ({ nama, value }))
     .sort((a, b) => b.value - a.value)
     .slice(0, 8);

   // -------------------------------------------------------- location hotspots
   const hotspotMap = new Map<string, { lokasi: string; anomali: number; insiden: number }>();
   for (const i of anomalies) {
     const loc = normaliseLocation((i as any).location);
     if (!loc) continue;
     const e = hotspotMap.get(loc.toLowerCase()) ?? { lokasi: loc, anomali: 0, insiden: 0 };
     e.anomali++;
     hotspotMap.set(loc.toLowerCase(), e);
   }
   for (const i of incidentsInPeriod) {
     const loc = normaliseLocation((i as any).location);
     if (!loc) continue;
     const e = hotspotMap.get(loc.toLowerCase()) ?? { lokasi: loc, anomali: 0, insiden: 0 };
     e.insiden++;
     hotspotMap.set(loc.toLowerCase(), e);
   }
   const hotspots = [...hotspotMap.values()]
     .map(h => ({ ...h, total: h.anomali + h.insiden }))
     // Incidents outrank anomalies when ranking a location's risk.
     .sort((a, b) => b.insiden - a.insiden || b.total - a.total)
     .slice(0, 6);

   // ------------------------------------------------------------ CSMS vendor
   const csmsMap = new Map<string, number>();
   for (const v of vendors || []) {
     const s = (v.csms_status || 'Pending Review').trim() || 'Pending Review';
     csmsMap.set(s, (csmsMap.get(s) || 0) + 1);
   }
   const csms = [...csmsMap.entries()]
     .map(([status, value]) => ({ status, value }))
     .sort((a, b) => b.value - a.value);

   // --------------------------------------------------- project progress mix
   // Compares reported progress against elapsed schedule time, so a project
   // that is "70% done" with 90% of its window gone reads as behind.
   const progressRows = activeProjects
     .map(p => {
       const start = new Date(p.start_date).getTime();
       const end = new Date(p.end_date).getTime();
       if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
       const elapsedPct = Math.min(100, Math.max(0, ((now.getTime() - start) / (end - start)) * 100));
       return { progress: p.progress ?? 0, elapsedPct };
     })
     .filter((x): x is NonNullable<typeof x> => x !== null);

   const progresMix = {
     unggul: progressRows.filter(r => r.progress >= r.elapsedPct + 5).length,
     sesuai: progressRows.filter(r => Math.abs(r.progress - r.elapsedPct) < 5).length,
     tertinggal: progressRows.filter(r => r.progress <= r.elapsedPct - 5).length,
     rataProgres: progressRows.length > 0
       ? Math.round(progressRows.reduce((s, r) => s + r.progress, 0) / progressRows.length)
       : null,
   };

   // -------------------------------------------------------------- viewer
   const { data: { user } } = await supabase.auth.getUser();
   const userName = user?.email?.split('@')[0].toUpperCase() || 'PENGGUNA';
   const userInitial = userName.charAt(0);

   const { data: profile } = user
     ? await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
     : { data: null };
   const role = profile?.role;
   const displayName = profile?.full_name?.split(' ')[0]?.toUpperCase() || userName;

   const currentMonth = `${MONTH_LONG[now.getMonth()]} ${now.getFullYear()}`;
   const hour = now.getHours();
   const greeting = hour < 11 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 19 ? 'Selamat Sore' : 'Selamat Malam';

   // PTW waiting for me, scoped to what this role actually approves
   const ptwWaitingCount = (ptws || []).filter(p => {
     if (role === 'admin') return PTW_PENDING_STATUSES.includes(p.status);
     if (role === 'pm') return p.status === PTW_STATUS.menungguApprovalPM;
     if (role === 'hse') return p.status === PTW_STATUS.reviewPtwIssuer || p.status === PTW_STATUS.menungguPenomoranHSSE;
     return false;
   }).length;

   const projectHealthPct = activeProjects.length > 0
     ? Math.round((onSchedule / activeProjects.length) * 100)
     : null;

   const dashboardData: DashboardData = {
     trend,
     pipeline: [
       { stage: 'Prosedur', disetujui: procDisetujui, menunggu: procMenunggu },
       { stage: 'JSA', disetujui: jsaDisetujui, menunggu: jsaMenunggu },
       { stage: 'PTW', disetujui: ptwDisetujui, menunggu: ptwMenunggu },
     ],
     prioritas,
     anomali: { open: anomaliOpen, progres: anomaliProgres, closed: anomaliClosed },
     vendorScorecard,
     jadwal: { onSchedule, terlambat },
     insidenTipe,
     incidentPattern,
     daysWithoutIncident,
     streakLabel,
     totalIncidents: incidentList.length,
     safeManHours,
     safetyRates,
     pyramid,
     investigasi,
     ptwByType,
     ptwExpiring,
     cycleTime,
     aging,
     oldestOpenDays,
     topHazards,
     hotspots,
     csms,
     progresMix,
     periodLabel: period.label,
     isFiltered,
   };

   const statCards = [
     {
       label: 'Proyek Aktif',
       value: activeProjects.length,
       icon: Briefcase,
       gradient: 'from-blue-500 to-blue-600',
       glow: 'group-hover:shadow-blue-500/25',
       footer: projectHealthPct === null ? 'Belum ada proyek' : `${projectHealthPct}% on schedule`,
       footerTone: projectHealthPct === null ? 'text-slate-400' : projectHealthPct >= 80 ? 'text-emerald-600' : 'text-amber-600',
     },
     {
       label: 'Vendor Terdaftar',
       value: vendorsCount || 0,
       icon: Building2,
       gradient: 'from-violet-500 to-violet-600',
       glow: 'group-hover:shadow-violet-500/25',
       footer: 'Mitra kerja aktif',
       footerTone: 'text-slate-400',
     },
     {
       label: 'Safe Man-Hours',
       value: safeManHours >= 1_000_000 ? (safeManHours / 1_000_000).toFixed(1) + 'M' : safeManHours.toLocaleString('id-ID'),
       icon: ShieldCheck,
       gradient: 'from-emerald-500 to-emerald-600',
       glow: 'group-hover:shadow-emerald-500/25',
       footer: totalWorkers > 0 ? `${totalWorkers} pekerja terdaftar` : 'Belum ada pekerja PTW',
       footerTone: totalWorkers > 0 ? 'text-emerald-600' : 'text-slate-400',
     },
     {
       label: 'Anomali Terbuka',
       value: anomaliOpen + anomaliProgres,
       icon: ClipboardList,
       gradient: 'from-amber-500 to-amber-600',
       glow: 'group-hover:shadow-amber-500/25',
       footer: (anomaliOpen + anomaliProgres) > 0 ? 'Perlu tindak lanjut' : 'Semua tertangani',
       footerTone: (anomaliOpen + anomaliProgres) > 0 ? 'text-amber-600' : 'text-emerald-600',
       pulse: anomaliOpen > 0,
     },
   ];

   return (
      <div className="space-y-6">
         <div className="flex flex-col gap-4">
           {/* Welcome Header */}
           <div className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-up">
             <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-2xl" />
             <div className="pointer-events-none absolute right-16 bottom-0 h-32 w-32 rounded-full bg-gradient-to-tr from-emerald-400/10 to-transparent blur-2xl" />

             <div className="relative flex items-center gap-4">
               <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-600 text-white font-black text-xl shadow-lg shadow-primary/25">
                 {userInitial}
               </div>
               <div>
                 <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                   {greeting}, {displayName} <span className="inline-block animate-wiggle">👋</span>
                 </h1>
                 <p className="text-sm text-slate-500 mt-1">Ringkasan Performa K3 — {period.label}.</p>
                 <div className="flex items-center gap-2 mt-3 text-xs">
                   <span className="flex items-center gap-1.5 text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-full">
                     <span className="relative flex h-2 w-2">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                     </span>
                     Live Data Terhubung
                   </span>
                 </div>
               </div>
             </div>

             <div className="relative flex flex-col items-stretch sm:items-end gap-1.5">
               <PeriodSwitcher options={periodOptions} value={period.value} />
               <p className="text-[10px] font-medium text-slate-400 text-center sm:text-right">
                 {isFiltered
                   ? 'Metrik aktivitas mengikuti periode ini'
                   : `Seluruh data sampai ${currentMonth}`}
               </p>
             </div>
           </div>

           {/* Task Alert Banner */}
           {ptwWaitingCount > 0 && (
             <div className="animate-fade-up bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ animationDelay: '80ms' }}>
               <div className="flex items-center gap-4">
                 <div className="bg-white p-2 rounded-xl text-amber-600 shadow-sm shrink-0">
                   <ClipboardList className="w-5 h-5" />
                 </div>
                 <div>
                   <h3 className="text-amber-900 font-bold text-sm">{ptwWaitingCount} PTW membutuhkan review Anda</h3>
                   <p className="text-amber-700/80 text-xs mt-0.5">Harap segera validasi agar vendor dapat memulai pekerjaannya di lapangan.</p>
                 </div>
               </div>
               <Link href="/dashboard/my-task" className="group bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 shadow-sm hover:shadow-md hover:shadow-amber-500/30">
                 Tinjau sekarang <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
               </Link>
             </div>
           )}

           {/* KPI Row */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {statCards.map((stat, i) => {
               const Icon = stat.icon;
               return (
                 <div
                   key={stat.label}
                   className={`group animate-fade-up relative bg-white border border-slate-200 rounded-2xl p-4 flex gap-3 shadow-sm items-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${stat.glow}`}
                   style={{ animationDelay: `${120 + i * 60}ms` }}
                 >
                   <div className={`bg-gradient-to-br ${stat.gradient} text-white p-2.5 rounded-xl h-fit shadow-sm transition-transform duration-300 group-hover:scale-110 relative`}>
                     <Icon className="w-5 h-5" />
                     {stat.pulse && (
                       <span className="absolute -top-1 -right-1 flex h-3 w-3">
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                         <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border-2 border-white"></span>
                       </span>
                     )}
                   </div>
                   <div className="min-w-0">
                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{stat.label}</p>
                     <p className="text-xl font-black text-slate-800">{stat.value}</p>
                     <p className={`text-[10px] font-semibold mt-0.5 truncate ${stat.footerTone}`}>{stat.footer}</p>
                   </div>
                 </div>
               );
             })}
           </div>
         </div>

         <InteractiveDashboard data={dashboardData} />
      </div>
   );
}
