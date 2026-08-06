import React from 'react';
import { Briefcase, Building2, ShieldCheck, Clock, ArrowUpRight, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { InteractiveDashboard, DashboardData } from '@/components/internal/interactive-dashboard';
import { getEffectivePtwStatus } from '@/lib/ptw-status';
import { isJsaPending } from '@/lib/jsa-status';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const ANOMALI_TYPES = ['Unsafe Act', 'Unsafe Condition'];
const POSITIF_TYPES = ['Safe Act', 'Safe Condition'];

/** Bucket key for a date, matching the 6-month trend window. */
function monthKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export default async function DashboardOverviewPage() {
   const supabase = await createClient();
   const now = new Date();

   // ---------------------------------------------------------------- fetches
   const [
     { count: vendorsCount },
     { data: projects },
     { data: procedures },
     { data: jsas },
     { data: ptws },
     { data: inspections },
     { data: incidents },
   ] = await Promise.all([
     supabase.from('vendor_profiles').select('*', { count: 'exact', head: true }),
     supabase.from('projects').select('status, start_date, end_date'),
     supabase.from('procedures').select('status'),
     supabase.from('jsa').select('status'),
     supabase.from('ptw').select('status, workers, projects ( end_date )'),
     supabase.from('inspections').select('status, finding_type, priority, created_at'),
     supabase.from('incidents').select('type, incident_date'),
   ]);

   // ------------------------------------------------------------- projects
   // 'Ditolak' is neither active nor late — it is out of the pipeline entirely.
   const activeProjects = (projects || []).filter(p => p.status !== 'Selesai' && p.status !== 'Ditolak');
   const onSchedule = activeProjects.filter(p => new Date(p.end_date) >= now).length;
   const terlambat = activeProjects.filter(p => new Date(p.end_date) < now).length;

   // ------------------------------------------------------------- pipeline
   const procMenunggu = (procedures || []).filter(p => p.status === 'Draft' || p.status === 'Menunggu Review PM').length;
   const procDisetujui = (procedures || []).filter(p => p.status === 'Prosedur Disetujui').length;

   const jsaMenunggu = (jsas || []).filter(j => isJsaPending(j.status)).length;
   const jsaDisetujui = (jsas || []).filter(j => j.status === 'JSA Disetujui').length;

   const ptwPendingStatuses = ['Draft', 'Menunggu Approval PM', 'Review PTW Issuer', 'Menunggu Penomoran HSSE'];
   const ptwMenunggu = (ptws || []).filter(p => ptwPendingStatuses.includes(p.status)).length;
   const ptwDisetujui = (ptws || []).filter(p => {
     const proj: any = Array.isArray(p.projects) ? p.projects[0] : p.projects;
     return getEffectivePtwStatus(p.status, proj?.end_date) === 'PTW Aktif';
   }).length;

   // Safe Man-Hours: 8 hours * 30 days * total workers across all PTWs
   const totalWorkers = (ptws || []).reduce(
     (sum, p) => sum + (Array.isArray(p.workers) ? p.workers.length : 0), 0
   );
   const safeManHours = totalWorkers * 8 * 30;

   // ---------------------------------------------------------- inspections
   const anomalies = (inspections || []).filter(i => ANOMALI_TYPES.includes(i.finding_type));
   const positives = (inspections || []).filter(i => POSITIF_TYPES.includes(i.finding_type));

   const anomaliOpen = anomalies.filter(i => i.status === 'Open').length;
   const anomaliProgres = anomalies.filter(i => i.status === 'In Progress').length;
   const anomaliClosed = anomalies.filter(i => i.status === 'Closed').length;

   // Priority profile of anomalies still needing action — data the old dashboard never surfaced.
   const openAnomalies = anomalies.filter(i => i.status !== 'Closed');
   const prioritas = (['Low', 'Medium', 'High', 'Critical'] as const).map(level => ({
     level,
     value: openAnomalies.filter(i => i.priority === level).length,
   }));

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
     if (role === 'admin') return p.status === 'Menunggu Approval PM' || p.status === 'Review PTW Issuer' || p.status === 'Menunggu Penomoran HSSE';
     if (role === 'pm') return p.status === 'Menunggu Approval PM';
     if (role === 'hse') return p.status === 'Review PTW Issuer' || p.status === 'Menunggu Penomoran HSSE';
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
     jadwal: { onSchedule, terlambat },
     insidenTipe,
     daysWithoutIncident,
     streakLabel,
     totalIncidents: incidentList.length,
     safeManHours,
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
                 <p className="text-sm text-slate-500 mt-1">Ringkasan Performa K3 — {currentMonth}.</p>
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

             <div className="relative flex items-center gap-2">
               <div className="flex items-center border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50 text-sm font-medium text-slate-700">
                 <Clock className="w-4 h-4 mr-2 text-primary" /> {currentMonth}
               </div>
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
