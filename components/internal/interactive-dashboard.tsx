"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Rocket, ClipboardCheck, AlertTriangle, Archive, ListChecks, ArrowRight,
  ShieldCheck, Inbox, CalendarClock, Flame, Timer, Hourglass, MapPin,
  FileWarning, Activity, Layers, BadgeCheck, TrendingUp,
} from 'lucide-react';
import { DashboardDetailModal, DetailModalConfig } from './dashboard-detail-modal';
import {
  getProjectScheduleDetails, getPtwDetails, getInspectionDetails, getAnomaliDetails,
} from '@/app/dashboard/actions/dashboard-detail';

export interface DashboardData {
  trend: { month: string; positif: number; anomali: number }[];
  pipeline: { stage: string; disetujui: number; menunggu: number }[];
  prioritas: { level: string; value: number }[];
  anomali: { open: number; progres: number; closed: number };
  vendorScorecard: { nama: string; anomali: number; terbuka: number; positif: number; total: number; rasio: number }[];
  jadwal: { onSchedule: number; terlambat: number };
  insidenTipe: { tipe: string; value: number }[];
  incidentPattern: {
    weekday: { hari: string; value: number }[];
    hour: { segmen: string; value: number }[];
    sampleSize: number;
  };
  daysWithoutIncident: number | null;
  streakLabel: string;
  totalIncidents: number;
  safeManHours: number;
  safetyRates: {
    trir: number | null;
    ltifr: number | null;
    recordable: number;
    lostTime: number;
    nearMissRatio: number | null;
    manHours: number;
  };
  pyramid: { tipe: string; value: number; tone: 'crit' | 'warn' | 'info' | 'base' }[];
  investigasi: { selesai: number; menunggu: number; rcaLengkap: number };
  ptwByType: { id: string; label: string; color: string; total: number; aktif: number }[];
  ptwExpiring: { nomor: string; proyek: string; tipe: string; validTo: string; sisaHari: number }[];
  cycleTime: { stage: string; avgDays: number | null; count: number }[];
  aging: { bucket: string; value: number; tone: 'ok' | 'warn' | 'crit' }[];
  oldestOpenDays: number | null;
  topHazards: { nama: string; value: number }[];
  hotspots: { lokasi: string; anomali: number; insiden: number; total: number }[];
  csms: { status: string; value: number }[];
  progresMix: { unggul: number; sesuai: number; tertinggal: number; rataProgres: number | null };
  periodLabel: string;
  isFiltered: boolean;
}

/**
 * Palette — every set below was checked with the dataviz validator against a
 * white card surface. Notable result: the intuitive green/red pairing for
 * Closed vs Open FAILS colorblind separation (ΔE 4.1), so Closed is blue.
 */
const C = {
  positif: '#2a78d6',   // categorical slot 1 — pairs clean with slot 2 (all checks pass)
  anomali: '#eb6834',   // categorical slot 2
  good: '#0ca30c',      // status: good
  warning: '#fab219',   // status: warning
  critical: '#d03b3b',  // status: critical
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#898781',
  ink: '#52514e',
};

// Ordinal ramp for the ordered priority tiers — one hue, monotone lightness (all checks pass).
const PRIORITY_RAMP = ['#86b6ef', '#5598e7', '#2a78d6', '#184f95'];
const PRIORITY_LABEL: Record<string, string> = {
  Low: 'Rendah', Medium: 'Sedang', High: 'Tinggi', Critical: 'Kritis',
};

const QUICK_LINKS = [
  { label: 'Proyek Berjalan', desc: 'Progres lapangan', href: '/dashboard/ongoing', icon: Rocket, tone: 'bg-blue-50 text-blue-600' },
  { label: 'Persetujuan', desc: 'Dokumen menunggu review', href: '/dashboard/approval', icon: ClipboardCheck, tone: 'bg-amber-50 text-amber-600' },
  { label: 'Inbox Temuan K3', desc: 'Inspeksi & anomali', href: '/dashboard/inspection', icon: ListChecks, tone: 'bg-emerald-50 text-emerald-600' },
  { label: 'Laporan Insiden', desc: 'Investigasi insiden', href: '/dashboard/incident', icon: AlertTriangle, tone: 'bg-rose-50 text-rose-600' },
  { label: 'Arsip Proyek', desc: 'Riwayat proyek selesai', href: '/dashboard/archive', icon: Archive, tone: 'bg-slate-100 text-slate-600' },
];

/* ------------------------------------------------------------------ pieces */

function Card({
  title, subtitle, onClick, className = '', live = false, children,
}: {
  title: string; subtitle?: string; onClick?: () => void; className?: string;
  /** Marks a card whose figures always reflect today, ignoring the period filter. */
  live?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''} ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {live && (
          <span
            title="Kartu ini selalu menampilkan kondisi terkini, tidak mengikuti filter periode."
            className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Terkini
          </span>
        )}
      </div>
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
      <Inbox className="w-7 h-7 text-slate-300" />
      <p className="text-xs text-slate-400 max-w-[22ch]">{label}</p>
    </div>
  );
}

/** Horizontal part-to-whole bar. Values are always shown as text, never color-only. */
function StackedRow({
  label, segments, total,
}: {
  label?: string;
  segments: { name: string; value: number; color: string }[];
  total: number;
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-bold text-slate-600">{label}</span>
          <span className="text-xs font-semibold text-slate-400 tabular-nums">{total}</span>
        </div>
      )}
      {total === 0 ? (
        <div className="h-2.5 rounded-full bg-slate-100" />
      ) : (
        <div className="flex gap-[2px] h-2.5">
          {segments.filter(s => s.value > 0).map((s, i, arr) => (
            <div
              key={s.name}
              title={`${s.name}: ${s.value}`}
              style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
              className={`h-full ${i === 0 ? 'rounded-l-full' : ''} ${i === arr.length - 1 ? 'rounded-r-full' : ''}`}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map(s => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            {s.name} <span className="font-bold text-slate-700 tabular-nums">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Section divider so a long dashboard still reads as grouped chapters. */
function SectionHeading({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-black text-slate-800 tracking-tight">{title}</h2>
        <p className="text-xs text-slate-400 truncate">{desc}</p>
      </div>
      <div className="flex-1 h-px bg-slate-200 ml-2" />
    </div>
  );
}

/** Labelled horizontal bar sized against the largest value in its set. */
function BarRow({
  label, value, max, color, suffix, hint,
}: {
  label: string; value: number; max: number; color: string; suffix?: string; hint?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold text-slate-600 truncate" title={label}>{label}</span>
        <span className="text-xs font-black text-slate-800 tabular-nums shrink-0">
          {value}{suffix}
          {hint && <span className="ml-1 font-medium text-slate-400">{hint}</span>}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%`,
            background: color,
            // Permit colours include near-white swatches; an inset ring keeps
            // those bars visible against the white card.
            boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.12)',
          }}
        />
      </div>
    </div>
  );
}

/** Big single figure with a caption — used for the rate tiles. */
function RateTile({
  label, value, unit, caption, tone,
}: {
  label: string; value: string; unit?: string; caption: string; tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-black leading-none mt-1.5 tabular-nums ${tone}`}>
        {value}{unit && <span className="text-xs font-bold ml-1 text-slate-400">{unit}</span>}
      </p>
      <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">{caption}</p>
    </div>
  );
}

const AGING_TONE: Record<string, string> = { ok: C.good, warn: C.warning, crit: C.critical };
const PYRAMID_TONE: Record<string, string> = {
  crit: C.critical, warn: C.warning, info: C.positif, base: PRIORITY_RAMP[0],
};

/**
 * Permit titles are stored as the shouty official form headings
 * ("IJIN KERJA DINGIN (COLD WORK PERMIT)"). Drop the English gloss and the
 * "IJIN/IZIN" prefix, then title-case what is left so a chart row reads
 * "Kerja Dingin" rather than a bare "DINGIN".
 */
function shortPermitLabel(title: string) {
  return title
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/^\s*I[JZ]IN\s+/i, '')
    .trim()
    .toLowerCase()
    .replace(/\b\p{L}/gu, ch => ch.toUpperCase());
}

/** CSMS is free text in the DB; map the known states and fall back to neutral. */
function csmsTone(status: string) {
  const s = status.toLowerCase();
  if (s.includes('approved') || s.includes('lulus') || s.includes('aktif')) return C.good;
  if (s.includes('pending') || s.includes('review')) return C.warning;
  if (s.includes('reject') || s.includes('tolak') || s.includes('expired')) return C.critical;
  return C.muted;
}

/* ------------------------------------------------------------------- main */

export function InteractiveDashboard({ data }: { data: DashboardData }) {
  const [detailConfig, setDetailConfig] = useState<DetailModalConfig | null>(null);

  const {
    trend, pipeline, prioritas, anomali, jadwal, insidenTipe, incidentPattern, daysWithoutIncident,
    streakLabel, totalIncidents, vendorScorecard,
    safetyRates, pyramid, investigasi, ptwByType, ptwExpiring, cycleTime,
    aging, oldestOpenDays, topHazards, hotspots, csms, progresMix,
    periodLabel, isFiltered,
  } = data;

  const trendTotal = trend.reduce((s, t) => s + t.positif + t.anomali, 0);
  const anomaliTotal = anomali.open + anomali.progres + anomali.closed;
  const prioritasTotal = prioritas.reduce((s, p) => s + p.value, 0);
  const prioritasMax = Math.max(1, ...prioritas.map(p => p.value));
  const jadwalTotal = jadwal.onSchedule + jadwal.terlambat;
  const closedPct = anomaliTotal > 0 ? Math.round((anomali.closed / anomaliTotal) * 100) : null;

  const pyramidMax = Math.max(1, ...pyramid.map(p => p.value));
  const ptwTypeMax = Math.max(1, ...ptwByType.map(p => p.total));
  const hazardMax = Math.max(1, ...topHazards.map(h => h.value));
  const hotspotMax = Math.max(1, ...hotspots.map(h => h.total));
  const cycleMax = Math.max(1, ...cycleTime.map(c => c.avgDays ?? 0));
  const agingTotal = aging.reduce((s, a) => s + a.value, 0);
  const csmsTotal = csms.reduce((s, c) => s + c.value, 0);
  const investigasiTotal = investigasi.selesai + investigasi.menunggu;
  const progresTotal = progresMix.unggul + progresMix.sesuai + progresMix.tertinggal;
  const weekdayMax = Math.max(1, ...incidentPattern.weekday.map(w => w.value));
  const hourMax = Math.max(1, ...incidentPattern.hour.map(h => h.value));
  const peakWeekday = [...incidentPattern.weekday].sort((a, b) => b.value - a.value)[0];
  const peakHour = [...incidentPattern.hour].sort((a, b) => b.value - a.value)[0];

  const fmtRate = (v: number | null) => (v === null ? '—' : v.toFixed(2));

  return (
    <div className="space-y-4">

      {/* ---------------------------------------- Row 1: trend + safety hero */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <Card
          title="Tren Temuan K3"
          subtitle={isFiltered ? `Hasil inspeksi 6 bulan sampai ${periodLabel}` : 'Hasil inspeksi 6 bulan terakhir'}
          className="lg:col-span-2 animate-fade-up"
          onClick={() => setDetailConfig({
            title: 'Hasil Inspeksi',
            fetchFn: getInspectionDetails,
            viewAllHref: '/dashboard/inspection',
            viewAllLabel: 'Lihat Semua Inspeksi',
          })}
        >
          {trendTotal === 0 ? (
            <EmptyHint label="Belum ada data inspeksi pada 6 bulan terakhir." />
          ) : (
            <div className="h-[260px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke={C.grid} strokeWidth={1} vertical={false} />
                  <XAxis
                    dataKey="month" tickLine={false} axisLine={{ stroke: C.axis }}
                    tick={{ fill: C.muted, fontSize: 11 }} dy={4}
                  />
                  <YAxis
                    allowDecimals={false} tickLine={false} axisLine={false}
                    tick={{ fill: C.muted, fontSize: 11 }} width={32}
                  />
                  <Tooltip
                    cursor={{ stroke: C.axis, strokeWidth: 1 }}
                    contentStyle={{
                      borderRadius: 10, border: `1px solid ${C.grid}`,
                      fontSize: 12, boxShadow: '0 4px 16px rgba(11,11,11,0.08)',
                    }}
                  />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  {/*
                    isAnimationActive={false} is load-bearing, not a preference:
                    recharts' entry animation never paints the line path under
                    React 19 here — the previous dashboard's pies/bars rendered
                    as empty cards for the same reason.
                  */}
                  <Line
                    name="Temuan Positif" dataKey="positif" stroke={C.positif}
                    strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                  <Line
                    name="Anomali" dataKey="anomali" stroke={C.anomali}
                    strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Safety hero — the number a safety board leads with */}
        <div className="animate-fade-up bg-slate-900 rounded-2xl shadow-sm p-5 flex flex-col text-white relative overflow-hidden" style={{ animationDelay: '60ms' }}>
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-2xl" />
          <div className="relative flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold">Rekor Keselamatan</h3>
              <span
                title="Rekor dihitung sepanjang waktu, tidak mengikuti filter periode."
                className="ml-auto text-[9px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 px-2 py-0.5 rounded-full"
              >
                Sepanjang Waktu
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hari Tanpa Insiden</p>
              {daysWithoutIncident === null ? (
                <p className="text-2xl font-black leading-tight mt-2 text-slate-300">Belum ada data</p>
              ) : (
                <p className="text-5xl font-black leading-none mt-2">
                  {daysWithoutIncident.toLocaleString('id-ID')}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-2">{streakLabel}</p>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Insiden</span>
                <span className={`text-lg font-black tabular-nums ${totalIncidents === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {totalIncidents}
                </span>
              </div>
              {insidenTipe.length > 0 ? (
                <div className="space-y-1">
                  {insidenTipe.map(t => (
                    <div key={t.tipe} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <Flame className="w-3 h-3 text-rose-400" />
                        {t.tipe}
                      </span>
                      <span className="font-bold tabular-nums">{t.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">Nihil — pertahankan catatan ini.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------ Section: lagging safety performance */}
      <SectionHeading
        icon={Activity}
        title="Performa Keselamatan"
        desc="Indikator standar industri — dihitung dari insiden terlapor dan estimasi man-hours"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Angka Kecelakaan" subtitle="TRIR & LTIFR — makin rendah makin baik" className="animate-fade-up">
          <div className="grid grid-cols-2 gap-3">
            <RateTile
              label="TRIR"
              value={fmtRate(safetyRates.trir)}
              caption="Recordable × 200.000 ÷ man-hours"
              tone={safetyRates.trir === null ? 'text-slate-300' : safetyRates.trir > 0 ? 'text-rose-600' : 'text-emerald-600'}
            />
            <RateTile
              label="LTIFR"
              value={fmtRate(safetyRates.ltifr)}
              caption="Lost-time × 1.000.000 ÷ man-hours"
              tone={safetyRates.ltifr === null ? 'text-slate-300' : safetyRates.ltifr > 0 ? 'text-rose-600' : 'text-emerald-600'}
            />
            <RateTile
              label="Recordable"
              value={String(safetyRates.recordable)}
              unit="kasus"
              caption="Medical Treatment, LTI, Fatality"
              tone={safetyRates.recordable > 0 ? 'text-amber-600' : 'text-emerald-600'}
            />
            <RateTile
              label="Rasio Near Miss"
              value={safetyRates.nearMissRatio === null ? '—' : String(safetyRates.nearMissRatio)}
              unit={safetyRates.nearMissRatio === null ? undefined : '%'}
              caption="Porsi laporan berupa nyaris celaka"
              tone="text-slate-700"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-3 leading-snug">
            Basis {safetyRates.manHours.toLocaleString('id-ID')} man-hours (estimasi dari jumlah pekerja PTW × 8 jam × 30 hari), bukan angka absensi tervalidasi.
          </p>
        </Card>

        <Card title="Piramida Keselamatan" subtitle="Sebaran keparahan — dasar lebar menandakan pelaporan dini yang sehat" className="animate-fade-up">
          {pyramid.every(p => p.value === 0) ? (
            <EmptyHint label="Belum ada insiden maupun temuan tercatat." />
          ) : (
            <div className="space-y-1.5 flex-1 flex flex-col justify-center">
              {pyramid.map(p => (
                <div key={p.tipe} className="flex items-center gap-2">
                  <div className="flex-1 flex justify-center">
                    <div
                      className="h-7 rounded flex items-center justify-center min-w-[36px] transition-all"
                      style={{
                        width: `${Math.max(14, (p.value / pyramidMax) * 100)}%`,
                        background: PYRAMID_TONE[p.tone],
                        boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.10)',
                      }}
                    >
                      <span className="text-[11px] font-black text-white tabular-nums drop-shadow-sm">{p.value}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 w-[104px] shrink-0 leading-tight">{p.tipe}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Status Investigasi Insiden" subtitle="Kelengkapan RCA atas insiden terlapor" className="animate-fade-up">
          {investigasiTotal === 0 ? (
            <EmptyHint label="Belum ada insiden yang dilaporkan." />
          ) : (
            <div className="space-y-5">
              <StackedRow
                label="Progres Investigasi"
                total={investigasiTotal}
                segments={[
                  { name: 'Selesai', value: investigasi.selesai, color: C.positif },
                  { name: 'Menunggu', value: investigasi.menunggu, color: C.warning },
                ]}
              />
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-600">Akar Masalah (RCA) Terisi</span>
                  <span className="text-lg font-black text-slate-800 tabular-nums">
                    {Math.round((investigasi.rcaLengkap / investigasiTotal) * 100)}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(investigasi.rcaLengkap / investigasiTotal) * 100}%`,
                      background: investigasi.rcaLengkap === investigasiTotal ? C.good : C.warning,
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  {investigasi.rcaLengkap} dari {investigasiTotal} insiden sudah punya analisis akar masalah.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ------------------------------------- Section: incident time pattern */}
      <SectionHeading
        icon={CalendarClock}
        title="Pola Waktu Insiden"
        desc="Kapan insiden paling sering terjadi — dasar untuk menambah pengawasan di jam/hari rawan"
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="Hari Rawan Insiden"
          subtitle="Sebaran insiden per hari dalam seminggu — sepanjang waktu"
          className="animate-fade-up"
        >
          {incidentPattern.sampleSize === 0 ? (
            <EmptyHint label="Belum ada insiden dengan tanggal & jam yang tercatat." />
          ) : (
            <>
              <div className="space-y-2.5 flex-1">
                {incidentPattern.weekday.map(w => (
                  <BarRow key={w.hari} label={w.hari} value={w.value} max={weekdayMax} color={C.anomali} />
                ))}
              </div>
              {peakWeekday && peakWeekday.value > 0 && (
                <p className="text-[10px] text-slate-400 mt-3 leading-snug">
                  Paling sering: <span className="font-bold text-slate-600">{peakWeekday.hari}</span> — pertimbangkan pengawasan ekstra di hari ini.
                </p>
              )}
            </>
          )}
        </Card>

        <Card
          title="Jam Rawan Insiden"
          subtitle="Sebaran insiden per segmen waktu — sepanjang waktu"
          className="animate-fade-up"
        >
          {incidentPattern.sampleSize === 0 ? (
            <EmptyHint label="Belum ada insiden dengan tanggal & jam yang tercatat." />
          ) : (
            <>
              <div className="space-y-2.5 flex-1">
                {incidentPattern.hour.map(h => (
                  <BarRow key={h.segmen} label={h.segmen} value={h.value} max={hourMax} color={C.anomali} />
                ))}
              </div>
              {peakHour && peakHour.value > 0 && (
                <p className="text-[10px] text-slate-400 mt-3 leading-snug">
                  Paling sering: <span className="font-bold text-slate-600">{peakHour.segmen}</span> — pertimbangkan pengawasan ekstra di jam ini.
                </p>
              )}
            </>
          )}
        </Card>
      </div>

      {/* --------------------------- Row 2: pipeline / prioritas / anomali */}
      <SectionHeading
        icon={ClipboardCheck}
        title="Alur Kerja & Tindak Lanjut"
        desc="Posisi dokumen, prioritas temuan, dan ketepatan jadwal"
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <Card
          title="Pipeline Persetujuan"
          subtitle="Posisi dokumen di tiap tahap"
          className="animate-fade-up"
          live
          onClick={() => setDetailConfig({
            title: 'Dokumen Menunggu Persetujuan',
            fetchFn: getPtwDetails,
            viewAllHref: '/dashboard/approval',
            viewAllLabel: 'Lihat Semua Persetujuan',
          })}
        >
          {pipeline.every(p => p.disetujui + p.menunggu === 0) ? (
            <EmptyHint label="Belum ada dokumen yang diajukan." />
          ) : (
            <div className="space-y-4">
              {pipeline.map(p => (
                <StackedRow
                  key={p.stage}
                  label={p.stage}
                  total={p.disetujui + p.menunggu}
                  segments={[
                    { name: 'Disetujui', value: p.disetujui, color: C.good },
                    { name: 'Menunggu', value: p.menunggu, color: C.warning },
                  ]}
                />
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Prioritas Anomali Terbuka"
          subtitle="Temuan yang belum ditutup"
          className="animate-fade-up"
          onClick={() => setDetailConfig({
            title: 'Tindak Lanjut Anomali',
            fetchFn: getAnomaliDetails,
            viewAllHref: '/dashboard/inspection',
            viewAllLabel: 'Lihat Semua Inspeksi',
          })}
        >
          {prioritasTotal === 0 ? (
            <EmptyHint label="Tidak ada anomali terbuka. Semua temuan sudah ditutup." />
          ) : (
            <div className="space-y-3">
              {prioritas.map((p, i) => (
                <div key={p.level} className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold text-slate-600">{PRIORITY_LABEL[p.level] ?? p.level}</span>
                    <span className="text-xs font-black text-slate-800 tabular-nums">{p.value}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(p.value / prioritasMax) * 100}%`, background: PRIORITY_RAMP[i] }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-slate-400 pt-1">
                Total {prioritasTotal} temuan menunggu tindak lanjut.
              </p>
            </div>
          )}
        </Card>

        <Card
          title="Tindak Lanjut & Jadwal"
          subtitle="Penyelesaian anomali dan ketepatan waktu proyek"
          className="animate-fade-up"
          onClick={() => setDetailConfig({
            title: 'Progres Proyek',
            fetchFn: getProjectScheduleDetails,
            viewAllHref: '/dashboard/ongoing',
            viewAllLabel: 'Lihat Semua Proyek',
          })}
        >
          <div className="space-y-5">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-bold text-slate-600">Penyelesaian Anomali</span>
                {closedPct !== null && (
                  <span className="text-lg font-black text-slate-800 tabular-nums">{closedPct}%</span>
                )}
              </div>
              {anomaliTotal === 0 ? (
                <p className="text-[11px] text-slate-400">Belum ada anomali tercatat.</p>
              ) : (
                <StackedRow
                  total={anomaliTotal}
                  segments={[
                    { name: 'Closed', value: anomali.closed, color: C.positif },
                    { name: 'Progres', value: anomali.progres, color: C.warning },
                    { name: 'Open', value: anomali.open, color: C.critical },
                  ]}
                />
              )}
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-600">Jadwal Proyek Aktif</span>
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                  Terkini
                </span>
              </div>
              {jadwalTotal === 0 ? (
                <p className="text-[11px] text-slate-400">Belum ada proyek berjalan.</p>
              ) : (
                <StackedRow
                  total={jadwalTotal}
                  segments={[
                    { name: 'On Schedule', value: jadwal.onSchedule, color: C.good },
                    { name: 'Terlambat', value: jadwal.terlambat, color: C.critical },
                  ]}
                />
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* -------------------- Section: responsiveness / permit operations */}
      <SectionHeading
        icon={Timer}
        title="Kecepatan Respons & Operasi Izin"
        desc="Lama persetujuan, umur temuan yang menganggur, dan izin kerja yang segera berakhir"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Waktu Siklus Persetujuan" subtitle="Rata-rata hari dari pengajuan sampai tahap selesai" className="animate-fade-up">
          {cycleTime.every(c => c.avgDays === null) ? (
            <EmptyHint label="Belum ada dokumen yang menyelesaikan tahap persetujuan." />
          ) : (
            <div className="space-y-3.5">
              {cycleTime.map(c => (
                <div key={c.stage}>
                  {c.avgDays === null ? (
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-600 truncate">{c.stage}</span>
                      <span className="text-[10px] font-medium text-slate-400 shrink-0">Belum ada data</span>
                    </div>
                  ) : (
                    <BarRow
                      label={c.stage}
                      value={Number(c.avgDays.toFixed(1))}
                      max={cycleMax}
                      suffix=" hari"
                      hint={`(${c.count})`}
                      color={c.avgDays <= 3 ? C.good : c.avgDays <= 7 ? C.warning : C.critical}
                    />
                  )}
                </div>
              ))}
              <p className="text-[10px] text-slate-400 pt-1 leading-snug">
                Angka dalam kurung = jumlah dokumen yang sudah melewati tahap tersebut. Dokumen yang masih berjalan tidak dihitung.
              </p>
            </div>
          )}
        </Card>

        <Card
          title="Umur Anomali Terbuka"
          subtitle="Makin lama menganggur, makin besar risikonya"
          className="animate-fade-up"
          onClick={() => setDetailConfig({
            title: 'Tindak Lanjut Anomali',
            fetchFn: getAnomaliDetails,
            viewAllHref: '/dashboard/inspection',
            viewAllLabel: 'Lihat Semua Inspeksi',
          })}
        >
          {agingTotal === 0 ? (
            <EmptyHint label="Tidak ada anomali terbuka. Semua temuan sudah ditutup." />
          ) : (
            <div className="space-y-3.5">
              {aging.map(a => (
                <BarRow
                  key={a.bucket}
                  label={a.bucket}
                  value={a.value}
                  max={Math.max(1, ...aging.map(x => x.value))}
                  color={AGING_TONE[a.tone]}
                />
              ))}
              {oldestOpenDays !== null && (
                <div className={`flex items-center gap-2 text-[11px] font-semibold rounded-lg px-3 py-2 mt-1 ${
                  oldestOpenDays > 30 ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600'
                }`}>
                  <Hourglass className="w-3.5 h-3.5 shrink-0" />
                  Temuan terlama menganggur {oldestOpenDays} hari.
                </div>
              )}
            </div>
          )}
        </Card>

        <Card
          title="Izin Kerja Segera Berakhir"
          subtitle="PTW terbit yang habis masa berlaku ≤ 7 hari"
          className="animate-fade-up"
          live
          onClick={() => setDetailConfig({
            title: 'Dokumen Menunggu Persetujuan',
            fetchFn: getPtwDetails,
            viewAllHref: '/dashboard/approval',
            viewAllLabel: 'Lihat Semua Persetujuan',
          })}
        >
          {ptwExpiring.length === 0 ? (
            <EmptyHint label="Tidak ada izin kerja yang mendekati masa berakhir." />
          ) : (
            <div className="space-y-2">
              {ptwExpiring.map((p, i) => {
                const expired = p.sisaHari < 0;
                const urgent = p.sisaHari >= 0 && p.sisaHari <= 2;
                return (
                  <div
                    key={`${p.nomor}-${i}`}
                    className={`rounded-xl border p-2.5 ${
                      expired ? 'border-rose-100 bg-rose-50/60'
                        : urgent ? 'border-amber-100 bg-amber-50/60'
                        : 'border-slate-100 bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate" title={p.proyek}>{p.proyek}</p>
                        <p className="text-[10px] text-slate-500 truncate" title={p.tipe}>{shortPermitLabel(p.tipe)}</p>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                        expired ? 'bg-rose-600 text-white'
                          : urgent ? 'bg-amber-500 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {expired ? `Lewat ${Math.abs(p.sisaHari)} hari` : p.sisaHari === 0 ? 'Hari ini' : `${p.sisaHari} hari lagi`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-400 font-medium">
                      <FileWarning className="w-3 h-3 shrink-0" />
                      <span className="truncate">{p.nomor}</span>
                      <span className="ml-auto tabular-nums shrink-0">s/d {p.validTo}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ------------------- Section: risk intelligence (hazards, hotspots) */}
      <SectionHeading
        icon={AlertTriangle}
        title="Peta Risiko"
        desc="Sumber bahaya yang paling sering muncul, lokasi rawan, dan sebaran jenis izin kerja"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Sumber Bahaya Terbanyak" subtitle="Dari deklarasi bahaya pada seluruh PTW" className="animate-fade-up">
          {topHazards.length === 0 ? (
            <EmptyHint label="Belum ada sumber bahaya yang dideklarasikan di PTW." />
          ) : (
            <div className="space-y-3">
              {topHazards.map((h, i) => (
                <BarRow
                  key={h.nama}
                  label={h.nama}
                  value={h.value}
                  max={hazardMax}
                  suffix=" PTW"
                  color={PRIORITY_RAMP[Math.min(3, Math.floor((i / Math.max(1, topHazards.length - 1)) * 3))]}
                />
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Lokasi Rawan"
          subtitle="Akumulasi anomali dan insiden per lokasi"
          className="animate-fade-up"
          onClick={() => setDetailConfig({
            title: 'Hasil Inspeksi',
            fetchFn: getInspectionDetails,
            viewAllHref: '/dashboard/inspection',
            viewAllLabel: 'Lihat Semua Inspeksi',
          })}
        >
          {hotspots.length === 0 ? (
            <EmptyHint label="Belum ada temuan atau insiden dengan data lokasi." />
          ) : (
            <div className="space-y-3">
              {hotspots.map(h => (
                <div key={h.lokasi} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600 truncate flex items-center gap-1.5" title={h.lokasi}>
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      {h.lokasi}
                    </span>
                    <span className="text-xs font-black text-slate-800 tabular-nums shrink-0">{h.total}</span>
                  </div>
                  <div className="flex gap-[2px] h-2">
                    <div
                      className="h-full rounded-l-full"
                      style={{ width: `${(h.anomali / hotspotMax) * 100}%`, background: C.anomali }}
                      title={`Anomali: ${h.anomali}`}
                    />
                    <div
                      className="h-full rounded-r-full"
                      style={{ width: `${(h.insiden / hotspotMax) * 100}%`, background: C.critical }}
                      title={`Insiden: ${h.insiden}`}
                    />
                  </div>
                  <div className="flex gap-3 text-[10px] font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: C.anomali }} />
                      Anomali <span className="font-bold text-slate-700">{h.anomali}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: C.critical }} />
                      Insiden <span className="font-bold text-slate-700">{h.insiden}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Jenis Izin Kerja" subtitle="Sebaran PTW menurut tipe izin" className="animate-fade-up">
          {ptwByType.length === 0 ? (
            <EmptyHint label="Belum ada PTW yang diajukan." />
          ) : (
            <div className="space-y-3">
              {ptwByType.map(t => (
                <BarRow
                  key={t.id}
                  label={shortPermitLabel(t.label)}
                  value={t.total}
                  max={ptwTypeMax}
                  color={t.color}
                  hint={t.aktif > 0 ? `${t.aktif} aktif` : undefined}
                />
              ))}
              <p className="text-[10px] text-slate-400 pt-1">
                Warna mengikuti kode warna resmi tiap formulir izin kerja.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* --------------------------------- Row 3: vendor safety scorecard */}
      <SectionHeading
        icon={Layers}
        title="Kinerja Vendor & Proyek"
        desc="Rapor keselamatan mitra kerja, kepatuhan CSMS, dan progres lapangan"
      />
      <Card
        title="Rapor Keselamatan Vendor"
        subtitle="Temuan K3 per vendor — diurutkan dari yang paling perlu perhatian"
        className="animate-fade-up"
        onClick={() => setDetailConfig({
          title: 'Tindak Lanjut Anomali',
          fetchFn: getAnomaliDetails,
          viewAllHref: '/dashboard/inspection',
          viewAllLabel: 'Lihat Semua Inspeksi',
        })}
      >
        {vendorScorecard.length === 0 ? (
          <EmptyHint label="Belum ada temuan inspeksi yang ditautkan ke vendor." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="text-left font-bold pb-2">Vendor</th>
                  <th className="text-right font-bold pb-2 w-24">Anomali</th>
                  <th className="text-right font-bold pb-2 w-24">Terbuka</th>
                  <th className="text-right font-bold pb-2 w-24">Positif</th>
                  <th className="text-left font-bold pb-2 w-40 pl-4">Rasio Anomali</th>
                </tr>
              </thead>
              <tbody>
                {vendorScorecard.map(v => (
                  <tr key={v.nama} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 pr-3 font-bold text-slate-700">{v.nama}</td>
                    <td className="py-2.5 text-right font-semibold text-slate-700 tabular-nums">{v.anomali}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {v.terbuka > 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold" style={{ color: C.critical }}>
                          <AlertTriangle className="w-3 h-3" />
                          {v.terbuka}
                        </span>
                      ) : (
                        <span className="font-semibold text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-slate-500 tabular-nums">{v.positif}</td>
                    <td className="py-2.5 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden min-w-[60px]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${v.rasio}%`,
                              background: v.rasio >= 50 ? C.critical : v.rasio >= 25 ? C.warning : C.good,
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-600 tabular-nums w-9 text-right">{v.rasio}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-400 mt-3">
              Rasio anomali = temuan tidak aman dibanding seluruh temuan vendor. Semakin rendah semakin baik.
            </p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Kepatuhan CSMS Vendor" subtitle="Status prakualifikasi keselamatan mitra kerja" className="animate-fade-up" live>
          {csmsTotal === 0 ? (
            <EmptyHint label="Belum ada vendor terdaftar." />
          ) : (
            <div className="space-y-4">
              <StackedRow
                total={csmsTotal}
                segments={csms.map(c => ({ name: c.status, value: c.value, color: csmsTone(c.status) }))}
              />
              <div className="grid grid-cols-2 gap-2 pt-2">
                {csms.map(c => (
                  <div key={c.status} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 truncate">
                      <BadgeCheck className="w-3.5 h-3.5 shrink-0" style={{ color: csmsTone(c.status) }} />
                      <span className="truncate" title={c.status}>{c.status}</span>
                    </span>
                    <span className="text-xs font-black text-slate-800 tabular-nums shrink-0 ml-2">{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card
          title="Progres Proyek vs Jadwal"
          subtitle="Membandingkan progres dilaporkan dengan waktu yang sudah terpakai"
          className="animate-fade-up"
          live
          onClick={() => setDetailConfig({
            title: 'Progres Proyek',
            fetchFn: getProjectScheduleDetails,
            viewAllHref: '/dashboard/ongoing',
            viewAllLabel: 'Lihat Semua Proyek',
          })}
        >
          {progresTotal === 0 ? (
            <EmptyHint label="Belum ada proyek aktif dengan rentang jadwal yang valid." />
          ) : (
            <div className="space-y-5">
              {progresMix.rataProgres !== null && (
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-600 inline-flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                      Rata-rata Progres Proyek Aktif
                    </span>
                    <span className="text-lg font-black text-slate-800 tabular-nums">{progresMix.rataProgres}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${progresMix.rataProgres}%`, background: C.positif }}
                    />
                  </div>
                </div>
              )}
              <div className="pt-4 border-t border-slate-100">
                <StackedRow
                  label="Posisi terhadap Jadwal"
                  total={progresTotal}
                  segments={[
                    { name: 'Lebih Cepat', value: progresMix.unggul, color: C.good },
                    { name: 'Sesuai', value: progresMix.sesuai, color: C.positif },
                    { name: 'Tertinggal', value: progresMix.tertinggal, color: C.critical },
                  ]}
                />
                <p className="text-[10px] text-slate-400 mt-2 leading-snug">
                  Sebuah proyek dihitung tertinggal bila progresnya ≥5% di bawah porsi waktu yang sudah berjalan.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------ Row 4: quick nav */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 animate-fade-up">
        <h3 className="text-sm font-bold text-slate-800 mb-1">Navigasi Cepat</h3>
        <p className="text-xs text-slate-400 mb-4">Klik kartu grafik di atas untuk rincian, atau lompat langsung ke alur kerja.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
          {QUICK_LINKS.map(link => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all"
              >
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${link.tone} transition-transform group-hover:scale-105`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-700 truncate">{link.label}</p>
                  <p className="text-xs text-slate-400 truncate">{link.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 shrink-0 transition-all group-hover:text-primary group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </div>

      <DashboardDetailModal config={detailConfig} onClose={() => setDetailConfig(null)} />
    </div>
  );
}
