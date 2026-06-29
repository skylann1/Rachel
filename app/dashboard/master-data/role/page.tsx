"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Shield, Plus, Edit2, Trash2, Check, Settings2, Users, XCircle, ArrowRight } from 'lucide-react';

const mockRoles = [
  { 
    id: 1, 
    name: 'Super Admin', 
    usersCount: 2, 
    description: 'Akses penuh ke seluruh sistem dan konfigurasi.', 
    isSystem: true,
    permissions: {
      jsa: ['view', 'create', 'review', 'approve', 'delete'],
      masterData: ['view_vendor', 'manage_vendor', 'view_account', 'manage_account', 'manage_role'],
      project: ['view', 'manage']
    }
  },
  { 
    id: 2, 
    name: 'HSE Manager', 
    usersCount: 5, 
    description: 'Review dan approve/reject JSA serta laporan K3.', 
    isSystem: false,
    permissions: {
      jsa: ['view', 'review', 'approve'],
      masterData: ['view_vendor'],
      project: ['view']
    }
  },
  { 
    id: 3, 
    name: 'Project Manager (PM)', 
    usersCount: 8, 
    description: 'Validasi PTW dan kontrol vendor pada proyek terkait.', 
    isSystem: false,
    permissions: {
      jsa: ['view', 'approve'],
      masterData: ['view_vendor'],
      project: ['view', 'manage']
    }
  },
  { 
    id: 4, 
    name: 'Vendor', 
    usersCount: 120, 
    description: 'Submit JSA, PTW, dan update progres kerja.', 
    isSystem: true,
    permissions: {
      jsa: ['view', 'create'],
      masterData: [],
      project: ['view']
    }
  },
];

const allPermissionModules = {
  jsa: {
    title: 'Modul JSA',
    items: [
      { key: 'view', label: 'Melihat Daftar JSA' },
      { key: 'create', label: 'Membuat Pengajuan JSA Baru' },
      { key: 'review', label: 'Review JSA (HSE)' },
      { key: 'approve', label: 'Approve / Validasi PTW' },
      { key: 'delete', label: 'Menghapus Data JSA' },
    ]
  },
  masterData: {
    title: 'Master Data',
    items: [
      { key: 'view_vendor', label: 'Melihat Data Vendor' },
      { key: 'manage_vendor', label: 'Mengelola Data Vendor' },
      { key: 'view_account', label: 'Melihat Data Akun' },
      { key: 'manage_account', label: 'Mengelola Data Akun' },
      { key: 'manage_role', label: 'Mengelola Role & Permission' },
    ]
  },
  project: {
    title: 'Modul Proyek',
    items: [
      { key: 'view', label: 'Melihat Daftar Proyek' },
      { key: 'manage', label: 'Mengelola (Tambah/Edit) Proyek' },
    ]
  }
};

export default function RolePermissionPage() {
  const [selectedRoleId, setSelectedRoleId] = useState(2); // Default selected: HSE Manager

  const selectedRole = mockRoles.find(r => r.id === selectedRoleId) || mockRoles[0];

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Role & Permission</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola peran pengguna dan hak akses modul di dalam sistem.</p>
        </div>
        <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm shadow-primary/30">
          <Plus className="w-4 h-4" />
          Tambah Role Baru
        </button>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Roles List */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Daftar Peran (Roles)
            </h2>
            <span className="bg-slate-200 text-slate-700 py-1 px-2.5 rounded-lg text-xs font-bold">
              {mockRoles.length} Total Role
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-white">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Role</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Pengguna</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {mockRoles.map((role) => (
                  <tr 
                    key={role.id} 
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`cursor-pointer transition-colors group ${selectedRoleId === role.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-slate-50 border-l-2 border-l-transparent'}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div>
                          <div className={`text-sm font-bold flex items-center gap-2 ${selectedRoleId === role.id ? 'text-primary' : 'text-slate-900'}`}>
                            {role.name}
                            {role.isSystem && (
                              <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">System</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 max-w-sm truncate">{role.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-slate-600 font-medium bg-slate-100 px-2.5 py-1 rounded-lg w-fit">
                        <Users className="w-4 h-4 mr-1.5 text-slate-400" />
                        {role.usersCount}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className={`flex justify-end gap-2 transition-opacity ${selectedRoleId === role.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Edit Detail Role">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <Link href={`/dashboard/master-data/role/${role.id}`} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Kelola Permission" onClick={(e) => e.stopPropagation()}>
                          <Settings2 className="w-4 h-4" />
                        </Link>
                        {!role.isSystem && (
                          <button className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Hapus" onClick={(e) => e.stopPropagation()}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Permission Preview Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 h-fit sticky top-24">
          <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Preview Hak Akses</h3>
              <p className="text-xs text-slate-500 mt-1">Role: <span className="font-bold text-primary">{selectedRole.name}</span></p>
            </div>
          </div>

          <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
            {Object.entries(allPermissionModules).map(([moduleKey, moduleData]) => {
              const roleModulePerms = selectedRole.permissions[moduleKey as keyof typeof selectedRole.permissions] || [];
              
              // Only show module if there are items to show
              if (moduleData.items.length === 0) return null;

              return (
                <div key={moduleKey}>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-3">{moduleData.title}</p>
                  <ul className="space-y-2">
                    {moduleData.items.map((item) => {
                      const hasAccess = roleModulePerms.includes(item.key);
                      return (
                        <li key={item.key} className={`flex items-center text-sm px-3 py-2 rounded-lg border ${hasAccess ? 'bg-emerald-50 text-slate-700 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                          {hasAccess ? (
                            <Check className="w-4 h-4 text-emerald-600 mr-2 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-300 mr-2 flex-shrink-0" />
                          )}
                          <span className={hasAccess ? 'font-medium' : 'line-through'}>{item.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
          
          <Link href={`/dashboard/master-data/role/${selectedRole.id}`} className="mt-6 flex items-center justify-center gap-2 w-full bg-slate-100 hover:bg-primary/10 hover:text-primary text-slate-700 font-bold py-3 rounded-xl text-sm transition-colors border border-slate-200 hover:border-primary/30">
            Kelola Akses {selectedRole.name}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </div>
  );
}
