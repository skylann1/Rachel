"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CheckCircle, FileSignature, Users, Shield, Building2, Briefcase, ClipboardList, Camera, AlertTriangle } from 'lucide-react';

const menuUtama = [
  { name: 'Dashboard Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Inspeksi & Temuan K3', href: '/dashboard/inspection', icon: Camera },
  { name: 'Laporan Insiden', href: '/dashboard/incident', icon: AlertTriangle },
  { name: 'Review JSA (HSE)', href: '/dashboard/jsa-review', icon: CheckCircle },
  { name: 'Validasi PTW (PM)', href: '/dashboard/approval', icon: FileSignature },
];

const masterData = [
  { name: 'Manajemen Akun', href: '/dashboard/master-data/account', icon: Users },
  { name: 'Role & Permission', href: '/dashboard/master-data/role', icon: Shield },
  { name: 'Data Vendor', href: '/dashboard/master-data/vendor', icon: Building2 },
  { name: 'Data Proyek', href: '/dashboard/master-data/project', icon: Briefcase },
];

export function SidebarNav() {
  const pathname = usePathname();

  // Helper to check if a path is active
  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname?.startsWith(href);
  };

  return (
    <nav className="flex-1 overflow-y-auto py-6 px-4">
      <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">Menu Utama</div>
      <ul className="space-y-1 mb-6">
        {menuUtama.map((item) => {
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

      <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">Master Data</div>
      <ul className="space-y-1">
        {masterData.map((item) => {
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
    </nav>
  );
}
