"use client";

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { ShieldCheck, Inbox, Flame } from 'lucide-react';
import type { VendorDashboardData } from '@/app/vendor/dashboard/actions';

/** Same validated palette as the internal dashboard (components/internal/interactive-dashboard.tsx). */
const C = {
  positif: '#2a78d6',
  anomali: '#eb6834',
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#898781',
};

function Card({ title, subtitle, className = '', children }: { title: string; subtitle?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col ${className}`}>
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
function StackedRow({ label, segments, total }: { label?: string; segments: { name: string; value: number; color: string }[]; total: number }) {
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

export function VendorDashboardCharts({ data }: { data: VendorDashboardData }) {
  const { trend, pipeline, anomali, insidenTipe, daysWithoutIncident, streakLabel, totalIncidents } = data;

  const trendTotal = trend.reduce((s, t) => s + t.positif + t.anomali, 0);
  const anomaliTotal = anomali.open + anomali.progres + anomali.closed;

  return (
    <div className="space-y-4">

      {/* -------------------------------------------- trend + safety hero */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <Card title="Tren Temuan K3" subtitle="Hasil inspeksi 6 bulan terakhir" className="lg:col-span-2 animate-fade-up">
          {trendTotal === 0 ? (
            <EmptyHint label="Belum ada data inspeksi pada 6 bulan terakhir." />
          ) : (
            <div className="h-[260px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke={C.grid} strokeWidth={1} vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: C.axis }} tick={{ fill: C.muted, fontSize: 11 }} dy={4} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: C.muted, fontSize: 11 }} width={32} />
                  <Tooltip
                    cursor={{ stroke: C.axis, strokeWidth: 1 }}
                    contentStyle={{ borderRadius: 10, border: `1px solid ${C.grid}`, fontSize: 12, boxShadow: '0 4px 16px rgba(11,11,11,0.08)' }}
                  />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
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
                <p className="text-5xl font-black leading-none mt-2">{daysWithoutIncident.toLocaleString('id-ID')}</p>
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

      {/* ------------------------------------------ pipeline + anomali */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Pipeline Persetujuan" subtitle="Posisi dokumen Anda di tiap tahap" className="animate-fade-up">
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

        <Card title="Tindak Lanjut Temuan" subtitle="Status penyelesaian anomali K3 Anda" className="animate-fade-up">
          {anomaliTotal === 0 ? (
            <EmptyHint label="Belum ada temuan anomali tercatat." />
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
        </Card>
      </div>
    </div>
  );
}
