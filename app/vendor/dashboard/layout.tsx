import { createClient } from "@/utils/supabase/server";
import { VendorMobileSidebar } from "@/components/vendor-mobile-sidebar";
import { VendorDesktopSidebar } from "@/components/vendor/desktop-sidebar";
import { VendorNotificationBell } from "@/components/vendor/notification-bell";
import { getUnreadCount, getNotificationPreferences } from "@/app/dashboard/inbox/actions";
import Link from "next/link";

export default async function VendorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const unreadCount = await getUnreadCount();
  const mutedTypes = await getNotificationPreferences();

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <VendorDesktopSidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30 shrink-0">
          <div className="flex items-center">
            <VendorMobileSidebar />
            <div className="hidden md:block leading-tight">
              <p className="text-xs font-bold text-slate-800">Portal Vendor</p>
              <p className="text-[11px] text-slate-400">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <p className="font-bold text-sm text-primary md:hidden">Portal Vendor</p>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <VendorNotificationBell initialUnread={unreadCount} userId={user?.id} mutedTypes={mutedTypes} />
            <div className="w-px h-6 bg-slate-200 hidden sm:block" />
            <Link href="/vendor/dashboard/profile" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <span className="text-sm font-semibold text-slate-700 hidden sm:block">{user?.email}</span>
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 relative bg-slate-50">
          {children}
        </div>
      </main>
    </div>
  );
}
