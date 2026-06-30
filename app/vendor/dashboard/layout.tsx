import { createClient } from "@/utils/supabase/server";
import { logout } from "@/app/vendor/login/actions";
import Link from "next/link";
import { LayoutDashboard, FileSignature, LogOut, Briefcase, ShieldAlert, Stamp, Users, Truck, AlertTriangle } from "lucide-react";

export default async function VendorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex h-screen w-full bg-muted/20">
      <aside className="w-64 flex-shrink-0 border-r bg-card flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b">
          <Briefcase className="h-6 w-6 text-primary mr-2" />
          <span className="font-bold text-lg text-primary tracking-tight">Portal Vendor</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            <li>
              <Link href="/vendor/dashboard" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-foreground">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard Vendor
              </Link>
            </li>
            <li>
              <Link href="/vendor/dashboard/projects" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                Proyek Aktif
              </Link>
            </li>
            <li>
              <Link href="/vendor/dashboard/pengajuan" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground">
                <FileSignature className="h-4 w-4" />
                Pengajuan Projek
              </Link>
            </li>
            <li>
              <Link href="/vendor/dashboard/jsa" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground">
                <ShieldAlert className="h-4 w-4" />
                Pengajuan JSA
              </Link>
            </li>
            <li>
              <Link href="/vendor/dashboard/ptw" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground">
                <Stamp className="h-4 w-4" />
                Pengajuan PTW
              </Link>
            </li>
            <li>
              <Link href="/vendor/dashboard/inspection" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                Inbox Temuan K3
              </Link>
            </li>
            <li>
              <Link href="/vendor/dashboard/incident" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                Laporan Insiden
              </Link>
            </li>
            
            {/* Divider */}
            <li className="pt-4 pb-2 px-3">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Data Master
              </div>
            </li>

            <li>
              <Link href="/vendor/dashboard/pekerja" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground">
                <Users className="h-4 w-4" />
                Data Pekerja
              </Link>
            </li>
            <li>
              <Link href="/vendor/dashboard/peralatan" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground">
                <Truck className="h-4 w-4" />
                Data Peralatan
              </Link>
            </li>
          </ul>
        </nav>
        <div className="p-4 border-t">
          <form action={logout}>
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10">
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 border-b bg-card">
          <div className="font-medium text-sm text-muted-foreground">Mitra Kerja</div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">{user?.email}</span>
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
