"use client";

import React, { useState } from 'react';
import {
  User, Mail, Shield, Calendar, CheckCircle, Clock, AlertTriangle,
  Building2, Edit2, X, Save, Loader2, Fingerprint, ScanLine, IdCard,
} from "lucide-react";
import { updateInternalProfile } from "@/app/actions/profile";
import { ChangePasswordCard } from "@/components/profile/change-password-card";

type ProfileStats = {
  activeProjects: number;
  jsaApproved: number;
  ptwWaiting: number;
  incidents: number;
};

type InternalUserData = {
  fullName: string;
  role: string;
  nip: string;
  joinedDate: string;
};

const STATS = (stats: ProfileStats) => [
  { label: 'Proyek Aktif', value: stats.activeProjects, icon: Building2, tone: 'text-blue-600 bg-blue-50' },
  { label: 'JSA Disetujui', value: stats.jsaApproved, icon: CheckCircle, tone: 'text-emerald-600 bg-emerald-50' },
  { label: 'PTW Menunggu', value: stats.ptwWaiting, icon: Clock, tone: 'text-amber-600 bg-amber-50' },
  { label: 'Laporan Insiden', value: stats.incidents, icon: AlertTriangle, tone: 'text-rose-600 bg-rose-50' },
];

export function EditableProfile({ user, initialUserData, stats }: { user: any, initialUserData: InternalUserData, stats: ProfileStats }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(initialUserData.fullName);
  const [nip, setNip] = useState(initialUserData.nip);

  const handleCancel = () => {
    setFullName(initialUserData.fullName);
    setNip(initialUserData.nip);
    setError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError("Nama lengkap tidak boleh kosong");
      return;
    }
    setIsLoading(true);
    setError(null);
    const { error } = await updateInternalProfile({ fullName: fullName.trim(), nip: nip.trim() });
    setIsLoading(false);

    if (!error) {
      setIsEditing(false);
    } else {
      setError(error);
    }
  };

  const initial = fullName.charAt(0).toUpperCase() || 'A';
  const idNumber = (user.id as string).replace(/-/g, '').slice(0, 12).toUpperCase();

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-fade-up">
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">

        {/* ================= ID BADGE ================= */}
        <div className="lg:sticky lg:top-6">
          <div className="relative bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">

            {/* Lanyard clip */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-2.5 w-14 h-5 rounded-full bg-slate-300 border border-slate-400/50 z-20" />

            {/* Header stripe */}
            <div className="relative h-16 bg-gradient-to-r from-primary to-blue-600 flex items-center justify-center">
              <span className="text-white text-[11px] font-bold tracking-[0.2em] uppercase">Kartu Identitas Internal</span>
            </div>

            {/* Punch hole */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[52px] w-6 h-6 rounded-full bg-slate-50 border border-slate-200 z-20" />

            {/* Avatar + identity */}
            <div className="pt-9 pb-6 px-6 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-50 to-white border-4 border-white shadow-md ring-1 ring-slate-200 flex items-center justify-center text-primary text-3xl font-black">
                {initial}
              </div>
              <h1 className="mt-4 text-xl font-black text-slate-800 leading-tight">{fullName}</h1>
              <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-[11px] font-bold text-primary tracking-wide uppercase">
                <Shield className="w-3 h-3" />
                {initialUserData.role}
              </span>

              <div className="flex items-center gap-1.5 mt-3 text-emerald-600 text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Akun Aktif
              </div>
            </div>

            {/* Perforated divider */}
            <div className="relative px-4">
              <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-50 border border-slate-200" />
              <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-50 border border-slate-200" />
              <div className="border-t border-dashed border-slate-300" />
            </div>

            {/* Detail rows */}
            <div className="p-6 space-y-3 text-left">
              <div className="flex items-center gap-3">
                <Fingerprint className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NIP</div>
                  <div className="font-mono text-sm font-bold text-slate-700 truncate">{nip || '—'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</div>
                  <div className="text-sm font-bold text-slate-700 truncate" title={user.email}>{user.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bergabung</div>
                  <div className="text-sm font-bold text-slate-700 truncate">{initialUserData.joinedDate}</div>
                </div>
              </div>
            </div>

            {/* Barcode footer */}
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between gap-3">
              <div className="flex items-end gap-[2px] h-6" aria-hidden>
                {Array.from({ length: 28 }).map((_, i) => (
                  <span
                    key={i}
                    className="bg-slate-400"
                    style={{ width: (i * 7) % 3 === 0 ? 2 : 1, height: `${40 + ((i * 37) % 60)}%` }}
                  />
                ))}
              </div>
              <span className="font-mono text-[10px] text-slate-400 tracking-wider shrink-0">{idNumber}</span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN ================= */}
        <div className="space-y-6">

          {/* Data Diri (editable) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <IdCard className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-slate-800">Data Diri</h3>
              </div>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  EDIT
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    BATAL
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 text-xs font-bold bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    SIMPAN
                  </button>
                </div>
              )}
            </div>

            <div className="p-6">
              {error && (
                <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nama Lengkap</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={!isEditing}
                      className={`w-full bg-white border ${isEditing ? 'border-primary ring-4 ring-blue-50' : 'border-slate-200 bg-slate-50'} rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-slate-800 transition-all outline-none disabled:cursor-not-allowed`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">NIP</label>
                  <div className="relative">
                    <Fingerprint className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      disabled={!isEditing}
                      placeholder={isEditing ? 'Masukkan NIP' : '—'}
                      className={`w-full bg-white border ${isEditing ? 'border-primary ring-4 ring-blue-50' : 'border-slate-200 bg-slate-50'} rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-slate-800 transition-all outline-none disabled:cursor-not-allowed`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Hak Akses</label>
                  <div className="relative">
                    <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={initialUserData.role}
                      disabled
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-slate-500 outline-none cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ChangePasswordCard />

          {/* Ringkasan Aktivitas */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
              <ScanLine className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-slate-800">Ringkasan Aktivitas K3</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
              {STATS(stats).map((s) => (
                <div key={s.label} className="p-5 flex flex-col items-center text-center gap-2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.tone}`}>
                    <s.icon className="w-[18px] h-[18px]" />
                  </div>
                  <div className="text-2xl font-black text-slate-800">{s.value}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
