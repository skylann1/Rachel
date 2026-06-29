import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Shield, User, Mail, Building2, CheckCircle2 } from 'lucide-react';

// In a real app, you would fetch this data based on the params.id
const getMockAccount = (id: string) => ({
  id,
  name: 'Budi Santoso',
  email: 'budi.santoso@pertamina.com',
  role: 'Admin',
  status: 'Active',
  department: 'IT / Digital',
  phone: '0812-3456-7890'
});

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const account = getMockAccount(resolvedParams.id);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Section */}
      <div className="flex items-center gap-4">
        <Link 
          href="/dashboard/master-data/account"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Edit Akun</h1>
          <p className="text-sm text-slate-500 mt-1">Perbarui profil, hak akses, dan status pengguna.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <form className="divide-y divide-slate-100">
          
          {/* Profile Section */}
          <div className="p-6 sm:p-8">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-6">
              <User className="w-5 h-5 text-primary" />
              Informasi Profil
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Nama Lengkap</label>
                <input 
                  type="text" 
                  defaultValue={account.name}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                  <input 
                    type="email" 
                    defaultValue={account.email}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Nomor Telepon</label>
                <input 
                  type="text" 
                  defaultValue={account.phone}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Departemen / Vendor</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 className="w-4 h-4 text-slate-400" />
                  </div>
                  <input 
                    type="text" 
                    defaultValue={account.department}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Role & Access Section */}
          <div className="p-6 sm:p-8 bg-slate-50/50">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-6">
              <Shield className="w-5 h-5 text-primary" />
              Role & Hak Akses
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Role Pengguna</label>
                <select 
                  defaultValue={account.role}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all text-sm"
                >
                  <option value="Admin">Admin</option>
                  <option value="HSE Manager">HSE Manager</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Vendor">Vendor</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Menentukan hak akses menu dan fungsi dalam aplikasi.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Status Akun</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="status" 
                      value="Active"
                      defaultChecked={account.status === 'Active'}
                      className="text-primary focus:ring-primary/30 w-4 h-4"
                    />
                    <span className="text-sm text-slate-700 font-medium">Aktif</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="status" 
                      value="Inactive"
                      defaultChecked={account.status === 'Inactive'}
                      className="text-rose-500 focus:ring-rose-500/30 w-4 h-4"
                    />
                    <span className="text-sm text-slate-700 font-medium">Nonaktif</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="p-6 sm:p-8 flex items-center justify-end gap-3 bg-slate-50 border-t border-slate-200">
            <Link 
              href="/dashboard/master-data/account"
              className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Batal
            </Link>
            <button 
              type="button" 
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-sm shadow-primary/30"
            >
              <Save className="w-4 h-4" />
              Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
