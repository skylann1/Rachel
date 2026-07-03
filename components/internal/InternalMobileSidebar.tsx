"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X, LogOut } from 'lucide-react';
import Image from "next/image";
import { SidebarNav } from "./sidebar-nav";

export function InternalMobileSidebar({ 
  userPermissions, 
  userEmail 
}: { 
  userPermissions: Record<string, string[]>;
  userEmail: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

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
          className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`fixed inset-y-0 left-0 z-[110] w-72 bg-white border-r shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Sidebar Header - Logos */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative h-6 w-20">
              <Image 
                src="/assets/logo/pertaminia-removebg-preview.png" 
                alt="Pertamina" 
                fill
                className="object-contain object-left"
              />
            </div>
            <div className="w-px h-6 bg-slate-300"></div>
            <div className="relative h-7 w-14">
              <Image 
                src="/assets/logo/pgn-logo.png" 
                alt="PGN" 
                fill
                className="object-contain object-left"
              />
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-slate-400 hover:bg-slate-100 rounded-md shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sidebar User Info */}
        <div className="px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner shrink-0">
              {userEmail?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-800 truncate">{userEmail || 'admin@pgn.co.id'}</p>
              <p className="text-xs text-slate-500 font-medium">HSE Manager</p>
            </div>
          </div>
        </div>

        {/* Navigation - Needs a wrapper that intercepts clicks */}
        <div onClick={handleLinkClick} className="flex-1 overflow-y-auto">
          <SidebarNav userPermissions={userPermissions} />
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-slate-100 shrink-0">
          <form method="POST" action="/api/auth/logout">
            <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">
              <LogOut className="h-5 w-5" />
              Keluar Sistem
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
        className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-md transition-colors mr-3"
        aria-label="Open Menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {mounted && createPortal(sidebarContent, document.body)}
    </>
  );
}
