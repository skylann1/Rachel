"use client";

import React, { useState } from 'react';
import {
  User, Mail, Shield, Calendar, CheckCircle, Clock, AlertTriangle,
  Building, Building2, Phone, MapPin, Edit2, X, Save, Loader2,
  Briefcase, ShieldCheck, ShieldAlert, ShieldQuestion, ThumbsUp,
} from "lucide-react";
import { updateVendorProfile } from "@/app/actions/profile";
import { ChangePasswordCard } from "@/components/profile/change-password-card";

type VendorStats = {
  activeProjects: number;
  ptwApproved: number;
  pendingReview: number;
  incidents: number;
};

type VendorCompliance = {
  /** % of inspection findings that were positive (Safe Act/Condition). Null when there's no data yet. */
  rate: number | null;
  anomaliCount: number;
  positifCount: number;
  openAnomali: number;
  totalFindings: number;
};

type VendorData = {
  companyName: string;
  picName: string;
  phone: string;
  address: string;
  status: string;
  joinedDate: string;
};

const STATS = (stats: VendorStats) => [
  { label: 'Proyek Aktif', value: stats.activeProjects, icon: Briefcase, tone: 'text-blue-600 bg-blue-50' },
  { label: 'PTW Disetujui', value: stats.ptwApproved, icon: CheckCircle, tone: 'text-emerald-600 bg-emerald-50' },
  { label: 'Menunggu Review', value: stats.pendingReview, icon: Clock, tone: 'text-amber-600 bg-amber-50' },
  { label: 'Laporan Insiden', value: stats.incidents, icon: AlertTriangle, tone: 'text-rose-600 bg-rose-50' },
];

/** Grade tier for the compliance ring — higher positive-finding share is better. */
function complianceTone(rate: number | null) {
  if (rate === null) return { ring: 'text-slate-300', chip: 'text-slate-500 bg-slate-100 border-slate-200', label: 'Belum Ada Data', Icon: ShieldQuestion };
  if (rate >= 80) return { ring: 'text-emerald-400', chip: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Kepatuhan Baik', Icon: ShieldCheck };
  if (rate >= 50) return { ring: 'text-amber-400', chip: 'text-amber-700 bg-amber-50 border-amber-200', label: 'Perlu Perhatian', Icon: ShieldAlert };
  return { ring: 'text-rose-400', chip: 'text-rose-700 bg-rose-50 border-rose-200', label: 'Kepatuhan Rendah', Icon: ShieldAlert };
}

export function EditableVendorProfile({ user, initialVendorData, stats, compliance }: {
  user: any;
  initialVendorData: VendorData;
  stats: VendorStats;
  compliance: VendorCompliance;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState(initialVendorData.companyName);
  const [picName, setPicName] = useState(initialVendorData.picName);
  const [phone, setPhone] = useState(initialVendorData.phone);
  const [address, setAddress] = useState(initialVendorData.address);

  const handleCancel = () => {
    setCompanyName(initialVendorData.companyName);
    setPicName(initialVendorData.picName);
    setPhone(initialVendorData.phone);
    setAddress(initialVendorData.address);
    setError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!companyName.trim() || !picName.trim()) {
      setError("Nama perusahaan dan PIC tidak boleh kosong.");
      return;
    }
    setIsLoading(true);
    setError(null);
    const { error } = await updateVendorProfile({
      companyName: companyName.trim(),
      picName: picName.trim(),
      phone: phone.trim(),
      address: address.trim(),
    });
    setIsLoading(false);

    if (!error) {
      setIsEditing(false);
    } else {
      setError(error);
    }
  };

  const currentInitials = (companyName || 'Mitra Karya').substring(0, 2).toUpperCase();
  const isActive = initialVendorData.status !== 'Nonaktif';
  const tone = complianceTone(compliance.rate);
  // SVG ring geometry for the compliance gauge.
  const R = 42;
  const CIRC = 2 * Math.PI * R;
  const dash = compliance.rate === null ? 0 : (compliance.rate / 100) * CIRC;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-fade-up">

      {/* ================= CREDENTIAL CARD ================= */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl border border-slate-200 bg-white">
        <div className="relative px-6 sm:px-10 pt-8 pb-8 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-800 overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full bg-white opacity-10 blur-3xl" />
          <div className="absolute bottom-0 right-10 w-48 h-48 rounded-full bg-blue-400 opacity-20 blur-2xl" />

          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-5 text-center sm:text-left">
              <div className="relative shrink-0">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-white to-blue-50 border-4 border-white/80 shadow-2xl flex items-center justify-center text-blue-800 text-3xl font-black">
                  {currentInitials}
                </div>
                <div className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </div>

              <div>
                <div className="flex flex-col sm:flex-row items-center gap-2 mb-1.5">
                  <h1 className="text-2xl font-extrabold text-white tracking-tight">{companyName}</h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-bold text-white tracking-widest uppercase">
                    Mitra Vendor
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold ${isActive ? 'bg-emerald-400/15 text-emerald-300' : 'bg-slate-400/15 text-slate-300'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                    {isActive ? 'Akun Aktif' : 'Akun Nonaktif'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-blue-100 font-semibold">
                    <Calendar className="w-3 h-3" /> Bergabung {initialVendorData.joinedDate}
                  </span>
                </div>
              </div>
            </div>

            {/* Compliance gauge — vendor's own K3 compliance credential */}
            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 px-5 py-4">
              <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 100 100" className="w-20 h-20 -rotate-90">
                  <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r={R} fill="none" strokeWidth="8" strokeLinecap="round"
                    className={tone.ring} stroke="currentColor"
                    strokeDasharray={`${dash} ${CIRC}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-black text-white">{compliance.rate === null ? '—' : `${compliance.rate}%`}</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-blue-200 uppercase tracking-wider mb-1">Sertifikat Kepatuhan K3</div>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${tone.chip}`}>
                  <tone.Icon className="w-3.5 h-3.5" /> {tone.label}
                </div>
                <div className="text-[11px] text-blue-200 mt-1.5">
                  {compliance.totalFindings > 0
                    ? `${compliance.positifCount} positif / ${compliance.anomaliCount} anomali dari inspeksi`
                    : 'Belum ada temuan inspeksi tercatat'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Edit toggle bar */}
        <div className="flex items-center justify-end gap-2 px-6 sm:px-10 py-3 border-b border-slate-100 bg-slate-50/60">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit Profil
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" /> Batal
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-70"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Simpan Perubahan
              </button>
            </>
          )}
        </div>

        <div className="px-6 sm:px-10 py-8">
          {error && (
            <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left: Company details */}
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
                      className={`w-full bg-white border ${isEditing ? 'border-blue-400 ring-4 ring-blue-50' : 'border-slate-200 bg-slate-50'} rounded-xl px-4 py-3 text-sm font-bold text-slate-800 transition-all outline-none disabled:cursor-not-allowed`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Penanggung Jawab (PIC)</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={picName}
                        onChange={(e) => setPicName(e.target.value)}
                        disabled={!isEditing}
                        className={`w-full bg-white border ${isEditing ? 'border-blue-400 ring-4 ring-blue-50' : 'border-slate-200 bg-slate-50'} rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-slate-800 transition-all outline-none disabled:cursor-not-allowed`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nomor Telepon</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={!isEditing}
                        placeholder={isEditing ? 'Masukkan nomor telepon' : '—'}
                        className={`w-full bg-white border ${isEditing ? 'border-blue-400 ring-4 ring-blue-50' : 'border-slate-200 bg-slate-50'} rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-slate-800 transition-all outline-none disabled:cursor-not-allowed`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Alamat Lengkap</label>
                    <div className="relative">
                      <MapPin className="absolute top-3.5 left-3.5 w-4 h-4 text-slate-400" />
                      <textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        disabled={!isEditing}
                        rows={3}
                        className={`w-full bg-white border ${isEditing ? 'border-blue-400 ring-4 ring-blue-50' : 'border-slate-200 bg-slate-50'} rounded-xl pl-10 pr-4 py-3 text-sm font-medium text-slate-700 transition-all outline-none resize-none disabled:cursor-not-allowed`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Compliance breakdown */}
              <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                    <ThumbsUp className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 tracking-tight">Ringkasan Temuan Inspeksi K3</h3>
                </div>

                {compliance.totalFindings === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-xl bg-white">
                    Belum ada temuan inspeksi K3 yang tercatat untuk perusahaan Anda.
                  </p>
                ) : (
                  <>
                    <div className="w-full h-3 rounded-full bg-rose-100 overflow-hidden flex mb-4">
                      <div className="h-full bg-emerald-500" style={{ width: `${compliance.rate ?? 0}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded-xl border border-slate-100 p-3 text-center">
                        <div className="text-xl font-black text-emerald-600">{compliance.positifCount}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Temuan Positif</div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-100 p-3 text-center">
                        <div className="text-xl font-black text-rose-600">{compliance.anomaliCount}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Anomali</div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-100 p-3 text-center">
                        <div className="text-xl font-black text-amber-600">{compliance.openAnomali}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Belum Selesai</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right: Account & security */}
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
                        <Mail className="w-4 h-4 text-blue-300 shrink-0" />
                        <span className="font-medium text-sm truncate">{user.email}</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tanggal Bergabung</div>
                      <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3 border border-white/5">
                        <Calendar className="w-4 h-4 text-blue-300 shrink-0" />
                        <span className="font-medium text-sm">{initialVendorData.joinedDate}</span>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-white/10">
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Data profil ini digunakan untuk keperluan administrasi dan pencetakan dokumen K3. Pastikan data yang dimasukkan valid dan terkini.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <ChangePasswordCard />

              <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Terdaftar sebagai mitra vendor di Smart System K3 PGN. Skor kepatuhan dihitung dari proporsi temuan inspeksi positif terhadap seluruh temuan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= ACTIVITY STATS ================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS(stats).map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-blue-200 transition-colors group">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${s.tone}`}>
                <s.icon className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-800">{s.value}</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
