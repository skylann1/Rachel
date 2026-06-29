import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Building2, Phone, Mail, MapPin, FileText, CheckCircle2, AlertTriangle, Briefcase } from 'lucide-react';

const getMockVendor = (id: string) => {
  return {
    id,
    name: 'PT. Konstruksi Sejahtera',
    pic: 'Budi Santoso',
    phone: '0812-3456-7890',
    email: 'contact@konstruksi-sejahtera.com',
    address: 'Jl. Jendral Sudirman No. 45, Jakarta Pusat, 10220',
    status: 'Verified',
    csmsScore: '85 (Baik)',
    projects: 3,
    joinDate: '2024-01-15'
  };
};

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const vendor = getMockVendor(resolvedParams.id);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard/master-data/vendor"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Profil Vendor</h1>
            <p className="text-sm text-slate-500 mt-1">Kelola data perusahaan mitra, kontak, dan status K3 (CSMS).</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Vendor Summary Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
              <Building2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">{vendor.name}</h2>
            <p className="text-sm font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full mt-2">ID: {vendor.id}</p>
            
            <div className="w-full h-px bg-slate-100 my-6"></div>
            
            <div className="w-full space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Status CSMS</span>
                {vendor.status === 'Verified' ? (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                    <AlertTriangle className="w-3.5 h-3.5" /> Pending
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Nilai K3</span>
                <span className="font-bold text-slate-800">{vendor.csmsScore}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Proyek Aktif</span>
                <span className="font-bold text-primary flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" /> {vendor.projects}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Bergabung</span>
                <span className="font-bold text-slate-800">{vendor.joinDate}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              Dokumen CSMS
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 border border-slate-100 rounded-xl bg-slate-50">
                <span className="text-sm text-slate-600 font-medium truncate">Profil_Perusahaan.pdf</span>
                <button className="text-xs font-bold text-primary hover:underline">Unduh</button>
              </div>
              <div className="flex justify-between items-center p-3 border border-slate-100 rounded-xl bg-slate-50">
                <span className="text-sm text-slate-600 font-medium truncate">Sertifikat_K3.pdf</span>
                <button className="text-xs font-bold text-primary hover:underline">Unduh</button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Form */}
        <div className="lg:col-span-2">
          <form className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-6 sm:p-8 flex-1">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-6">
                <Building2 className="w-5 h-5 text-primary" />
                Informasi Perusahaan
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Nama Perusahaan</label>
                  <input 
                    type="text" 
                    defaultValue={vendor.name}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Person In Charge (PIC)</label>
                  <input 
                    type="text" 
                    defaultValue={vendor.pic}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Email Utama</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="w-4 h-4 text-slate-400" />
                    </div>
                    <input 
                      type="email" 
                      defaultValue={vendor.email}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Nomor Telepon</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="w-4 h-4 text-slate-400" />
                    </div>
                    <input 
                      type="text" 
                      defaultValue={vendor.phone}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Alamat Lengkap</label>
                  <div className="relative">
                    <div className="absolute top-3 left-3 pointer-events-none">
                      <MapPin className="w-4 h-4 text-slate-400" />
                    </div>
                    <textarea 
                      defaultValue={vendor.address}
                      rows={3}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                    />
                  </div>
                </div>
              </div>

              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-6 pt-6 border-t border-slate-100">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Validasi K3 (CSMS)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Status Vendor</label>
                  <select 
                    defaultValue={vendor.status}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm font-medium"
                  >
                    <option value="Verified">Lulus (Verified)</option>
                    <option value="Pending Review">Evaluasi Dokumen (Pending)</option>
                    <option value="Suspended">Ditangguhkan (Suspended)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Nilai CSMS</label>
                  <input 
                    type="text" 
                    defaultValue={vendor.csmsScore}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="p-6 flex items-center justify-end gap-3 bg-slate-50 border-t border-slate-200 mt-auto">
              <Link 
                href="/dashboard/master-data/vendor"
                className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Batal
              </Link>
              <button 
                type="button" 
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-sm shadow-primary/30"
              >
                <Save className="w-4 h-4" />
                Update Profil Vendor
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
