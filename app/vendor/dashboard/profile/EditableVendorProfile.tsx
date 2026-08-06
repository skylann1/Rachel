"use client";

import React, { useState } from 'react';
import { User, Mail, Shield, BadgeCheck, Star, Calendar, FileText, CheckCircle, Clock, AlertTriangle, CreditCard, Building, Phone, MapPin, Edit2, X, Save, Loader2, Building2, Briefcase } from "lucide-react";
import Image from "next/image";
import { updateVendorProfile } from "@/app/actions/profile";

type VendorStats = {
  activeProjects: number;
  ptwApproved: number;
  pendingReview: number;
  incidents: number;
};

export function EditableVendorProfile({ user, initialVendorData, stats }: { user: any, initialVendorData: any, stats: VendorStats }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Local state for editable fields
  const [companyName, setCompanyName] = useState(initialVendorData.companyName);
  const [picName, setPicName] = useState(initialVendorData.picName);
  const [phone, setPhone] = useState(initialVendorData.phone);
  const [address, setAddress] = useState(initialVendorData.address);

  const handleSave = async () => {
    setIsLoading(true);
    const { error } = await updateVendorProfile({
      companyName: companyName,
      picName: picName,
      phone: phone,
      address: address
    });
    
    setIsLoading(false);
    
    if (!error) {
      setIsEditing(false);
    } else {
      alert("Gagal memperbarui profil: " + error);
    }
  };

  const currentInitials = (companyName || 'Mitra Karya').substring(0, 2).toUpperCase();

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      
      {/* Top Banner and Profile Info */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl border border-white/20 bg-white">
        {/* Abstract Premium Banner */}
        <div className="relative h-64 w-full bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-800 overflow-hidden">
          <div className="absolute inset-0 bg-[url('/assets/pattern-bg.svg')] opacity-20 mix-blend-overlay"></div>
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full bg-white opacity-10 blur-3xl"></div>
          <div className="absolute bottom-0 right-10 w-48 h-48 rounded-full bg-blue-400 opacity-20 blur-2xl"></div>
        </div>

        {/* Content Overlay */}
        <div className="px-6 sm:px-10 pb-10 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 -mt-20 mb-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
              {/* Floating Avatar */}
              <div className="relative group">
                <div className="w-36 h-36 rounded-2xl bg-gradient-to-br from-white to-blue-50 border-[6px] border-white shadow-2xl flex items-center justify-center text-blue-800 text-5xl font-black relative z-10 overflow-hidden transform transition-transform group-hover:scale-105">
                  <span className="drop-shadow-sm">{currentInitials}</span>
                  <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-colors"></div>
                </div>
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 w-8 h-8 rounded-full border-4 border-white z-20 flex items-center justify-center shadow-sm">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              </div>

              {/* Title & Badges */}
              <div className="pb-2 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center gap-3 mb-2">
                  <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">{companyName}</h1>
                  <span className="px-3 py-1 rounded-full bg-blue-100/80 border border-blue-200 text-[11px] font-bold text-blue-800 tracking-widest shadow-sm">
                    MITRA VENDOR
                  </span>
                </div>
                <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-500 font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 w-fit">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span className="text-sm">Terdaftar di Rachel Smart System</span>
                </div>
              </div>
            </div>

            {/* Action Buttons / Edit Toggle */}
            <div className="flex items-center gap-3 bg-white/50 backdrop-blur-md p-2 rounded-2xl border border-slate-100 shadow-sm">
              {!isEditing ? (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg active:scale-95"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Profil
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95"
                  >
                    <X className="w-4 h-4" />
                    Batal
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Simpan Perubahan
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Form Details */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                    <Building className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 tracking-tight">Detail Perusahaan</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nama Perusahaan</label>
                    <input 
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      disabled={!isEditing}
                      className={`w-full bg-white border ${isEditing ? 'border-blue-400 ring-4 ring-blue-50 focus:border-blue-500' : 'border-slate-200 opacity-90'} rounded-xl px-4 py-3 text-sm font-bold text-slate-800 transition-all outline-none`}
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Penanggung Jawab (PIC)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input 
                        type="text"
                        value={picName}
                        onChange={(e) => setPicName(e.target.value)}
                        disabled={!isEditing}
                        className={`w-full bg-white border ${isEditing ? 'border-blue-400 ring-4 ring-blue-50 focus:border-blue-500' : 'border-slate-200 opacity-90'} rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-slate-800 transition-all outline-none`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nomor Telepon</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input 
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={!isEditing}
                        className={`w-full bg-white border ${isEditing ? 'border-blue-400 ring-4 ring-blue-50 focus:border-blue-500' : 'border-slate-200 opacity-90'} rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-slate-800 transition-all outline-none`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Alamat Lengkap</label>
                    <div className="relative">
                      <div className="absolute top-3.5 left-3.5 flex items-start pointer-events-none text-slate-400">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <textarea 
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        disabled={!isEditing}
                        rows={3}
                        className={`w-full bg-white border ${isEditing ? 'border-blue-400 ring-4 ring-blue-50 focus:border-blue-500' : 'border-slate-200 opacity-90'} rounded-xl pl-10 pr-4 py-3 text-sm font-medium text-slate-700 transition-all outline-none resize-none`}
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Account & Security */}
            <div className="space-y-6">
              
              <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Shield className="w-24 h-24" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400" /> Keamanan Akun
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email Terdaftar</div>
                      <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3 border border-white/5">
                        <Mail className="w-4 h-4 text-blue-300" />
                        <span className="font-medium text-sm truncate">{user.email}</span>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tanggal Bergabung</div>
                      <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3 border border-white/5">
                        <Calendar className="w-4 h-4 text-blue-300" />
                        <span className="font-medium text-sm">{initialVendorData.joinedDate}</span>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-white/10">
                       <p className="text-xs text-slate-400 leading-relaxed">
                         Data profil ini digunakan untuk keperluan administrasi dan pencetakan dokumen K3. Pastikan data yang dimasukkan valid dan *up-to-date*.
                       </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-blue-200 transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-800">{stats.activeProjects}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Proyek Aktif</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-emerald-200 transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-800">{stats.ptwApproved}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">PTW Disetujui</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-amber-200 transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-800">{stats.pendingReview}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Menunggu Review</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-rose-200 transition-colors group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-800">{stats.incidents}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Insiden</div>
          </div>
        </div>
      </div>

    </div>
  );
}
