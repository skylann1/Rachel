"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileSignature, LogOut, Briefcase, Users, Truck, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
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
    <aside className={`flex-shrink-0 bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800 flex flex-col hidden md:flex shadow-xl z-20 transition-all duration-300 relative ${isCollapsed ? 'w-20' : 'w-64'}`}>

      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 bg-white border border-slate-200 rounded-full p-1 z-50 hover:bg-slate-50 text-slate-500 shadow-sm transition-transform"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Brand */}
      <div className={`h-20 flex items-center border-b border-slate-800/80 overflow-hidden ${isCollapsed ? 'justify-center' : 'px-5 gap-3'}`}>
        <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-950/50">
          <Briefcase className="h-5 w-5 text-white" />
        </div>
        {!isCollapsed && (
          <div className="overflow-hidden whitespace-nowrap">
            <p className="font-black text-sm text-white tracking-tight leading-none">Portal Vendor</p>
            <p className="text-[10px] text-slate-400 font-bold mt-1.5 tracking-widest uppercase">SIPERMIT K3</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-5 overflow-x-hidden">
        <ul className="space-y-1 px-3">
          {!isCollapsed && (
            <li className="px-3 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
              Menu Utama
            </li>
          )}
          {menuUtama.map(item => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={`flex items-center rounded-xl py-2.5 text-sm font-semibold transition-all ${
                    isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                  } ${
                    active
                      ? item.danger
                        ? 'bg-rose-500/15 text-rose-400'
                        : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-950/40'
                      : item.danger
                        ? 'text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-400'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                </Link>
              </li>
            );
          })}

          {/* Divider */}
          <li className="pt-5 pb-2">
            {!isCollapsed ? (
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 whitespace-nowrap">
                Data Master
              </div>
            ) : (
              <div className="mx-auto w-8 border-t border-slate-800"></div>
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
                  className={`flex items-center rounded-xl py-2.5 text-sm font-semibold transition-all ${
                    isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                  } ${
                    active
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-950/40'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
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

      <div className="p-3 border-t border-slate-800/80 overflow-hidden">
        <form action={logout}>
          <button
            title={isCollapsed ? "Keluar" : undefined}
            className={`flex w-full items-center rounded-xl py-2.5 text-sm font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors ${
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
