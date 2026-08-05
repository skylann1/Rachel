"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, LabelList, Legend
} from 'recharts';
import {
  Rocket, ShieldAlert, ClipboardCheck, AlertTriangle, Archive, ListChecks, ArrowRight
} from 'lucide-react';

export interface DashboardData {
  proyekData: { name: string; value: number; color: string }[];
  progresProyekData: { name: string; onSchedule: number; terlambat: number }[];
  prosedurData: { name: string; value: number; color: string }[];
  jsaData: { name: string; value: number; color: string }[];
  ptwData: { name: string; value: number; color: string }[];
  inspeksiData: { name: string; positif: number; anomali: number }[];
  anomaliData: { name: string; closed: number; progres: number; open: number }[];
  jka: number;
  incidents: number;
}

const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: '1px solid #e1e0d9',
  fontSize: 12,
  boxShadow: '0 4px 16px rgba(11,11,11,0.08)',
};

const ChartCard = ({ title, children, onClick }: { title: string, children: React.ReactNode, onClick?: () => void }) => (
  <div
    className={`group bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col h-56 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
  >
    <h3 className="text-xs font-bold text-slate-700 text-center mb-2 pb-1.5 inline-block mx-auto relative after:content-[''] after:absolute after:left-1/2 after:-translate-x-1/2 after:-bottom-0 after:h-0.5 after:w-8 after:rounded-full after:bg-gradient-to-r after:from-primary after:to-blue-400 after:transition-all group-hover:after:w-12">
      {title}
    </h3>
    <div className="flex-1 w-full relative">
      {children}
    </div>
  </div>
);

const QUICK_LINKS = [
  { label: 'Proyek Berjalan', desc: 'Pantau PTW aktif & progres lapangan', href: '/dashboard/ongoing', icon: Rocket, tone: 'bg-blue-50 text-blue-600' },
  { label: 'Persetujuan', desc: 'Prosedur, JSA & PTW menunggu review', href: '/dashboard/approval', icon: ClipboardCheck, tone: 'bg-amber-50 text-amber-600' },
  { label: 'Inbox Temuan K3', desc: 'Tindak lanjuti inspeksi & anomali', href: '/dashboard/inspection', icon: ListChecks, tone: 'bg-emerald-50 text-emerald-600' },
  { label: 'Laporan Insiden', desc: 'Investigasi insiden yang dilaporkan', href: '/dashboard/incident', icon: AlertTriangle, tone: 'bg-rose-50 text-rose-600' },
  { label: 'Arsip Proyek', desc: 'Riwayat proyek yang telah selesai', href: '/dashboard/archive', icon: Archive, tone: 'bg-slate-100 text-slate-600' },
];

export function InteractiveDashboard({ data }: { data: DashboardData }) {
  const router = useRouter();

  const {
    proyekData,
    progresProyekData,
    prosedurData,
    jsaData,
    ptwData,
    inspeksiData,
    anomaliData,
    jka,
    incidents
  } = data;

  const goTo = (href: string) => router.push(href);

  return (
    <div className="flex flex-col xl:flex-row gap-6 mt-6">
      {/* Left Column: Charts Area */}
      <div className="flex-1 flex flex-col gap-6">

        {/* Row 1: 5 Small Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">

          <ChartCard title="Jumlah Proyek" onClick={() => goTo('/dashboard/ongoing')}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={proyekData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="80%" paddingAngle={2} cornerRadius={4}>
                  {proyekData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="#fcfcfb" strokeWidth={2} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Progres Proyek" onClick={() => goTo('/dashboard/ongoing')}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progresProyekData} layout="vertical" margin={{ left: -30, right: 10 }} barGap={2}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" hide />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(37,106,191,0.06)' }} />
                <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                <Bar name="On Schedule" dataKey="onSchedule" stackId="a" fill="#0ca30c" radius={[4, 0, 0, 4]}>
                    <LabelList dataKey="onSchedule" position="center" fill="#fff" fontWeight="bold"/>
                </Bar>
                <Bar name="Terlambat" dataKey="terlambat" stackId="a" fill="#d03b3b" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="terlambat" position="center" fill="#fff" fontWeight="bold"/>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Jumlah Prosedur" onClick={() => goTo('/dashboard/approval')}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={prosedurData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="80%" innerRadius="40%" paddingAngle={2} cornerRadius={4}>
                  {prosedurData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="#fcfcfb" strokeWidth={2} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Jumlah JSA" onClick={() => goTo('/dashboard/approval')}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={jsaData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="80%" innerRadius="40%" paddingAngle={2} cornerRadius={4}>
                  {jsaData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="#fcfcfb" strokeWidth={2} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Jumlah PTW" onClick={() => goTo('/dashboard/approval')}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={ptwData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="80%" paddingAngle={2} cornerRadius={4}>
                  {ptwData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="#fcfcfb" strokeWidth={2} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

        </div>

        {/* Row 2: Inspeksi, Anomali, Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          <ChartCard title="Hasil Inspeksi" onClick={() => goTo('/dashboard/inspection')}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inspeksiData} margin={{ left: -30, right: 10, top: 20 }} barGap={4}>
                <XAxis dataKey="name" hide />
                <YAxis hide />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(37,106,191,0.06)' }} />
                <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                <Bar name="Aspek Positif" dataKey="positif" fill="#0ca30c" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="positif" position="top" fill="#64748b" fontWeight="bold"/>
                </Bar>
                <Bar name="Anomali" dataKey="anomali" fill="#ec835a" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="anomali" position="top" fill="#64748b" fontWeight="bold"/>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Tindak Lanjut Anomali" onClick={() => goTo('/dashboard/inspection')}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={anomaliData} layout="vertical" margin={{ left: -40, right: 10 }} barGap={2}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" hide />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(37,106,191,0.06)' }} />
                <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                <Bar name="Closed" dataKey="closed" stackId="b" fill="#0ca30c" radius={[4, 0, 0, 4]}>
                    <LabelList dataKey="closed" position="center" fill="#fff" fontWeight="bold"/>
                </Bar>
                <Bar name="Progres" dataKey="progres" stackId="b" fill="#fab219" >
                    <LabelList dataKey="progres" position="center" fill="#fff" fontWeight="bold"/>
                </Bar>
                <Bar name="Open" dataKey="open" stackId="b" fill="#d03b3b" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="open" position="center" fill="#fff" fontWeight="bold"/>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center h-56 transition-all duration-300 hover:shadow-md">
            <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">HSSE Statistik</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Safe Man-Hours</p>
                <p className="text-3xl font-black text-slate-800 tabular-nums">{jka.toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Total Insiden</p>
                <p className={`text-3xl font-black tabular-nums ${incidents === 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {incidents}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Right Column: Quick Navigation */}
      <div className="w-full xl:w-96 flex-shrink-0 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold text-slate-800">Navigasi Cepat</h3>
        </div>
        <p className="text-xs text-slate-400 mb-4">Klik grafik di samping, atau pilih pintasan berikut untuk masuk ke alur kerja terkait.</p>

        <div className="flex-1 flex flex-col gap-2">
          {QUICK_LINKS.map((link) => {
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

    </div>
  );
}
