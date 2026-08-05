"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { SidebarNav } from "./sidebar-nav";
import { logout } from "@/app/auth/login/actions";
import { LogOut, ChevronLeft, ChevronRight } from "lucide-react";

export function DesktopSidebar({ user, permissions }: { user: any, permissions: any }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`flex-shrink-0 bg-white border-r border-slate-200 flex flex-col hidden lg:flex shadow-sm z-20 transition-all duration-300 relative ${isCollapsed ? 'w-20' : 'w-72'}`}>
      
      {/* Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 bg-white border border-slate-200 rounded-full p-1 z-50 hover:bg-slate-50 text-slate-500 shadow-sm transition-transform"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Sidebar Header - Logos */}
      <div className="h-20 flex items-center justify-center border-b border-slate-100 overflow-hidden">
        {isCollapsed ? (
           <div className="font-bold text-xl text-primary">R</div>
        ) : (
          <div className="relative h-8 w-32">
            <Image 
              src="/assets/logo/main-logo.png" 
              alt="Main Logo" 
              fill
              className="object-contain object-center"
            />
          </div>
        )}
      </div>

      {/* Sidebar User Info */}
      <Link href="/dashboard/profile" className={`py-5 border-b border-slate-100 flex items-center justify-center overflow-hidden transition-all hover:bg-slate-50 cursor-pointer ${isCollapsed ? 'px-2' : 'px-6'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 w-full'}`}>
          <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner">
            {user?.email?.charAt(0).toUpperCase() || 'A'}
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden whitespace-nowrap">
              <p className="text-sm font-bold text-slate-800 truncate">{user?.email || 'admin@pgn.co.id'}</p>
              <p className="text-xs text-slate-500 font-medium">HSE Manager</p>
            </div>
          )}
        </div>
      </Link>

      {/* Navigation */}
      <SidebarNav userPermissions={permissions || {}} isCollapsed={isCollapsed} />

      {/* Logout */}
      <div className="p-4 border-t border-slate-100 mt-auto overflow-hidden">
        <form action={logout}>
          <button className={`flex w-full items-center rounded-xl py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'}`}>
            <LogOut className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap">Keluar Sistem</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}
