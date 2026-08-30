import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { logout } from "@/app/pgsol/login/actions";

export default async function PgsolDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <p className="font-bold text-sm text-primary">Portal PGSOL</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link href="/pgsol/dashboard" className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            Beranda
          </Link>
          <Link href="/dashboard/approval" className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            Review JSA
          </Link>
          <Link href="/pgsol/dashboard/projects" className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            Proyek Saya
          </Link>
          <Link href="/pgsol/dashboard/staff" className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            Staff Organisasi
          </Link>
          <Link href="/pgsol/dashboard/profile" className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
            Profil Saya
          </Link>
        </nav>
        <form action={logout} className="p-3 border-t border-slate-100">
          <button type="submit" className="w-full px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 text-left">
            Keluar
          </button>
        </form>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30 shrink-0">
          <p className="font-bold text-sm text-primary md:hidden">Portal PGSOL</p>
          <div className="flex items-center gap-2.5 ml-auto">
            <span className="text-sm font-semibold text-slate-700 hidden sm:block">{user?.email}</span>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 relative bg-slate-50">
          {children}
        </div>
      </main>
    </div>
  );
}
