"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Menu, X, LayoutDashboard, FileSignature, LogOut, Briefcase, Users, Truck, AlertTriangle } from 'lucide-react';
import { usePathname } from 'next/navigation';

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

export function VendorMobileSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  const isActive = (href: string) => {
    if (href === '/vendor/dashboard') {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  const sidebarContent = (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`fixed inset-y-0 left-0 z-[110] w-72 bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out md:hidden flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-20 flex items-center justify-between px-5 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-950/50">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-black text-sm text-white tracking-tight leading-none">Portal Vendor</p>
              <p className="text-[10px] text-slate-400 font-bold mt-1.5 tracking-widest uppercase">SIPERMIT K3</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-slate-400 hover:bg-white/5 hover:text-white rounded-lg shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-5">
          <ul className="space-y-1 px-3">
            <li className="px-3 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Menu Utama
            </li>
            {menuUtama.map(item => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={handleLinkClick}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
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
                    {item.name}
                  </Link>
                </li>
              );
            })}

            {/* Divider */}
            <li className="pt-5 pb-2 px-3">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Data Master
              </div>
            </li>

            {masterData.map(item => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={handleLinkClick}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                      active
                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-950/40'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-3 border-t border-slate-800/80 shrink-0">
          <form method="POST" action="/auth/logout">
            <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors">
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors mr-2"
        aria-label="Open Menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {mounted && createPortal(sidebarContent, document.body)}
    </>
  );
}
