"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CheckCircle, FileSignature, Users, Shield, Building2, Briefcase, ClipboardList, Camera, AlertTriangle, Rocket, Archive, Siren, BookOpen, Megaphone } from 'lucide-react';
import type { SidebarBadges } from '@/app/dashboard/actions/sidebar-badges';

const menuUtama = [
  { name: 'Dashboard Overview', href: '/dashboard', icon: LayoutDashboard, permission: { module: 'dashboard', action: 'view' } },
  { name: 'My Task', href: '/dashboard/my-task', icon: CheckCircle, permission: { module: 'dashboard', action: 'view' }, badgeKey: 'myTask' as const },
  { name: 'Inspeksi Proyek', href: '/dashboard/inspection', icon: Camera, permission: { module: 'inspection', action: 'view' }, badgeKey: 'openInspections' as const },
  { name: 'Laporan Insiden', href: '/dashboard/incident', icon: AlertTriangle, permission: { module: 'incident', action: 'view' }, badgeKey: 'openIncidents' as const },
  { name: 'Kelola Proyek', href: '/dashboard/approval', icon: FileSignature, permission: { module: 'approval', action: 'view' }, badgeKey: 'pendingApproval' as const },
  { name: 'Proyek Berjalan', href: '/dashboard/ongoing', icon: Rocket, permission: { module: 'approval', action: 'view' }, badgeKey: 'ongoingProjects' as const },
  { name: 'Status Lapangan', href: '/dashboard/site-status', icon: Siren, permission: { module: 'siteOps', action: 'view' } },
  { name: 'Arsip Proyek', href: '/dashboard/archive', icon: Archive, permission: { module: 'approval', action: 'view' } },
  { name: 'Dokumen Vendor', href: '/dashboard/vendor-docs', icon: ClipboardList, permission: { module: 'vendorDocs', action: 'view' } },
  { name: 'Panduan Alur K3', href: '/dashboard/panduan', icon: BookOpen, permission: { module: 'dashboard', action: 'view' } },
];

const masterData = [
  { name: 'Manajemen Akun', href: '/dashboard/master-data/account', icon: Users, permission: { module: 'masterData', action: 'view_account' } },
  // Href sama dengan "Manajemen Akun" di atas — halaman itu sendiri
  // membedakan tampilan lewat crossOrg (lihat
  // app/dashboard/master-data/account/page.tsx). De-dup di filter di
  // bawah mencegah dua entri identik kalau satu aktor kebetulan punya
  // kedua permission.
  { name: 'Staff Organisasi', href: '/dashboard/master-data/account', icon: Users, permission: { module: 'masterData', action: 'manage_org_staff' } },
  { name: 'Kelola Reviewer PGSOL', href: '/dashboard/master-data/project-pgsol-assign', icon: Users, permission: { module: 'jsa', action: 'manage_assignment_pgsol' } },
  { name: 'Role & Permission', href: '/dashboard/master-data/role', icon: Shield, permission: { module: 'masterData', action: 'manage_role' } },
  { name: 'News & Pengumuman', href: '/dashboard/master-data/announcement', icon: Megaphone, permission: { module: 'announcement', action: 'manage' } },
  { name: 'Data Vendor', href: '/dashboard/master-data/vendor', icon: Building2, permission: { module: 'masterData', action: 'view_vendor' } },
  { name: 'Data Proyek', href: '/dashboard/master-data/project', icon: Briefcase, permission: { module: 'masterData', action: 'view_project' } },
];

export function SidebarNav({
  userPermissions,
  isCollapsed,
  badges,
}: {
  userPermissions: Record<string, string[]>;
  isCollapsed?: boolean;
  badges?: SidebarBadges;
}) {
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

  const badgeCount = (badgeKey?: keyof SidebarBadges) => {
    if (!badgeKey || !badges) return 0;
    return badges[badgeKey] || 0;
  };

  const filteredMenuUtama = menuUtama.filter(item => hasAccess(item.permission.module, item.permission.action));
  const filteredMasterData = masterData
    .filter(item => hasAccess(item.permission.module, item.permission.action))
    // Manajemen Akun dan Staff Organisasi mengarah ke href yang sama —
    // hindari dua entri nav identik kalau satu aktor kebetulan punya
    // kedua permission (keeps the first match, i.e. "Manajemen Akun").
    .filter((item, idx, arr) => arr.findIndex(i => i.href === item.href) === idx);

  return (
    <nav className="flex-1 overflow-y-auto py-6 px-4 overflow-x-hidden">
      {!isCollapsed && <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase whitespace-nowrap">Menu Utama</div>}
      <ul className="space-y-1 mb-6">
        {filteredMenuUtama.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const count = badgeCount(item.badgeKey);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={isCollapsed ? item.name : undefined}
                className={`relative flex items-center rounded-xl py-3 text-sm transition-all ${
                  isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                } ${
                  active
                    ? 'font-bold bg-primary/20 text-white'
                    : 'font-semibold text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="relative shrink-0">
                  <Icon className={`h-5 w-5 ${active ? 'text-primary' : 'opacity-70'}`} />
                  {isCollapsed && count > 0 && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-slate-900" />
                  )}
                </span>
                {!isCollapsed && (
                  <>
                    <span className="whitespace-nowrap flex-1">{item.name}</span>
                    {count > 0 && (
                      <span className="shrink-0 min-w-[1.25rem] h-5 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold px-1.5">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {filteredMasterData.length > 0 && (
        <>
          {!isCollapsed && <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase whitespace-nowrap">Master Data</div>}
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
                        ? 'font-bold bg-primary/20 text-white'
                        : 'font-semibold text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-primary' : 'opacity-70'}`} />
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
