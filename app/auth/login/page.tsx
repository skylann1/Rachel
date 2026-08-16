import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Mail, Lock, ArrowRight, Fingerprint, Radio } from 'lucide-react';
import { login } from "./actions";
import { SubmitButton } from "@/components/submit-button";

export default async function InternalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      {/* Left Column: Identity / access panel */}
      <div className="relative lg:w-[50%] bg-slate-950 flex flex-col overflow-hidden px-8 sm:px-14 py-10 lg:py-14">
        {/* Blueprint grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:34px_34px]" />
        <div className="absolute top-0 left-0 w-[550px] h-[550px] bg-primary/20 rounded-full blur-3xl -translate-y-1/3 -translate-x-1/4" />
        <div className="absolute bottom-0 right-0 w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-3xl translate-y-1/3 translate-x-1/4" />

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xl font-black text-white tracking-tight leading-none block">RACHEL</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Portal Internal</span>
          </div>
        </div>

        {/* Headline + ID card */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-md py-12 lg:py-0">
          <div className="inline-flex w-fit items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-md mb-6">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-white tracking-wider uppercase">Akses Personel Terverifikasi</span>
          </div>
          <h1 className="text-4xl font-black text-white leading-[1.15] tracking-tight mb-4">
            Satu Portal untuk<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Seluruh Tim HSE.</span>
          </h1>
          <p className="text-sm text-slate-400 font-medium leading-relaxed mb-3">
            Khusus untuk Tim HSE, Project Manager, dan Pengelola Aset yang terdaftar di sistem.
          </p>
          <p className="text-xs text-slate-500 font-medium leading-relaxed mb-10">
            RACHEL — <span className="italic">Request for Approval and Control of Hazard Evaluation Log</span>
          </p>

          {/* Digital badge mock */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-emerald-400/20 rounded-2xl blur-xl opacity-60" />
            <div className="relative bg-slate-900/80 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl p-5">
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kartu Akses Digital</span>
                <Fingerprint className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <div className="w-5 h-5 rounded-sm bg-gradient-to-br from-blue-400 to-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-2.5 w-32 bg-white/15 rounded-full mb-2" />
                  <div className="h-2 w-20 bg-white/10 rounded-full" />
                </div>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Aktif
                </span>
              </div>
              <div className="flex items-center gap-1 mt-5 h-4">
                {Array.from({ length: 28 }).map((_, i) => (
                  <span
                    key={i}
                    className="flex-1 bg-white/15 rounded-full"
                    style={{ height: i % 3 === 0 ? '100%' : '55%' }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs font-medium text-slate-500">
          &copy; {new Date().getFullYear()} Departemen HSE. All rights reserved.
        </div>
      </div>

      {/* Right Column: Form */}
      <div className="relative lg:w-[50%] flex items-center justify-center px-8 sm:px-16 py-16">
        <div className="absolute inset-0 bg-[radial-gradient(#f1f5f9_1.5px,transparent_1.5px)] [background-size:26px_26px] pointer-events-none" />

        <div className="relative w-full max-w-sm">
          <div className="mb-10">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Login Internal</h2>
            <p className="text-sm text-slate-500 leading-relaxed">Masuk dengan akun korporat yang telah didaftarkan oleh administrator.</p>
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
              <label className="text-sm font-bold text-slate-700">Kata Sandi</label>
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
              Mitra Kerja atau Kontraktor? <Link href="/vendor/login" className="font-bold text-primary hover:underline">Masuk via Portal Mitra Kerja</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
