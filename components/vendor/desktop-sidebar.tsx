"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileSignature, LogOut, Briefcase, ShieldAlert, Stamp, Users, Truck, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { logout } from "@/app/vendor/login/actions";

const menuUtama = [
  { name: 'Dashboard Vendor', href: '/vendor/dashboard', icon: LayoutDashboard },
  { name: 'Proyek Aktif', href: '/vendor/dashboard/projects', icon: Briefcase },
  { name: 'Inbox Temuan K3', href: '/vendor/dashboard/inspection', icon: AlertTriangle },
  { name: 'Laporan Insiden', href: '/vendor/dashboard/incident', icon: AlertTriangle, danger: true },
];

const masterData = [
  { name: 'Dokumen K3', href: '/vendor/dashboard/dokumen', icon: FileSignature },
  { name: 'Data Pekerja', href: '/vendor/dashboard/pekerja', icon: Users },
  { name: 'Data Peralatan', href: '/vendor/dashboard/peralatan', icon: Truck },
];

export function VendorDesktopSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/vendor/dashboard') {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  return (
    <aside className={`flex-shrink-0 border-r bg-card flex flex-col hidden md:flex transition-all duration-300 relative ${isCollapsed ? 'w-20' : 'w-64'}`}>
      
      {/* Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 bg-white border border-slate-200 rounded-full p-1 z-50 hover:bg-slate-50 text-slate-500 shadow-sm transition-transform"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className={`h-16 flex items-center border-b overflow-hidden ${isCollapsed ? 'justify-center' : 'px-6'}`}>
        <Briefcase className="h-6 w-6 text-primary shrink-0" />
        {!isCollapsed && <span className="font-bold text-lg text-primary tracking-tight ml-2 whitespace-nowrap">Portal Vendor</span>}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 overflow-x-hidden">
        <ul className="space-y-1 px-3">
          {menuUtama.map(item => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link 
                  href={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={`flex items-center rounded-md py-2 text-sm font-medium transition-colors ${
                    isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                  } ${
                    active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  } ${item.danger && !active ? 'text-rose-500 hover:text-rose-600' : ''}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${item.danger ? 'text-rose-500' : ''}`} />
                  {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                </Link>
              </li>
            );
          })}
          
          {/* Divider */}
          <li className="pt-4 pb-2">
            {!isCollapsed ? (
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-3 whitespace-nowrap">
                Data Master
              </div>
            ) : (
              <div className="mx-auto w-8 border-t border-border"></div>
            )}
          </li>

          {masterData.map(item => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link 
                  href={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={`flex items-center rounded-md py-2 text-sm font-medium transition-colors ${
                    isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                  } ${
                    active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t overflow-hidden">
        <form action={logout}>
          <button 
            title={isCollapsed ? "Keluar" : undefined}
            className={`flex w-full items-center rounded-md py-2 text-sm font-medium text-destructive hover:bg-destructive/10 ${
              isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap">Keluar</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}
