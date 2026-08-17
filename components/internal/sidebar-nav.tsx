"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CheckCircle, FileSignature, Users, Shield, Building2, Briefcase, ClipboardList, Camera, AlertTriangle, Rocket, Archive, Siren } from 'lucide-react';

const menuUtama = [
  { name: 'Dashboard Overview', href: '/dashboard', icon: LayoutDashboard, permission: { module: 'dashboard', action: 'view' } },
  { name: 'My Task', href: '/dashboard/my-task', icon: CheckCircle, permission: { module: 'dashboard', action: 'view' } },
  { name: 'Inspeksi Proyek', href: '/dashboard/inspection', icon: Camera, permission: { module: 'inspection', action: 'view' } },
  { name: 'Laporan Insiden', href: '/dashboard/incident', icon: AlertTriangle, permission: { module: 'incident', action: 'view' } },
  { name: 'Kelola Proyek', href: '/dashboard/approval', icon: FileSignature, permission: { module: 'approval', action: 'view' } },
  { name: 'Proyek Berjalan', href: '/dashboard/ongoing', icon: Rocket, permission: { module: 'approval', action: 'view' } },
  { name: 'Status Lapangan', href: '/dashboard/site-status', icon: Siren, permission: { module: 'siteOps', action: 'view' } },
  { name: 'Arsip Proyek', href: '/dashboard/archive', icon: Archive, permission: { module: 'approval', action: 'view' } },
  { name: 'Dokumen Vendor', href: '/dashboard/vendor-docs', icon: ClipboardList, permission: { module: 'vendorDocs', action: 'view' } },
];

const masterData = [
  { name: 'Manajemen Akun', href: '/dashboard/master-data/account', icon: Users, permission: { module: 'masterData', action: 'view_account' } },
  { name: 'Role & Permission', href: '/dashboard/master-data/role', icon: Shield, permission: { module: 'masterData', action: 'manage_role' } },
  { name: 'Data Vendor', href: '/dashboard/master-data/vendor', icon: Building2, permission: { module: 'masterData', action: 'view_vendor' } },
  { name: 'Data Proyek', href: '/dashboard/master-data/project', icon: Briefcase, permission: { module: 'masterData', action: 'view_project' } },
];

export function SidebarNav({ userPermissions, isCollapsed }: { userPermissions: Record<string, string[]>, isCollapsed?: boolean }) {
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
    <nav className="flex-1 overflow-y-auto py-6 px-4 overflow-x-hidden">
      {!isCollapsed && <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase whitespace-nowrap">Menu Utama</div>}
      <ul className="space-y-1 mb-6">
        {filteredMenuUtama.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link 
                href={item.href}
                title={isCollapsed ? item.name : undefined}
                className={`flex items-center rounded-xl py-3 text-sm transition-all ${
                  isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                } ${
                  active 
                    ? 'font-bold bg-primary/10 text-primary' 
                    : 'font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${active ? '' : 'opacity-70'}`} />
                {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
              </Link>
            </li>
          );
        })}
      </ul>

      {filteredMasterData.length > 0 && (
        <>
          {!isCollapsed && <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase whitespace-nowrap">Master Data</div>}
          <ul className="space-y-1">
            {filteredMasterData.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link 
                    href={item.href}
                    title={isCollapsed ? item.name : undefined}
                    className={`flex items-center rounded-xl py-3 text-sm transition-all ${
                      isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                    } ${
                      active 
                        ? 'font-bold bg-primary/10 text-primary' 
                        : 'font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${active ? '' : 'opacity-70'}`} />
                    {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
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
