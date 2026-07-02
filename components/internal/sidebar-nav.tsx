"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CheckCircle, FileSignature, Users, Shield, Building2, Briefcase, ClipboardList, Camera, AlertTriangle } from 'lucide-react';

const menuUtama = [
  { name: 'Dashboard Overview', href: '/dashboard', icon: LayoutDashboard, permission: { module: 'dashboard', action: 'view' } },
  { name: 'Inspeksi & Temuan K3', href: '/dashboard/inspection', icon: Camera, permission: { module: 'inspection', action: 'view' } },
  { name: 'Laporan Insiden', href: '/dashboard/incident', icon: AlertTriangle, permission: { module: 'incident', action: 'view' } },
  { name: 'Verifikasi Dokumen', href: '/dashboard/approval', icon: FileSignature, permission: { module: 'approval', action: 'view' } },
];

const masterData = [
  { name: 'Manajemen Akun', href: '/dashboard/master-data/account', icon: Users, permission: { module: 'masterData', action: 'view_account' } },
  { name: 'Role & Permission', href: '/dashboard/master-data/role', icon: Shield, permission: { module: 'masterData', action: 'manage_role' } },
  { name: 'Data Vendor', href: '/dashboard/master-data/vendor', icon: Building2, permission: { module: 'masterData', action: 'view_vendor' } },
  { name: 'Data Proyek', href: '/dashboard/master-data/project', icon: Briefcase, permission: { module: 'masterData', action: 'view_project' } },
];

export function SidebarNav({ userPermissions }: { userPermissions: Record<string, string[]> }) {
  const pathname = usePathname();

  // Helper to check if a path is active
  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname?.startsWith(href);
  };

  const hasAccess = (module: string, action: string) => {
    // If no permission object provided, fallback to false (safe side)
    if (!userPermissions) return false;
    const perms = userPermissions[module];
    if (!Array.isArray(perms)) return false;
    return perms.includes(action);
  };

  const filteredMenuUtama = menuUtama.filter(item => hasAccess(item.permission.module, item.permission.action));
  const filteredMasterData = masterData.filter(item => hasAccess(item.permission.module, item.permission.action));

  return (
    <nav className="flex-1 overflow-y-auto py-6 px-4">
      <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">Menu Utama</div>
      <ul className="space-y-1 mb-6">
        {filteredMenuUtama.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link 
                href={item.href} 
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all ${
                  active 
                    ? 'font-bold bg-primary/10 text-primary' 
                    : 'font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? '' : 'opacity-70'}`} />
                {item.name}
              </Link>
            </li>
          );
        })}
      </ul>

      {filteredMasterData.length > 0 && (
        <>
          <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">Master Data</div>
          <ul className="space-y-1">
            {filteredMasterData.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link 
                href={item.href} 
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all ${
                  active 
                    ? 'font-bold bg-primary/10 text-primary' 
                    : 'font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? '' : 'opacity-70'}`} />
                {item.name}
              </Link>
            </li>
          );
            })}
          </ul>
        </>
      )}
    </nav>
  );
}
