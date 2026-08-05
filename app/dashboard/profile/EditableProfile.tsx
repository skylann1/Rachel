"use client";

import React, { useState } from 'react';
import { User, Mail, Shield, Building2, Calendar, FileText, CheckCircle, Clock, AlertTriangle, CreditCard, Edit2, X, Save, Loader2 } from "lucide-react";
import Image from "next/image";
import { updateUserMetadata } from "@/app/actions/profile";

export function EditableProfile({ user, initialUserData }: { user: any, initialUserData: any }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Local state for editable fields
  const [fullName, setFullName] = useState(initialUserData.fullName);

  const handleSave = async () => {
    setIsLoading(true);
    const { error } = await updateUserMetadata({
      full_name: fullName
    });
    
    setIsLoading(false);
    
    if (!error) {
      setIsEditing(false);
    } else {
      alert("Gagal memperbarui profil: " + error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      
      {/* Top Card: Banner + Avatar + Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
        {/* Banner */}
        <div className="relative h-[220px] w-full">
          <Image 
            src="/assets/banner/banner.png" 
            alt="Profile Banner" 
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Avatar and Header Info */}
        <div className="px-8 pb-8 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 -mt-16 mb-8">
            <div className="flex items-end gap-6">
              {/* Avatar Box overlapping the banner */}
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-blue-50 border-4 border-white flex items-center justify-center text-blue-600 text-4xl font-black shadow-md z-10 relative">
                  {fullName.charAt(0).toUpperCase() || 'A'}
                </div>
              </div>

              {/* Name & Role */}
              <div className="pb-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-black text-slate-800">{fullName}</h1>
                  <span className="px-2.5 py-0.5 rounded-full border border-slate-300 text-[10px] font-bold text-slate-700 tracking-wider">
                    INTERNAL
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 mt-1 font-medium">
                  <Shield className="w-4 h-4" />
                  <span>{initialUserData.role}</span>
                </div>
              </div>
            </div>
            
            {/* Joined Date Badge */}
            <div className="bg-slate-50 border border-slate-100 text-slate-600 rounded-xl px-5 py-3 flex items-center gap-4 shadow-sm pb-2 mb-2">
              <Calendar className="w-8 h-8 opacity-50" />
              <div>
                <div className="text-[10px] font-bold tracking-wider uppercase">Bergabung Sejak</div>
                <div className="text-lg font-black leading-none">{initialUserData.joinedDate}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Employee Profile Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-700" />
                  <h3 className="text-xs font-bold text-slate-700 tracking-wider uppercase">Data Pegawai</h3>
                </div>
                {!isEditing ? (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    EDIT
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      BATAL
                    </button>
                    <button 
                      onClick={handleSave}
                      disabled={isLoading}
                      className="flex items-center gap-1 text-xs font-bold bg-primary text-white px-2 py-1 rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      SIMPAN
                    </button>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {/* Full Name (Editable) */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="w-full">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Lengkap</div>
                    {isEditing ? (
                      <input 
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full mt-1 bg-white border border-slate-300 rounded px-2 py-1 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    ) : (
                      <div className="font-bold text-slate-800">{fullName}</div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NIK</div>
                      <div className="font-bold text-slate-800">{initialUserData.nik}</div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Departemen</div>
                      <div className="font-bold text-slate-800">HSE</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* System Account Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 h-[34px]">
                <Shield className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold text-slate-700 tracking-wider uppercase">Informasi Akun</h3>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Email (Read Only)</div>
                    <div className="font-bold text-slate-800 truncate" title={user.email}>{user.email}</div>
                  </div>
                </div>
                
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hak Akses</div>
                    <div className="font-bold text-slate-800">{initialUserData.role}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Stats Cards Row (Replaced with K3 Relevant Stats) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center justify-center gap-2 text-center">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mb-2">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="text-3xl font-black text-slate-800">5</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Proyek Aktif</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center justify-center gap-2 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 mb-2">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="text-3xl font-black text-slate-800">12</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">JSA Disetujui</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center justify-center gap-2 text-center">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-2">
            <Clock className="w-5 h-5" />
          </div>
          <div className="text-3xl font-black text-slate-800">3</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PTW Menunggu Review</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center justify-center gap-2 text-center">
          <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-2">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="text-3xl font-black text-slate-800">0</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Laporan Insiden</div>
        </div>
      </div>

    </div>
  );
}
