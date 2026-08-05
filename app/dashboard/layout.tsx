import { createClient } from "@/utils/supabase/server";
import { logout } from "@/app/auth/login/actions";
import Link from "next/link";
import Image from "next/image";
import { SidebarNav } from "@/components/internal/sidebar-nav";
import { DesktopSidebar } from "@/components/internal/desktop-sidebar";
import { InternalMobileSidebar } from "@/components/internal/InternalMobileSidebar";
import { getUserPermissions } from "@/utils/permissions";
import { getUnreadCount } from "@/app/dashboard/inbox/actions";
import { LayoutDashboard, CheckCircle, LogOut, FileSignature, ShieldCheck, Bell, Database, Users, Shield, Building2, Briefcase } from "lucide-react";

export default async function AuthDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const permissions = await getUserPermissions();
  const unreadCount = await getUnreadCount();

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900">

      {/* Sidebar - Clean White Theme */}
      <DesktopSidebar user={user} permissions={permissions} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">

        {/* Top Header */}
        <header className="h-20 flex items-center justify-between px-6 lg:px-8 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10">
          <div className="flex items-center">
            <InternalMobileSidebar
              userPermissions={permissions || {}}
              userEmail={user?.email || 'admin@pgn.co.id'}
            />
            <div className="hidden lg:flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800 tracking-tight">RACHEL</span>
              <div className="flex h-5 items-center justify-center rounded-md border border-primary/20 bg-primary/5 px-1.5 font-mono text-[10px] font-bold text-primary ml-1">
                v1.0
              </div>
            </div>
            <p className="text-sm font-bold text-primary lg:hidden">RACHEL</p>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/dashboard/inbox" className="relative p-2 text-slate-400 hover:text-primary transition-colors">
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 flex items-center justify-center bg-rose-500 rounded-full border-2 border-white text-[10px] font-black text-white px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Sub-Header Banner */}
        <div className="bg-white border-b border-slate-200 border-l-4 border-l-slate-300 px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0 text-sm text-slate-600 shadow-sm z-10">
          <div className="font-medium text-slate-500">
            Welcome to Rachel v1.0
          </div>
          <div className="text-slate-500 text-xs">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
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
