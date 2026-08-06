import React from 'react';
import { createClient } from "@/utils/supabase/server";
import Link from 'next/link';
import Image from 'next/image';
import {
  ClipboardList,
  FileSignature,
  Briefcase,
  Plus,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  ShieldCheck,
  FolderOpen
} from 'lucide-react';
import { getVendorDashboardData, getVendorRecentActivity } from './actions';

const JSA_BADGE: Record<string, { cls: string; icon: React.ElementType; label: string }> = {
  Approved: { cls: 'bg-emerald-50 text-emerald-600 border-emerald-200/50', icon: CheckCircle2, label: 'Disetujui' },
  Pending: { cls: 'bg-amber-50 text-amber-600 border-amber-200/50', icon: Clock, label: 'Menunggu Review' },
  Rejected: { cls: 'bg-rose-50 text-rose-600 border-rose-200/50', icon: AlertTriangle, label: 'Ditolak' },
  'Belum Ada': { cls: 'bg-slate-50 text-slate-500 border-slate-200/50', icon: FileSignature, label: 'Belum Ada' },
};

const PTW_BADGE: Record<string, string> = {
  Aktif: 'bg-emerald-50 text-emerald-600 border-emerald-200/50',
  'Menunggu Persetujuan': 'bg-blue-50 text-blue-600 border-blue-200/50',
  Ditolak: 'bg-rose-50 text-rose-600 border-rose-200/50',
  Expired: 'bg-slate-100 text-slate-500 border-slate-300/50',
  'Belum Terbit': 'bg-slate-50 text-slate-500 border-slate-200/50',
};

export default async function VendorDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { projects, stats } = await getVendorDashboardData();
  const activity = await getVendorRecentActivity();
  const userName = user?.email?.split('@')[0].toUpperCase() || 'MITRA';

  const statTiles = [
    { label: 'Total Proyek', value: stats.total, icon: Briefcase, gradient: 'from-blue-500 to-blue-600' },
    { label: 'JSA Menunggu Review', value: stats.pendingJsa, icon: FileSignature, gradient: 'from-amber-500 to-amber-600' },
    { label: 'PTW Aktif', value: stats.activePtw, icon: ShieldCheck, gradient: 'from-emerald-500 to-emerald-600' },
    { label: 'Butuh Tindakan', value: stats.needsAction, icon: AlertTriangle, gradient: 'from-rose-500 to-rose-600' },
  ];

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">

      {/* ── Hero ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-blue-800 p-6 sm:p-8 lg:p-10 text-white shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="pointer-events-none absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-16 w-44 h-44 rounded-full bg-blue-400/20 blur-2xl" />
        <div className="pointer-events-none absolute top-1/2 right-1/3 w-32 h-32 rounded-full bg-cyan-400/20 blur-2xl" />

        <div className="relative z-10 w-full lg:w-3/5 xl:w-2/3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white/10 backdrop-blur text-white/80 text-[10px] font-bold rounded-full border border-white/15 uppercase tracking-widest mb-4">
            <FolderOpen className="w-3 h-3" /> Portal Mitra Vendor
          </div>
          <h1 className="text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight mb-3 drop-shadow-sm">
            Selamat Datang, {userName}
          </h1>
          <p className="text-blue-50/80 text-sm sm:text-base leading-relaxed mb-8">
            Kelola pengajuan Prosedur Kerja, pantau status JSA (Job Safety Analysis), dan akses PTW (Permit to Work) untuk seluruh proyek Anda secara real-time di satu tempat.
          </p>

          <Link
            href="/vendor/dashboard/projects"
            className="inline-flex items-center justify-center gap-2 bg-white text-blue-900 hover:bg-blue-50 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-sm hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            Mulai Pengajuan K3
          </Link>
        </div>

        <div className="hidden lg:flex absolute right-4 xl:right-8 bottom-0 h-full items-end justify-center pointer-events-none">
           <div className="relative w-56 h-56 xl:w-80 xl:h-80 pb-2 xl:pb-4">
              <Image
                 src="/assets/undraws/undraw_construction-workers_z99i.svg"
                 alt="Vendor Illustration"
                 fill
                 className="object-contain object-bottom drop-shadow-2xl"
                 priority
              />
           </div>
        </div>
      </div>

      {/* ── Stat tiles ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '60ms' }}>
        {statTiles.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="group bg-white border border-slate-200 rounded-2xl p-4 flex gap-3 shadow-sm items-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className={`bg-gradient-to-br ${stat.gradient} text-white p-2.5 rounded-xl h-fit shadow-sm transition-transform duration-300 group-hover:scale-110`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{stat.label}</p>
                <p className="text-xl font-black text-slate-800 tabular-nums">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Project list ──────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" /> Status Proyek Terkini
            </h2>
            <Link href="/vendor/dashboard/projects" className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1">
              Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white border-2 border-dashed border-slate-200 rounded-2xl">
              <Briefcase className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">Belum ada proyek yang dikerjakan.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {projects.map((project) => {
                const jsaBadge = JSA_BADGE[project.jsaStatus] ?? JSA_BADGE['Belum Ada'];
                const JsaIcon = jsaBadge.icon;
                return (
                  <Link
                    key={project.id}
                    href={`/vendor/dashboard/projects/${project.id}/prosedur`}
                    className="group bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:shadow-md hover:border-slate-300 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{project.name}</p>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">Mulai {project.date}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${jsaBadge.cls}`}>
                        <JsaIcon className="w-3 h-3" /> JSA: {jsaBadge.label}
                      </span>
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-bold border ${PTW_BADGE[project.ptwStatus] ?? PTW_BADGE['Belum Terbit']}`}>
                        PTW: {project.ptwStatus}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-300 shrink-0 transition-all group-hover:text-primary group-hover:translate-x-0.5 hidden sm:block" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Activity sidebar ──────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 h-fit">
           <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Aktivitas Terakhir
           </h3>

           {activity.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-10 text-center">
               <Activity className="w-8 h-8 text-slate-300 mb-2" />
               <p className="text-sm font-medium text-slate-500">Belum ada aktivitas terbaru.</p>
             </div>
           ) : (
             <ul className="space-y-1">
               {activity.map((item) => {
                 const dotCls = item.type === 'success' ? 'bg-emerald-500' : item.type === 'danger' ? 'bg-rose-500' : 'bg-blue-500';
                 const Wrapper: any = item.link ? Link : 'div';
                 return (
                   <li key={item.id}>
                     <Wrapper
                       {...(item.link ? { href: item.link } : {})}
                       className="flex gap-3 py-2.5 px-2 -mx-2 rounded-xl hover:bg-slate-50 transition-colors"
                     >
                       <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
                       <div className="min-w-0">
                         <div className="flex items-center justify-between gap-2">
                           <h4 className="font-bold text-slate-800 text-xs truncate">{item.title}</h4>
                           <span className="text-[10px] font-bold text-slate-400 shrink-0">{item.time}</span>
                         </div>
                         <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5 line-clamp-2">{item.desc}</p>
                       </div>
                     </Wrapper>
                   </li>
                 );
               })}
             </ul>
           )}
        </div>

      </div>
    </div>
  );
}
