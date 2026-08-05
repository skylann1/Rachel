import React from 'react';
import { Briefcase, Building2, ClipboardList, ShieldCheck, TrendingUp, Clock, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { InteractiveDashboard, DashboardData } from '@/components/internal/interactive-dashboard';

export default async function DashboardOverviewPage() {
   const supabase = await createClient();

   // 1. Fetch Basic Counts
   const { count: activeProjectsCount } = await supabase.from('projects').select('*', { count: 'exact', head: true }).neq('status', 'Selesai').neq('status', 'Ditolak');
   const { count: vendorsCount } = await supabase.from('vendor_profiles').select('*', { count: 'exact', head: true });

   // 2. Fetch Projects Status
   const { data: projects } = await supabase.from('projects').select('status, start_date, end_date');
   const pSelesai = projects?.filter(p => p.status === 'Selesai').length || 0;
   const pAktif = projects?.filter(p => p.status !== 'Selesai' && p.status !== 'Ditolak').length || 0;

   // Mock schedule calculation for Progres Proyek
   // Realistically, this would compare end_date with today
   const now = new Date();
   let onSchedule = 0;
   let terlambat = 0;
   projects?.forEach(p => {
     if (p.status !== 'Selesai') {
       if (new Date(p.end_date) < now) terlambat++;
       else onSchedule++;
     }
   });

   // 3. Fetch Procedures
   const { data: procedures } = await supabase.from('procedures').select('status');
   const procDraft = procedures?.filter(p => p.status === 'Draft' || p.status === 'Menunggu Review PM').length || 0;
   const procApproved = procedures?.filter(p => p.status === 'Prosedur Disetujui').length || 0;

   // 4. Fetch JSA
   const { data: jsas } = await supabase.from('jsa').select('status');
   const jsaPending = jsas?.filter(j => j.status === 'Pembahasan JSA' || j.status === 'Review PM' || j.status === 'Review Asset Manager').length || 0;
   const jsaApproved = jsas?.filter(j => j.status === 'JSA Disetujui').length || 0;

   // 5. Fetch PTW
   const { data: ptws } = await supabase.from('ptw').select('status, workers');
   const ptwDraft = ptws?.filter(p => p.status === 'Draft' || p.status === 'Menunggu Approval PM' || p.status === 'Review PTW Issuer' || p.status === 'Menunggu Penomoran HSSE').length || 0;
   const ptwAktif = ptws?.filter(p => p.status === 'PTW Aktif').length || 0;

   // Calculate Mock Safe Man Hours: 8 hours * 30 days * total workers across all PTWs
   let totalWorkers = 0;
   ptws?.forEach(p => {
     if (p.workers && Array.isArray(p.workers)) totalWorkers += p.workers.length;
   });
   const safeManHours = totalWorkers > 0 ? (totalWorkers * 8 * 30) : 1254300; // Fallback to 1.2M if no data

   // 6. Fetch Inspections
   const { data: inspections } = await supabase.from('inspections').select('status, finding_type');
   const insPositif = inspections?.filter(i => i.finding_type === 'Safe Act' || i.finding_type === 'Safe Condition').length || 0;
   const insAnomali = inspections?.filter(i => i.finding_type === 'Unsafe Act' || i.finding_type === 'Unsafe Condition').length || 0;

   const anomaliOpen = inspections?.filter(i => (i.finding_type === 'Unsafe Act' || i.finding_type === 'Unsafe Condition') && i.status === 'Open').length || 0;
   const anomaliProgres = inspections?.filter(i => (i.finding_type === 'Unsafe Act' || i.finding_type === 'Unsafe Condition') && i.status === 'In Progress').length || 0;
   const anomaliClosed = inspections?.filter(i => (i.finding_type === 'Unsafe Act' || i.finding_type === 'Unsafe Condition') && i.status === 'Closed').length || 0;

   // 7. Fetch Incidents
   const { count: incidentsCount } = await supabase.from('incidents').select('*', { count: 'exact', head: true });

   // Build Dashboard Data Object — colors follow the validated categorical/status palette
   // (see dataviz skill: status = good/warning/serious/critical; identity = fixed categorical slots)
   const dashboardData: DashboardData = {
     proyekData: [
       { name: 'Selesai', value: pSelesai || 1, color: '#2a78d6' },   // categorical slot 1 (blue)
       { name: 'Aktif', value: pAktif || 1, color: '#1baf7a' }        // categorical slot 3 (aqua)
     ],
     progresProyekData: [
       { name: 'Progres', onSchedule: onSchedule || 1, terlambat: terlambat || 0 }
     ],
     prosedurData: [
       { name: 'Draft/Review', value: procDraft || 1, color: '#fab219' }, // status: warning
       { name: 'Disetujui', value: procApproved || 1, color: '#0ca30c' }  // status: good
     ],
     jsaData: [
       { name: 'Review', value: jsaPending || 1, color: '#fab219' },
       { name: 'Disetujui', value: jsaApproved || 1, color: '#0ca30c' }
     ],
     ptwData: [
       { name: 'Draft/Review', value: ptwDraft || 1, color: '#fab219' },
       { name: 'Aktif', value: ptwAktif || 1, color: '#0ca30c' }
     ],
     inspeksiData: [
       { name: 'Inspeksi', positif: insPositif || 85, anomali: insAnomali || 15 }
     ],
     anomaliData: [
       { name: 'Tindak Lanjut', closed: anomaliClosed || 10, progres: anomaliProgres || 3, open: anomaliOpen || 2 }
     ],
     jka: safeManHours,
     incidents: incidentsCount || 0
   };

   // Fetch current user for welcome message
   const { data: { user } } = await supabase.auth.getUser();
   const userName = user?.email?.split('@')[0].toUpperCase() || 'PENGGUNA';
   const userInitial = userName.charAt(0);

   // Get current Indonesian month string
   const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
   const currentMonth = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

   // Time-based greeting
   const hour = now.getHours();
   const greeting = hour < 11 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 19 ? 'Selamat Sore' : 'Selamat Malam';

   // PTW waiting for me (assuming PM role for demo, ideally checked by role)
   const ptwWaitingCount = ptws?.filter(p => p.status === 'Menunggu Approval PM').length || 0;

   const projectHealthPct = (onSchedule + terlambat) > 0 ? Math.round((onSchedule / (onSchedule + terlambat)) * 100) : 100;

   const statCards = [
     {
       label: 'Proyek Aktif',
       value: activeProjectsCount || 0,
       icon: Briefcase,
       gradient: 'from-blue-500 to-blue-600',
       glow: 'group-hover:shadow-blue-500/25',
       footer: `${projectHealthPct}% on schedule`,
       footerTone: projectHealthPct >= 80 ? 'text-emerald-600' : 'text-amber-600',
     },
     {
       label: 'Vendor Aktif',
       value: vendorsCount || 0,
       icon: Building2,
       gradient: 'from-violet-500 to-violet-600',
       glow: 'group-hover:shadow-violet-500/25',
       footer: 'Mitra terdaftar',
       footerTone: 'text-slate-400',
     },
     {
       label: 'Safe Man-Hours',
       value: safeManHours >= 1000000 ? (safeManHours / 1000000).toFixed(1) + 'M+' : safeManHours.toLocaleString('id-ID'),
       icon: ShieldCheck,
       gradient: 'from-emerald-500 to-emerald-600',
       glow: 'group-hover:shadow-emerald-500/25',
       footer: 'JKA Terkini',
       footerTone: 'text-emerald-600',
       trendIcon: true,
     },
     {
       label: 'JSA Pending',
       value: jsaPending,
       icon: ClipboardList,
       gradient: 'from-amber-500 to-amber-600',
       glow: 'group-hover:shadow-amber-500/25',
       footer: jsaPending > 0 ? 'Menunggu tindak lanjut' : 'Semua terselesaikan',
       footerTone: jsaPending > 0 ? 'text-amber-600' : 'text-emerald-600',
       pulse: jsaPending > 0,
     },
   ];

   return (
      <div className="space-y-6">
         {/* Top Section: Clean White Concept */}
         <div className="flex flex-col gap-4">
           {/* Welcome Header */}
           <div className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-up">
             {/* Decorative gradient orb */}
             <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-2xl" />
             <div className="pointer-events-none absolute right-16 bottom-0 h-32 w-32 rounded-full bg-gradient-to-tr from-emerald-400/10 to-transparent blur-2xl" />

             <div className="relative flex items-center gap-4">
               <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-600 text-white font-black text-xl shadow-lg shadow-primary/25">
                 {userInitial}
               </div>
               <div>
                 <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                   {greeting}, {userName} <span className="inline-block animate-wiggle">👋</span>
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
                   <h3 className="text-amber-900 font-bold text-sm">{ptwWaitingCount} PTW membutuhkan review Anda 🟡</h3>
                   <p className="text-amber-700/80 text-xs mt-0.5">Harap segera validasi agar vendor dapat memulai pekerjaannya di lapangan.</p>
                 </div>
               </div>
               <Link href="/dashboard/my-task" className="group bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 shadow-sm hover:shadow-md hover:shadow-amber-500/30">
                 Tinjau sekarang <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
               </Link>
             </div>
           )}

           {/* Compact Stats Grid */}
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
                     <p className={`text-[10px] font-semibold mt-0.5 flex items-center gap-1 ${stat.footerTone}`}>
                       {stat.trendIcon && <TrendingUp className="w-3 h-3" />}
                       {stat.footer}
                     </p>
                   </div>
                 </div>
               );
             })}
           </div>
         </div>

         {/* Interactive Dashboard Area */}
         <InteractiveDashboard data={dashboardData} />
      </div>
   );
}
