import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Mail, Lock, ArrowRight } from 'lucide-react';
import { login } from "./actions";

export default async function InternalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left Column: Form */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 sm:px-16 lg:px-24 bg-white relative z-10 shadow-2xl">
        
        {/* Logo/Brand */}
        <div className="absolute top-8 left-8 sm:left-16 lg:left-24 flex items-center gap-2">
           <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30">
              <ShieldCheck className="w-6 h-6" />
           </div>
           <div>
              <span className="text-xl font-black text-slate-800 tracking-tight leading-none block">SIPERMIT</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Internal Portal</span>
           </div>
        </div>

        <div className="w-full max-w-sm mx-auto mt-16 lg:mt-0">
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

              <button 
                formAction={login}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-primary/30 group"
              >
                 Masuk ke Sistem
                 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
               </button>
           </form>

           <div className="mt-8 pt-8 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500 font-medium">
                 Vendor atau Kontraktor? <Link href="/vendor/login" className="font-bold text-primary hover:underline">Masuk via Portal Vendor</Link>
              </p>
           </div>
        </div>

        {/* Footer info */}
        <div className="absolute bottom-8 left-0 right-0 text-center text-xs font-medium text-slate-400">
           &copy; {new Date().getFullYear()} Departemen HSE. All rights reserved.
        </div>
      </div>

      {/* Right Column: Visual/Banner */}
      <div className="hidden lg:block lg:w-[55%] relative overflow-hidden bg-slate-900">
         {/* Background Image using generic Unsplash industrial/construction photo */}
         <img 
            src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1600&q=80" 
            alt="Industrial Background" 
            className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
         />
         
         {/* Gradient Overlay */}
         <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-slate-900/80 to-slate-900"></div>
         
         {/* Decorative elements */}
         <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
         <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>

         <div className="absolute inset-0 flex flex-col justify-center items-start px-24">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 backdrop-blur-md mb-6">
               <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
               <span className="text-xs font-bold text-white tracking-wider uppercase">Sistem Internal Berjalan Baik</span>
            </div>
            <h2 className="text-5xl font-black text-white leading-[1.1] tracking-tight mb-6">
               Keselamatan<br />
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Dimulai dari Tim Kita.</span>
            </h2>
            <p className="text-lg text-slate-300 font-medium leading-relaxed max-w-lg mb-12">
               Portal SIPERMIT khusus manajemen internal. Verifikasi JSA, validasi PTW, dan pantau keselamatan seluruh area proyek dalam satu kendali terpusat.
            </p>

            <div className="grid grid-cols-2 gap-8">
               <div>
                  <h4 className="text-3xl font-black text-white mb-1">Zero</h4>
                  <p className="text-sm text-slate-400 font-medium uppercase tracking-wider">Accident Target</p>
               </div>
               <div>
                  <h4 className="text-3xl font-black text-white mb-1">100%</h4>
                  <p className="text-sm text-slate-400 font-medium uppercase tracking-wider">Digital PTW</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
