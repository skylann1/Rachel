import { login } from "./actions";
import { Checkbox } from "@/components/ui/checkbox"; // We don't have shadcn checkbox installed yet, let's use standard HTML for MVP to avoid build errors, or I can install it.
import Image from "next/image";

export default async function VendorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <div className="flex min-h-screen w-full font-sans">
      {/* Left Side - Hero / Illustration */}
      <div 
        className="hidden lg:flex w-1/2 relative overflow-hidden flex-col text-white p-10 bg-cover bg-center"
        style={{ backgroundImage: "url('/assets/banner/banner5.jpeg')" }}
      >
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-slate-900/80 z-0"></div>
        
        {/* Abstract Circles */}
        <div className="absolute top-20 right-20 w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center z-0">
          <div className="w-8 h-8 bg-white/40 rounded-full blur-sm" />
        </div>
        <div className="absolute bottom-40 right-40 w-24 h-24 rounded-full border-4 border-white/20 flex items-center justify-center z-0">
          <div className="w-12 h-12 bg-white/30 rounded-full blur-md" />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-lg text-center flex flex-col items-center mb-auto mt-12 self-center">
          <p className="text-sm font-medium tracking-wide mb-2 opacity-90">Nice to see you again</p>
          <h1 className="text-5xl font-extrabold tracking-widest mb-6">WELCOME BACK</h1>
          
          <div className="w-12 h-1 bg-white mb-6 rounded-full" />

          <p className="text-xs leading-relaxed opacity-80 max-w-sm">
            Portal Vendor SIPERMIT K3 adalah platform tata kelola digital terintegrasi untuk menyederhanakan, mendigitalisasi, dan mempercepat alur birokrasi dokumen keselamatan kerja.
          </p>
        </div>

        {/* Logos at bottom */}
        <div className="relative z-20 mt-auto flex flex-col items-center gap-2 self-center pb-8">
          <span className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold">Powered by</span>
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-24">
              <Image 
                src="/assets/logo/pertamina-logo-white .png" 
                alt="Pertamina Logo" 
                fill
                className="object-contain object-center"
              />
            </div>
            <div className="w-px h-6 bg-white/30"></div>
            <div className="relative h-8 w-24">
              <Image 
                src="/assets/logo/pgn-logo-white .png" 
                alt="PGN Logo" 
                fill
                className="object-contain object-center"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white text-slate-900">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-primary mb-3">Login Account</h2>
            <p className="text-xs text-slate-400">
              Silakan masuk menggunakan kredensial vendor Anda untuk mengakses dashboard dan mengirimkan form Digital JSA.
            </p>
          </div>

          <form className="space-y-6">
            {/* Input Email */}
            <div className="relative flex items-center">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-md" />
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Email ID"
                required
                className="w-full h-12 pl-4 pr-4 bg-slate-50 border-none rounded-md outline-none focus:ring-1 focus:ring-primary text-sm placeholder:text-slate-300"
              />
            </div>

            {/* Input Password */}
            <div className="relative flex items-center">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-md" />
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Password"
                required
                className="w-full h-12 pl-4 pr-4 bg-slate-50 border-none rounded-md outline-none focus:ring-1 focus:ring-primary text-sm placeholder:text-slate-300"
              />
            </div>

            {/* Checkbox and links */}
            <div className="flex items-center text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-500">
                <input type="checkbox" className="rounded text-primary border-slate-300 focus:ring-primary" />
                <span>Keep me signed in</span>
              </label>
            </div>

            {resolvedSearchParams?.error && (
              <div className="text-sm font-medium text-red-500 text-center">
                {resolvedSearchParams.error}
              </div>
            )}

            {/* Submit Button */}
            <button
              formAction={login}
              className="w-full h-12 mt-4 bg-primary text-white font-bold rounded-full shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
