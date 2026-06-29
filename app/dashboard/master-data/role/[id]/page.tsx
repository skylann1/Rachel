import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Shield, Check, XCircle } from 'lucide-react';

const getMockRole = (id: string) => {
  // Simulate fetching from DB based on ID
  return {
    id,
    name: id === '2' ? 'HSE Manager' : 'Vendor',
    description: id === '2' ? 'Review dan approve/reject JSA serta laporan K3.' : 'Submit JSA, PTW, dan update progres kerja.',
    permissions: {
      jsa: id === '2' ? ['view', 'review', 'approve'] : ['view', 'create'],
      masterData: id === '2' ? ['view_vendor'] : [],
      project: id === '2' ? ['view'] : ['view']
    }
  };
};

const allPermissionModules = [
  {
    id: 'jsa',
    title: 'Modul JSA & PTW',
    description: 'Hak akses terkait manajemen Job Safety Analysis dan Surat Izin Kerja Aman.',
    items: [
      { key: 'view', label: 'Melihat Daftar JSA' },
      { key: 'create', label: 'Membuat Pengajuan JSA Baru' },
      { key: 'review', label: 'Review JSA (Tim HSE)' },
      { key: 'approve', label: 'Approve / Validasi PTW (Project Manager)' },
      { key: 'delete', label: 'Menghapus Data JSA' },
    ]
  },
  {
    id: 'masterData',
    title: 'Master Data',
    description: 'Akses ke data inti sistem seperti Akun, Role, dan Vendor.',
    items: [
      { key: 'view_vendor', label: 'Melihat Data Vendor' },
      { key: 'manage_vendor', label: 'Mengelola Data Vendor' },
      { key: 'view_account', label: 'Melihat Data Akun' },
      { key: 'manage_account', label: 'Mengelola Data Akun' },
      { key: 'manage_role', label: 'Mengelola Role & Permission' },
    ]
  },
  {
    id: 'project',
    title: 'Modul Proyek',
    description: 'Manajemen daftar proyek, lokasi, dan status pekerjaan.',
    items: [
      { key: 'view', label: 'Melihat Daftar Proyek' },
      { key: 'manage', label: 'Mengelola (Tambah/Edit) Proyek' },
    ]
  }
];

export default async function EditRolePermissionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const role = getMockRole(resolvedParams.id);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard/master-data/role"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Kelola Hak Akses Role</h1>
            <p className="text-sm text-slate-500 mt-1">Role: <span className="font-bold text-primary">{role.name}</span></p>
          </div>
        </div>
        <button 
          type="button" 
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-sm shadow-primary/30 w-full sm:w-auto justify-center"
        >
          <Save className="w-4 h-4" />
          Simpan Konfigurasi
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Role Identity Details (Readonly or Editable) */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            Informasi Role
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Nama Role</label>
              <input 
                type="text" 
                defaultValue={role.name}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Deskripsi</label>
              <input 
                type="text" 
                defaultValue={role.description}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              />
            </div>
          </div>
        </div>

        {/* Permissions Configuration List */}
        <div className="p-6">
          <h2 className="text-base font-bold text-slate-800 mb-6 border-b border-slate-100 pb-2">
            Konfigurasi Hak Akses (Permissions)
          </h2>

          <div className="space-y-8">
            {allPermissionModules.map((module) => {
              const roleModulePerms = role.permissions[module.id as keyof typeof role.permissions] || [];

              return (
                <div key={module.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{module.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{module.description}</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-200/50 px-2.5 py-1.5 rounded-lg transition-colors">
                      <input type="checkbox" className="w-4 h-4 rounded text-primary focus:ring-primary/30 border-slate-300" />
                      Pilih Semua
                    </label>
                  </div>
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {module.items.map((item) => {
                      const isChecked = roleModulePerms.includes(item.key);
                      return (
                        <label 
                          key={item.key} 
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isChecked ? 'bg-primary/5 border-primary/20' : 'hover:bg-slate-50 border-slate-100'}`}
                        >
                          <div className="flex h-5 items-center">
                            <input 
                              type="checkbox" 
                              defaultChecked={isChecked}
                              className="w-4 h-4 rounded text-primary focus:ring-primary/30 border-slate-300" 
                            />
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${isChecked ? 'text-primary' : 'text-slate-700'}`}>{item.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Izinkan aksi '{item.key}' pada {module.title}.</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
