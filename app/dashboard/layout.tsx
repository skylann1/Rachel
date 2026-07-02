import { createClient } from "@/utils/supabase/server";
import { logout } from "@/app/auth/login/actions";
import Link from "next/link";
import Image from "next/image";
import { SidebarNav } from "@/components/internal/sidebar-nav";
import { getUserPermissions } from "@/utils/permissions";
import { LayoutDashboard, CheckCircle, LogOut, FileSignature, ShieldCheck, Bell, Database, Users, Shield, Building2, Briefcase } from "lucide-react";

export default async function AuthDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const permissions = await getUserPermissions();

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900">
      
      {/* Sidebar - Clean White Theme */}
      <aside className="w-72 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col hidden lg:flex shadow-sm z-20">
        
        {/* Sidebar Header - Logos */}
        <div className="h-20 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="relative h-6 w-20">
              <Image 
                src="/assets/logo/pertaminia-removebg-preview.png" 
                alt="Pertamina" 
                fill
                className="object-contain object-left"
              />
            </div>
            <div className="w-px h-6 bg-slate-300"></div>
            <div className="relative h-7 w-14">
              <Image 
                src="/assets/logo/pgn-logo.png" 
                alt="PGN" 
                fill
                className="object-contain object-left"
              />
            </div>
          </div>
        </div>

        {/* Sidebar User Info */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner">
              {user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-800 truncate">{user?.email || 'admin@pgn.co.id'}</p>
              <p className="text-xs text-slate-500 font-medium">HSE Manager</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <SidebarNav userPermissions={permissions || {}} />

        {/* Logout */}
        <div className="p-4 border-t border-slate-100">
          <form action={logout}>
            <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">
              <LogOut className="h-5 w-5" />
              Keluar Sistem
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-20 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10">
          <div>
            <p className="text-sm font-semibold text-slate-500">
              Developed by <span className="text-primary font-bold tracking-tight">SIPERMIT</span>
              team
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            <Link href="/dashboard/inbox" className="relative p-2 text-slate-400 hover:text-primary transition-colors">
              <Bell className="h-6 w-6" />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          {/* Subtle Background Pattern for Main Area */}
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-50 pointer-events-none"></div>
          
          <div className="relative max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
