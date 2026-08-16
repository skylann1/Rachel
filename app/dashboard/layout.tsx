import { createClient } from "@/utils/supabase/server";
import { logout } from "@/app/auth/login/actions";
import Link from "next/link";
import Image from "next/image";
import { SidebarNav } from "@/components/internal/sidebar-nav";
import { DesktopSidebar } from "@/components/internal/desktop-sidebar";
import { InternalMobileSidebar } from "@/components/internal/InternalMobileSidebar";
import { getUserPermissions } from "@/utils/permissions";
import {
  getUnreadCount,
  getNotificationPreferences,
} from "@/app/dashboard/inbox/actions";
import { InternalNotificationBell } from "@/components/internal/notification-bell";
import { getRoleLabel } from "@/lib/roles";

export default async function AuthDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const permissions = await getUserPermissions();
  const unreadCount = await getUnreadCount();
  const mutedTypes = await getNotificationPreferences();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const roleLabel = getRoleLabel(profile?.role);

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900">
      {/* Sidebar - Clean White Theme */}
      <DesktopSidebar
        user={user}
        permissions={permissions}
        roleLabel={roleLabel}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-20 flex items-center justify-between px-6 lg:px-8 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
          <div className="flex items-center">
            <InternalMobileSidebar
              userPermissions={permissions || {}}
              userEmail={user?.email || "admin@pgn.co.id"}
              roleLabel={roleLabel}
            />
            <div className="hidden lg:flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800 tracking-tight">
                RACHEL
              </span>
              <div className="flex h-5 items-center justify-center rounded-md border border-primary/20 bg-primary/5 px-1.5 font-mono text-[10px] font-bold text-primary ml-1">
                v0.1
              </div>
            </div>
            <p className="text-sm font-bold text-primary lg:hidden">RACHEL</p>
          </div>

          <div className="flex items-center gap-6">
            <InternalNotificationBell
              initialUnread={unreadCount}
              userId={user?.id}
              mutedTypes={mutedTypes}
            />
          </div>
        </header>

        {/* Sub-Header Banner */}
        <div className="bg-white border-b border-slate-200 border-l-4 border-l-slate-300 px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0 text-sm text-slate-600 shadow-sm z-10">
          <div className="font-medium text-slate-500">Request for Approval and Control of Hazard Evaluation Log</div>
          <div className="text-slate-500 text-xs">
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
          {/* Subtle Background Pattern for Main Area */}
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-50 pointer-events-none"></div>

          <div className="relative max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
