"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Menu, X, LayoutDashboard, FileSignature, LogOut, Briefcase, ShieldAlert, Stamp, Users, Truck, AlertTriangle } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function VendorMobileSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper to close sidebar when navigating
  const handleLinkClick = () => {
    setIsOpen(false);
  };

  const sidebarContent = (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`fixed inset-y-0 left-0 z-[110] w-72 bg-card border-r shadow-2xl transform transition-transform duration-300 ease-in-out md:hidden flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b shrink-0">
          <div className="flex items-center">
            <Briefcase className="h-6 w-6 text-primary mr-2" />
            <span className="font-bold text-lg text-primary tracking-tight">Portal Vendor</span>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-muted-foreground hover:bg-accent rounded-md shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            <li>
              <Link href="/vendor/dashboard" onClick={handleLinkClick} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-foreground">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard Vendor
              </Link>
            </li>
            <li>
              <Link href="/vendor/dashboard/projects" onClick={handleLinkClick} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                Proyek Aktif
              </Link>
            </li>

            <li>
              <Link href="/vendor/dashboard/inspection" onClick={handleLinkClick} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                Inbox Temuan K3
              </Link>
            </li>
            <li>
              <Link href="/vendor/dashboard/incident" onClick={handleLinkClick} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground">
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
              <Link href="/vendor/dashboard/dokumen" onClick={handleLinkClick} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground">
                <FileSignature className="h-4 w-4" />
                Dokumen K3
              </Link>
            </li>
            <li>
              <Link href="/vendor/dashboard/pekerja" onClick={handleLinkClick} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground">
                <Users className="h-4 w-4" />
                Data Pekerja
              </Link>
            </li>
            <li>
              <Link href="/vendor/dashboard/peralatan" onClick={handleLinkClick} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground">
                <Truck className="h-4 w-4" />
                Data Peralatan
              </Link>
            </li>
          </ul>
        </nav>
        
        <div className="p-4 border-t shrink-0">
          {/* Note: In a client component, form actions to server actions can be tricky.
              We can just use a standard POST request to the logout route or redirect. */}
          <form method="POST" action="/auth/logout">
            <button type="submit" className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10">
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
        className="md:hidden p-2 text-muted-foreground hover:bg-accent rounded-md transition-colors mr-3"
        aria-label="Open Menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {mounted && createPortal(sidebarContent, document.body)}
    </>
  );
}
