import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, ArrowRight, HardHat, FileCheck, Zap } from "lucide-react";
import { login } from "./actions";
import { SubmitButton } from "@/components/submit-button";

export default async function VendorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-slate-950 px-4 py-16">

      {/* Caution-stripe accent bar — vendor/field-work signature */}
      <div
        className="absolute top-0 left-0 right-0 h-2 z-20"
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, #f59e0b 0 14px, #0f172a 14px 28px)' }}
      />

      {/* Background photo */}
      <Image
        src="/assets/banner/banner5.jpeg"
        alt="Vendor Industrial Background"
        fill
        priority
        className="object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/95 via-slate-950/90 to-slate-950" />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 sm:p-10">

          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center text-slate-900 shadow-lg shadow-amber-500/30 mb-4">
              <HardHat className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">RACHEL</h1>
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest mt-1">Portal Mitra Kerja</span>
          </div>

          <div className="mb-8 text-center">
            <h2 className="text-lg font-bold text-white mb-1.5">Masuk sebagai Mitra Kerja</h2>
            <p className="text-sm text-slate-400 leading-relaxed">Akses khusus untuk mitra kerja dan kontraktor terdaftar.</p>
          </div>

          <form className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Email Mitra Kerja</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="nama@perusahaan.com"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:bg-white/10 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 outline-none transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Kata Sandi</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:bg-white/10 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 outline-none transition-all text-sm font-medium"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-400 font-medium cursor-pointer select-none">
              <input type="checkbox" className="w-4 h-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/40" />
              Ingat saya
            </label>

            {resolvedSearchParams?.error && (
              <div className="text-xs font-medium text-rose-300 text-center bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                {resolvedSearchParams.error}
              </div>
            )}

            <SubmitButton
              formAction={login}
              pendingText="Memproses..."
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-amber-500/20 group disabled:opacity-70"
            >
              Masuk sebagai Vendor
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </SubmitButton>
          </form>

          <div className="mt-7 pt-6 border-t border-white/10 flex items-center justify-center gap-5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
              <FileCheck className="w-3.5 h-3.5 text-emerald-400" /> 100% Digital
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Proses Cepat
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 font-medium mt-6">
          Staf Internal? <Link href="/auth/login" className="font-bold text-amber-400 hover:underline">Masuk via Portal Internal</Link>
        </p>
      </div>
    </div>
  );
}
