"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Rocket, ClipboardCheck, AlertTriangle, Archive, ListChecks, ArrowRight,
  ShieldCheck, Inbox, CalendarClock, Flame,
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
  daysWithoutIncident: number | null;
  streakLabel: string;
  totalIncidents: number;
  safeManHours: number;
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
  title, subtitle, onClick, className = '', children,
}: {
  title: string; subtitle?: string; onClick?: () => void; className?: string; children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''} ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
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

/* ------------------------------------------------------------------- main */

export function InteractiveDashboard({ data }: { data: DashboardData }) {
  const [detailConfig, setDetailConfig] = useState<DetailModalConfig | null>(null);

  const { trend, pipeline, prioritas, anomali, jadwal, insidenTipe, daysWithoutIncident, streakLabel, totalIncidents, vendorScorecard } = data;

  const trendTotal = trend.reduce((s, t) => s + t.positif + t.anomali, 0);
  const anomaliTotal = anomali.open + anomali.progres + anomali.closed;
  const prioritasTotal = prioritas.reduce((s, p) => s + p.value, 0);
  const prioritasMax = Math.max(1, ...prioritas.map(p => p.value));
  const jadwalTotal = jadwal.onSchedule + jadwal.terlambat;
  const closedPct = anomaliTotal > 0 ? Math.round((anomali.closed / anomaliTotal) * 100) : null;

  return (
    <div className="space-y-4">

      {/* ---------------------------------------- Row 1: trend + safety hero */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <Card
          title="Tren Temuan K3"
          subtitle="Hasil inspeksi 6 bulan terakhir"
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

      {/* --------------------------- Row 2: pipeline / prioritas / anomali */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <Card
          title="Pipeline Persetujuan"
          subtitle="Posisi dokumen di tiap tahap"
          className="animate-fade-up"
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

      {/* --------------------------------- Row 3: vendor safety scorecard */}
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
