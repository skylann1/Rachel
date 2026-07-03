import React from 'react';
import { Briefcase, Building2, ClipboardList, ShieldCheck, TrendingUp, Clock, AlertTriangle, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/server';

export default async function DashboardOverviewPage() {
   const supabase = await createClient();

   // 1. Fetch Proyek Aktif
   const { count: activeProjectsCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'Selesai')
      .neq('status', 'Ditolak');

   // 2. Fetch Total Vendors
   const { count: vendorsCount } = await supabase
      .from('vendor_profiles')
      .select('*', { count: 'exact', head: true });

   // 3. Fetch JSA Pending Review
   const { count: pendingJsaCount } = await supabase
      .from('jsa')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Menunggu Review'); // Asumsi status Menunggu Review

   // 4. Fetch JSA data for the chart (Current Year)
   const currentYear = new Date().getFullYear();
   const { data: jsaData } = await supabase
      .from('jsa')
      .select('status, created_at')
      .gte('created_at', `${currentYear}-01-01T00:00:00Z`)
      .lt('created_at', `${currentYear + 1}-01-01T00:00:00Z`);

   const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
   const chartData = monthNames.map(month => ({ month, approved: 0, rejected: 0, max: 0 }));

   if (jsaData) {
      jsaData.forEach(jsa => {
         const monthIndex = new Date(jsa.created_at).getMonth();
         if (jsa.status === 'Approved') chartData[monthIndex].approved++;
         if (jsa.status === 'Rejected') chartData[monthIndex].rejected++;
      });
   }

   // Calculate percentages for the chart height
   let maxCount = 0;
   chartData.forEach(d => {
      if (d.approved > maxCount) maxCount = d.approved;
      if (d.rejected > maxCount) maxCount = d.rejected;
   });

   if (maxCount === 0) maxCount = 1; // avoid division by zero

   // Normalize data for chart (height percentage)
   const normalizedChartData = chartData.slice(0, new Date().getMonth() + 1).map(d => ({
      month: d.month,
      approvedRaw: d.approved,
      rejectedRaw: d.rejected,
      approved: (d.approved / maxCount) * 100,
      rejected: (d.rejected / maxCount) * 100
   }));

   // Fetch current user for welcome message
   const { data: { user } } = await supabase.auth.getUser();
   const userName = user?.email?.split('@')[0].toUpperCase() || 'PENGGUNA';

   return (
      <div className="space-y-6">
         {/* Hero Banner */}
         <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-900 to-blue-600 p-6 sm:p-8 lg:p-10 text-white shadow-lg">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white opacity-10 blur-3xl"></div>
            <div className="absolute bottom-0 right-10 w-40 h-40 rounded-full bg-blue-400 opacity-20 blur-2xl"></div>
            <div className="absolute top-1/2 right-1/3 w-32 h-32 rounded-full bg-cyan-400 opacity-20 blur-2xl"></div>

            {/* Content */}
            <div className="relative z-10 w-full lg:w-3/5 xl:w-2/3 max-w-2xl">
               <h1 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold tracking-tight mb-2 drop-shadow-sm">
                  SELAMAT DATANG, {userName}
               </h1>
               <p className="text-blue-100 font-bold tracking-widest text-xs sm:text-sm mb-4 sm:mb-6 uppercase">
                  RACHEL SMART SYSTEM
               </p>
               <p className="text-blue-50/90 text-sm sm:text-base leading-relaxed">
                  Dashboard RACHEL (Request for Approval and Control of Hazard Evaluation Log) ini didesain untuk membantu pengawasan, verifikasi dokumen K3, serta pemantauan performa mitra kerja secara terpusat. Apabila terdapat kendala teknis atau pertanyaan lebih lanjut, silakan hubungi tim IT. Diharapkan sistem ini dapat meningkatkan kedisiplinan dan budaya keselamatan kerja yang lebih baik.
               </p>
            </div>

            {/* Decorative Illustration Area (Right Side) */}
            <div className="hidden lg:flex absolute right-4 xl:right-8 bottom-0 h-full items-end justify-center pointer-events-none">
               <div className="relative w-56 h-56 xl:w-80 xl:h-80 pb-2 xl:pb-4">
                  <Image
                     src="/assets/undraws/undraw_construction-workers_z99i.svg"
                     alt="Construction Workers Illustration"
                     fill
                     className="object-contain object-bottom drop-shadow-2xl"
                     priority
                  />
               </div>
            </div>
         </div>

         {/* Quick Stats Grid */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stat 1 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                     <Briefcase className="w-5 h-5" />
                  </div>
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                     <TrendingUp className="w-3 h-3" /> 12%
                  </span>
               </div>
               <h3 className="text-sm font-bold text-slate-500">Proyek Aktif</h3>
               <p className="text-2xl font-black text-slate-800 mt-1">{activeProjectsCount || 0}</p>
            </div>

            {/* Stat 2 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                     <Building2 className="w-5 h-5" />
                  </div>
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                     <TrendingUp className="w-3 h-3" /> Aktif
                  </span>
               </div>
               <h3 className="text-sm font-bold text-slate-500">Vendor Terverifikasi</h3>
               <p className="text-2xl font-black text-slate-800 mt-1">{vendorsCount || 0}</p>
            </div>

            {/* Stat 3 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                     <ClipboardList className="w-5 h-5" />
                  </div>
                  <Link href="/dashboard/jsa-review" className="text-xs font-bold text-primary hover:underline">
                     Lihat Semua
                  </Link>
               </div>
               <h3 className="text-sm font-bold text-slate-500">JSA Pending Review</h3>
               <p className="text-2xl font-black text-amber-600 mt-1">{pendingJsaCount || 0}</p>
            </div>

            {/* Stat 4 */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 shadow-sm">
               <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl bg-white text-primary flex items-center justify-center shadow-sm">
                     <ShieldCheck className="w-5 h-5" />
                  </div>
               </div>
               <h3 className="text-sm font-bold text-slate-600">Total Safe Man-Hours</h3>
               <p className="text-2xl font-black text-primary mt-1">1.2M+</p>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Main Chart (CSS Based for Mockup) */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col">
               <div className="flex justify-between items-center mb-6">
                  <div>
                     <h2 className="text-base font-bold text-slate-800">Tren Pengajuan JSA</h2>
                     <p className="text-xs text-slate-500">Statistik persetujuan JSA bulanan (Tahun 2026)</p>
                  </div>
                  <select className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none">
                     <option>Tahun 2026</option>
                     <option>Tahun 2025</option>
                  </select>
               </div>

               {/* Mockup Bar Chart using standard HTML/Tailwind */}
               <div className="flex-1 flex items-end justify-between gap-2 h-48 mt-4 overflow-x-auto">
                  {normalizedChartData.map((data, idx) => (
                     <div key={idx} className="flex flex-col items-center flex-1 group min-w-[3rem]">
                        <div className="relative w-full flex justify-center h-40 items-end gap-1">
                           {/* Rejected Bar */}
                           <div
                              className="w-1/3 bg-rose-200 rounded-t-md transition-all group-hover:bg-rose-300 relative"
                              style={{ height: `${data.rejected}%`, minHeight: data.rejected > 0 ? '4px' : '0' }}
                              title={`Ditolak: ${data.rejectedRaw}`}
                           >
                              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">{data.rejectedRaw}</span>
                           </div>
                           {/* Approved Bar */}
                           <div
                              className="w-1/3 bg-primary/80 rounded-t-md transition-all group-hover:bg-primary relative"
                              style={{ height: `${data.approved}%`, minHeight: data.approved > 0 ? '4px' : '0' }}
                              title={`Disetujui: ${data.approvedRaw}`}
                           >
                              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">{data.approvedRaw}</span>
                           </div>
                        </div>
                        <span className="text-xs font-bold text-slate-400 mt-3">{data.month}</span>
                     </div>
                  ))}
               </div>

               <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-primary/80"></div>
                     <span className="text-xs font-bold text-slate-600">Disetujui</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-rose-200"></div>
                     <span className="text-xs font-bold text-slate-600">Ditolak</span>
                  </div>
               </div>
            </div>

            {/* Recent Activity Timeline */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-base font-bold text-slate-800">Aktivitas Terbaru</h2>
                  <button className="text-xs font-bold text-primary hover:underline">Lihat Semua</button>
               </div>

               <div className="relative flex-1">
                  {/* Vertical Line */}
                  <div className="absolute left-3.5 top-2 bottom-0 w-px bg-slate-100"></div>

                  <div className="space-y-6">
                     {/* Activity 1 */}
                     <div className="relative pl-10">
                        <div className="absolute left-2.5 top-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-white"></div>
                        <p className="text-xs text-slate-400 font-bold mb-0.5">10 Menit yang lalu</p>
                        <p className="text-sm font-semibold text-slate-800">PTW Divalidasi (Project Manager)</p>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                           PTW-2026-001 untuk PT. Konstruksi Sejahtera telah divalidasi. Pekerjaan siap dimulai.
                        </p>
                     </div>

                     {/* Activity 2 */}
                     <div className="relative pl-10">
                        <div className="absolute left-2.5 top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-white"></div>
                        <p className="text-xs text-slate-400 font-bold mb-0.5">1 Jam yang lalu</p>
                        <p className="text-sm font-semibold text-slate-800">JSA Disetujui (HSE)</p>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                           JSA-2026-001 telah disetujui. PTW otomatis terbuat dan menunggu validasi PM.
                        </p>
                     </div>

                     {/* Activity 3 */}
                     <div className="relative pl-10">
                        <div className="absolute left-2.5 top-1.5 w-2 h-2 rounded-full bg-amber-500 ring-4 ring-white"></div>
                        <p className="text-xs text-slate-400 font-bold mb-0.5">3 Jam yang lalu</p>
                        <p className="text-sm font-semibold text-slate-800">Pengajuan JSA Baru</p>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                           CV. Karya Abadi mengajukan JSA baru untuk proyek Maintenance Boiler.
                        </p>
                     </div>

                     {/* Activity 4 */}
                     <div className="relative pl-10">
                        <div className="absolute left-2.5 top-1.5 w-2 h-2 rounded-full bg-rose-500 ring-4 ring-white"></div>
                        <p className="text-xs text-slate-400 font-bold mb-0.5">Kemarin, 14:30</p>
                        <p className="text-sm font-semibold text-slate-800">Insiden Kecil Dilaporkan</p>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                           Laporan insiden *near miss* pada area perancah B. Investigasi sedang berjalan.
                        </p>
                     </div>
                  </div>
               </div>
            </div>

         </div>
      </div>
   );
}
