import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Mail, Lock, ArrowRight } from 'lucide-react';
import { login } from "./actions";
import { SubmitButton } from "@/components/submit-button";

const BAR_HEIGHTS = [40, 65, 50, 80, 55, 90, 70];

export default async function InternalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Column: Form */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 sm:px-16 lg:px-24 bg-white relative z-10">
        <div className="absolute inset-0 bg-[radial-gradient(#f1f5f9_1.5px,transparent_1.5px)] [background-size:26px_26px] pointer-events-none" />

        {/* Logo/Brand */}
        <div className="absolute top-8 left-8 sm:left-16 lg:left-24 flex items-center gap-2 z-10">
           <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30">
              <ShieldCheck className="w-6 h-6" />
           </div>
           <div>
              <span className="text-xl font-black text-slate-800 tracking-tight leading-none block">RACHEL</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Internal Portal</span>
           </div>
        </div>

        <div className="relative w-full max-w-sm mx-auto mt-16 lg:mt-0">
           <div className="mb-10 text-center lg:text-left">
              <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Login Internal</h1>
              <p className="text-sm text-slate-500 leading-relaxed">Akses khusus untuk Tim HSE, Project Manager, dan Administrator Korporat.</p>
           </div>

           <form className="space-y-6">
              <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-700">Email Korporat</label>
                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                       <Mail className="w-5 h-5 text-slate-400" />
                    </div>
                    <input
                       id="email"
                       name="email"
                       type="email"
                       placeholder="nama@perusahaan.com"
                       required
                       className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm font-medium"
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-slate-700">Kata Sandi</label>
                 </div>
                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                       <Lock className="w-5 h-5 text-slate-400" />
                    </div>
                    <input
                       id="password"
                       name="password"
                       type="password"
                       placeholder="••••••••"
                       required
                       className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm font-medium"
                    />
                 </div>
              </div>

              <div className="flex items-center gap-2">
                 <input type="checkbox" id="remember" className="w-4 h-4 rounded text-primary focus:ring-primary/30 border-slate-300" />
                 <label htmlFor="remember" className="text-sm text-slate-600 font-medium select-none cursor-pointer">Ingat saya</label>
              </div>

              {resolvedSearchParams?.error && (
                <div className="text-sm font-medium text-rose-500 text-center bg-rose-50 p-2 rounded-lg border border-rose-100">
                  {resolvedSearchParams.error}
                </div>
              )}

              <SubmitButton
                formAction={login}
                pendingText="Memproses..."
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-primary/30 group disabled:opacity-70"
              >
                 Masuk ke Sistem
                 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
               </SubmitButton>
           </form>

           <div className="mt-8 pt-8 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500 font-medium">
                 Vendor atau Kontraktor? <Link href="/vendor/login" className="font-bold text-primary hover:underline">Masuk via Portal Vendor</Link>
              </p>
           </div>
        </div>

        {/* Footer info */}
        <div className="relative mt-auto lg:absolute lg:bottom-8 lg:left-0 lg:right-0 pt-10 lg:pt-0 text-center text-xs font-medium text-slate-400">
           &copy; {new Date().getFullYear()} Departemen HSE. All rights reserved.
        </div>
      </div>

      {/* Right Column: Command-center preview */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-slate-950 items-center justify-center p-16">
         <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1.5px,transparent_1.5px)] [background-size:28px_28px]" />
         <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-primary/20 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
         <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

         <div className="relative z-10 max-w-lg w-full">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-md mb-6">
               <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
               <span className="text-xs font-bold text-white tracking-wider uppercase">Live Monitoring Aktif</span>
            </div>
            <h2 className="text-4xl font-black text-white leading-[1.15] tracking-tight mb-4">
               Kendali Penuh untuk<br />
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Keselamatan Kerja.</span>
            </h2>
            <p className="text-sm text-slate-400 font-medium leading-relaxed mb-10 max-w-md">
               Verifikasi JSA, validasi PTW, dan pantau seluruh proyek dari satu dashboard terpusat.
            </p>

            {/* Mock dashboard preview */}
            <div className="relative">
               <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-emerald-400/20 rounded-2xl blur-xl opacity-60" />
               <div className="relative bg-slate-900/80 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ringkasan Hari Ini</span>
                     <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                     </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                     <div className="bg-white/5 rounded-xl p-3">
                        <div className="text-xl font-black text-white">24</div>
                        <div className="text-[10px] font-semibold text-slate-400 mt-0.5">Proyek Aktif</div>
                     </div>
                     <div className="bg-white/5 rounded-xl p-3">
                        <div className="text-xl font-black text-white">156</div>
                        <div className="text-[10px] font-semibold text-slate-400 mt-0.5">PTW Terbit</div>
                     </div>
                     <div className="bg-white/5 rounded-xl p-3">
                        <div className="text-xl font-black text-emerald-400">0</div>
                        <div className="text-[10px] font-semibold text-slate-400 mt-0.5">Insiden Bulan Ini</div>
                     </div>
                  </div>
                  <div className="flex items-end gap-1.5 h-16">
                     {BAR_HEIGHTS.map((h, i) => (
                        <div
                           key={i}
                           className="flex-1 rounded-t-sm bg-gradient-to-t from-primary to-blue-400"
                           style={{ height: `${h}%` }}
                        />
                     ))}
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
