import { createClient } from "@/utils/supabase/server";
import { VendorMobileSidebar } from "@/components/vendor-mobile-sidebar";
import { VendorDesktopSidebar } from "@/components/vendor/desktop-sidebar";
import Link from "next/link";

export default async function VendorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex h-screen w-full bg-muted/20">
      <VendorDesktopSidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 border-b bg-card">
          <div className="flex items-center">
            <VendorMobileSidebar />
            <div className="font-medium text-sm text-muted-foreground hidden md:block">Mitra Kerja</div>
            <div className="font-bold text-sm text-primary md:hidden">Portal Vendor</div>
          </div>
          <Link href="/vendor/dashboard/profile" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
            <span className="text-sm font-medium hidden sm:block">{user?.email}</span>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
          </Link>
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

        <div className="flex-1 overflow-y-auto p-4 md:p-6 relative">
          {children}
        </div>
      </main>
    </div>
  );
}
